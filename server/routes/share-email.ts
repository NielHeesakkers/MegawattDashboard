import { Router, Response } from 'express';
import nodemailer from 'nodemailer';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAudit } from '../lib/audit';
import { getSmtpSettings } from './settings';

const router = Router();

// POST /api/share-email — send PDF via email
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const smtp = await getSmtpSettings();

  if (!smtp.host || !smtp.user || !smtp.pass) {
    res.status(400).json({ error: 'SMTP is niet geconfigureerd. Stel dit in via Instellingen.' });
    return;
  }

  if (!smtp.fromEmail) {
    res.status(400).json({ error: 'E-mail afzender is niet geconfigureerd. Stel dit in via Instellingen.' });
    return;
  }

  const { to, subject, pdfBase64, fileName } = req.body;

  if (!to || !pdfBase64) {
    res.status(400).json({ error: 'Ontvanger en PDF zijn verplicht' });
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    res.status(400).json({ error: 'Ongeldig e-mailadres' });
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: { user: smtp.user, pass: smtp.pass },
    });

    const emailSubject = subject || 'Megawatt Organigram';
    const attachmentName = fileName || 'MEGAWATT-Organigram.pdf';

    await transporter.sendMail({
      from: smtp.fromName ? `"${smtp.fromName}" <${smtp.fromEmail}>` : smtp.fromEmail,
      to,
      subject: emailSubject,
      text: 'Zie de bijlage voor het Megawatt organigram.',
      html: '<p>Zie de bijlage voor het <strong>Megawatt organigram</strong>.</p>',
      attachments: [
        {
          filename: attachmentName,
          content: Buffer.from(pdfBase64, 'base64'),
          contentType: 'application/pdf',
        },
      ],
    });

    await logAudit('CREATE', 'Email', 0, { action: 'share', to, subject: emailSubject }, req.adminUsername);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Share email failed:', err);
    res.status(500).json({ error: err.message || 'E-mail verzenden mislukt' });
  }
});

export default router;
