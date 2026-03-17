import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAudit } from '../lib/audit';

const router = Router();
const prisma = new PrismaClient();

// ── Projects ──

// List projects (filterable by status)
router.get('/', async (req, res: Response) => {
  const status = req.query.status as string | undefined;
  const where = status ? { status } : {};
  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      klant: true,
      _count: { select: { activations: true } },
    },
  });
  res.json(projects);
});

// Get single project with activations
router.get('/:id', async (req, res: Response) => {
  const project = await prisma.project.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      klant: true,
      activations: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!project) {
    res.status(404).json({ error: 'Project niet gevonden' });
    return;
  }
  res.json(project);
});

// Create project (with first activation in transaction)
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { klantId, projectNumber, startDate, endDate, contactPerson, email } = req.body;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          klantId,
          projectNumber,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          contactPerson,
          email,
        },
      });
      await tx.activation.create({
        data: { projectId: project.id, location: '', date: null },
      });
      return tx.project.findUnique({
        where: { id: project.id },
        include: { klant: true, activations: true },
      });
    });
    await logAudit('CREATE', 'Project', result!.id, { projectNumber, klantId }, req.adminUsername!);
    res.status(201).json(result);
  } catch (err: unknown) {
    const prismaErr = err as { code?: string };
    if (prismaErr.code === 'P2002') {
      res.status(400).json({ error: 'Er bestaat al een project met dit projectnummer' });
      return;
    }
    throw err;
  }
});

// Update project
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { klantId, projectNumber, startDate, endDate, status, contactPerson, email } = req.body;
  if (status && !['active', 'completed'].includes(status)) {
    res.status(400).json({ error: 'Ongeldige status' });
    return;
  }
  try {
    const project = await prisma.project.update({
      where: { id: Number(req.params.id) },
      data: {
        klantId,
        projectNumber,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        status,
        contactPerson,
        email,
      },
      include: { klant: true, activations: true },
    });
    await logAudit('UPDATE', 'Project', project.id, { projectNumber, status }, req.adminUsername!);
    res.json(project);
  } catch (err: unknown) {
    const prismaErr = err as { code?: string };
    if (prismaErr.code === 'P2002') {
      res.status(400).json({ error: 'Er bestaat al een project met dit projectnummer' });
      return;
    }
    throw err;
  }
});

// Delete project (cascades to activations)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  await prisma.project.delete({ where: { id } });
  await logAudit('DELETE', 'Project', id, {}, req.adminUsername!);
  res.json({ success: true });
});

// ── Activations (nested under project) ──

// List activations for a project
router.get('/:projectId/activations', async (req, res: Response) => {
  const activations = await prisma.activation.findMany({
    where: { projectId: Number(req.params.projectId) },
    orderBy: { createdAt: 'asc' },
  });
  res.json(activations);
});

// Create activation for a project
router.post('/:projectId/activations', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { location, date } = req.body;
  const activation = await prisma.activation.create({
    data: {
      projectId: Number(req.params.projectId),
      location: location || '',
      date: date ? new Date(date) : null,
    },
  });
  await logAudit('CREATE', 'Activation', activation.id, { projectId: req.params.projectId, location }, req.adminUsername!);
  res.status(201).json(activation);
});

// Update activation
router.put('/activations/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { location, date } = req.body;
  const activation = await prisma.activation.update({
    where: { id: Number(req.params.id) },
    data: {
      location,
      date: date ? new Date(date) : null,
    },
  });
  await logAudit('UPDATE', 'Activation', activation.id, { location, date }, req.adminUsername!);
  res.json(activation);
});

// Delete activation
router.delete('/activations/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  await prisma.activation.delete({ where: { id } });
  await logAudit('DELETE', 'Activation', id, {}, req.adminUsername!);
  res.json({ success: true });
});

export default router;
