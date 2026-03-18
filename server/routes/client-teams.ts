import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAudit } from '../lib/audit';

const router = Router();
const prisma = new PrismaClient();

// Protected: get all client teams with members, clients, and executive
router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const clientTeams = await prisma.clientTeam.findMany({
    include: {
      members: {
        include: { member: true, executive: true },
        orderBy: { order: 'asc' },
      },
      clients: { orderBy: { order: 'asc' } },
      executive: true,
    },
    orderBy: { order: 'asc' },
  });
  res.json(clientTeams);
});

// Admin: reorder client teams (batch)
router.put('/reorder/batch', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { orders } = req.body as { orders: { id: number; order: number }[] };
  await Promise.all(
    orders.map(({ id, order }) => prisma.clientTeam.update({ where: { id }, data: { order } }))
  );
  await logAudit('UPDATE', 'ClientTeam', 0, { action: 'reorder', orders }, req.adminUsername);
  res.json({ success: true });
});

// Admin: create client team
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { name, order, executiveId } = req.body;
  const clientTeam = await prisma.clientTeam.create({
    data: {
      name,
      order: order ?? 0,
      executiveId: executiveId ? Number(executiveId) : null,
    },
    include: { executive: true, members: { include: { member: true } }, clients: true },
  });
  await logAudit('CREATE', 'ClientTeam', clientTeam.id, { name, executiveId }, req.adminUsername);
  res.status(201).json(clientTeam);
});

// Admin: update client team
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const { name, order, executiveId } = req.body;
  const clientTeam = await prisma.clientTeam.update({
    where: { id },
    data: {
      name,
      order,
      executiveId: executiveId !== undefined ? (executiveId ? Number(executiveId) : null) : undefined,
    },
    include: { executive: true, members: { include: { member: true } }, clients: true },
  });
  await logAudit('UPDATE', 'ClientTeam', id, { name, executiveId }, req.adminUsername);
  res.json(clientTeam);
});

// Admin: delete client team
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  await prisma.clientTeam.delete({ where: { id } });
  await logAudit('DELETE', 'ClientTeam', id, {}, req.adminUsername);
  res.json({ success: true });
});

export default router;
