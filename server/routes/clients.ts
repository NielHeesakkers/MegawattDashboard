import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAudit } from '../lib/audit';

const router = Router();

// Protected: get all clients
router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const clients = await prisma.client.findMany({
    include: { clientTeam: true },
    orderBy: [{ clientTeamId: 'asc' }, { order: 'asc' }],
  });
  res.json(clients);
});

// Admin: reorder clients (batch)
router.put('/reorder/batch', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { orders } = req.body as { orders: { id: number; order: number }[] };
  await Promise.all(
    orders.map(({ id, order }) => prisma.client.update({ where: { id }, data: { order } }))
  );
  await logAudit('UPDATE', 'Client', 0, { action: 'reorder', orders }, req.adminUsername);
  res.json({ success: true });
});

// Admin: create client
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { name, url, clientTeamId, order } = req.body;
  const client = await prisma.client.create({
    data: {
      name,
      url: url || null,
      clientTeamId: Number(clientTeamId),
      order: order ?? 0,
    },
    include: { clientTeam: true },
  });
  await logAudit('CREATE', 'Client', client.id, { name, clientTeamId }, req.adminUsername);
  res.status(201).json(client);
});

// Admin: update client
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const { name, url, clientTeamId, order } = req.body;
  const client = await prisma.client.update({
    where: { id },
    data: {
      name,
      url: url !== undefined ? (url || null) : undefined,
      clientTeamId: clientTeamId ? Number(clientTeamId) : undefined,
      order,
    },
    include: { clientTeam: true },
  });
  await logAudit('UPDATE', 'Client', id, { name, url, clientTeamId }, req.adminUsername);
  res.json(client);
});

// Admin: delete client
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  await prisma.client.delete({ where: { id } });
  await logAudit('DELETE', 'Client', id, {}, req.adminUsername);
  res.json({ success: true });
});

export default router;
