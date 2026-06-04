import { Router, Response } from 'express';
import nodemailer from 'nodemailer';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAudit } from '../lib/audit';
import { getSmtpSettings } from './settings';
import { emailLayout } from '../lib/email';

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
    const isKlantteams = (subject || '').toLowerCase().includes('klantteam');
    const title = isKlantteams ? 'Megawatt Klantteams' : 'Megawatt Organigram';
    const bodyHtml = emailLayout(title, `
      <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;margin:0 0 20px">
        ${isKlantteams
          ? 'Zie de bijlage voor een overzicht van de Megawatt klantteams.'
          : 'Zie de bijlage voor het actuele Megawatt organigram.'}
      </p>
      <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:12px">
        <span style="font-size:24px">📎</span>
        <span style="color:rgba(255,255,255,0.8);font-size:13px">${attachmentName}</span>
      </div>
    `);

    await transporter.sendMail({
      from: smtp.fromName ? `"${smtp.fromName}" <${smtp.fromEmail}>` : smtp.fromEmail,
      to,
      subject: emailSubject,
      html: bodyHtml,
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
