import fs from 'fs';
import path from 'path';
import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import sharp from 'sharp';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAudit } from '../lib/audit';
import { geocode } from '../lib/geocode';
import { uploadsDir } from '../middleware/upload';

const router = Router();
const prisma = new PrismaClient();

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

// GET /api/locations — lijst met relaties
router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const locations = await prisma.location.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      contacts: { orderBy: { order: 'asc' } },
      photos: { orderBy: { order: 'asc' } },
      costs: { orderBy: { order: 'asc' } },
    },
  });
  res.json(locations);
});

// GET /api/locations/:id — enkele locatie
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const location = await prisma.location.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      contacts: { orderBy: { order: 'asc' } },
      photos: { orderBy: { order: 'asc' } },
      costs: { orderBy: { order: 'asc' } },
    },
  });
  if (!location) { res.status(404).json({ error: 'Locatie niet gevonden' }); return; }
  res.json(location);
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
  stroom: boolean;
  verlichting: boolean;
  lengte?: number | null;
  breedte?: number | null;
  m2?: number | null;
  notities: string;
  contacts: ContactInput[];
  costs: CostInput[];
}

// POST /api/locations — nieuwe locatie
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const body = req.body as LocationInput;
  if (!body.naam?.trim()) { res.status(400).json({ error: 'Naam is verplicht' }); return; }
  if (!body.land?.trim()) { res.status(400).json({ error: 'Land is verplicht' }); return; }
  if (!body.adres?.trim()) { res.status(400).json({ error: 'Adres is verplicht' }); return; }

  const coords = body.adres ? await geocode(body.adres) : null;

  const location = await prisma.location.create({
    data: {
      naam: body.naam,
      land: body.land,
      adres: body.adres,
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
      stroom: body.stroom,
      verlichting: body.verlichting,
      lengte: body.lengte ?? null,
      breedte: body.breedte ?? null,
      m2: body.m2 ?? null,
      notities: body.notities ?? '',
      contacts: { create: (body.contacts ?? []).map((c, i) => ({ ...c, order: i })) },
      costs: { create: (body.costs ?? []).map((c, i) => ({ ...c, order: i })) },
    },
    include: { contacts: true, photos: true, costs: true },
  });

  await logAudit('CREATE', 'Location', location.id, { naam: body.naam }, req.adminUsername);
  res.status(201).json(location);
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

  // Alleen geocoden als adres gewijzigd is
  let coords: { lat: number; lng: number } | null = null;
  const addressChanged = body.adres !== existing.adres;
  if (addressChanged && body.adres) coords = await geocode(body.adres);

  const location = await prisma.$transaction(async (tx) => {
    await tx.locationContact.deleteMany({ where: { locationId: id } });
    await tx.locationCost.deleteMany({ where: { locationId: id } });
    return tx.location.update({
      where: { id },
      data: {
        naam: body.naam,
        land: body.land,
        adres: body.adres,
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
        stroom: body.stroom,
        verlichting: body.verlichting,
        lengte: body.lengte ?? null,
        breedte: body.breedte ?? null,
        m2: body.m2 ?? null,
        notities: body.notities ?? '',
        contacts: { create: (body.contacts ?? []).map((c, i) => ({ ...c, order: i })) },
        costs: { create: (body.costs ?? []).map((c, i) => ({ ...c, order: i })) },
      },
      include: { contacts: true, photos: true, costs: true },
    });
  });

  await logAudit('UPDATE', 'Location', id, { naam: body.naam }, req.adminUsername);
  res.json(location);
});

// DELETE /api/locations/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const existing = await prisma.location.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ error: 'Locatie niet gevonden' }); return; }

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
  const coords = existing.adres ? await geocode(existing.adres) : null;
  // Alleen overschrijven als geocode slaagde — anders bestaande coords behouden
  const updated = coords
    ? await prisma.location.update({ where: { id }, data: { lat: coords.lat, lng: coords.lng } })
    : existing;
  res.json({ lat: updated.lat, lng: updated.lng, found: !!coords });
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
    await sharp(file.buffer).rotate().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(outPath);
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
  res.json({ success: true });
});

// PATCH /api/locations/:id/photos/:photoId/main
router.patch('/:id/photos/:photoId/main', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const photoId = Number(req.params.photoId);
  await prisma.$transaction([
    prisma.locationPhoto.updateMany({ where: { locationId: id }, data: { isMain: false } }),
    prisma.locationPhoto.updateMany({ where: { id: photoId, locationId: id }, data: { isMain: true } }),
  ]);
  res.json({ success: true });
});

export default router;
