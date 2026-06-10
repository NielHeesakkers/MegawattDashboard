import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/specialismes
router.get('/', async (_req, res: Response) => {
  const specialismes = await prisma.specialisme.findMany({ orderBy: { naam: 'asc' } });
  res.json(specialismes);
});

// POST /api/specialismes
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { naam } = req.body;
  if (!naam?.trim()) { res.status(400).json({ error: 'Naam is verplicht' }); return; }
  try {
    const specialisme = await prisma.specialisme.create({ data: { naam: naam.trim() } });
    res.status(201).json(specialisme);
  } catch {
    res.status(409).json({ error: 'Specialisme bestaat al' });
  }
});

// DELETE /api/specialismes/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  await prisma.specialisme.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
