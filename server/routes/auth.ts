import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authMiddleware, AuthRequest, adminOnly } from '../middleware/auth';
import { logAudit } from '../lib/audit';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'megawatt-dashboard-secret-2026';
const AVAILABLE_TABS = ['intern', 'planning'];

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
    res.status(400).json({ error: 'Username and password required' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    recordAttempt(ip);
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  // Successful login — reset attempts
  resetAttempts(ip);

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  const allowedTabs = user.role === 'admin'
    ? AVAILABLE_TABS
    : JSON.parse(user.allowedTabs) as string[];

  res.json({ token, username: user.username, role: user.role, allowedTabs });
});

// Admin: list all users
router.get('/users', authMiddleware, adminOnly, async (_req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true, allowedTabs: true },
    orderBy: { username: 'asc' },
  });
  res.json(users.map(u => ({
    ...u,
    allowedTabs: JSON.parse(u.allowedTabs) as string[],
  })));
});

// Admin: create user
router.post('/users', authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const { username, password, role, allowedTabs } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Gebruikersnaam en wachtwoord zijn verplicht' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Wachtwoord moet minimaal 6 tekens zijn' });
    return;
  }

  const validRole = role === 'admin' || role === 'user' ? role : 'user';

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    res.status(409).json({ error: 'Gebruikersnaam bestaat al' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const resolvedTabs = validRole === 'admin'
    ? JSON.stringify(AVAILABLE_TABS)
    : JSON.stringify(Array.isArray(allowedTabs) ? allowedTabs : []);

  const user = await prisma.user.create({
    data: { username, passwordHash, role: validRole, allowedTabs: resolvedTabs },
    select: { id: true, username: true, role: true, allowedTabs: true },
  });

  await logAudit('CREATE', 'User', user.id, { username, role: validRole }, req.adminUsername);
  res.status(201).json({ ...user, allowedTabs: JSON.parse(user.allowedTabs) as string[] });
});

// Admin: update user
router.put('/users/:id', authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const { username, password, role, allowedTabs } = req.body;

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
  if (role === 'user' && existing.role === 'admin') {
    const adminCount = await prisma.user.count({ where: { role: 'admin' } });
    if (adminCount <= 1) {
      res.status(400).json({ error: 'Er moet minimaal één admin gebruiker bestaan' });
      return;
    }
  }

  const data: { username?: string; passwordHash?: string; role?: string; allowedTabs?: string } = {};
  if (username) data.username = username;
  if (password) data.passwordHash = await bcrypt.hash(password, 10);
  if (role === 'admin' || role === 'user') {
    data.role = role;
    if (role === 'admin') {
      data.allowedTabs = JSON.stringify(AVAILABLE_TABS);
    }
  }
  if (allowedTabs !== undefined && (data.role || existing.role) !== 'admin') {
    data.allowedTabs = JSON.stringify(Array.isArray(allowedTabs) ? allowedTabs : []);
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, username: true, role: true, allowedTabs: true },
  });

  await logAudit('UPDATE', 'User', id, { username: username || existing.username, role: user.role, passwordChanged: !!password }, req.adminUsername);
  res.json({ ...user, allowedTabs: JSON.parse(user.allowedTabs) as string[] });
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
