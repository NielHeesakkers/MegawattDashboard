import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAudit } from '../lib/audit';
import { geocode } from '../lib/geocode';

const router = Router();
const prisma = new PrismaClient();

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

export default router;
