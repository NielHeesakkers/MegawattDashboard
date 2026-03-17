import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAudit } from '../lib/audit';

const router = Router();
const prisma = new PrismaClient();

// List all klanten
router.get('/', async (_req, res: Response) => {
  const klanten = await prisma.klant.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { projects: true } } },
  });
  res.json(klanten);
});

// Get single klant
router.get('/:id', async (req, res: Response) => {
  const klant = await prisma.klant.findUnique({
    where: { id: Number(req.params.id) },
    include: { projects: true },
  });
  if (!klant) {
    res.status(404).json({ error: 'Klant niet gevonden' });
    return;
  }
  res.json(klant);
});

// Create klant
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { name, contactPerson, email } = req.body;
  try {
    const klant = await prisma.klant.create({
      data: { name, contactPerson, email },
    });
    await logAudit('CREATE', 'Klant', klant.id, { name, contactPerson, email }, req.adminUsername!);
    res.status(201).json(klant);
  } catch (err: unknown) {
    const prismaErr = err as { code?: string };
    if (prismaErr.code === 'P2002') {
      res.status(400).json({ error: 'Er bestaat al een klant met deze naam' });
      return;
    }
    throw err;
  }
});

// Update klant
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { name, contactPerson, email } = req.body;
  try {
    const klant = await prisma.klant.update({
      where: { id: Number(req.params.id) },
      data: { name, contactPerson, email },
    });
    await logAudit('UPDATE', 'Klant', klant.id, { name, contactPerson, email }, req.adminUsername!);
    res.json(klant);
  } catch (err: unknown) {
    const prismaErr = err as { code?: string };
    if (prismaErr.code === 'P2002') {
      res.status(400).json({ error: 'Er bestaat al een klant met deze naam' });
      return;
    }
    throw err;
  }
});

// Delete klant (only if no linked projects)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const projectCount = await prisma.project.count({ where: { klantId: id } });
  if (projectCount > 0) {
    res.status(400).json({ error: 'Kan klant niet verwijderen: er zijn nog projecten gekoppeld' });
    return;
  }
  await prisma.klant.delete({ where: { id } });
  await logAudit('DELETE', 'Klant', id, {}, req.adminUsername!);
  res.json({ success: true });
});

export default router;
