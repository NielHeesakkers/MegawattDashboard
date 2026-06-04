import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { authMiddleware, AuthRequest, adminOnly, adminOrSuperuser } from '../middleware/auth';
import { logAudit } from '../lib/audit';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'megawatt-dashboard-secret-2026';
const AVAILABLE_TABS = ['intern', 'planning', 'locatie'];

// Login rate limiting — max 5 attempts per 15 minutes per IP
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record) return { allowed: true };

  // Reset if window has passed
  if (now - record.firstAttempt > WINDOW_MS) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }

  if (record.count >= MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((record.firstAttempt + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true };
}

function recordAttempt(ip: string): void {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record || now - record.firstAttempt > WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    record.count++;
  }
}

function resetAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const ip = getClientIp(req);

  // Check rate limit
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    const minutes = Math.ceil((rateCheck.retryAfterSeconds || 0) / 60);
    res.status(429).json({ error: `Te veel inlogpogingen. Probeer het over ${minutes} minuten opnieuw.` });
    return;
  }

  if (!username || !password) {
    res.status(400).json({ error: 'E-mailadres en wachtwoord zijn verplicht' });
    return;
  }

  // Login met email OF username
  const identifier = String(username).trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { OR: [{ username: identifier }, { email: identifier }] },
  });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    recordAttempt(ip);
    res.status(401).json({ error: 'Onjuist e-mailadres of wachtwoord' });
    return;
  }

  // Successful login — reset attempts
  resetAttempts(ip);

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  const allowedTabs = (user.role === 'admin' || user.role === 'superuser')
    ? AVAILABLE_TABS
    : JSON.parse(user.allowedTabs) as string[];

  res.json({ token, username: user.username, role: user.role, allowedTabs });
});

// ── Password reset via e-mail ───────────────────────────────────────────────

import { emailLayout, emailButton, emailMeta } from '../lib/email';

async function sendWelcomeEmail(user: { id: number; username: string; email: string }, origin: string, role: string) {
  const cfg = await getEmailConfig();
  if (!cfg.host || !cfg.user) {
    console.warn('SMTP niet geconfigureerd — geen welkomstmail verstuurd');
    return false;
  }
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.passwordResetToken.create({ data: { token, userId: user.id, expiresAt } });

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host, port: cfg.port,
      secure: cfg.port === 465,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    const setupUrl = `${origin}/reset-password/${token}`;
    const roleLabel = role === 'admin' ? 'Admin' : 'Gebruiker';

    const body = `
      <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;margin:0 0 4px">
        Er is een account voor je aangemaakt bij het Megawatt Dashboard.
        Stel hieronder je eigen wachtwoord in om aan de slag te gaan.
      </p>
      ${emailMeta([['E-mailadres', user.email], ['Rol', roleLabel]])}
      ${emailButton(setupUrl, 'Wachtwoord instellen →')}
      <p style="color:rgba(255,255,255,0.35);font-size:12px;margin:0 0 16px">
        Deze link is 7 dagen geldig.
      </p>
      <p style="color:rgba(255,255,255,0.25);font-size:11px;word-break:break-all;margin:0;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06)">
        Werkt de knop niet? Kopieer:<br>${setupUrl}
      </p>`;

    await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.from || cfg.user}>`,
      to: user.email,
      subject: 'Welkom bij Megawatt Dashboard — stel je wachtwoord in',
      html: emailLayout('Welkom bij Megawatt', body),
    });
    return true;
  } catch (e) {
    console.error('Welkomstmail versturen mislukt:', e);
    return false;
  }
}

async function getEmailConfig() {
  const keys = ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPass', 'fromEmail', 'fromName'];
  const settings = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const map: Record<string, string> = {};
  settings.forEach(s => { map[s.key] = s.value; });
  return {
    host: map.smtpHost || '',
    port: parseInt(map.smtpPort || '587', 10),
    user: map.smtpUser || '',
    pass: map.smtpPass || '',
    from: map.fromEmail || '',
    fromName: map.fromName || 'Megawatt Dashboard',
  };
}

// POST /api/auth/forgot-password — vraag reset link aan
router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  const ip = getClientIp(req);

  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    res.status(429).json({ error: 'Te veel pogingen, probeer later opnieuw.' });
    return;
  }
  recordAttempt(ip);

  // Anti-enumeratie: altijd succes-bericht ongeacht of email bestaat
  const successMsg = { success: true, message: 'Als dit e-mailadres bekend is, is een reset link verstuurd.' };

  if (!email) { res.json(successMsg); return; }

  const user = await prisma.user.findFirst({ where: { email: { equals: String(email).trim() } } });
  if (!user || !user.email) { res.json(successMsg); return; }

  // Genereer token, geldig 1 uur
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.passwordResetToken.create({ data: { token, userId: user.id, expiresAt } });

  // Stuur email
  try {
    const cfg = await getEmailConfig();
    if (!cfg.host || !cfg.user) {
      console.error('SMTP niet geconfigureerd — kan reset email niet versturen');
      res.json(successMsg);
      return;
    }
    const transporter = nodemailer.createTransport({
      host: cfg.host, port: cfg.port,
      secure: cfg.port === 465,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    const origin = req.headers.origin || `http://${req.headers.host}`;
    const resetUrl = `${origin}/reset-password/${token}`;
    const resetBody = `
      <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;margin:0 0 4px">
        Er is een wachtwoordreset aangevraagd voor jouw account.
        Klik op de knop hieronder om een nieuw wachtwoord in te stellen.
      </p>
      ${emailMeta([['E-mailadres', user.email]])}
      ${emailButton(resetUrl, 'Nieuw wachtwoord instellen →')}
      <p style="color:rgba(255,255,255,0.35);font-size:12px;margin:0 0 16px">
        Deze link is 1 uur geldig. Heb je geen reset aangevraagd? Dan kun je deze e-mail negeren.
      </p>
      <p style="color:rgba(255,255,255,0.25);font-size:11px;word-break:break-all;margin:0;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06)">
        Werkt de knop niet? Kopieer:<br>${resetUrl}
      </p>`;
    await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.from || cfg.user}>`,
      to: user.email,
      subject: 'Wachtwoord resetten — Megawatt Dashboard',
      html: emailLayout('Wachtwoord resetten', resetBody),
    });
    await logAudit('UPDATE', 'User', user.id, { passwordResetRequested: true }, 'system');
  } catch (e) {
    console.error('Email versturen mislukt:', e);
  }

  res.json(successMsg);
});

// GET /api/auth/reset-password/:token/check — valideer token
router.get('/reset-password/:token/check', async (req: Request, res: Response) => {
  const token = String(req.params.token ?? '');
  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: { select: { username: true, email: true } } },
  });
  if (!record || record.used || record.expiresAt < new Date()) {
    res.status(400).json({ valid: false, error: 'Link is ongeldig of verlopen' });
    return;
  }
  res.json({ valid: true, username: record.user.username });
});

// POST /api/auth/reset-password — voltooi de reset
router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  const ip = getClientIp(req);

  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    res.status(429).json({ error: 'Te veel pogingen, probeer later opnieuw.' });
    return;
  }

  if (!token || !newPassword) { res.status(400).json({ error: 'Token en wachtwoord zijn verplicht' }); return; }
  if (newPassword.length < 6) { res.status(400).json({ error: 'Wachtwoord moet minimaal 6 tekens zijn' }); return; }

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!record || record.used || record.expiresAt < new Date()) {
    recordAttempt(ip);
    res.status(400).json({ error: 'Link is ongeldig of verlopen' });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } }),
    // Invalideer alle andere openstaande tokens voor deze gebruiker
    prisma.passwordResetToken.updateMany({ where: { userId: record.userId, used: false }, data: { used: true } }),
  ]);

  resetAttempts(ip);
  await logAudit('UPDATE', 'User', record.userId, { passwordReset: true }, 'reset-link');
  res.json({ success: true });
});

// Admin: list all users
router.get('/users', authMiddleware, adminOnly, async (_req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, email: true, role: true, allowedTabs: true },
    orderBy: { username: 'asc' },
  });
  res.json(users.map(u => ({
    ...u,
    allowedTabs: JSON.parse(u.allowedTabs) as string[],
  })));
});

// Admin: create user — email = username, wachtwoord niet vereist (wordt via welcome-mail gezet)
router.post('/users', authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const { email, role, allowedTabs, password } = req.body;

  if (!email || !String(email).includes('@')) {
    res.status(400).json({ error: 'Geldig e-mailadres is verplicht' });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const validRole = ['admin', 'superuser', 'user'].includes(role) ? role : 'user';

  // Email én username moeten uniek zijn
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: normalizedEmail }, { email: normalizedEmail }] },
  });
  if (existing) {
    res.status(409).json({ error: 'Er bestaat al een account met dit e-mailadres' });
    return;
  }

  // Wachtwoord optioneel: als meegegeven meteen instellen, anders via welcome-mail
  const passwordHash = password && password.length >= 6
    ? await bcrypt.hash(password, 10)
    : await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10); // wegwerp-hash

  const resolvedTabs = (validRole === 'admin' || validRole === 'superuser')
    ? JSON.stringify(AVAILABLE_TABS)
    : JSON.stringify(Array.isArray(allowedTabs) ? allowedTabs : []);

  const user = await prisma.user.create({
    data: { username: normalizedEmail, email: normalizedEmail, passwordHash, role: validRole, allowedTabs: resolvedTabs },
    select: { id: true, username: true, email: true, role: true, allowedTabs: true },
  });

  await logAudit('CREATE', 'User', user.id, { email: normalizedEmail, role: validRole }, req.adminUsername);

  // Altijd welkomstmail sturen met link om wachtwoord in te stellen
  const origin = req.headers.origin || `http://${req.headers.host}`;
  const emailSent = await sendWelcomeEmail({ id: user.id, username: user.username, email: user.email! }, origin, validRole);

  res.status(201).json({ ...user, allowedTabs: JSON.parse(user.allowedTabs) as string[], emailSent });
});

// Admin: update user
router.put('/users/:id', authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const { username, password, email, role, allowedTabs } = req.body;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Gebruiker niet gevonden' });
    return;
  }

  if (username && username !== existing.username) {
    const duplicate = await prisma.user.findUnique({ where: { username } });
    if (duplicate) {
      res.status(409).json({ error: 'Gebruikersnaam bestaat al' });
      return;
    }
  }

  if (password && password.length < 6) {
    res.status(400).json({ error: 'Wachtwoord moet minimaal 6 tekens zijn' });
    return;
  }

  // Demotion check: if changing admin→user, ensure at least one other admin remains
  if (role !== 'admin' && existing.role === 'admin') {
    const adminCount = await prisma.user.count({ where: { role: 'admin' } });
    if (adminCount <= 1) {
      res.status(400).json({ error: 'Er moet minimaal één admin gebruiker bestaan' });
      return;
    }
  }
  if (!['admin', 'superuser', 'user'].includes(role ?? '')) {
    // onbekende rol — negeer
  }

  const data: { username?: string; email?: string | null; passwordHash?: string; role?: string; allowedTabs?: string } = {};
  if (username) data.username = username;
  if (email !== undefined) data.email = email?.trim() || null;
  if (password) data.passwordHash = await bcrypt.hash(password, 10);
  if (['admin', 'superuser', 'user'].includes(role)) {
    data.role = role;
    if (role === 'admin' || role === 'superuser') {
      data.allowedTabs = JSON.stringify(AVAILABLE_TABS);
    }
  }
  const effectiveRole = data.role || existing.role;
  if (allowedTabs !== undefined && effectiveRole !== 'admin' && effectiveRole !== 'superuser') {
    data.allowedTabs = JSON.stringify(Array.isArray(allowedTabs) ? allowedTabs : []);
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, username: true, email: true, role: true, allowedTabs: true },
  });

  await logAudit('UPDATE', 'User', id, { username: username || existing.username, role: user.role, passwordChanged: !!password }, req.adminUsername);
  res.json({ ...user, allowedTabs: JSON.parse(user.allowedTabs) as string[] });
});

// Admin: stuur welkomstmail opnieuw (voor bestaande gebruikers)
router.post('/users/:id/send-welcome', authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) { res.status(404).json({ error: 'Gebruiker niet gevonden' }); return; }
  if (!user.email) { res.status(400).json({ error: 'Gebruiker heeft geen e-mailadres' }); return; }
  const origin = req.headers.origin || `http://${req.headers.host}`;
  const ok = await sendWelcomeEmail({ id: user.id, username: user.username, email: user.email }, origin, user.role);
  if (!ok) { res.status(500).json({ error: 'E-mail versturen mislukt — controleer SMTP instellingen' }); return; }
  await logAudit('UPDATE', 'User', user.id, { welcomeEmailResent: true }, req.adminUsername);
  res.json({ success: true });
});

// Admin: delete user
router.delete('/users/:id', authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);

  // Prevent deleting yourself
  if (id === req.userId) {
    res.status(400).json({ error: 'Je kunt jezelf niet verwijderen' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Gebruiker niet gevonden' });
    return;
  }

  // Prevent deleting the last admin
  if (existing.role === 'admin') {
    const adminCount = await prisma.user.count({ where: { role: 'admin' } });
    if (adminCount <= 1) {
      res.status(400).json({ error: 'Er moet minimaal één admin gebruiker bestaan' });
      return;
    }
  }

  await prisma.user.delete({ where: { id } });
  await logAudit('DELETE', 'User', id, { username: existing.username }, req.adminUsername);
  res.json({ success: true });
});

export default router;
