import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import { authMiddleware, adminOrSuperuser, AuthRequest } from '../middleware/auth';
import { logAudit } from '../lib/audit';
import { emailLayout } from '../lib/email';

const router = Router();
const prisma = new PrismaClient();

async function getSmtpSettings() {
  const keys = ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPass', 'emailFromAddress', 'emailFromName'];
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    host: map.smtpHost || '',
    port: Number(map.smtpPort) || 587,
    user: map.smtpUser || '',
    pass: map.smtpPass || '',
    fromEmail: map.emailFromAddress || '',
    fromName: map.emailFromName || '',
  };
}

// GET /api/settings/email — email configuration status + values
router.get('/email', authMiddleware, adminOrSuperuser, async (_req: AuthRequest, res: Response) => {
  const smtp = await getSmtpSettings();

  res.json({
    configured: !!(smtp.host && smtp.user && smtp.pass && smtp.fromEmail),
    smtpHost: smtp.host,
    smtpPort: smtp.port,
    smtpUser: smtp.user,
    smtpPass: smtp.pass ? '••••••••' : '',
    fromEmail: smtp.fromEmail,
    fromName: smtp.fromName,
  });
});

// PUT /api/settings/email — update SMTP + sender settings
router.put('/email', authMiddleware, adminOrSuperuser, async (req: AuthRequest, res: Response) => {
  const { smtpHost, smtpPort, smtpUser, smtpPass, fromEmail, fromName } = req.body;

  if (!smtpHost || !smtpUser || !fromEmail) {
    res.status(400).json({ error: 'SMTP host, gebruiker en afzender e-mail zijn verplicht' });
    return;
  }

  const settings: Record<string, string> = {
    smtpHost,
    smtpPort: String(smtpPort || 587),
    smtpUser,
    emailFromAddress: fromEmail,
    emailFromName: fromName || '',
  };

  // Only update password if a new one was provided (not the masked placeholder)
  if (smtpPass && smtpPass !== '••••••••') {
    settings.smtpPass = smtpPass;
  }

  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  await logAudit('UPDATE', 'Setting', 0, { smtpHost, smtpUser, fromEmail, fromName }, req.adminUsername);
  res.json({ success: true });
});

// POST /api/settings/email/test — send a test email
router.post('/email/test', authMiddleware, adminOrSuperuser, async (req: AuthRequest, res: Response) => {
  const smtp = await getSmtpSettings();

  if (!smtp.host || !smtp.user || !smtp.pass) {
    res.status(400).json({ error: 'SMTP is niet volledig geconfigureerd' });
    return;
  }

  const { testEmail } = req.body;
  if (!testEmail) {
    res.status(400).json({ error: 'Test e-mailadres is verplicht' });
    return;
  }

  if (!smtp.fromEmail) {
    res.status(400).json({ error: 'Stel eerst een afzender e-mailadres in' });
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: { user: smtp.user, pass: smtp.pass },
    });

    await transporter.sendMail({
      from: smtp.fromName ? `"${smtp.fromName}" <${smtp.fromEmail}>` : smtp.fromEmail,
      to: testEmail,
      subject: 'Megawatt Dashboard — Test e-mail',
      html: emailLayout('Test e-mail', `
        <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;margin:0 0 20px">
          De e-mailconfiguratie van het Megawatt Dashboard werkt correct.
          Je ontvangt dit bericht als bevestiging dat verzending via SMTP succesvol is.
        </p>
        <div style="background:rgba(45,212,191,0.1);border:1px solid rgba(45,212,191,0.3);border-radius:10px;padding:14px 16px;margin-bottom:20px">
          <p style="margin:0;color:#2dd4bf;font-size:13px;font-weight:600">✓ SMTP-verbinding geslaagd</p>
        </div>
        <p style="color:rgba(255,255,255,0.35);font-size:12px;margin:0">
          Verstuurd vanuit Admin → Instellingen → E-mail test
        </p>
      `),
    });

    await logAudit('CREATE', 'Email', 0, { action: 'test', to: testEmail }, req.adminUsername);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Test email failed:', err);
    res.status(500).json({ error: err.message || 'E-mail verzenden mislukt' });
  }
});

export { getSmtpSettings };
export default router;
