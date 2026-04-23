import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAudit } from '../lib/audit';

const router = Router();
const prisma = new PrismaClient();

const LOCATION_INCLUDE = {
  klant: { select: { id: true, name: true, logo: true } },
  contacts: { orderBy: { order: 'asc' as const } },
  locations: {
    orderBy: { order: 'asc' as const },
    include: {
      location: {
        include: {
          contacts: { orderBy: { order: 'asc' as const } },
          photos: { orderBy: { order: 'asc' as const } },
          costs: { orderBy: { order: 'asc' as const } },
        },
      },
    },
  },
};

interface ContactInput { naam: string; email?: string | null; telefoon?: string | null }

function sanitizeContacts(input: ContactInput[] | undefined): Array<{ naam: string; email: string | null; telefoon: string | null; order: number }> {
  if (!Array.isArray(input)) return [];
  return input
    .filter((c) => c && (c.naam?.trim() || c.email?.trim() || c.telefoon?.trim()))
    .map((c, i) => ({
      naam: (c.naam ?? '').trim(),
      email: c.email?.trim() || null,
      telefoon: c.telefoon?.trim() || null,
      order: i,
    }));
}

interface LocProjectLocationInput {
  locationId: number;
  startDate?: string | null;
  endDate?: string | null;
  available?: 'yes' | 'no' | 'unknown';
  actionOpen?: boolean;
  actionLabel?: string | null;
  opmerkingen?: string;
}

type LocProjectStatus = 'starten' | 'bezig' | 'afgerond';

interface LocProjectInput {
  klantId: number;
  projectNumber: string;
  name?: string | null;
  status?: LocProjectStatus;
  contactPerson?: string | null;
  email?: string | null;
  telefoon?: string | null;
  contacts?: ContactInput[];
  notities?: string;
  locations?: LocProjectLocationInput[];
}

function normalizeStatus(s: unknown): LocProjectStatus {
  return s === 'bezig' || s === 'afgerond' ? s : 'starten';
}

function toDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sanitizeLocations(input: LocProjectLocationInput[] | undefined): Array<{
  locationId: number; order: number; startDate: Date | null; endDate: Date | null;
  available: string; actionOpen: boolean; actionLabel: string | null; opmerkingen: string;
}> {
  if (!Array.isArray(input)) return [];
  return input
    .map((l, i): { locationId: number; order: number; startDate: Date | null; endDate: Date | null; available: string; actionOpen: boolean; actionLabel: string | null; opmerkingen: string } | null => {
      const locationId = Number(l.locationId);
      if (!Number.isFinite(locationId) || locationId <= 0) return null;
      return {
        locationId,
        order: i,
        startDate: toDate(l.startDate),
        endDate: toDate(l.endDate),
        available: l.available === 'yes' || l.available === 'no' ? l.available : 'unknown',
        actionOpen: !!l.actionOpen,
        actionLabel: l.actionLabel?.trim() || null,
        opmerkingen: l.opmerkingen ?? '',
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

async function validateLocationIds(ids: number[]): Promise<string | null> {
  if (ids.length === 0) return null;
  const found = await prisma.location.findMany({ where: { id: { in: ids } }, select: { id: true } });
  const foundSet = new Set(found.map((f) => f.id));
  const missing = ids.filter((id) => !foundSet.has(id));
  return missing.length > 0 ? `Onbekende locatie-id's: ${missing.join(', ')}` : null;
}

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const rawLimit = Number(req.query.limit);
  const rawOffset = Number(req.query.offset);
  const take = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 1000) : undefined;
  const skip = Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : undefined;
  const projects = await prisma.locProject.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      klant: { select: { id: true, name: true, logo: true } },
      _count: { select: { locations: true } },
    },
    take,
    skip,
  });
  res.json(projects);
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const project = await prisma.locProject.findUnique({
    where: { id: Number(req.params.id) },
    include: LOCATION_INCLUDE,
  });
  if (!project) { res.status(404).json({ error: 'Project niet gevonden' }); return; }
  res.json(project);
});

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const body = req.body as LocProjectInput;
  if (!body.projectNumber?.trim()) { res.status(400).json({ error: 'Projectnummer is verplicht' }); return; }
  const klantId = Number(body.klantId);
  if (!Number.isFinite(klantId) || klantId <= 0) { res.status(400).json({ error: 'Ongeldige klant' }); return; }
  const klantExists = await prisma.klant.findUnique({ where: { id: klantId }, select: { id: true } });
  if (!klantExists) { res.status(400).json({ error: 'Klant niet gevonden' }); return; }

  const locs = sanitizeLocations(body.locations);
  const locError = await validateLocationIds(locs.map((l) => l.locationId));
  if (locError) { res.status(400).json({ error: locError }); return; }
  const contacts = sanitizeContacts(body.contacts);
  // Legacy velden synchroon met eerste contact zodat lijstweergaven blijven werken
  const legacy = contacts[0] ?? {};
  try {
    const project = await prisma.locProject.create({
      data: {
        klantId,
        projectNumber: body.projectNumber.trim(),
        name: body.name?.trim() || null,
        status: normalizeStatus(body.status),
        contactPerson: legacy.naam || body.contactPerson?.trim() || null,
        email: legacy.email || body.email?.trim() || null,
        telefoon: legacy.telefoon || body.telefoon?.trim() || null,
        notities: body.notities ?? '',
        locations: { create: locs },
        contacts: { create: contacts },
      },
      include: LOCATION_INCLUDE,
    });
    await logAudit('CREATE', 'LocProject', project.id, { projectNumber: project.projectNumber }, req.adminUsername);
    res.status(201).json(project);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === 'P2002') { res.status(400).json({ error: 'Projectnummer bestaat al' }); return; }
    throw err;
  }
});

router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) { res.status(400).json({ error: 'Ongeldig project-id' }); return; }
  const body = req.body as LocProjectInput;
  const existing = await prisma.locProject.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ error: 'Project niet gevonden' }); return; }
  if (!body.projectNumber?.trim()) { res.status(400).json({ error: 'Projectnummer is verplicht' }); return; }
  const klantId = Number(body.klantId);
  if (!Number.isFinite(klantId) || klantId <= 0) { res.status(400).json({ error: 'Ongeldige klant' }); return; }
  const klantExists = await prisma.klant.findUnique({ where: { id: klantId }, select: { id: true } });
  if (!klantExists) { res.status(400).json({ error: 'Klant niet gevonden' }); return; }

  const hasLocationsField = body.locations !== undefined;
  const hasContactsField = body.contacts !== undefined;
  const locs = sanitizeLocations(body.locations);
  if (hasLocationsField) {
    const locError = await validateLocationIds(locs.map((l) => l.locationId));
    if (locError) { res.status(400).json({ error: locError }); return; }
  }
  const contacts = sanitizeContacts(body.contacts);
  const legacy = contacts[0] ?? {};

  try {
    const project = await prisma.$transaction(async (tx) => {
      if (hasLocationsField) {
        await tx.locProjectLocation.deleteMany({ where: { locProjectId: id } });
      }
      if (hasContactsField) {
        await tx.locProjectContact.deleteMany({ where: { locProjectId: id } });
      }
      return tx.locProject.update({
        where: { id },
        data: {
          klantId,
          projectNumber: body.projectNumber.trim(),
          name: body.name?.trim() || null,
          status: normalizeStatus(body.status),
          contactPerson: hasContactsField ? (legacy.naam || null) : body.contactPerson?.trim() || null,
          email: hasContactsField ? (legacy.email || null) : body.email?.trim() || null,
          telefoon: hasContactsField ? (legacy.telefoon || null) : body.telefoon?.trim() || null,
          notities: body.notities ?? '',
          ...(hasLocationsField ? { locations: { create: locs } } : {}),
          ...(hasContactsField ? { contacts: { create: contacts } } : {}),
        },
        include: LOCATION_INCLUDE,
      });
    });
    await logAudit('UPDATE', 'LocProject', id, { projectNumber: project.projectNumber }, req.adminUsername);
    res.json(project);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === 'P2002') { res.status(400).json({ error: 'Projectnummer bestaat al' }); return; }
    throw err;
  }
});

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const existing = await prisma.locProject.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ error: 'Project niet gevonden' }); return; }
  await prisma.locProject.delete({ where: { id } });
  await logAudit('DELETE', 'LocProject', id, { projectNumber: existing.projectNumber }, req.adminUsername);
  res.json({ success: true });
});

export default router;
