import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAudit } from '../lib/audit';
import { uploadsDir, fileUpload } from '../middleware/upload';

const router = Router();
const prisma = new PrismaClient();

const PROJECT_INCLUDE = {
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
      superchargers: {
        orderBy: { order: 'asc' as const },
        include: { supercharger: { select: { id: true, firstName: true, lastName: true, function: true, photo: true } } },
      },
    },
  },
  toeleveranciers: {
    include: { toeleverancier: { select: { id: true, name: true, logo: true } } },
  },
  activations: { include: { staff: { include: { supercharger: true } } } },
};

interface ToeleverancierRow { id: number; telefoon?: string | null }

function sanitizeToeleverancierRows(input: unknown): ToeleverancierRow[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<number>();
  const rows: ToeleverancierRow[] = [];
  for (const v of input) {
    const id = typeof v === 'object' && v !== null ? Number((v as Record<string, unknown>).id) : Number(v);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    const telefoon = typeof v === 'object' && v !== null ? ((v as Record<string, unknown>).telefoon as string | null) ?? null : null;
    rows.push({ id, telefoon: telefoon?.trim() || null });
  }
  return rows;
}

/** Legacy: accept plain id array too */
function sanitizeToeleverancierIds(input: unknown): number[] {
  return sanitizeToeleverancierRows(input).map((r) => r.id);
}

function generateBriefingToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

function slugifyPart(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
// Leesbare, stabiele deel-token: projectnr_klant_projectnaam (projectnr is uniek → token uniek).
function projectShareSlug(projectNumber: string, klantName: string, name: string | null): string {
  return [projectNumber, klantName, name || 'project'].map(slugifyPart).filter(Boolean).join('_');
}

// Alleen-lezen locatie-overzicht voor de publieke deel-pagina (geen interne velden).
async function buildSharedLocations(projectId: number) {
  const rows = await prisma.projectLocation.findMany({
    where: { projectId },
    orderBy: { order: 'asc' },
    include: { location: { include: { photos: { orderBy: { order: 'asc' } } } } },
  });
  return rows.map((r) => ({
    id: r.location.id,
    naam: r.location.naam,
    code: r.location.code,
    land: r.location.land,
    stad: r.location.stad,
    adres: r.location.adres,
    lat: r.location.lat,
    lng: r.location.lng,
    omgevingType: r.location.omgevingType,
    m2: r.location.m2,
    photos: r.location.photos.map((ph) => ({ filename: ph.filename, isMain: ph.isMain })),
  }));
}

function sanitize(s: string): string {
  return s.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
}

function toDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

interface ContactInput { naam: string; email?: string | null; telefoon?: string | null }
function sanitizeContacts(input: ContactInput[] | undefined) {
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

interface LocationSuperchargerInput {
  superchargerId: number;
  availability?: Record<string, boolean> | string | null;
}

interface LocationInput {
  locationId: number;
  startDate?: string | null;
  endDate?: string | null;
  available?: 'yes' | 'no' | 'unknown';
  actionOpen?: boolean;
  actionLabel?: string | null;
  opmerkingen?: string;
  superchargers?: LocationSuperchargerInput[];
}

/** Coerce een willekeurig object naar { [date]: boolean }. */
function coerceAvailabilityObject(obj: unknown): string {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '{}';
  const cleaned: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) cleaned[k] = !!v;
  return JSON.stringify(cleaned);
}

function sanitizeLocationSuperchargers(input: LocationSuperchargerInput[] | undefined) {
  if (!Array.isArray(input)) return [];
  const seen = new Set<number>();
  const rows: Array<{ superchargerId: number; availability: string; order: number }> = [];
  input.forEach((s, i) => {
    const superchargerId = Number(s?.superchargerId);
    if (!Number.isFinite(superchargerId) || superchargerId <= 0 || seen.has(superchargerId)) return;
    seen.add(superchargerId);
    let availability = '{}';
    if (typeof s.availability === 'string') {
      // Parse + valideer dat het een plat object is (geen array, geen primitief).
      try {
        const parsed = JSON.parse(s.availability);
        availability = coerceAvailabilityObject(parsed);
      } catch { /* keep default */ }
    } else if (s.availability && typeof s.availability === 'object') {
      availability = coerceAvailabilityObject(s.availability);
    }
    rows.push({ superchargerId, availability, order: i });
  });
  return rows;
}

interface SanitizedLocation {
  locationId: number;
  order: number;
  startDate: Date | null;
  endDate: Date | null;
  available: string;
  actionOpen: boolean;
  actionLabel: string | null;
  opmerkingen: string;
  superchargers: Array<{ superchargerId: number; availability: string; order: number }>;
}

/** Convert sanitized location to Prisma nested-create format. */
function locationToPrismaCreate(l: SanitizedLocation) {
  const { superchargers, ...rest } = l;
  return {
    ...rest,
    superchargers: { create: superchargers.map((s) => ({ superchargerId: s.superchargerId, availability: s.availability, order: s.order })) },
  };
}

function sanitizeLocations(input: LocationInput[] | undefined) {
  if (!Array.isArray(input)) return [];
  return input
    .map((l, i) => {
      const locationId = Number(l.locationId);
      if (!Number.isFinite(locationId) || locationId <= 0) return null;
      return {
        locationId, order: i,
        startDate: toDate(l.startDate),
        endDate: toDate(l.endDate),
        available: l.available === 'yes' || l.available === 'no' ? l.available : 'unknown',
        actionOpen: !!l.actionOpen,
        actionLabel: l.actionLabel?.trim() || null,
        opmerkingen: l.opmerkingen ?? '',
        superchargers: sanitizeLocationSuperchargers(l.superchargers),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

async function projectFolder(id: number): Promise<string | null> {
  const p = await prisma.project.findUnique({
    where: { id },
    include: { klant: { select: { name: true } } },
  });
  if (!p) return null;
  const folderName = [p.projectNumber, p.klant.name, p.name || 'project']
    .map(sanitize).filter(Boolean).join('_');
  return path.join(uploadsDir, 'Projecten', folderName);
}

function readNotes(folder: string): Record<string, string> {
  const p = path.join(folder, '_notes.json');
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return {}; }
}
function writeNotes(folder: string, notes: Record<string, string>) {
  fs.writeFileSync(path.join(folder, '_notes.json'), JSON.stringify(notes, null, 2));
}

// ── Projects ──

// List projects
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const status = req.query.status as string | undefined;
  const where = status ? { status } : {};
  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      klant: { select: { id: true, name: true, logo: true } },
      toeleveranciers: { select: { toeleverancierId: true } },
      _count: { select: { activations: true, locations: true } },
    },
  });
  res.json(projects);
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const project = await prisma.project.findUnique({
    where: { id: Number(req.params.id) },
    include: PROJECT_INCLUDE,
  });
  if (!project) { res.status(404).json({ error: 'Project niet gevonden' }); return; }
  // Backfill leesbare deel-token voor bestaande projecten zonder token.
  if (!project.locationShareToken) {
    const slug = projectShareSlug(project.projectNumber, project.klant.name, project.name);
    try {
      await prisma.project.update({ where: { id: project.id }, data: { locationShareToken: slug } });
      project.locationShareToken = slug;
    } catch { /* zeldzame slug-botsing — laat token null */ }
  }
  res.json(project);
});

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const {
    klantId, projectNumber, name, startDate, endDate, contactPerson, email,
    needsLocations, needsSuperchargers, notities,
    campaignDescription, campaignMessage, campaignTargetAudience, campaignTarget,
    clothing, settingInstructions, extraInfo,
    contacts, locations, toeleverancierIds,
  } = req.body;
  const tRows = sanitizeToeleverancierRows(toeleverancierIds);
  const klantForSlug = await prisma.klant.findUnique({ where: { id: klantId }, select: { name: true } });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          klantId,
          projectNumber,
          name: name || null,
          startDate: startDate ? new Date(startDate) : new Date(),
          endDate:   endDate   ? new Date(endDate)   : new Date(),
          contactPerson, email,
          needsLocations: !!needsLocations,
          needsSuperchargers: !!needsSuperchargers,
          notities: notities ?? '',
          campaignDescription, campaignMessage, campaignTargetAudience, campaignTarget,
          clothing, settingInstructions, extraInfo,
          locationShareToken: projectShareSlug(projectNumber, klantForSlug?.name ?? '', name || null),
          contacts:  { create: sanitizeContacts(contacts) },
          locations: { create: sanitizeLocations(locations).map(locationToPrismaCreate) },
          toeleveranciers: { create: tRows.map((r) => ({ toeleverancierId: r.id, telefoon: r.telefoon })) },
        },
      });
      // Auto-aanmaken eerste activation als needsSuperchargers aan staat
      if (needsSuperchargers) {
        await tx.activation.create({
          data: { projectId: project.id, location: '', date: null, briefingToken: generateBriefingToken() },
        });
      }
      return tx.project.findUnique({ where: { id: project.id }, include: PROJECT_INCLUDE });
    });
    await logAudit('CREATE', 'Project', result!.id, { projectNumber, klantId }, req.adminUsername!);
    res.status(201).json(result);
  } catch (err: unknown) {
    const prismaErr = err as { code?: string };
    if (prismaErr.code === 'P2002') { res.status(400).json({ error: 'Er bestaat al een project met dit projectnummer' }); return; }
    throw err;
  }
});

router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const {
    klantId, projectNumber, name, startDate, endDate, status, contactPerson, email,
    needsLocations, needsSuperchargers, notities,
    campaignDescription, campaignMessage, campaignTargetAudience, campaignTarget,
    clothing, settingInstructions, extraInfo,
    contacts, locations, toeleverancierIds,
  } = req.body;
  if (status && !['active', 'completed', 'cancelled'].includes(status)) {
    res.status(400).json({ error: 'Ongeldige status' }); return;
  }
  const hasToeleveranciersField = toeleverancierIds !== undefined;
  const tRows = hasToeleveranciersField ? sanitizeToeleverancierRows(toeleverancierIds) : [];

  // Folder hernoemen indien projectNumber/klant/name wijzigt
  const existing = await prisma.project.findUnique({ where: { id }, include: { klant: { select: { name: true } } } });

  try {
    const project = await prisma.$transaction(async (tx) => {
      // Replace contacts/locations/toeleveranciers als meegegeven
      if (contacts !== undefined) {
        await tx.projectContact.deleteMany({ where: { projectId: id } });
      }
      if (locations !== undefined) {
        await tx.projectLocation.deleteMany({ where: { projectId: id } });
      }
      if (hasToeleveranciersField) {
        await tx.projectToeleverancier.deleteMany({ where: { projectId: id } });
      }
      return tx.project.update({
        where: { id },
        data: {
          klantId,
          projectNumber,
          name: name !== undefined ? (name || null) : undefined,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate:   endDate   ? new Date(endDate)   : undefined,
          status,
          contactPerson, email,
          needsLocations: needsLocations !== undefined ? !!needsLocations : undefined,
          needsSuperchargers: needsSuperchargers !== undefined ? !!needsSuperchargers : undefined,
          notities: notities !== undefined ? notities : undefined,
          campaignDescription, campaignMessage, campaignTargetAudience, campaignTarget,
          clothing, settingInstructions, extraInfo,
          ...(contacts  !== undefined ? { contacts:  { create: sanitizeContacts(contacts)   } } : {}),
          ...(locations !== undefined ? { locations: { create: sanitizeLocations(locations).map(locationToPrismaCreate) } } : {}),
          ...(hasToeleveranciersField ? { toeleveranciers: { create: tRows.map((r) => ({ toeleverancierId: r.id, telefoon: r.telefoon })) } } : {}),
        },
        include: PROJECT_INCLUDE,
      });
    });

    // Hernoem folder als naam-componenten zijn gewijzigd
    if (existing) {
      const oldName = [existing.projectNumber, existing.klant.name, existing.name || 'project'].map(sanitize).filter(Boolean).join('_');
      const newName = [project.projectNumber, project.klant.name, project.name || 'project'].map(sanitize).filter(Boolean).join('_');
      if (oldName !== newName) {
        const oldPath = path.join(uploadsDir, 'Projecten', oldName);
        const newPath = path.join(uploadsDir, 'Projecten', newName);
        if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
          try { fs.renameSync(oldPath, newPath); } catch { /* stil falen */ }
        }
      }
    }

    await logAudit('UPDATE', 'Project', project.id, { projectNumber, status }, req.adminUsername!);
    res.json(project);
  } catch (err: unknown) {
    const prismaErr = err as { code?: string };
    if (prismaErr.code === 'P2002') { res.status(400).json({ error: 'Er bestaat al een project met dit projectnummer' }); return; }
    throw err;
  }
});

// Stel het optionele wachtwoord van de deel-link in of wis het. De link (token) zelf
// is een vaste, leesbare slug die bij het project hoort — die wordt hier niet gewijzigd.
router.put('/:id/share', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const { password } = req.body as { password?: string | null };

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, locationShareToken: true },
  });
  if (!project) { res.status(404).json({ error: 'Project niet gevonden' }); return; }

  // Wachtwoord wordt als platte tekst bewaard (zichtbaar voor ingelogde admins; de site
  // zit volledig achter login). password: niet-lege string => zetten, '' of null => wissen.
  const data: { locationSharePassword?: string | null } = {};
  if (password === null || password === '') {
    data.locationSharePassword = null;
  } else if (typeof password === 'string') {
    data.locationSharePassword = password;
  }

  const updated = await prisma.project.update({
    where: { id },
    data,
    select: { locationShareToken: true, locationSharePassword: true },
  });
  await logAudit('UPDATE', 'Project', id, { share: 'wachtwoord bijgewerkt' }, req.adminUsername!);
  res.json({ shareToken: updated.locationShareToken, password: updated.locationSharePassword });
});

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  await prisma.project.delete({ where: { id } });
  await logAudit('DELETE', 'Project', id, {}, req.adminUsername!);
  res.json({ success: true });
});

// ── Bestanden ───────────────────────────────────────────────────────────────

router.get('/:id/files', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const folder = await projectFolder(id);
  if (!folder) { res.status(404).json({ error: 'Project niet gevonden' }); return; }
  if (!fs.existsSync(folder)) { res.json([]); return; }
  const notes = readNotes(folder);
  const files = fs.readdirSync(folder)
    .filter(name => name !== '_notes.json')
    .map(filename => {
      const stats = fs.statSync(path.join(folder, filename));
      const relName = path.relative(uploadsDir, folder);
      return {
        filename, size: stats.size, uploadedAt: stats.mtime.toISOString(),
        url: `/uploads/${relName.split(path.sep).map(encodeURIComponent).join('/')}/${encodeURIComponent(filename)}`,
        notitie: notes[filename] ?? '',
      };
    });
  res.json(files);
});

router.post('/:id/files', authMiddleware, fileUpload.array('files', 20), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const folder = await projectFolder(id);
  if (!folder) { res.status(404).json({ error: 'Project niet gevonden' }); return; }
  fs.mkdirSync(folder, { recursive: true });

  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) { res.status(400).json({ error: 'Geen bestanden meegestuurd' }); return; }

  const saved: string[] = [];
  for (const f of files) {
    const ext = path.extname(f.originalname);
    const base = path.basename(f.originalname, ext);
    let target = path.join(folder, f.originalname);
    let n = 1;
    while (fs.existsSync(target)) { target = path.join(folder, `${base} (${n})${ext}`); n++; }
    fs.writeFileSync(target, f.buffer);
    saved.push(path.basename(target));
  }
  await logAudit('UPDATE', 'Project', id, { uploaded: saved }, req.adminUsername);
  res.json({ saved });
});

router.patch('/:id/files/:filename', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const folder = await projectFolder(id);
  if (!folder) { res.status(404).json({ error: 'Project niet gevonden' }); return; }
  const filename = String(req.params.filename ?? '');
  if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    res.status(400).json({ error: 'Ongeldige bestandsnaam' }); return;
  }
  if (!fs.existsSync(path.join(folder, filename))) { res.status(404).json({ error: 'Bestand niet gevonden' }); return; }
  const notitie = String(req.body?.notitie ?? '').trim();
  const notes = readNotes(folder);
  if (notitie) notes[filename] = notitie; else delete notes[filename];
  writeNotes(folder, notes);
  res.json({ filename, notitie });
});

router.delete('/:id/files/:filename', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const folder = await projectFolder(id);
  if (!folder) { res.status(404).json({ error: 'Project niet gevonden' }); return; }
  const filename = String(req.params.filename ?? '');
  if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    res.status(400).json({ error: 'Ongeldige bestandsnaam' }); return;
  }
  const target = path.join(folder, filename);
  if (!fs.existsSync(target)) { res.status(404).json({ error: 'Bestand niet gevonden' }); return; }
  fs.unlinkSync(target);
  const notes = readNotes(folder);
  if (notes[filename]) { delete notes[filename]; writeNotes(folder, notes); }
  await logAudit('UPDATE', 'Project', id, { deletedFile: filename }, req.adminUsername);
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

// ── Publieke deelbare locatie-link (geen auth) ───────────────────────────────
// GET: haalt overzicht op; als er een wachtwoord is, alleen metadata + requiresPassword.
router.get('/share/locations/:token', async (req: Request, res: Response) => {
  const project = await prisma.project.findUnique({
    where: { locationShareToken: String(req.params.token) },
    select: { id: true, name: true, projectNumber: true, locationSharePassword: true, klant: { select: { name: true } } },
  });
  if (!project) { res.status(404).json({ error: 'Deel-link niet gevonden' }); return; }
  const meta = { projectName: project.name || project.projectNumber, klantName: project.klant.name };
  if (project.locationSharePassword) {
    res.json({ requiresPassword: true, ...meta });
    return;
  }
  res.json({ requiresPassword: false, ...meta, locations: await buildSharedLocations(project.id) });
});

// POST: verifieer wachtwoord en geef het overzicht terug.
router.post('/share/locations/:token', async (req: Request, res: Response) => {
  const { password } = req.body as { password?: string };
  const project = await prisma.project.findUnique({
    where: { locationShareToken: String(req.params.token) },
    select: { id: true, name: true, projectNumber: true, locationSharePassword: true, klant: { select: { name: true } } },
  });
  if (!project) { res.status(404).json({ error: 'Deel-link niet gevonden' }); return; }
  if (project.locationSharePassword) {
    const ok = typeof password === 'string' && password === project.locationSharePassword;
    if (!ok) { res.status(401).json({ error: 'Onjuist wachtwoord' }); return; }
  }
  res.json({
    requiresPassword: false,
    projectName: project.name || project.projectNumber,
    klantName: project.klant.name,
    locations: await buildSharedLocations(project.id),
  });
});

export default router;
