import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAudit } from '../lib/audit';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'megawatt-dashboard-secret-2026';

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

  const admin = await prisma.admin.findUnique({ where: { username } });
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    recordAttempt(ip);
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  // Successful login — reset attempts
  resetAttempts(ip);

  const token = jwt.sign(
    { id: admin.id, username: admin.username },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token, username: admin.username });
});

// Admin: list all admin users
router.get('/users', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const users = await prisma.admin.findMany({
    select: { id: true, username: true },
    orderBy: { username: 'asc' },
  });
  res.json(users);
});

// Admin: create admin user
router.post('/users', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Gebruikersnaam en wachtwoord zijn verplicht' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Wachtwoord moet minimaal 6 tekens zijn' });
    return;
  }

  const existing = await prisma.admin.findUnique({ where: { username } });
  if (existing) {
    res.status(409).json({ error: 'Gebruikersnaam bestaat al' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.admin.create({
    data: { username, passwordHash },
    select: { id: true, username: true },
  });

  await logAudit('CREATE', 'Admin', user.id, { username }, req.adminUsername);
  res.status(201).json(user);
});

// Admin: update admin user
router.put('/users/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const { username, password } = req.body;

  const existing = await prisma.admin.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Gebruiker niet gevonden' });
    return;
  }

  if (username && username !== existing.username) {
    const duplicate = await prisma.admin.findUnique({ where: { username } });
    if (duplicate) {
      res.status(409).json({ error: 'Gebruikersnaam bestaat al' });
      return;
    }
  }

  if (password && password.length < 6) {
    res.status(400).json({ error: 'Wachtwoord moet minimaal 6 tekens zijn' });
    return;
  }

  const data: { username?: string; passwordHash?: string } = {};
  if (username) data.username = username;
  if (password) data.passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.admin.update({
    where: { id },
    data,
    select: { id: true, username: true },
  });

  await logAudit('UPDATE', 'Admin', id, { username: username || existing.username, passwordChanged: !!password }, req.adminUsername);
  res.json(user);
});

// Admin: delete admin user
router.delete('/users/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);

  // Prevent deleting yourself
  if (id === req.adminId) {
    res.status(400).json({ error: 'Je kunt jezelf niet verwijderen' });
    return;
  }

  const existing = await prisma.admin.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Gebruiker niet gevonden' });
    return;
  }

  // Prevent deleting the last admin
  const count = await prisma.admin.count();
  if (count <= 1) {
    res.status(400).json({ error: 'Er moet minimaal één admin gebruiker bestaan' });
    return;
  }

  await prisma.admin.delete({ where: { id } });
  await logAudit('DELETE', 'Admin', id, { username: existing.username }, req.adminUsername);
  res.json({ success: true });
});

export default router;
