import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /api/locations — lijst met relaties
router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const locations = await prisma.location.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      contacts: { orderBy: { order: 'asc' } },
      photos: { orderBy: { order: 'asc' } },
      costs: { orderBy: { order: 'asc' } },
    },
  });
  res.json(locations);
});

// GET /api/locations/:id — enkele locatie
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const location = await prisma.location.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      contacts: { orderBy: { order: 'asc' } },
      photos: { orderBy: { order: 'asc' } },
      costs: { orderBy: { order: 'asc' } },
    },
  });
  if (!location) { res.status(404).json({ error: 'Locatie niet gevonden' }); return; }
  res.json(location);
});

export default router;
