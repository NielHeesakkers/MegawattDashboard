import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { upload, processPhoto, deletePhoto } from '../middleware/upload';
import { logAudit } from '../lib/audit';

const router = Router();
const prisma = new PrismaClient();

// Public: get all executives
router.get('/', async (_req: Request, res: Response) => {
  const executives = await prisma.executive.findMany({
    orderBy: { level: 'asc' },
  });
  res.json(executives);
});

// Admin: create executive
router.post(
  '/',
  authMiddleware,
  upload.single('photo'),
  processPhoto,
  async (req: AuthRequest, res: Response) => {
    const { name, role, email, photo, level } = req.body;
    const exec = await prisma.executive.create({
      data: {
        name,
        role,
        email: email || null,
        photo: photo || null,
        level: Number(level) || 1,
      },
    });
    await logAudit('CREATE', 'Executive', exec.id, { name, role, level }, req.adminUsername);
    res.status(201).json(exec);
  }
);

// Admin: update executive
router.put(
  '/:id',
  authMiddleware,
  upload.single('photo'),
  processPhoto,
  async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = await prisma.executive.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Executive not found' }); return; }

    const { name, role, email, photo, level } = req.body;

    if (photo && existing.photo) {
      deletePhoto(existing.photo);
    }

    const exec = await prisma.executive.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        role: role ?? existing.role,
        email: email !== undefined ? (email || null) : existing.email,
        photo: photo ?? existing.photo,
        level: level !== undefined ? Number(level) : existing.level,
      },
    });
    await logAudit('UPDATE', 'Executive', id, { name, role, level }, req.adminUsername);
    res.json(exec);
  }
);

// Admin: delete executive
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const existing = await prisma.executive.findUnique({ where: { id } });
  if (existing?.photo) deletePhoto(existing.photo);
  await prisma.executive.delete({ where: { id } });
  await logAudit('DELETE', 'Executive', id, { name: existing?.name }, req.adminUsername);
  res.json({ success: true });
});

export default router;
