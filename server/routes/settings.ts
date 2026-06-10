import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, adminOrSuperuser, AuthRequest } from '../middleware/auth';
import { logAudit } from '../lib/audit';
import { emailLayout } from '../lib/email';
import { getEmailSettings, isEmailConfigured, sendMail, verifyConnection, EmailMethod } from '../lib/mailer';

const router = Router();

const MASK = '••••••••';

// GET /api/settings/email — configuratie-status + waarden (secrets gemaskeerd)
router.get('/email', authMiddleware, adminOrSuperuser, async (_req: AuthRequest, res: Response) => {
  const s = await getEmailSettings();
  res.json({
    configured: isEmailConfigured(s),
    method: s.method,
    smtpHost: s.host,
    smtpPort: s.port,
    smtpUser: s.user,
    smtpPass: s.pass ? MASK : '',
    graphTenantId: s.tenantId,
    graphClientId: s.clientId,
    graphClientSecret: s.clientSecret ? MASK : '',
    fromEmail: s.fromEmail,
    fromName: s.fromName,
  });
});

// PUT /api/settings/email — verzendmethode + bijbehorende instellingen
router.put('/email', authMiddleware, adminOrSuperuser, async (req: AuthRequest, res: Response) => {
  const {
    method, smtpHost, smtpPort, smtpUser, smtpPass,
    graphTenantId, graphClientId, graphClientSecret,
    fromEmail, fromName,
  } = req.body;
  const m: EmailMethod = method === 'graph' ? 'graph' : 'smtp';

  if (!fromEmail) {
    res.status(400).json({ error: 'Afzender e-mail is verplicht' });
    return;
  }
  if (m === 'smtp' && (!smtpHost || !smtpUser)) {
    res.status(400).json({ error: 'SMTP host en gebruiker zijn verplicht' });
    return;
  }
  if (m === 'graph' && (!graphTenantId || !graphClientId)) {
    res.status(400).json({ error: 'Tenant-ID en Client-ID zijn verplicht' });
    return;
  }

  const settings: Record<string, string> = {
    emailMethod: m,
    smtpHost: smtpHost || '',
    smtpPort: String(smtpPort || 587),
    smtpUser: smtpUser || '',
    graphTenantId: graphTenantId || '',
    graphClientId: graphClientId || '',
    emailFromAddress: fromEmail,
    emailFromName: fromName || '',
  };
  // Secrets alleen bijwerken als er een nieuwe waarde is (niet de masker-placeholder)
  if (smtpPass && smtpPass !== MASK) settings.smtpPass = smtpPass;
  if (graphClientSecret && graphClientSecret !== MASK) settings.graphClientSecret = graphClientSecret;

  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }

  await logAudit('UPDATE', 'Setting', 0, { method: m, fromEmail }, req.adminUsername);
  res.json({ success: true });
});

// POST /api/settings/email/test-connection — controleer alleen de verbinding/credentials
router.post('/email/test-connection', authMiddleware, adminOrSuperuser, async (_req: AuthRequest, res: Response) => {
  try {
    await verifyConnection();
    res.json({ success: true });
  } catch (err: any) {
    console.error('Email connection test failed:', err);
    res.status(400).json({ error: err.message || 'Verbinding mislukt' });
  }
});

// POST /api/settings/email/test — stuur een test-e-mail via de gekozen methode
router.post('/email/test', authMiddleware, adminOrSuperuser, async (req: AuthRequest, res: Response) => {
  const s = await getEmailSettings();
  if (!isEmailConfigured(s)) {
    res.status(400).json({ error: 'E-mail is niet volledig geconfigureerd' });
    return;
  }

  const { testEmail } = req.body;
  if (!testEmail) {
    res.status(400).json({ error: 'Test e-mailadres is verplicht' });
    return;
  }

  const methodLabel = s.method === 'graph' ? 'Microsoft 365 (Graph)' : 'SMTP';

  try {
    await sendMail({
      to: testEmail,
      subject: 'Megawatt Dashboard — Test e-mail',
      html: emailLayout('Test e-mail', `
        <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;margin:0 0 20px">
          De e-mailconfiguratie van het Megawatt Dashboard werkt correct.
          Je ontvangt dit bericht als bevestiging dat verzending via ${methodLabel} succesvol is.
        </p>
        <div style="background:rgba(45,212,191,0.1);border:1px solid rgba(45,212,191,0.3);border-radius:10px;padding:14px 16px;margin-bottom:20px">
          <p style="margin:0;color:#2dd4bf;font-size:13px;font-weight:600">✓ Verbinding via ${methodLabel} geslaagd</p>
        </div>
        <p style="color:rgba(255,255,255,0.35);font-size:12px;margin:0">
          Verstuurd vanuit Admin → Instellingen → E-mail test
        </p>
      `),
    });

    await logAudit('CREATE', 'Email', 0, { action: 'test', to: testEmail, method: s.method }, req.adminUsername);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Test email failed:', err);
    res.status(500).json({ error: err.message || 'E-mail verzenden mislukt' });
  }
});

export default router;
