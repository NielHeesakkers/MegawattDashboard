import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type EmailMethod = 'smtp' | 'graph';

export interface EmailSettings {
  method: EmailMethod;
  // SMTP
  host: string;
  port: number;
  user: string;
  pass: string;
  // Microsoft 365 / Graph (app-only, client credentials)
  tenantId: string;
  clientId: string;
  clientSecret: string;
  // Afzender (gedeeld door beide methoden)
  fromEmail: string;
  fromName: string;
}

const SETTING_KEYS = [
  'emailMethod',
  'smtpHost', 'smtpPort', 'smtpUser', 'smtpPass',
  'graphTenantId', 'graphClientId', 'graphClientSecret',
  'emailFromAddress', 'emailFromName',
];

export async function getEmailSettings(): Promise<EmailSettings> {
  const rows = await prisma.setting.findMany({ where: { key: { in: SETTING_KEYS } } });
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    method: m.emailMethod === 'graph' ? 'graph' : 'smtp',
    host: m.smtpHost || '',
    port: Number(m.smtpPort) || 587,
    user: m.smtpUser || '',
    pass: m.smtpPass || '',
    tenantId: m.graphTenantId || '',
    clientId: m.graphClientId || '',
    clientSecret: m.graphClientSecret || '',
    fromEmail: m.emailFromAddress || '',
    fromName: m.emailFromName || '',
  };
}

/** Is de gekozen verzendmethode volledig geconfigureerd? */
export function isEmailConfigured(s: EmailSettings): boolean {
  if (!s.fromEmail) return false;
  return s.method === 'graph'
    ? !!(s.tenantId && s.clientId && s.clientSecret)
    : !!(s.host && s.user && s.pass);
}

export interface MailAttachment { filename: string; content: Buffer; contentType?: string }
export interface MailInput { to: string; subject: string; html: string; attachments?: MailAttachment[] }

/** Verstuur een e-mail via de geconfigureerde methode (SMTP of Microsoft 365 Graph). */
export async function sendMail(input: MailInput): Promise<void> {
  const s = await getEmailSettings();
  if (!isEmailConfigured(s)) throw new Error('E-mail is niet volledig geconfigureerd');
  if (s.method === 'graph') {
    await sendViaGraph(s, input);
  } else {
    await sendViaSmtp(s, input);
  }
}

/** Controleer alleen de verbinding/credentials, zonder een e-mail te versturen. */
export async function verifyConnection(): Promise<void> {
  const s = await getEmailSettings();
  if (!isEmailConfigured(s)) throw new Error('E-mail is niet volledig geconfigureerd');
  if (s.method === 'graph') {
    // Een geldig token bewijst dat Tenant-ID, Client-ID en secret kloppen.
    await getGraphToken(s);
  } else {
    const transporter = nodemailer.createTransport({
      host: s.host,
      port: s.port,
      secure: s.port === 465,
      auth: { user: s.user, pass: s.pass },
    });
    await transporter.verify();
  }
}

async function sendViaSmtp(s: EmailSettings, input: MailInput): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.port === 465,
    auth: { user: s.user, pass: s.pass },
  });
  const info = await transporter.sendMail({
    from: s.fromName ? `"${s.fromName}" <${s.fromEmail}>` : s.fromEmail,
    to: input.to,
    subject: input.subject,
    html: input.html,
    attachments: input.attachments?.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
  });
  console.log(`[Mail/SMTP] from=${s.fromEmail} to=${input.to} accepted=${JSON.stringify(info.accepted)} rejected=${JSON.stringify(info.rejected)} response=${info.response}`);
}

// ── Microsoft Graph (app-only) ───────────────────────────────────────────────

async function getGraphToken(s: EmailSettings): Promise<string> {
  const resp = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(s.tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: s.clientId,
      client_secret: s.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Microsoft-token ophalen mislukt (${resp.status}): ${txt.slice(0, 300)}`);
  }
  const data = (await resp.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('Geen access_token ontvangen van Microsoft');
  return data.access_token;
}

async function sendViaGraph(s: EmailSettings, input: MailInput): Promise<void> {
  const token = await getGraphToken(s);
  const message: Record<string, unknown> = {
    subject: input.subject,
    body: { contentType: 'HTML', content: input.html },
    toRecipients: [{ emailAddress: { address: input.to } }],
    from: { emailAddress: { address: s.fromEmail, name: s.fromName || undefined } },
  };
  if (input.attachments?.length) {
    message.attachments = input.attachments.map((a) => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: a.filename,
      contentType: a.contentType || 'application/octet-stream',
      contentBytes: a.content.toString('base64'),
    }));
  }
  // Verstuur namens de gedeelde postbus (de afzender). De app heeft Mail.Send op die mailbox.
  const resp = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(s.fromEmail)}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, saveToSentItems: false }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Microsoft Graph verzenden mislukt (${resp.status}): ${txt.slice(0, 300)}`);
  }
}
