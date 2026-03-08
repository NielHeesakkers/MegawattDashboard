import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAudit } from '../lib/audit';

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
router.get('/email', authMiddleware, async (_req: AuthRequest, res: Response) => {
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
router.put('/email', authMiddleware, async (req: AuthRequest, res: Response) => {
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
router.post('/email/test', authMiddleware, async (req: AuthRequest, res: Response) => {
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
      subject: 'Megawatt Dashboard - Test e-mail',
      text: 'Dit is een test e-mail van het Megawatt Dashboard. De e-mail configuratie werkt correct.',
      html: '<p>Dit is een test e-mail van het <strong>Megawatt Dashboard</strong>.</p><p>De e-mail configuratie werkt correct.</p>',
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
