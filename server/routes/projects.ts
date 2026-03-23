import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAudit } from '../lib/audit';
import { uploadsDir } from '../middleware/upload';

const router = Router();
const prisma = new PrismaClient();

/** Generate a unique briefing token */
function generateBriefingToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/** Sanitize string for use in folder names */
function sanitize(s: string): string {
  return s.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
}

/** Ensure the project folder exists under uploads/projecten/ */
async function ensureProjectFolder(projectNumber: string, klantName: string, projectName: string | null) {
  const parts = [sanitize(projectNumber), sanitize(klantName)];
  if (projectName) parts.push(sanitize(projectName));
  const folderName = parts.join('_');
  const folderPath = path.join(uploadsDir, 'Projecten', folderName);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  return folderName;
}

// ── Projects ──

// List projects (filterable by status)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
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

// Get single project with activations and staff
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const project = await prisma.project.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      klant: true,
      activations: {
        orderBy: { createdAt: 'asc' },
        include: { staff: { include: { supercharger: true } } },
      },
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
  const {
    klantId, projectNumber, name, startDate, endDate, contactPerson, email,
    campaignDescription, campaignMessage, campaignTargetAudience, campaignTarget,
    clothing, settingInstructions, extraInfo,
  } = req.body;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          klantId,
          projectNumber,
          name: name || null,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          contactPerson,
          email,
          campaignDescription, campaignMessage, campaignTargetAudience, campaignTarget,
          clothing, settingInstructions, extraInfo,
        },
      });
      await tx.activation.create({
        data: {
          projectId: project.id,
          location: '',
          date: null,
          briefingToken: generateBriefingToken(),
        },
      });
      return tx.project.findUnique({
        where: { id: project.id },
        include: { klant: true, activations: { include: { staff: { include: { supercharger: true } } } } },
      });
    });
    // Create project folder
    if (result?.klant) {
      await ensureProjectFolder(result.projectNumber, result.klant.name, result.name);
    }
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
  const {
    klantId, projectNumber, name, startDate, endDate, status, contactPerson, email,
    campaignDescription, campaignMessage, campaignTargetAudience, campaignTarget,
    clothing, settingInstructions, extraInfo,
  } = req.body;
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
        name: name !== undefined ? (name || null) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        status,
        contactPerson,
        email,
        campaignDescription, campaignMessage, campaignTargetAudience, campaignTarget,
        clothing, settingInstructions, extraInfo,
      },
      include: { klant: true, activations: { include: { staff: { include: { supercharger: true } } } } },
    });
    // Ensure project folder exists
    if (project.klant) {
      await ensureProjectFolder(project.projectNumber, project.klant.name, project.name);
    }
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
router.get('/:projectId/activations', authMiddleware, async (req: AuthRequest, res: Response) => {
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
      briefingToken: generateBriefingToken(),
    },
    include: { staff: { include: { supercharger: true } } },
  });
  await logAudit('CREATE', 'Activation', activation.id, { projectId: req.params.projectId, location }, req.adminUsername!);
  res.status(201).json(activation);
});

// Update activation (all briefing fields)
router.put('/activations/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const {
    location, locationLat, locationLon, locationZoom, date, startTime, endTime, scheduleItems,
    tasks, storeList, photoRequirements, extraInfo, evaluationLink, target,
    staff, // array of { superchargerId, role }
  } = req.body;

  const activation = await prisma.$transaction(async (tx) => {
    const updated = await tx.activation.update({
      where: { id: Number(req.params.id) },
      data: {
        location,
        locationLat: locationLat !== undefined ? locationLat : undefined,
        locationLon: locationLon !== undefined ? locationLon : undefined,
        locationZoom: locationZoom !== undefined ? locationZoom : undefined,
        date: date ? new Date(date) : null,
        startTime, endTime,
        scheduleItems: scheduleItems !== undefined ? JSON.stringify(scheduleItems) : undefined,
        tasks, storeList, photoRequirements, extraInfo, evaluationLink, target,
      },
    });

    // Update staff assignments if provided
    if (staff !== undefined) {
      await tx.activationStaff.deleteMany({ where: { activationId: updated.id } });
      if (staff.length > 0) {
        await tx.activationStaff.createMany({
          data: staff.map((s: { superchargerId: number; role: string }) => ({
            activationId: updated.id,
            superchargerId: s.superchargerId,
            role: s.role || 'supercharger',
          })),
        });
      }
    }

    return tx.activation.findUnique({
      where: { id: updated.id },
      include: { staff: { include: { supercharger: true } } },
    });
  });

  await logAudit('UPDATE', 'Activation', activation!.id, { location, date }, req.adminUsername!);
  res.json(activation);
});

// Delete activation
router.delete('/activations/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  await prisma.activation.delete({ where: { id } });
  await logAudit('DELETE', 'Activation', id, {}, req.adminUsername!);
  res.json({ success: true });
});

// ── Public Briefing (no auth) ──

router.get('/briefing/:token', async (req: Request, res: Response) => {
  const activation = await prisma.activation.findUnique({
    where: { briefingToken: String(req.params.token) },
    include: {
      project: {
        include: { klant: true },
      },
      staff: {
        include: { supercharger: true },
      },
    },
  });
  if (!activation) {
    res.status(404).json({ error: 'Briefing niet gevonden' });
    return;
  }
  res.json(activation);
});

export default router;
