import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAudit } from '../lib/audit';

const router = Router();
const prisma = new PrismaClient();

// Admin: assign member or executive to client team
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { clientTeamId, memberId, executiveId, role, order } = req.body;

  const assignment = await prisma.clientTeamMember.create({
    data: {
      clientTeamId: Number(clientTeamId),
      memberId: memberId ? Number(memberId) : null,
      executiveId: executiveId ? Number(executiveId) : null,
      role,
      order: order ?? 0,
    },
    include: { member: true, executive: true },
  });
  await logAudit('CREATE', 'ClientTeamMember', assignment.id, { clientTeamId, memberId, executiveId, role }, req.adminUsername);
  res.status(201).json(assignment);
});

// Admin: update assignment (role or order)
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const { role, order } = req.body;

  const assignment = await prisma.clientTeamMember.update({
    where: { id },
    data: { role, order },
    include: { member: true, executive: true },
  });
  await logAudit('UPDATE', 'ClientTeamMember', id, { role, order }, req.adminUsername);
  res.json(assignment);
});

// Admin: reorder members within client team
router.put('/reorder/batch', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { orders } = req.body as { orders: { id: number; order: number }[] };
  await Promise.all(
    orders.map(({ id, order }) => prisma.clientTeamMember.update({ where: { id }, data: { order } }))
  );
  await logAudit('UPDATE', 'ClientTeamMember', 0, { action: 'reorder', orders }, req.adminUsername);
  res.json({ success: true });
});

// Admin: remove member from client team
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  await prisma.clientTeamMember.delete({ where: { id } });
  await logAudit('DELETE', 'ClientTeamMember', id, {}, req.adminUsername);
  res.json({ success: true });
});

export default router;
