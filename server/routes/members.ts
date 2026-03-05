import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { upload, processPhoto, deletePhoto } from '../middleware/upload';
import { logAudit } from '../lib/audit';

const router = Router();
const prisma = new PrismaClient();

// Public: get all members
router.get('/', async (_req: Request, res: Response) => {
  const members = await prisma.member.findMany({
    include: { team: true },
    orderBy: [{ teamId: 'asc' }, { order: 'asc' }],
  });
  res.json(members);
});

// Admin: reorder members (batch) — must be above /:id to avoid being caught by it
router.put('/reorder/batch', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { orders } = req.body as { orders: { id: number; order: number }[] };
  await Promise.all(
    orders.map(({ id, order }) => prisma.member.update({ where: { id }, data: { order } }))
  );
  await logAudit('UPDATE', 'Member', 0, { action: 'reorder', orders }, req.adminUsername);
  res.json({ success: true });
});

// Admin: create member
router.post(
  '/',
  authMiddleware,
  upload.single('photo'),
  processPhoto,
  async (req: AuthRequest, res: Response) => {
    const { name, role, email, phone, photo, teamId, isVacancy, isTeamLead, order, subGroup } = req.body;
    const member = await prisma.member.create({
      data: {
        name,
        role,
        email: email || null,
        phone: phone || null,
        photo: photo || null,
        teamId: Number(teamId),
        isVacancy: isVacancy === 'true' || isVacancy === true,
        isTeamLead: isTeamLead === 'true' || isTeamLead === true,
        order: Number(order) || 0,
        subGroup: subGroup || null,
      },
      include: { team: true },
    });
    await logAudit('CREATE', 'Member', member.id, { name, role, teamId }, req.adminUsername);
    res.status(201).json(member);
  }
);

// Admin: update member
router.put(
  '/:id',
  authMiddleware,
  upload.single('photo'),
  processPhoto,
  async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = await prisma.member.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Member not found' }); return; }

    const { name, role, email, phone, photo, removePhoto, teamId, isVacancy, isTeamLead, order, subGroup } = req.body;

    // Delete old photo if new one uploaded or explicitly removed
    if ((photo || removePhoto === 'true') && existing.photo) {
      deletePhoto(existing.photo);
    }

    const resolvedPhoto = removePhoto === 'true' ? null : (photo ?? existing.photo);

    const member = await prisma.member.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        role: role ?? existing.role,
        email: email !== undefined ? (email || null) : existing.email,
        phone: phone !== undefined ? (phone || null) : existing.phone,
        photo: resolvedPhoto,
        teamId: teamId ? Number(teamId) : existing.teamId,
        isVacancy: isVacancy !== undefined ? (isVacancy === 'true' || isVacancy === true) : existing.isVacancy,
        isTeamLead: isTeamLead !== undefined ? (isTeamLead === 'true' || isTeamLead === true) : existing.isTeamLead,
        order: order !== undefined ? Number(order) : existing.order,
        subGroup: subGroup !== undefined ? (subGroup || null) : existing.subGroup,
      },
      include: { team: true },
    });
    await logAudit('UPDATE', 'Member', id, { name, role, teamId }, req.adminUsername);
    res.json(member);
  }
);

// Admin: delete member
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const existing = await prisma.member.findUnique({ where: { id } });
  if (existing?.photo) deletePhoto(existing.photo);
  await prisma.member.delete({ where: { id } });
  await logAudit('DELETE', 'Member', id, { name: existing?.name }, req.adminUsername);
  res.json({ success: true });
});

export default router;
