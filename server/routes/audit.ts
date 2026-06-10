import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { readFileSync } from 'fs';
import path from 'path';
import { authMiddleware } from '../middleware/auth';

const router = Router();

const PROJECT_ROOT = __dirname.includes(path.join('dist', 'server'))
  ? path.resolve(__dirname, '../../..')
  : path.resolve(__dirname, '../..');

// Admin: get audit logs with pagination
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 50;
  const entity = req.query.entity as string | undefined;

  const where = entity ? { entity } : {};

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ logs, total, page, pages: Math.ceil(total / limit) });
});

// GET /api/audit-logs/changelog — return CHANGELOG.md content
router.get('/changelog', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const content = readFileSync(path.join(PROJECT_ROOT, 'CHANGELOG.md'), 'utf-8');
    res.json({ content });
  } catch {
    res.json({ content: '' });
  }
});

export default router;
