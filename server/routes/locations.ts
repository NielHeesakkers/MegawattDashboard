import fs from 'fs';
import path from 'path';
import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import multer from 'multer';
import sharp from 'sharp';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAudit } from '../lib/audit';
import { geocode, formatAddress, suggest } from '../lib/geocode';
import { generateLocationCode } from '../lib/locationCode';
import { uploadsDir } from '../middleware/upload';

const router = Router();

function serializeLocation<T extends { stroomvoorzieningTypes: string; doelgroepen: string; eventTypes: string }>(loc: T) {
  const arr = (s: string): string[] => { try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; } };
  return { ...loc, stroomvoorzieningTypes: arr(loc.stroomvoorzieningTypes), doelgroepen: arr(loc.doelgroepen), eventTypes: arr(loc.eventTypes) };
}

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Alleen afbeeldingen toegestaan'));
    }
  },
});

// GET /api/locations/suggest — adres-autocomplete via server-side Nominatim queue
router.get('/suggest', authMiddleware, async (req: AuthRequest, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const land = typeof req.query.land === 'string' ? req.query.land : null;
  const results = await suggest(q, land, 5);
  res.json(results);
});

// GET /api/locations — lijst met relaties (optioneel ?limit + ?offset)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const rawLimit = Number(req.query.limit);
  const rawOffset = Number(req.query.offset);
  const take = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 1000) : undefined;
  const skip = Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : undefined;
  const locations = await prisma.location.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      contacts: { orderBy: { order: 'asc' } },
      photos: { orderBy: { order: 'asc' } },
      costs: { orderBy: { order: 'asc' } },
    },
    take,
    skip,
  });
  res.json(locations.map(serializeLocation));
});

// GET /api/locations/:id — enkele locatie
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const location = await prisma.location.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      contacts: { orderBy: { order: 'asc' } },
      photos: { orderBy: { order: 'asc' } },
      costs: { orderBy: { order: 'asc' } },
      projects: {
        include: {
          project: { include: { klant: { select: { id: true, name: true, logo: true } } } },
        },
        orderBy: { order: 'asc' },
      },
    },
  });
  if (!location) { res.status(404).json({ error: 'Locatie niet gevonden' }); return; }
  res.json(serializeLocation(location));
});

interface ContactInput { naam: string; email?: string | null; telefoon?: string | null; website?: string | null; rol?: string | null; }
interface CostInput { label: string; bedragCents: number; }

interface LocationInput {
  naam: string;
  land: string;
  adres: string;
  omgevingType: string;
  orientatie: string;
  eigendomType: string;
  vergunningNodig: boolean;
  vergunningLink?: string | null;
  truckBereikbaar: boolean;
  geschiktActivatie: boolean;
  geschiktSampling: boolean;
  geschiktHotspot: boolean;
  geschiktAnder?: string | null;
  stroom: boolean;
  verlichting: boolean;
  lengte?: number | null;
  breedte?: number | null;
  m2?: number | null;
  notities: string;
  contacts: ContactInput[];
  costs: CostInput[];
  stroomvoorzieningTypes?: string[];
  aanvraagtijd?: string;
  volumeSampling?: string;
  doelgroepen?: string[];
  eventTypes?: string[];
}

// POST /api/locations — nieuwe locatie
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const body = req.body as LocationInput;
  if (!body.naam?.trim()) { res.status(400).json({ error: 'Naam is verplicht' }); return; }
  if (!body.land?.trim()) { res.status(400).json({ error: 'Land is verplicht' }); return; }
  if (!body.adres?.trim()) { res.status(400).json({ error: 'Adres is verplicht' }); return; }

  const coords = body.adres ? await geocode(body.adres, body.land) : null;
  // Overschrijf adres met canonical Nominatim-versie indien gevonden; anders user input
  const canonicalAdres = coords ? formatAddress(coords) || body.adres : body.adres;
  const stad = coords?.city || null;

  // Race-safe create: bij P2002 op `code` (concurrent insert voor zelfde stad) regenereren en opnieuw proberen.
  let location: Awaited<ReturnType<typeof prisma.location.create>> | null = null;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = await generateLocationCode(stad);
    try {
      location = await prisma.location.create({
        data: {
          code,
          naam: body.naam,
          land: body.land,
          stad,
          adres: canonicalAdres,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          omgevingType: body.omgevingType,
          orientatie: body.orientatie,
          eigendomType: body.eigendomType,
          vergunningNodig: body.vergunningNodig,
          vergunningLink: body.vergunningLink ?? null,
          truckBereikbaar: body.truckBereikbaar,
          geschiktActivatie: body.geschiktActivatie,
          geschiktSampling: body.geschiktSampling,
          geschiktHotspot: body.geschiktHotspot ?? false,
          geschiktAnder: body.geschiktAnder ?? null,
          stroom: body.stroom,
          verlichting: body.verlichting,
          lengte: body.lengte ?? null,
          breedte: body.breedte ?? null,
          m2: body.m2 ?? null,
          notities: body.notities ?? '',
          stroomvoorzieningTypes: JSON.stringify(body.stroomvoorzieningTypes ?? []),
          aanvraagtijd: body.aanvraagtijd ?? '',
          volumeSampling: body.volumeSampling ?? '',
          doelgroepen: JSON.stringify(body.doelgroepen ?? []),
          eventTypes: JSON.stringify(body.eventTypes ?? []),
          contacts: { create: (body.contacts ?? []).map((c, i) => ({ ...c, order: i })) },
          costs: { create: (body.costs ?? []).map((c, i) => ({ ...c, order: i })) },
        },
        include: { contacts: true, photos: true, costs: true },
      });
      break;
    } catch (err) {
      lastErr = err;
      const e = err as { code?: string; meta?: { target?: string[] | string } };
      const isCodeCollision = e.code === 'P2002' && (
        Array.isArray(e.meta?.target) ? e.meta.target.includes('code') : e.meta?.target === 'code'
      );
      if (!isCodeCollision) throw err;
      // concurrent insert voor dezelfde stad-prefix — probeer opnieuw met verse seq-nummer
    }
  }
  if (!location) {
    console.error('[locations] Code collision after 4 attempts', lastErr);
    res.status(409).json({ error: 'Locatie-code conflict, probeer opnieuw' });
    return;
  }

  await logAudit('CREATE', 'Location', location.id, { naam: body.naam, code: location.code }, req.adminUsername);
  res.status(201).json(serializeLocation(location));
});

// PUT /api/locations/:id — update (contacts/costs worden volledig vervangen)
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const body = req.body as LocationInput;
  if (!body.naam?.trim()) { res.status(400).json({ error: 'Naam is verplicht' }); return; }
  if (!body.land?.trim()) { res.status(400).json({ error: 'Land is verplicht' }); return; }
  if (!body.adres?.trim()) { res.status(400).json({ error: 'Adres is verplicht' }); return; }

  const existing = await prisma.location.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ error: 'Locatie niet gevonden' }); return; }

  // Alleen geocoden als adres of land gewijzigd is
  let coords: Awaited<ReturnType<typeof geocode>> = null;
  const addressChanged = body.adres !== existing.adres || body.land !== existing.land;
  if (addressChanged && body.adres) coords = await geocode(body.adres, body.land);
  const canonicalAdres = coords ? formatAddress(coords) || body.adres : body.adres;
  const stad = coords?.city ?? existing.stad;

  const location = await prisma.$transaction(async (tx) => {
    await tx.locationContact.deleteMany({ where: { locationId: id } });
    await tx.locationCost.deleteMany({ where: { locationId: id } });
    return tx.location.update({
      where: { id },
      data: {
        naam: body.naam,
        land: body.land,
        stad,
        adres: canonicalAdres,
        lat: addressChanged ? coords?.lat ?? null : existing.lat,
        lng: addressChanged ? coords?.lng ?? null : existing.lng,
        omgevingType: body.omgevingType,
        orientatie: body.orientatie,
        eigendomType: body.eigendomType,
        vergunningNodig: body.vergunningNodig,
        vergunningLink: body.vergunningLink ?? null,
        truckBereikbaar: body.truckBereikbaar,
        geschiktActivatie: body.geschiktActivatie,
        geschiktSampling: body.geschiktSampling,
        geschiktHotspot: body.geschiktHotspot ?? false,
        geschiktAnder: body.geschiktAnder ?? null,
        stroom: body.stroom,
        verlichting: body.verlichting,
        lengte: body.lengte ?? null,
        breedte: body.breedte ?? null,
        m2: body.m2 ?? null,
        notities: body.notities ?? '',
        stroomvoorzieningTypes: JSON.stringify(body.stroomvoorzieningTypes ?? []),
        aanvraagtijd: body.aanvraagtijd ?? '',
        volumeSampling: body.volumeSampling ?? '',
        doelgroepen: JSON.stringify(body.doelgroepen ?? []),
        eventTypes: JSON.stringify(body.eventTypes ?? []),
        contacts: { create: (body.contacts ?? []).map((c, i) => ({ ...c, order: i })) },
        costs: { create: (body.costs ?? []).map((c, i) => ({ ...c, order: i })) },
      },
      include: { contacts: true, photos: true, costs: true },
    });
  });

  await logAudit('UPDATE', 'Location', id, { naam: body.naam }, req.adminUsername);
  res.json(serializeLocation(location));
});

// DELETE /api/locations/:id — met ?force=true om cascade door LocProjects te bevestigen
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const existing = await prisma.location.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ error: 'Locatie niet gevonden' }); return; }

  const force = req.query.force === 'true' || req.query.force === '1';
  const linked = await prisma.projectLocation.findMany({
    where: { locationId: id },
    include: { project: { select: { id: true, projectNumber: true, name: true } } },
  });
  if (linked.length > 0 && !force) {
    res.status(409).json({
      error: 'Locatie is gekoppeld aan projecten',
      projects: linked.map((l) => ({ id: l.project.id, projectNumber: l.project.projectNumber, name: l.project.name })),
    });
    return;
  }

  await prisma.location.delete({ where: { id } });

  // Opruimen van foto-bestanden (row is al weg — failures hier mogen de request niet laten falen)
  const photoDir = path.join(uploadsDir, 'Locaties', String(id));
  try {
    if (fs.existsSync(photoDir)) fs.rmSync(photoDir, { recursive: true, force: true });
  } catch (err) {
    console.error(`[locations] Failed to remove photo dir for location ${id}:`, err);
  }

  await logAudit('DELETE', 'Location', id, { naam: existing.naam }, req.adminUsername);
  res.json({ success: true });
});

// POST /api/locations/:id/geocode — handmatig opnieuw geocoden
router.post('/:id/geocode', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const existing = await prisma.location.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ error: 'Locatie niet gevonden' }); return; }
  const coords = existing.adres ? await geocode(existing.adres, existing.land) : null;
  // Alleen overschrijven als geocode slaagde — anders bestaande coords + adres behouden
  const updated = coords
    ? await prisma.location.update({
        where: { id },
        data: {
          lat: coords.lat,
          lng: coords.lng,
          stad: coords.city || existing.stad,
          adres: formatAddress(coords) || existing.adres,
          code: existing.code ?? await generateLocationCode(coords.city),
        },
      })
    : existing;
  res.json({ lat: updated.lat, lng: updated.lng, adres: updated.adres, code: updated.code, found: !!coords });
});

// POST /api/locations/backfill-codes — genereer codes voor locaties die er nog geen hebben
router.post('/backfill-codes', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const missing = await prisma.location.findMany({ where: { code: null } });
  const results: Array<{ id: number; code: string | null; stad: string | null }> = [];
  for (const loc of missing) {
    let stad = loc.stad;
    if (!stad && loc.adres) {
      const coords = await geocode(loc.adres, loc.land);
      stad = coords?.city || null;
    }
    const code = await generateLocationCode(stad);
    await prisma.location.update({ where: { id: loc.id }, data: { code, stad } });
    results.push({ id: loc.id, code, stad });
  }
  res.json({ count: results.length, results });
});

// POST /api/locations/:id/photos — upload één of meerdere foto's
router.post('/:id/photos', authMiddleware, photoUpload.array('photos', 20), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const location = await prisma.location.findUnique({ where: { id }, include: { photos: true } });
  if (!location) { res.status(404).json({ error: 'Locatie niet gevonden' }); return; }

  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) { res.status(400).json({ error: 'Geen bestanden' }); return; }

  const photoDir = path.join(uploadsDir, 'Locaties', String(id));
  fs.mkdirSync(photoDir, { recursive: true });

  let order = location.photos.length;
  const hasMain = location.photos.some((p) => p.isMain);
  const saved: Awaited<ReturnType<typeof prisma.locationPhoto.create>>[] = [];
  for (const file of files) {
    const photo = await prisma.locationPhoto.create({
      data: {
        locationId: id,
        filename: 'pending',
        isMain: !hasMain && saved.length === 0,
        order: order++,
      },
    });
    const filename = `${photo.id}.jpg`;
    const outPath = path.join(photoDir, filename);
    try {
      await sharp(file.buffer).rotate().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(outPath);
    } catch (err) {
      // Sharp mislukt — verwijder de placeholder-rij om orphan state te voorkomen
      await prisma.locationPhoto.delete({ where: { id: photo.id } }).catch(() => {});
      throw err;
    }
    const updated = await prisma.locationPhoto.update({ where: { id: photo.id }, data: { filename } });
    saved.push(updated);
  }

  await logAudit('CREATE', 'LocationPhoto', id, { count: saved.length }, req.adminUsername);
  res.status(201).json(saved);
});

// DELETE /api/locations/:id/photos/:photoId
router.delete('/:id/photos/:photoId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const photoId = Number(req.params.photoId);
  const photo = await prisma.locationPhoto.findFirst({ where: { id: photoId, locationId: id } });
  if (!photo) { res.status(404).json({ error: 'Foto niet gevonden' }); return; }

  const filePath = path.join(uploadsDir, 'Locaties', String(id), photo.filename);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (err) { console.error(`[locations] Failed to unlink photo ${photoId}:`, err); }
  }
  await prisma.locationPhoto.delete({ where: { id: photoId } });

  // Als hoofdfoto verwijderd, promoveer de eerste remaining
  if (photo.isMain) {
    const next = await prisma.locationPhoto.findFirst({ where: { locationId: id }, orderBy: { order: 'asc' } });
    if (next) await prisma.locationPhoto.update({ where: { id: next.id }, data: { isMain: true } });
  }

  await logAudit('DELETE', 'LocationPhoto', photoId, { locationId: id, filename: photo.filename }, req.adminUsername);
  res.json({ success: true });
});

// PATCH /api/locations/:id/photos/order — { order: number[] }
router.patch('/:id/photos/order', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const order = req.body.order as number[];
  if (!Array.isArray(order)) { res.status(400).json({ error: 'order moet een array zijn' }); return; }
  await prisma.$transaction(
    order.map((photoId, idx) =>
      prisma.locationPhoto.updateMany({ where: { id: photoId, locationId: id }, data: { order: idx } }),
    ),
  );
  await logAudit('UPDATE', 'LocationPhoto', id, { action: 'reorder', count: order.length }, req.adminUsername);
  res.json({ success: true });
});

// PATCH /api/locations/:id/photos/:photoId/main
router.patch('/:id/photos/:photoId/main', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const photoId = Number(req.params.photoId);
  const exists = await prisma.locationPhoto.findFirst({ where: { id: photoId, locationId: id } });
  if (!exists) { res.status(404).json({ error: 'Foto niet gevonden' }); return; }
  await prisma.$transaction([
    prisma.locationPhoto.updateMany({ where: { locationId: id }, data: { isMain: false } }),
    prisma.locationPhoto.updateMany({ where: { id: photoId, locationId: id }, data: { isMain: true } }),
  ]);
  await logAudit('UPDATE', 'LocationPhoto', photoId, { locationId: id, action: 'set-main' }, req.adminUsername);
  res.json({ success: true });
});

export default router;
