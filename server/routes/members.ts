import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { upload, processPhoto, deletePhoto } from '../middleware/upload';
import { logAudit } from '../lib/audit';

const router = Router();
const prisma = new PrismaClient();

// Protected: get all members
router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
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
    const isVac = isVacancy === 'true' || isVacancy === true;
    const isLead = isTeamLead === 'true' || isTeamLead === true;

    // Auto-calculate order: vacancies at bottom, team leads above vacancies
    let finalOrder = Number(order) || 0;
    if (!order || Number(order) === 0) {
      const teamMembers = await prisma.member.findMany({
        where: { teamId: Number(teamId) },
        orderBy: { order: 'asc' },
      });
      if (isVac) {
        // Vacancy: after everything
        finalOrder = teamMembers.length > 0 ? Math.max(...teamMembers.map(m => m.order)) + 1 : 0;
      } else if (isLead) {
        // Team lead: always at the top
        finalOrder = 0;
        // Shift everyone down
        await Promise.all(
          teamMembers.map(m =>
            prisma.member.update({ where: { id: m.id }, data: { order: m.order + 1 } })
          )
        );
      } else {
        // Regular member: at the bottom, but above vacancies
        const firstVacancy = teamMembers.find(m => m.isVacancy);
        if (firstVacancy) {
          finalOrder = firstVacancy.order;
          // Shift vacancies down
          await Promise.all(
            teamMembers.filter(m => m.isVacancy).map(m =>
              prisma.member.update({ where: { id: m.id }, data: { order: m.order + 1 } })
            )
          );
        } else {
          finalOrder = teamMembers.length > 0 ? Math.max(...teamMembers.map(m => m.order)) + 1 : 0;
        }
      }
    }

    const member = await prisma.member.create({
      data: {
        name,
        role,
        email: email || null,
        phone: phone || null,
        photo: photo || null,
        teamId: Number(teamId),
        isVacancy: isVac,
        isTeamLead: isLead,
        order: finalOrder,
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
