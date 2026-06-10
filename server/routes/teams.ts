import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAudit } from '../lib/audit';

const router = Router();

// Protected: get all teams with members and executive
router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const teams = await prisma.team.findMany({
    include: { members: { orderBy: { order: 'asc' } }, executive: true },
    orderBy: { order: 'asc' },
  });
  res.json(teams);
});

// Protected: get single team
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const team = await prisma.team.findUnique({
    where: { id: Number(req.params.id) },
    include: { members: { orderBy: { order: 'asc' } }, executive: true },
  });
  if (!team) { res.status(404).json({ error: 'Team not found' }); return; }
  res.json(team);
});

// Admin: reorder teams (batch) — must be above /:id to avoid being caught by it
router.put('/reorder/batch', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { orders } = req.body as { orders: { id: number; order: number }[] };
  await Promise.all(
    orders.map(({ id, order }) => prisma.team.update({ where: { id }, data: { order } }))
  );
  await logAudit('UPDATE', 'Team', 0, { action: 'reorder', orders }, req.adminUsername);
  res.json({ success: true });
});

// Admin: create team
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { name, color, order, executiveId } = req.body;
  const team = await prisma.team.create({
    data: {
      name,
      color: color || '#c9a84c',
      order: order ?? 0,
      executiveId: executiveId ? Number(executiveId) : null,
    },
    include: { executive: true },
  });
  await logAudit('CREATE', 'Team', team.id, { name, color, order, executiveId }, req.adminUsername);
  res.status(201).json(team);
});

// Admin: update team
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const { name, color, order, executiveId } = req.body;
  const team = await prisma.team.update({
    where: { id },
    data: {
      name,
      color,
      order,
      executiveId: executiveId !== undefined ? (executiveId ? Number(executiveId) : null) : undefined,
    },
    include: { executive: true },
  });
  await logAudit('UPDATE', 'Team', id, { name, color, order, executiveId }, req.adminUsername);
  res.json(team);
});

// Admin: delete team
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  await prisma.team.delete({ where: { id } });
  await logAudit('DELETE', 'Team', id, {}, req.adminUsername);
  res.json({ success: true });
});

export default router;
