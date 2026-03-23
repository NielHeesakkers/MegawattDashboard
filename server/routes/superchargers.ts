import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { upload, processPhotoTo, deletePhoto } from '../middleware/upload';
import { logAudit } from '../lib/audit';

const router = Router();
const prisma = new PrismaClient();

// Get all superchargers
router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const superchargers = await prisma.supercharger.findMany({
    orderBy: { lastName: 'asc' },
  });
  res.json(superchargers);
});

// Create supercharger
router.post(
  '/',
  authMiddleware,
  upload.single('photo'),
  processPhotoTo('Superchargers'),
  async (req: AuthRequest, res: Response) => {
    const { firstName, lastName, function: fn, email, phone, birthDate, photo } = req.body;
    const supercharger = await prisma.supercharger.create({
      data: {
        firstName,
        lastName,
        function: fn || 'Supercharger',
        email: email || null,
        phone: phone || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        photo: photo || null,
      },
    });
    await logAudit('CREATE', 'Supercharger', supercharger.id, { firstName, lastName }, req.adminUsername);
    res.status(201).json(supercharger);
  }
);

// Update supercharger
router.put(
  '/:id',
  authMiddleware,
  upload.single('photo'),
  processPhotoTo('Superchargers'),
  async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = await prisma.supercharger.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Supercharger not found' }); return; }

    const { firstName, lastName, function: fn, email, phone, birthDate, photo, removePhoto } = req.body;

    if ((photo || removePhoto === 'true') && existing.photo) {
      deletePhoto(existing.photo);
    }

    const resolvedPhoto = removePhoto === 'true' ? null : (photo ?? existing.photo);

    const supercharger = await prisma.supercharger.update({
      where: { id },
      data: {
        firstName: firstName ?? existing.firstName,
        lastName: lastName ?? existing.lastName,
        function: fn ?? existing.function,
        email: email !== undefined ? (email || null) : existing.email,
        phone: phone !== undefined ? (phone || null) : existing.phone,
        birthDate: birthDate !== undefined ? (birthDate ? new Date(birthDate) : null) : existing.birthDate,
        photo: resolvedPhoto,
      },
    });
    await logAudit('UPDATE', 'Supercharger', id, { firstName, lastName }, req.adminUsername);
    res.json(supercharger);
  }
);

// Delete supercharger
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const existing = await prisma.supercharger.findUnique({ where: { id } });
  if (existing?.photo) deletePhoto(existing.photo);
  await prisma.supercharger.delete({ where: { id } });
  await logAudit('DELETE', 'Supercharger', id, { name: `${existing?.firstName} ${existing?.lastName}` }, req.adminUsername);
  res.json({ success: true });
});

export default router;
