import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'megawatt-organigram-secret-2026';

router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }

  const admin = await prisma.admin.findUnique({ where: { username } });
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign(
    { id: admin.id, username: admin.username },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token, username: admin.username });
});

export default router;
