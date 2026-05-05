# Locatie Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Herbruikbare, filterbare database van activatie-locaties met foto's, contacten, kosten, kaart en backup-integratie.

**Architecture:** SQLite + Prisma voor opslag. Express REST-API voor CRUD + foto-upload + geocoding. React frontend met 2-koloms card-grid, linker filter-zijbalk en single-page detail-formulier. Leaflet voor kaart (OSM tiles). Nominatim voor adres→lat/lng.

**Tech Stack:** Prisma 6 · Express · multer · Sharp · Leaflet · React 18 · @dnd-kit · axios · Tailwind · Nominatim (OSM geocoder)

**Spec:** [docs/superpowers/specs/2026-04-22-locatie-management-design.md](../specs/2026-04-22-locatie-management-design.md)

---

## Prerequisites (reeds gebouwd)

- Tab `locatie` toegevoegd aan `AVAILABLE_TABS` in `server/routes/auth.ts`
- Tab-checkbox "Locatie man" toegevoegd aan `AVAILABLE_TABS` in `client/src/components/admin/Settings.tsx`
- Knop "Locatie man" in header van `OrganigramPage.tsx` (gated door `hasTab('locatie')`)
- Placeholder `client/src/components/organigram/LocatieManPage.tsx` (wordt in Task 10 vervangen)

## Tests in dit project

Het project heeft (nog) geen test-framework. Verificatie per task via:
- **Backend:** `curl` tegen `http://localhost:3001` met JWT-token
- **Frontend:** browser-reload op `http://localhost:5173`

De dev-servers draaien via `npm run dev` (tsx-watch backend + vite HMR frontend) dus herstarts zijn niet nodig. Alle bestandspaden hieronder zijn relatief aan `/Users/niel/Development/MegawattDashboard/megawatt-dashboard/`.

## File Structure

### Nieuwe bestanden
```
prisma/migrations/<ts>_add_location_models/migration.sql   (Prisma gegenereerd)
server/routes/locations.ts                                 (alle location-endpoints)
server/lib/geocode.ts                                      (Nominatim wrapper + rate limit)
client/src/components/locatie/LocatieListPage.tsx          (lijst met filters)
client/src/components/locatie/LocatieDetailPage.tsx        (detail-form)
client/src/components/locatie/LocatieCard.tsx              (card-item)
client/src/components/locatie/LocatieFilterSidebar.tsx     (live-filter zijbalk)
client/src/components/locatie/LocatieMap.tsx               (Leaflet-wrapper)
client/src/components/locatie/LocatieContactsSection.tsx   (contacten-editor)
client/src/components/locatie/LocatieCostsSection.tsx      (kosten-editor)
client/src/components/locatie/LocatiePhotoManager.tsx      (foto's-editor)
client/src/components/locatie/OpdrachtenPlaceholder.tsx    (tijdelijk)
```

### Aan te passen bestanden
```
prisma/schema.prisma                                       (4 nieuwe modellen)
server/index.ts                                            (router registreren)
server/routes/backup.ts                                    (backup-integratie)
client/src/api.ts                                          (types + API-functies)
client/src/components/organigram/OrganigramPage.tsx        (dropdown + viewmodes)
client/src/components/organigram/LocatieManPage.tsx        (verwijderen aan eind)
```

### Nieuwe runtime-map
```
uploads/Locaties/                                          (foto-opslag, per locatie-ID)
```

---

## Task 1: Prisma schema — 4 nieuwe modellen + migratie

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_add_location_models/migration.sql` (auto)

- [ ] **Step 1: Voeg modellen toe aan `schema.prisma`**

Onderaan `prisma/schema.prisma` toevoegen:

```prisma
model Location {
  id                Int      @id @default(autoincrement())
  naam              String
  land              String
  adres             String
  lat               Float?
  lng               Float?
  omgevingType      String   @default("centrum")
  orientatie        String   @default("N")
  eigendomType      String   @default("particulier")
  vergunningNodig   Boolean  @default(false)
  vergunningLink    String?
  truckBereikbaar   Boolean  @default(false)
  geschiktActivatie Boolean  @default(false)
  geschiktSampling  Boolean  @default(false)
  stroom            Boolean  @default(false)
  verlichting       Boolean  @default(false)
  lengte            Float?
  breedte           Float?
  m2                Float?
  notities          String   @default("")
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  contacts LocationContact[]
  photos   LocationPhoto[]
  costs    LocationCost[]
}

model LocationContact {
  id         Int      @id @default(autoincrement())
  locationId Int
  location   Location @relation(fields: [locationId], references: [id], onDelete: Cascade)
  naam       String
  email      String?
  telefoon   String?
  website    String?
  rol        String?
  order      Int

  @@index([locationId])
}

model LocationPhoto {
  id         Int      @id @default(autoincrement())
  locationId Int
  location   Location @relation(fields: [locationId], references: [id], onDelete: Cascade)
  filename   String
  isMain     Boolean  @default(false)
  order      Int
  createdAt  DateTime @default(now())

  @@index([locationId])
}

model LocationCost {
  id          Int      @id @default(autoincrement())
  locationId  Int
  location    Location @relation(fields: [locationId], references: [id], onDelete: Cascade)
  label       String   @default("Locatiehuur")
  bedragCents Int      @default(0)
  order       Int

  @@index([locationId])
}
```

- [ ] **Step 2: Migratie maken en toepassen**

```bash
cd /Users/niel/Development/MegawattDashboard/megawatt-dashboard
npx prisma migrate dev --name add_location_models
```

Expected: nieuwe migratie in `prisma/migrations/`, `dev.db` bijgewerkt, Prisma client regenerated.

- [ ] **Step 3: Verifieer schema**

```bash
npx prisma studio --port 5556 &
sleep 3
curl -s http://localhost:5556 | head -1
kill %1
```

Of simpeler — check of dev-server restart (tsx-watch) zonder errors:

```bash
curl -s http://localhost:3001/api/health
```

Expected: `{"status":"ok",...}`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add Location, LocationContact, LocationPhoto, LocationCost models"
```

---

## Task 2: Backend — geocoding helper

**Files:**
- Create: `server/lib/geocode.ts`

- [ ] **Step 1: Schrijf `server/lib/geocode.ts`**

```typescript
// Nominatim (OpenStreetMap) geocoder met eenvoudige rate-limit (1 req/sec).
// Nominatim policy: https://operations.osmfoundation.org/policies/nominatim/

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'Megawatt Dashboard (familie@heesakkers.com)';
const MIN_INTERVAL_MS = 1100;

let lastCallAt = 0;
let queue: Promise<unknown> = Promise.resolve();

export interface GeocodeResult {
  lat: number;
  lng: number;
}

export async function geocode(address: string): Promise<GeocodeResult | null> {
  const run = async (): Promise<GeocodeResult | null> => {
    const wait = Math.max(0, lastCallAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();

    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(address)}&format=json&limit=1`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) return null;
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (!data.length) return null;
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch {
      return null;
    }
  };

  queue = queue.then(run, run);
  return queue as Promise<GeocodeResult | null>;
}
```

- [ ] **Step 2: Verifieer compileerbaar**

```bash
cd /Users/niel/Development/MegawattDashboard/megawatt-dashboard
npx tsc -p tsconfig.server.json --noEmit
```

Expected: geen output (success).

- [ ] **Step 3: Commit**

```bash
git add server/lib/geocode.ts
git commit -m "feat(server): add Nominatim geocoder with rate limiting"
```

---

## Task 3: Backend — locations routes skeleton (list + detail)

**Files:**
- Create: `server/routes/locations.ts`

- [ ] **Step 1: Schrijf skeleton met GET list en GET detail**

```typescript
import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

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

export default router;
```

- [ ] **Step 2: Registreer router in `server/index.ts`**

In `server/index.ts` na `import superchargerRoutes ...`:

```typescript
import locationRoutes from './routes/locations';
```

En onder `app.use('/api/superchargers', superchargerRoutes);`:

```typescript
app.use('/api/locations', locationRoutes);
```

- [ ] **Step 3: Verifieer**

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"megawatt2026"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s http://localhost:3001/api/locations -H "Authorization: Bearer $TOKEN"
```

Expected: `[]` (lege lijst).

- [ ] **Step 4: Commit**

```bash
git add server/routes/locations.ts server/index.ts
git commit -m "feat(api): add locations list and detail endpoints"
```

---

## Task 4: Backend — locations create (POST) met inline contacts en costs + geocoding

**Files:**
- Modify: `server/routes/locations.ts`

- [ ] **Step 1: Voeg imports en POST toe**

Bovenaan `server/routes/locations.ts` (na bestaande imports):

```typescript
import { logAudit } from '../lib/audit';
import { geocode } from '../lib/geocode';
```

Na GET-routes toevoegen:

```typescript
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
```

- [ ] **Step 2: Verifieer create**

```bash
curl -s -X POST http://localhost:3001/api/locations \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "naam":"Test locatie",
    "land":"Nederland",
    "adres":"Kalverstraat 114 Amsterdam",
    "omgevingType":"winkelstraat",
    "orientatie":"N",
    "eigendomType":"particulier",
    "vergunningNodig":false,
    "truckBereikbaar":true,
    "geschiktActivatie":true,
    "geschiktSampling":false,
    "stroom":true,
    "verlichting":false,
    "notities":"test",
    "contacts":[{"naam":"Piet"}],
    "costs":[{"label":"Locatiehuur","bedragCents":120000}]
  }'
```

Expected: JSON met `id`, `lat` en `lng` (Nominatim reageert), contacts/costs aanwezig.

- [ ] **Step 3: Commit**

```bash
git add server/routes/locations.ts
git commit -m "feat(api): add POST /api/locations with geocoding and inline contacts/costs"
```

---

## Task 5: Backend — locations update (PUT) met full-replace contacts/costs

**Files:**
- Modify: `server/routes/locations.ts`

- [ ] **Step 1: Voeg PUT toe**

Na POST in `server/routes/locations.ts`:

```typescript
// PUT /api/locations/:id — update (contacts/costs worden volledig vervangen)
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const body = req.body as LocationInput;
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
```

- [ ] **Step 2: Verifieer update**

(Gebruik `$LOCATION_ID` uit vorige task's response — pak de `id` uit de JSON.)

```bash
curl -s -X PUT http://localhost:3001/api/locations/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"naam":"Test locatie v2","land":"Nederland","adres":"Kalverstraat 114 Amsterdam","omgevingType":"winkelstraat","orientatie":"N","eigendomType":"particulier","vergunningNodig":false,"truckBereikbaar":true,"geschiktActivatie":true,"geschiktSampling":false,"stroom":true,"verlichting":false,"notities":"","contacts":[],"costs":[]}'
```

Expected: JSON met `naam: "Test locatie v2"`, lege `contacts` en `costs` arrays.

- [ ] **Step 3: Commit**

```bash
git add server/routes/locations.ts
git commit -m "feat(api): add PUT /api/locations/:id with transaction-based contact/cost replace"
```

---

## Task 6: Backend — locations delete + handmatige geocode-endpoint

**Files:**
- Modify: `server/routes/locations.ts`

- [ ] **Step 1: Voeg DELETE en POST /:id/geocode toe**

```typescript
import fs from 'fs';
import path from 'path';
import { uploadsDir } from '../middleware/upload';

// DELETE /api/locations/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const existing = await prisma.location.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ error: 'Locatie niet gevonden' }); return; }

  await prisma.location.delete({ where: { id } });

  // Opruimen van foto-bestanden
  const photoDir = path.join(uploadsDir, 'Locaties', String(id));
  if (fs.existsSync(photoDir)) fs.rmSync(photoDir, { recursive: true, force: true });

  await logAudit('DELETE', 'Location', id, { naam: existing.naam }, req.adminUsername);
  res.json({ success: true });
});

// POST /api/locations/:id/geocode — handmatig opnieuw geocoden
router.post('/:id/geocode', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const existing = await prisma.location.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ error: 'Locatie niet gevonden' }); return; }
  const coords = existing.adres ? await geocode(existing.adres) : null;
  const updated = await prisma.location.update({
    where: { id },
    data: { lat: coords?.lat ?? null, lng: coords?.lng ?? null },
  });
  res.json({ lat: updated.lat, lng: updated.lng, found: !!coords });
});
```

- [ ] **Step 2: Controleer of `uploadsDir` uit `server/middleware/upload.ts` bestaat**

```bash
cd /Users/niel/Development/MegawattDashboard/megawatt-dashboard
grep -n "export const uploadsDir" server/middleware/upload.ts
```

Als de export niet bestaat: open `server/middleware/upload.ts` en voeg bovenaan toe:

```typescript
// uploadsDir is al eerder geëxporteerd in dit bestand; geen wijziging nodig als grep matcht.
```

Als `uploadsDir` niet geëxporteerd is, ken je het uit `projects.ts` patroon: importeer hem uit daar, of definieer lokaal:

```typescript
const uploadsDir = path.resolve(__dirname, __dirname.includes(path.join('dist', 'server')) ? '../../../uploads' : '../../uploads');
```

- [ ] **Step 3: Verifieer**

```bash
curl -s -X DELETE http://localhost:3001/api/locations/1 -H "Authorization: Bearer $TOKEN"
```

Expected: `{"success":true}`.

- [ ] **Step 4: Commit**

```bash
git add server/routes/locations.ts
git commit -m "feat(api): add DELETE and manual geocode endpoints"
```

---

## Task 7: Backend — foto endpoints (upload, delete, reorder, set-main)

**Files:**
- Modify: `server/routes/locations.ts`

- [ ] **Step 1: Voeg multer config toe bovenaan `locations.ts`**

```typescript
import multer from 'multer';
import sharp from 'sharp';

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.mimetype);
    cb(ok ? null : new Error('Alleen afbeeldingen toegestaan'), ok);
  },
});
```

- [ ] **Step 2: Voeg foto-upload endpoint toe**

Na de geocode-endpoint in `locations.ts`:

```typescript
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
  const saved = [];
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
```

- [ ] **Step 3: Voeg delete, reorder, set-main endpoints toe**

```typescript
// DELETE /api/locations/:id/photos/:photoId
router.delete('/:id/photos/:photoId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const photoId = Number(req.params.photoId);
  const photo = await prisma.locationPhoto.findFirst({ where: { id: photoId, locationId: id } });
  if (!photo) { res.status(404).json({ error: 'Foto niet gevonden' }); return; }

  const filePath = path.join(uploadsDir, 'Locaties', String(id), photo.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
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
```

- [ ] **Step 4: Verifieer upload**

```bash
# Maak eerst een nieuwe locatie (zie Task 4), pak de ID, dan:
curl -s -X POST http://localhost:3001/api/locations/1/photos \
  -H "Authorization: Bearer $TOKEN" \
  -F "photos=@01 Images/Niel-Heesakkers.jpg"
ls uploads/Locaties/1/
```

Expected: JSON-array met één foto, bestand `1.jpg` in `uploads/Locaties/1/`.

- [ ] **Step 5: Commit**

```bash
git add server/routes/locations.ts
git commit -m "feat(api): add location photo endpoints (upload/delete/reorder/set-main)"
```

---

## Task 8: Backend — backup-integratie

**Files:**
- Modify: `server/routes/backup.ts`

- [ ] **Step 1: Breid `BackupData` interface uit**

In `server/routes/backup.ts`, voeg toe aan het interface:

```typescript
interface BackupData {
  version: number;
  exportedAt: string;
  executives: any[];
  teams: any[];
  members: any[];
  clientTeams?: any[];
  clientTeamMembers?: any[];
  clients?: any[];
  users?: any[];
  klanten?: any[];
  projects?: any[];
  activations?: any[];
  locations?: any[];
  locationContacts?: any[];
  locationPhotos?: any[];
  locationCosts?: any[];
}
```

- [ ] **Step 2: Voeg locations toe aan export (`/export` route)**

In de `Promise.all([...])` bovenin de `/export` handler, voeg toe (aan het eind):

```typescript
prisma.location.findMany({ orderBy: { id: 'asc' } }),
prisma.locationContact.findMany({ orderBy: { id: 'asc' } }),
prisma.locationPhoto.findMany({ orderBy: { id: 'asc' } }),
prisma.locationCost.findMany({ orderBy: { id: 'asc' } }),
```

En destructure matching:

```typescript
const [executives, teams, members, clientTeams, clientTeamMembers, clients, users, klanten, projects, activations, locations, locationContacts, locationPhotos, locationCosts] = await Promise.all([
  // ...bestaande calls...
]);
```

En in `backupData`:

```typescript
const backupData: BackupData = {
  version: 2,
  exportedAt: new Date().toISOString(),
  executives,
  teams,
  members,
  clientTeams,
  clientTeamMembers,
  clients,
  users,
  klanten,
  projects,
  activations,
  locations,
  locationContacts,
  locationPhotos,
  locationCosts,
};
```

(Doe dit op beide plekken waar `backupData` gebouwd wordt — in `/export` én in `createAutoBackup()`.)

- [ ] **Step 3: Voeg import-logica toe**

In de `/import` handler, binnen `prisma.$transaction`, bovenin de delete-cascade toevoegen (vóór bestaande deletes):

```typescript
await tx.locationCost.deleteMany();
await tx.locationPhoto.deleteMany();
await tx.locationContact.deleteMany();
await tx.location.deleteMany();
```

Aan het einde van de transaction-callback, na de bestaande imports, toevoegen:

```typescript
// Import locations met ID-remapping
const locIdMap = new Map<number, number>();
if (backupData.locations) {
  for (const loc of backupData.locations) {
    const { id: oldId, contacts: _c, photos: _p, costs: _cs, ...data } = loc;
    const created = await tx.location.create({ data });
    locIdMap.set(oldId, created.id);
  }
}
if (backupData.locationContacts) {
  for (const c of backupData.locationContacts) {
    const { id: _oldId, location: _l, ...data } = c;
    const newId = locIdMap.get(data.locationId);
    if (!newId) continue;
    await tx.locationContact.create({ data: { ...data, locationId: newId } });
  }
}
if (backupData.locationPhotos) {
  for (const p of backupData.locationPhotos) {
    const { id: _oldId, location: _l, ...data } = p;
    const newId = locIdMap.get(data.locationId);
    if (!newId) continue;
    await tx.locationPhoto.create({ data: { ...data, locationId: newId } });
  }
}
if (backupData.locationCosts) {
  for (const c of backupData.locationCosts) {
    const { id: _oldId, location: _l, ...data } = c;
    const newId = locIdMap.get(data.locationId);
    if (!newId) continue;
    await tx.locationCost.create({ data: { ...data, locationId: newId } });
  }
}
```

- [ ] **Step 4: Voeg aan `/clear` route toe**

In de `/clear` handler, binnen de `prisma.$transaction`, bovenin toevoegen (vóór bestaande deletes):

```typescript
await tx.locationCost.deleteMany();
await tx.locationPhoto.deleteMany();
await tx.locationContact.deleteMany();
await tx.location.deleteMany();
```

- [ ] **Step 5: Verifieer**

```bash
curl -s -X GET http://localhost:3001/api/backup/export \
  -H "Authorization: Bearer $TOKEN" --output /tmp/test-backup.zip
unzip -p /tmp/test-backup.zip data.json | python3 -c "import sys,json;d=json.load(sys.stdin);print('locations' in d, 'locationContacts' in d)"
```

Expected: `True True`.

- [ ] **Step 6: Commit**

```bash
git add server/routes/backup.ts
git commit -m "feat(backup): include locations in export/import/clear"
```

---

## Task 9: Frontend — API client (types + functies)

**Files:**
- Modify: `client/src/api.ts`

- [ ] **Step 1: Voeg types toe aan `client/src/api.ts`**

Onderaan `client/src/api.ts` (ná bestaande interfaces, vóór `api.interceptors` is al boven — dit hoort bij de rest van de types):

```typescript
export interface LocationContact {
  id: number;
  locationId: number;
  naam: string;
  email: string | null;
  telefoon: string | null;
  website: string | null;
  rol: string | null;
  order: number;
}

export interface LocationPhoto {
  id: number;
  locationId: number;
  filename: string;
  isMain: boolean;
  order: number;
  createdAt: string;
}

export interface LocationCost {
  id: number;
  locationId: number;
  label: string;
  bedragCents: number;
  order: number;
}

export type OmgevingType = 'centrum' | 'winkelstraat' | 'park' | 'plein' | 'stationsplein';
export type Orientatie = 'N' | 'NO' | 'O' | 'ZO' | 'Z' | 'ZW' | 'W' | 'NW';
export type EigendomType = 'particulier' | 'gemeentelijk';

export interface Location {
  id: number;
  naam: string;
  land: string;
  adres: string;
  lat: number | null;
  lng: number | null;
  omgevingType: OmgevingType;
  orientatie: Orientatie;
  eigendomType: EigendomType;
  vergunningNodig: boolean;
  vergunningLink: string | null;
  truckBereikbaar: boolean;
  geschiktActivatie: boolean;
  geschiktSampling: boolean;
  stroom: boolean;
  verlichting: boolean;
  lengte: number | null;
  breedte: number | null;
  m2: number | null;
  notities: string;
  createdAt: string;
  updatedAt: string;
  contacts: LocationContact[];
  photos: LocationPhoto[];
  costs: LocationCost[];
}

export type LocationWriteInput = Omit<Location, 'id' | 'lat' | 'lng' | 'createdAt' | 'updatedAt' | 'contacts' | 'photos' | 'costs'> & {
  contacts: Array<Omit<LocationContact, 'id' | 'locationId' | 'order'>>;
  costs: Array<Omit<LocationCost, 'id' | 'locationId' | 'order'>>;
};
```

- [ ] **Step 2: Voeg API-functies toe**

Zoek in `client/src/api.ts` een goede plek onderaan (na bestaande export-functies) en voeg toe:

```typescript
export async function fetchLocations(): Promise<Location[]> {
  const { data } = await api.get('/locations');
  return data;
}

export async function fetchLocation(id: number): Promise<Location> {
  const { data } = await api.get(`/locations/${id}`);
  return data;
}

export async function createLocation(input: LocationWriteInput): Promise<Location> {
  const { data } = await api.post('/locations', input);
  return data;
}

export async function updateLocation(id: number, input: LocationWriteInput): Promise<Location> {
  const { data } = await api.put(`/locations/${id}`, input);
  return data;
}

export async function deleteLocation(id: number): Promise<void> {
  await api.delete(`/locations/${id}`);
}

export async function geocodeLocation(id: number): Promise<{ lat: number | null; lng: number | null; found: boolean }> {
  const { data } = await api.post(`/locations/${id}/geocode`);
  return data;
}

export async function uploadLocationPhotos(id: number, files: File[]): Promise<LocationPhoto[]> {
  const form = new FormData();
  for (const f of files) form.append('photos', f);
  const { data } = await api.post(`/locations/${id}/photos`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  return data;
}

export async function deleteLocationPhoto(id: number, photoId: number): Promise<void> {
  await api.delete(`/locations/${id}/photos/${photoId}`);
}

export async function reorderLocationPhotos(id: number, order: number[]): Promise<void> {
  await api.patch(`/locations/${id}/photos/order`, { order });
}

export async function setLocationPhotoMain(id: number, photoId: number): Promise<void> {
  await api.patch(`/locations/${id}/photos/${photoId}/main`);
}
```

- [ ] **Step 3: Verifieer typecheck**

```bash
cd /Users/niel/Development/MegawattDashboard/megawatt-dashboard
npx tsc -p tsconfig.json --noEmit 2>&1 | head -20
```

Expected: geen errors voor `api.ts`.

- [ ] **Step 4: Commit**

```bash
git add client/src/api.ts
git commit -m "feat(api-client): add Location types and API functions"
```

---

## Task 10: Frontend — Locatie-man dropdown, viewmodes en Opdrachten placeholder

**Files:**
- Modify: `client/src/components/organigram/OrganigramPage.tsx`
- Create: `client/src/components/locatie/OpdrachtenPlaceholder.tsx`
- Delete: `client/src/components/organigram/LocatieManPage.tsx`

- [ ] **Step 1: Maak `OpdrachtenPlaceholder.tsx`**

```tsx
export default function OpdrachtenPlaceholder() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-white mb-6">Opdrachten</h1>
      <div className="rounded-xl bg-[rgba(255,255,255,0.03)] ring-1 ring-[rgba(255,255,255,0.08)] p-12 text-center">
        <p className="text-[rgba(255,255,255,0.5)] text-sm">Binnenkort beschikbaar.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `OrganigramPage.tsx` — viewmode type en storage-herstel**

Zoek:

```typescript
type ViewMode = 'dashboard' | 'klantteams' | 'planning-projecten' | 'planning-klanten' | 'planning-superchargers' | 'locatie';
```

Vervang door:

```typescript
type ViewMode = 'dashboard' | 'klantteams' | 'planning-projecten' | 'planning-klanten' | 'planning-superchargers' | 'locatie-lijst' | 'locatie-opdrachten';
```

Zoek de `useState`-initializer die `saved === 'locatie'` checkt. Vervang die condition:

```typescript
if (saved === 'klantteams' || saved === 'planning-projecten' || saved === 'planning-klanten' || saved === 'planning-superchargers' || saved === 'locatie-lijst' || saved === 'locatie-opdrachten') return saved;
```

Zoek:

```typescript
const isLocatieView = viewMode === 'locatie';
```

Vervang door:

```typescript
const isLocatieView = viewMode === 'locatie-lijst' || viewMode === 'locatie-opdrachten';
```

In de `useEffect` voor redirect-fallback: vervang het `isLocatieView`-blok zodat het correct reageert op beide viewmodes:

```typescript
const isLocatieView = viewMode === 'locatie-lijst' || viewMode === 'locatie-opdrachten';
```

(Deze declaratie bestaat al; gebruik `hasTab('locatie')` als guard en fallback doet al het juiste.)

In de `fallback()`-helper: vervang `'locatie'` door `'locatie-lijst'`:

```typescript
if (hasTab('locatie')) return 'locatie-lijst' as ViewMode;
```

- [ ] **Step 3: Update header-knop naar dropdown**

Voeg toe bij de andere menu-refs bovenin de component:

```typescript
const [locatieMenuOpen, setLocatieMenuOpen] = useState(false);
const locatieMenuRef = useRef<HTMLDivElement>(null);
```

In de outside-click handler, breid uit:

```typescript
if (!exportOpen && !internMenuOpen && !planningMenuOpen && !locatieMenuOpen) return;
// En binnenin:
if (locatieMenuOpen && locatieMenuRef.current && !locatieMenuRef.current.contains(e.target as Node)) setLocatieMenuOpen(false);
```

Update de dep-array:

```typescript
}, [exportOpen, internMenuOpen, planningMenuOpen, locatieMenuOpen]);
```

Vervang het huidige enkele "Locatie man"-knop-blok met een dropdown (spiegel van het "Planning"-blok):

```tsx
{hasTab('locatie') && (
  <div ref={locatieMenuRef} className="relative">
    <button
      onClick={() => setLocatieMenuOpen(!locatieMenuOpen)}
      className={`flex items-center whitespace-nowrap gap-1.5 h-7 px-3 rounded-lg ring-1 ring-[rgba(255,255,255,0.15)] text-[12px] font-medium transition-all duration-150 cursor-pointer ${
        locatieMenuOpen || isLocatieView
          ? 'bg-[rgba(255,255,255,0.12)] text-white'
          : 'bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.5)] hover:bg-[rgba(255,255,255,0.12)] hover:text-white'
      }`}
    >
      Locatie man
      <svg className={`w-3 h-3 transition-transform duration-150 ${locatieMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
      </svg>
    </button>
    {locatieMenuOpen && (
      <div className="absolute top-full right-0 mt-[10px] z-50 w-44 bg-bg-surface rounded-xl ring-1 ring-[rgba(255,255,255,0.12)] shadow-2xl overflow-hidden animate-[slideDown_100ms_ease-out]">
        {([
          { mode: 'locatie-lijst' as ViewMode, label: 'Locaties' },
          { mode: 'locatie-opdrachten' as ViewMode, label: 'Opdrachten' },
        ]).map((item, i) => (
          <div key={item.mode}>
            {i > 0 && <div className="border-t border-[rgba(255,255,255,0.06)]" />}
            <button
              onClick={() => { handleViewMode(item.mode); setLocatieMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-[13px] transition-colors cursor-pointer ${
                viewMode === item.mode
                  ? 'bg-accent/15 text-accent'
                  : 'text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.08)] hover:text-white'
              }`}
            >
              {viewMode === item.mode && (
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              )}
              <span className={viewMode !== item.mode ? 'ml-[26px]' : ''}>{item.label}</span>
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 4: Vervang import + render-conditie**

Bovenin `OrganigramPage.tsx`:

```typescript
// Verwijder: import LocatieManPage from './LocatieManPage';
// Voeg toe:
import LocatieListPage from '../locatie/LocatieListPage';
import OpdrachtenPlaceholder from '../locatie/OpdrachtenPlaceholder';
```

(`LocatieListPage` bestaat nog niet — Task 13 maakt de volledige versie. Voor nu: maak een minimale stub in dezelfde commit zodat imports werken — zie Step 5.)

Zoek het render-blok:

```tsx
{isLocatieView ? (
  <LocatieManPage />
) : isPlanningView ? (
```

Vervang door:

```tsx
{viewMode === 'locatie-lijst' ? (
  <LocatieListPage onOpenDetail={(_id) => { /* Task 13 wires this to state */ }} />
) : viewMode === 'locatie-opdrachten' ? (
  <OpdrachtenPlaceholder />
) : isPlanningView ? (
```

- [ ] **Step 5: Maak tijdelijke stub voor `LocatieListPage`**

Maak `client/src/components/locatie/LocatieListPage.tsx`:

```tsx
interface Props { onOpenDetail: (id: number) => void; }
export default function LocatieListPage(_props: Props) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-white mb-6">Locaties</h1>
      <div className="text-[rgba(255,255,255,0.5)] text-sm">Lijst volgt in Task 13.</div>
    </div>
  );
}
```

- [ ] **Step 6: Verwijder oude `LocatieManPage.tsx`**

```bash
rm client/src/components/organigram/LocatieManPage.tsx
```

- [ ] **Step 7: Verifieer in de browser**

Reload `http://localhost:5173`, log in, klik rechts in de header op "Locatie man" — je ziet dropdown met "Locaties" en "Opdrachten". Beide items laden hun respectievelijke placeholder-pagina.

- [ ] **Step 8: Commit**

```bash
git add client/src/components/organigram/OrganigramPage.tsx \
         client/src/components/locatie/OpdrachtenPlaceholder.tsx \
         client/src/components/locatie/LocatieListPage.tsx
git rm client/src/components/organigram/LocatieManPage.tsx
git commit -m "feat(ui): convert Locatie man button to dropdown with Locaties/Opdrachten"
```

---

## Task 11: Frontend — LocatieCard component

**Files:**
- Create: `client/src/components/locatie/LocatieCard.tsx`

- [ ] **Step 1: Schrijf de card-component**

```tsx
import type { Location } from '../../api';

interface Props {
  location: Location;
  onClick: () => void;
}

function formatEUR(cents: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

export default function LocatieCard({ location, onClick }: Props) {
  const mainPhoto = location.photos.find((p) => p.isMain) ?? location.photos[0];
  const totalCents = location.costs.reduce((sum, c) => sum + c.bedragCents, 0);

  const chips: string[] = [];
  if (location.geschiktActivatie) chips.push('Activatie');
  if (location.geschiktSampling) chips.push('Sampling');
  if (location.stroom) chips.push('Stroom');
  if (location.verlichting) chips.push('Verlichting');
  if (location.vergunningNodig) chips.push('Vergunning');
  if (location.truckBereikbaar) chips.push('Bakwagen');
  if (location.eigendomType === 'particulier') chips.push('Particulier');
  else chips.push('Gemeentelijk');

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex text-left bg-[rgba(255,255,255,0.03)] ring-1 ring-[rgba(255,255,255,0.08)] hover:ring-[rgba(255,255,255,0.18)] rounded-xl overflow-hidden transition-all duration-150 cursor-pointer"
    >
      <div className="w-[130px] h-[130px] flex-shrink-0 bg-[rgba(255,255,255,0.05)]">
        {mainPhoto ? (
          <img src={`/uploads/Locaties/${location.id}/${mainPhoto.filename}`} alt={location.naam} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[rgba(255,255,255,0.2)]">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 p-3 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-white font-semibold text-[14px] truncate">{location.naam || 'Naamloos'}</h3>
          {totalCents > 0 && <span className="text-accent text-[12px] font-medium whitespace-nowrap">{formatEUR(totalCents)}</span>}
        </div>
        <div className="text-[rgba(255,255,255,0.5)] text-[12px] mb-2">
          {[location.land, location.m2 ? `${location.m2} m²` : null].filter(Boolean).join(' · ')}
        </div>
        <div className="flex flex-wrap gap-1 mt-auto">
          {chips.map((c) => (
            <span key={c} className="inline-flex items-center h-5 px-2 rounded text-[10px] font-medium bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.7)]">
              {c}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Verifieer typecheck**

```bash
npx tsc -p tsconfig.json --noEmit 2>&1 | grep LocatieCard || echo "clean"
```

Expected: `clean`.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/locatie/LocatieCard.tsx
git commit -m "feat(ui): add LocatieCard component for list grid"
```

---

## Task 12: Frontend — LocatieFilterSidebar component

**Files:**
- Create: `client/src/components/locatie/LocatieFilterSidebar.tsx`

- [ ] **Step 1: Schrijf filter-zijbalk**

```tsx
import type { Location } from '../../api';

export interface LocatieFilters {
  landen: string[];
  m2Buckets: Array<'≤10' | '20' | '40' | '60+'>;
  geschiktVoor: Array<'activatie' | 'sampling'>;
  voorzieningen: Array<'stroom' | 'verlichting' | 'vergunning' | 'truck'>;
  eigendom: Array<'particulier' | 'gemeentelijk'>;
}

export const EMPTY_FILTERS: LocatieFilters = { landen: [], m2Buckets: [], geschiktVoor: [], voorzieningen: [], eigendom: [] };

export function applyFilters(locations: Location[], f: LocatieFilters, search: string): Location[] {
  const q = search.trim().toLowerCase();
  return locations.filter((loc) => {
    if (q) {
      const hay = [loc.naam, loc.adres, loc.land].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.landen.length && !f.landen.includes(loc.land)) return false;
    if (f.m2Buckets.length) {
      const m2 = loc.m2 ?? 0;
      const bucket = m2 <= 10 ? '≤10' : m2 <= 25 ? '20' : m2 <= 50 ? '40' : '60+';
      if (!f.m2Buckets.includes(bucket as any)) return false;
    }
    if (f.geschiktVoor.includes('activatie') && !loc.geschiktActivatie) return false;
    if (f.geschiktVoor.includes('sampling') && !loc.geschiktSampling) return false;
    if (f.voorzieningen.includes('stroom') && !loc.stroom) return false;
    if (f.voorzieningen.includes('verlichting') && !loc.verlichting) return false;
    if (f.voorzieningen.includes('vergunning') && !loc.vergunningNodig) return false;
    if (f.voorzieningen.includes('truck') && !loc.truckBereikbaar) return false;
    if (f.eigendom.length && !f.eigendom.includes(loc.eigendomType)) return false;
    return true;
  });
}

function isEmpty(f: LocatieFilters): boolean {
  return !f.landen.length && !f.m2Buckets.length && !f.geschiktVoor.length && !f.voorzieningen.length && !f.eigendom.length;
}

interface Props {
  filters: LocatieFilters;
  onChange: (f: LocatieFilters) => void;
  availableLanden: string[];
  resultCount: number;
}

export default function LocatieFilterSidebar({ filters, onChange, availableLanden, resultCount }: Props) {
  const toggle = <K extends keyof LocatieFilters>(key: K, value: LocatieFilters[K][number]) => {
    const current = filters[key] as string[];
    const next = current.includes(value as string) ? current.filter((v) => v !== value) : [...current, value as string];
    onChange({ ...filters, [key]: next } as LocatieFilters);
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[rgba(255,255,255,0.4)] mb-2">{title}</div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );

  const Check = ({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) => (
    <label className="flex items-center gap-2 text-[13px] text-[rgba(255,255,255,0.8)] cursor-pointer hover:text-white">
      <input type="checkbox" checked={checked} onChange={onClick} className="accent-accent-teal" />
      {label}
    </label>
  );

  return (
    <aside className="w-56 flex-shrink-0 p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[13px] text-[rgba(255,255,255,0.6)]">{resultCount} locaties</span>
        {!isEmpty(filters) && (
          <button onClick={() => onChange(EMPTY_FILTERS)} className="text-[11px] text-accent hover:opacity-80 cursor-pointer">Wissen</button>
        )}
      </div>

      <Section title="Land">
        {availableLanden.map((l) => (
          <Check key={l} checked={filters.landen.includes(l)} onClick={() => toggle('landen', l)} label={l} />
        ))}
      </Section>

      <Section title="Oppervlak">
        {(['≤10', '20', '40', '60+'] as const).map((b) => (
          <Check key={b} checked={filters.m2Buckets.includes(b)} onClick={() => toggle('m2Buckets', b)} label={`${b} m²`} />
        ))}
      </Section>

      <Section title="Geschikt voor">
        <Check checked={filters.geschiktVoor.includes('activatie')} onClick={() => toggle('geschiktVoor', 'activatie')} label="Activatie" />
        <Check checked={filters.geschiktVoor.includes('sampling')} onClick={() => toggle('geschiktVoor', 'sampling')} label="Mass sampling" />
      </Section>

      <Section title="Voorzieningen">
        <Check checked={filters.voorzieningen.includes('stroom')} onClick={() => toggle('voorzieningen', 'stroom')} label="Stroom aanwezig" />
        <Check checked={filters.voorzieningen.includes('verlichting')} onClick={() => toggle('voorzieningen', 'verlichting')} label="Verlichting" />
        <Check checked={filters.voorzieningen.includes('vergunning')} onClick={() => toggle('voorzieningen', 'vergunning')} label="Vergunning nodig" />
        <Check checked={filters.voorzieningen.includes('truck')} onClick={() => toggle('voorzieningen', 'truck')} label="Bakwagen-bereikbaar" />
      </Section>

      <Section title="Type">
        <Check checked={filters.eigendom.includes('particulier')} onClick={() => toggle('eigendom', 'particulier')} label="Particulier" />
        <Check checked={filters.eigendom.includes('gemeentelijk')} onClick={() => toggle('eigendom', 'gemeentelijk')} label="Gemeentelijk" />
      </Section>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/locatie/LocatieFilterSidebar.tsx
git commit -m "feat(ui): add LocatieFilterSidebar with live-filter logic"
```

---

## Task 13: Frontend — LocatieListPage (volledige implementatie)

**Files:**
- Modify: `client/src/components/locatie/LocatieListPage.tsx`
- Modify: `client/src/components/organigram/OrganigramPage.tsx` (wire onOpenDetail)

- [ ] **Step 1: Vervang stub door echte pagina**

```tsx
import { useEffect, useState, useMemo } from 'react';
import { fetchLocations, Location } from '../../api';
import LocatieCard from './LocatieCard';
import LocatieFilterSidebar, { LocatieFilters, EMPTY_FILTERS, applyFilters } from './LocatieFilterSidebar';

interface Props {
  onOpenDetail: (id: number | 'new') => void;
}

export default function LocatieListPage({ onOpenDetail }: Props) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<LocatieFilters>(EMPTY_FILTERS);

  useEffect(() => {
    fetchLocations().then(setLocations).finally(() => setLoading(false));
  }, []);

  const landen = useMemo(() => [...new Set(locations.map((l) => l.land).filter(Boolean))].sort(), [locations]);
  const filtered = useMemo(() => applyFilters(locations, filters, search), [locations, filters, search]);

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-white">Locaties</h1>
        <button
          onClick={() => onOpenDetail('new')}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-accent-teal text-[#1a3a38] text-[13px] font-semibold hover:opacity-85 transition-opacity cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Nieuwe locatie
        </button>
      </div>

      <input
        type="search"
        placeholder="Zoek op naam, adres of land…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full h-10 px-4 mb-4 rounded-lg bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.08)] text-white text-[14px] placeholder-[rgba(255,255,255,0.3)] focus:outline-none focus:ring-[rgba(255,255,255,0.2)]"
      />

      <div className="flex gap-6">
        <LocatieFilterSidebar filters={filters} onChange={setFilters} availableLanden={landen} resultCount={filtered.length} />

        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="text-[rgba(255,255,255,0.4)] text-sm">Laden…</div>
          ) : locations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="text-[rgba(255,255,255,0.5)] mb-4">Nog geen locaties</p>
              <button onClick={() => onOpenDetail('new')} className="h-10 px-6 rounded-lg bg-accent-teal text-[#1a3a38] font-semibold hover:opacity-85 cursor-pointer">
                + Voeg je eerste locatie toe
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-[rgba(255,255,255,0.4)] text-sm py-12 text-center">Geen locaties komen overeen met de filters.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filtered.map((loc) => (
                <LocatieCard key={loc.id} location={loc} onClick={() => onOpenDetail(loc.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire `onOpenDetail` in `OrganigramPage.tsx`**

Voeg bovenin de component toe (naast andere state):

```typescript
const [editingLocationId, setEditingLocationId] = useState<number | 'new' | undefined>(undefined);
```

Update `handleViewMode` zodat detail-state opgeruimd wordt bij view-switch:

```typescript
const handleViewMode = (mode: ViewMode) => {
  setViewMode(mode);
  setEditingProjectId(undefined);
  setEditingLocationId(undefined);
  localStorage.setItem('megawatt-view-mode', mode);
};
```

Update de render-conditie:

```tsx
{viewMode === 'locatie-lijst' ? (
  editingLocationId !== undefined ? (
    <LocatieDetailPage
      locationId={editingLocationId}
      onBack={() => setEditingLocationId(undefined)}
      onDeleted={() => setEditingLocationId(undefined)}
    />
  ) : (
    <LocatieListPage onOpenDetail={(id) => setEditingLocationId(id)} />
  )
) : viewMode === 'locatie-opdrachten' ? (
  <OpdrachtenPlaceholder />
) : isPlanningView ? (
```

En voeg import toe:

```typescript
import LocatieDetailPage from '../locatie/LocatieDetailPage';
```

- [ ] **Step 3: Maak stub `LocatieDetailPage.tsx`**

```tsx
interface Props { locationId: number | 'new'; onBack: () => void; onDeleted: () => void; }
export default function LocatieDetailPage({ locationId, onBack }: Props) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <button onClick={onBack} className="text-accent text-sm mb-4 cursor-pointer">← Terug</button>
      <h1 className="text-2xl font-semibold text-white">{locationId === 'new' ? 'Nieuwe locatie' : `Locatie #${locationId}`}</h1>
      <p className="text-[rgba(255,255,255,0.5)] text-sm mt-4">Detail-formulier volgt in Tasks 14-20.</p>
    </div>
  );
}
```

- [ ] **Step 4: Verifieer in browser**

Reload, ga naar Locatie man → Locaties. Je ziet "Nog geen locaties" met knop. Klik `+ Voeg je eerste locatie toe` → je belandt op de detail-stub. Klik ← Terug → lijst weer.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/locatie/LocatieListPage.tsx \
         client/src/components/locatie/LocatieDetailPage.tsx \
         client/src/components/organigram/OrganigramPage.tsx
git commit -m "feat(ui): implement LocatieListPage with filter + search + grid"
```

---

## Task 14: Frontend — LocatieMap component (Leaflet)

**Files:**
- Create: `client/src/components/locatie/LocatieMap.tsx`

- [ ] **Step 1: Schrijf kaart-wrapper**

```tsx
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet's default marker icon paths werken niet goed met Vite; inline oplossen.
const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface Props {
  lat: number | null;
  lng: number | null;
  address: string;
}

export default function LocatieMap({ lat, lng, address }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!ref.current || lat == null || lng == null) return;
    if (!mapRef.current) {
      mapRef.current = L.map(ref.current, { scrollWheelZoom: false }).setView([lat, lng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(mapRef.current);
      markerRef.current = L.marker([lat, lng], { icon }).addTo(mapRef.current);
    } else {
      mapRef.current.setView([lat, lng], 15);
      if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
    }
    return () => {
      // Cleanup only on unmount
    };
  }, [lat, lng]);

  useEffect(() => () => {
    mapRef.current?.remove();
    mapRef.current = null;
    markerRef.current = null;
  }, []);

  if (lat == null || lng == null) {
    return (
      <div className="h-[200px] rounded-lg bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.08)] flex items-center justify-center text-[rgba(255,255,255,0.4)] text-sm">
        Adres niet gevonden — controleer het adres en geocode opnieuw.
      </div>
    );
  }

  return (
    <a
      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`}
      target="_blank"
      rel="noreferrer"
      title="Open route in Google Maps"
      className="block h-[200px] rounded-lg overflow-hidden ring-1 ring-[rgba(255,255,255,0.08)]"
    >
      <div ref={ref} className="w-full h-full" />
    </a>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/locatie/LocatieMap.tsx
git commit -m "feat(ui): add LocatieMap Leaflet wrapper"
```

---

## Task 15: Frontend — LocatieDetailPage shell + Algemeen + Omgeving + Geschikt voor + Afmetingen + Voorzieningen

**Files:**
- Modify: `client/src/components/locatie/LocatieDetailPage.tsx`

- [ ] **Step 1: Vervang stub door detailpagina-basis**

```tsx
import { useEffect, useState } from 'react';
import { useToast } from '../ui/Toast';
import {
  fetchLocation, createLocation, updateLocation, deleteLocation, geocodeLocation,
  Location, LocationWriteInput, OmgevingType, Orientatie, EigendomType, LocationContact, LocationCost,
} from '../../api';
import LocatieMap from './LocatieMap';

interface Props { locationId: number | 'new'; onBack: () => void; onDeleted: () => void; }

type FormState = LocationWriteInput & { lat: number | null; lng: number | null };

function emptyForm(): FormState {
  return {
    naam: '', land: 'Nederland', adres: '',
    lat: null, lng: null,
    omgevingType: 'centrum', orientatie: 'N', eigendomType: 'particulier',
    vergunningNodig: false, vergunningLink: null, truckBereikbaar: false,
    geschiktActivatie: false, geschiktSampling: false,
    stroom: false, verlichting: false,
    lengte: null, breedte: null, m2: null,
    notities: '',
    contacts: [], costs: [{ label: 'Locatiehuur', bedragCents: 0 } as Omit<LocationCost, 'id' | 'locationId' | 'order'>],
  };
}

function fromLocation(loc: Location): FormState {
  return {
    naam: loc.naam, land: loc.land, adres: loc.adres,
    lat: loc.lat, lng: loc.lng,
    omgevingType: loc.omgevingType, orientatie: loc.orientatie, eigendomType: loc.eigendomType,
    vergunningNodig: loc.vergunningNodig, vergunningLink: loc.vergunningLink, truckBereikbaar: loc.truckBereikbaar,
    geschiktActivatie: loc.geschiktActivatie, geschiktSampling: loc.geschiktSampling,
    stroom: loc.stroom, verlichting: loc.verlichting,
    lengte: loc.lengte, breedte: loc.breedte, m2: loc.m2,
    notities: loc.notities,
    contacts: loc.contacts.map(({ id: _i, locationId: _l, order: _o, ...rest }) => rest),
    costs: loc.costs.map(({ id: _i, locationId: _l, order: _o, ...rest }) => rest),
  };
}

export default function LocatieDetailPage({ locationId, onBack, onDeleted }: Props) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [originalLocation, setOriginalLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(locationId !== 'new');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (locationId === 'new') return;
    fetchLocation(locationId).then((loc) => { setOriginalLocation(loc); setForm(fromLocation(loc)); }).finally(() => setLoading(false));
  }, [locationId]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const onLengteBreedteChange = (lengte: number | null, breedte: number | null) => {
    setForm((f) => ({
      ...f,
      lengte, breedte,
      m2: (lengte != null && breedte != null) ? +(lengte * breedte).toFixed(2) : f.m2,
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const { lat: _la, lng: _ln, ...writeInput } = form;
      if (locationId === 'new') {
        const created = await createLocation(writeInput);
        toast.success('Locatie opgeslagen');
        setOriginalLocation(created);
        setForm(fromLocation(created));
        // Blijf op detailpagina — id is nu bekend
        window.history.replaceState({}, '', `#location-${created.id}`);
      } else {
        const updated = await updateLocation(locationId, writeInput);
        setOriginalLocation(updated);
        setForm(fromLocation(updated));
        toast.success('Wijzigingen opgeslagen');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Opslaan mislukt');
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (locationId === 'new') return;
    if (!confirm('Weet je zeker dat je deze locatie wilt verwijderen?')) return;
    await deleteLocation(locationId);
    toast.success('Locatie verwijderd');
    onDeleted();
  };

  const reGeocode = async () => {
    if (locationId === 'new') { toast.error('Sla eerst op voordat je kunt geocoden'); return; }
    const result = await geocodeLocation(locationId);
    setForm((f) => ({ ...f, lat: result.lat, lng: result.lng }));
    if (result.found) toast.success('Coördinaten bijgewerkt');
    else toast.error('Adres niet gevonden');
  };

  if (loading) return <div className="p-8 text-[rgba(255,255,255,0.5)]">Laden…</div>;

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mb-8">
      <h2 className="text-[13px] font-bold uppercase tracking-wider text-[rgba(255,255,255,0.6)] mb-3">{title}</h2>
      {children}
    </section>
  );

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <label className="flex flex-col gap-1.5 mb-3">
      <span className="text-[12px] text-[rgba(255,255,255,0.6)]">{label}</span>
      {children}
    </label>
  );

  const inputClass = 'h-10 px-3 rounded-lg bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.08)] text-white text-[14px] placeholder-[rgba(255,255,255,0.3)] focus:outline-none focus:ring-[rgba(255,255,255,0.2)]';
  const areaClass = 'px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.08)] text-white text-[14px] placeholder-[rgba(255,255,255,0.3)] focus:outline-none focus:ring-[rgba(255,255,255,0.2)]';

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="sticky top-0 z-20 -mx-6 px-6 py-3 mb-6 bg-[rgba(15,31,29,0.95)] backdrop-blur border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between">
        <button onClick={onBack} className="text-accent text-sm hover:opacity-80 cursor-pointer">← Terug</button>
        <h1 className="text-white font-semibold truncate">{form.naam || 'Nieuwe locatie'}</h1>
        <div className="flex gap-2">
          {locationId !== 'new' && (
            <button onClick={del} className="h-9 px-3 rounded-lg bg-red-500/10 ring-1 ring-red-500/20 text-red-400 text-[13px] font-medium hover:bg-red-500/20 cursor-pointer">Verwijderen</button>
          )}
          <button onClick={save} disabled={saving} className="h-9 px-4 rounded-lg bg-accent-teal text-[#1a3a38] text-[13px] font-semibold hover:opacity-85 cursor-pointer disabled:opacity-50">
            {saving ? 'Opslaan…' : 'Opslaan'}
          </button>
        </div>
      </div>

      <Section title="Algemeen">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Naam"><input className={inputClass} value={form.naam} onChange={(e) => set('naam', e.target.value)} /></Field>
          <Field label="Land"><input className={inputClass} value={form.land} onChange={(e) => set('land', e.target.value)} placeholder="Nederland" /></Field>
        </div>
        <Field label="Adres">
          <textarea className={areaClass} rows={2} value={form.adres} onChange={(e) => set('adres', e.target.value)} />
        </Field>
        <div className="flex gap-3 mb-3">
          <button onClick={reGeocode} className="h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.06)] ring-1 ring-[rgba(255,255,255,0.15)] text-white text-[12px] hover:bg-[rgba(255,255,255,0.12)] cursor-pointer">Geocode adres</button>
        </div>
        <LocatieMap lat={form.lat} lng={form.lng} address={form.adres} />
      </Section>

      <Section title="Omgeving">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Omgevingstype">
            <select className={inputClass} value={form.omgevingType} onChange={(e) => set('omgevingType', e.target.value as OmgevingType)}>
              <option value="centrum">Centrum</option>
              <option value="winkelstraat">Winkelstraat</option>
              <option value="park">Park</option>
              <option value="plein">Plein</option>
              <option value="stationsplein">Stationsplein</option>
            </select>
          </Field>
          <Field label="Oriëntatie">
            <select className={inputClass} value={form.orientatie} onChange={(e) => set('orientatie', e.target.value as Orientatie)}>
              {(['N', 'NO', 'O', 'ZO', 'Z', 'ZW', 'W', 'NW'] as const).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Geschikt voor">
        <label className="flex items-center gap-2 text-[14px] text-white mb-2 cursor-pointer">
          <input type="checkbox" checked={form.geschiktActivatie} onChange={(e) => set('geschiktActivatie', e.target.checked)} /> Activatie
        </label>
        <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer">
          <input type="checkbox" checked={form.geschiktSampling} onChange={(e) => set('geschiktSampling', e.target.checked)} /> Mass sampling
        </label>
      </Section>

      <Section title="Afmetingen">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Lengte (m)"><input type="number" className={inputClass} value={form.lengte ?? ''} onChange={(e) => onLengteBreedteChange(e.target.value ? +e.target.value : null, form.breedte)} /></Field>
          <Field label="Breedte (m)"><input type="number" className={inputClass} value={form.breedte ?? ''} onChange={(e) => onLengteBreedteChange(form.lengte, e.target.value ? +e.target.value : null)} /></Field>
          <Field label="m² (handmatig overschrijfbaar)"><input type="number" className={inputClass} value={form.m2 ?? ''} onChange={(e) => set('m2', e.target.value ? +e.target.value : null)} /></Field>
        </div>
      </Section>

      <Section title="Voorzieningen">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer"><input type="checkbox" checked={form.stroom} onChange={(e) => set('stroom', e.target.checked)} /> Stroom aanwezig</label>
          <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer"><input type="checkbox" checked={form.verlichting} onChange={(e) => set('verlichting', e.target.checked)} /> Verlichting</label>
          <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer"><input type="checkbox" checked={form.truckBereikbaar} onChange={(e) => set('truckBereikbaar', e.target.checked)} /> Bereikbaar met bakwagen</label>
          <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer"><input type="checkbox" checked={form.vergunningNodig} onChange={(e) => set('vergunningNodig', e.target.checked)} /> Vergunning nodig</label>
        </div>
        {form.vergunningNodig && (
          <Field label="Link waar vergunning aan te vragen"><input className={inputClass} value={form.vergunningLink ?? ''} onChange={(e) => set('vergunningLink', e.target.value || null)} placeholder="https://..." /></Field>
        )}
        <Field label="Eigendomstype">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer"><input type="radio" checked={form.eigendomType === 'particulier'} onChange={() => set('eigendomType', 'particulier')} /> Particulier</label>
            <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer"><input type="radio" checked={form.eigendomType === 'gemeentelijk'} onChange={() => set('eigendomType', 'gemeentelijk')} /> Gemeentelijk</label>
          </div>
        </Field>
      </Section>

      <Section title="Notities">
        <textarea className={areaClass} rows={5} value={form.notities} onChange={(e) => set('notities', e.target.value)} placeholder="Vrije tekst…" />
      </Section>

      {locationId !== 'new' && originalLocation && (
        <p className="text-[11px] text-[rgba(255,255,255,0.3)]">Contactpersonen, kosten en foto's komen in Task 16-18.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verifieer in browser**

Reload, Locatie man → Locaties → + Nieuwe locatie. Vul naam + adres in ("Kalverstraat 114 Amsterdam"), klik **Opslaan**. Na opslaan verschijnt de kaart met de marker (de geocode vanuit Nominatim). Ga terug naar de lijst — je ziet de card. Klik de card → detail opent.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/locatie/LocatieDetailPage.tsx
git commit -m "feat(ui): add LocatieDetailPage with general/omgeving/afmetingen/voorzieningen sections"
```

---

## Task 16: Frontend — LocatieContactsSection

**Files:**
- Create: `client/src/components/locatie/LocatieContactsSection.tsx`
- Modify: `client/src/components/locatie/LocatieDetailPage.tsx`

- [ ] **Step 1: Schrijf contact-sectie**

```tsx
import type { LocationContact } from '../../api';

type ContactInput = Omit<LocationContact, 'id' | 'locationId' | 'order'>;

interface Props {
  contacts: ContactInput[];
  onChange: (contacts: ContactInput[]) => void;
}

const inputClass = 'h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.08)] text-white text-[13px] focus:outline-none focus:ring-[rgba(255,255,255,0.2)]';

export default function LocatieContactsSection({ contacts, onChange }: Props) {
  const add = () => onChange([...contacts, { naam: '', email: null, telefoon: null, website: null, rol: null }]);
  const remove = (i: number) => onChange(contacts.filter((_, idx) => idx !== i));
  const upd = (i: number, patch: Partial<ContactInput>) => onChange(contacts.map((c, idx) => idx === i ? { ...c, ...patch } : c));

  return (
    <div>
      <div className="flex flex-col gap-3">
        {contacts.map((c, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <input className={`${inputClass} col-span-3`} placeholder="Naam" value={c.naam} onChange={(e) => upd(i, { naam: e.target.value })} />
            <input className={`${inputClass} col-span-3`} placeholder="E-mail" value={c.email ?? ''} onChange={(e) => upd(i, { email: e.target.value || null })} />
            <input className={`${inputClass} col-span-2`} placeholder="Telefoon" value={c.telefoon ?? ''} onChange={(e) => upd(i, { telefoon: e.target.value || null })} />
            <input className={`${inputClass} col-span-2`} placeholder="Website" value={c.website ?? ''} onChange={(e) => upd(i, { website: e.target.value || null })} />
            <input className={`${inputClass} col-span-1`} placeholder="Rol" value={c.rol ?? ''} onChange={(e) => upd(i, { rol: e.target.value || null })} />
            <button onClick={() => remove(i)} className="col-span-1 h-9 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 cursor-pointer" title="Verwijderen">
              <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
            </button>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-3 h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.06)] ring-1 ring-[rgba(255,255,255,0.15)] text-white text-[12px] hover:bg-[rgba(255,255,255,0.12)] cursor-pointer">+ Contact toevoegen</button>
    </div>
  );
}
```

- [ ] **Step 2: Integreer in `LocatieDetailPage.tsx`**

Voeg import toe:

```typescript
import LocatieContactsSection from './LocatieContactsSection';
```

Voeg een sectie toe (tussen "Voorzieningen" en "Notities"):

```tsx
<Section title="Contactpersonen">
  <LocatieContactsSection contacts={form.contacts} onChange={(contacts) => set('contacts', contacts)} />
</Section>
```

- [ ] **Step 3: Verifieer**

In browser: open een locatie, klik "+ Contact toevoegen", vul naam/email in, sla op. Reload: contact verschijnt.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/locatie/LocatieContactsSection.tsx \
         client/src/components/locatie/LocatieDetailPage.tsx
git commit -m "feat(ui): add LocatieContactsSection with add/delete"
```

---

## Task 17: Frontend — LocatieCostsSection

**Files:**
- Create: `client/src/components/locatie/LocatieCostsSection.tsx`
- Modify: `client/src/components/locatie/LocatieDetailPage.tsx`

- [ ] **Step 1: Schrijf kosten-sectie**

```tsx
import type { LocationCost } from '../../api';

type CostInput = Omit<LocationCost, 'id' | 'locationId' | 'order'>;

interface Props {
  costs: CostInput[];
  onChange: (costs: CostInput[]) => void;
}

const inputClass = 'h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.08)] text-white text-[13px] focus:outline-none focus:ring-[rgba(255,255,255,0.2)]';

export default function LocatieCostsSection({ costs, onChange }: Props) {
  const add = () => onChange([...costs, { label: '', bedragCents: 0 }]);
  const remove = (i: number) => onChange(costs.filter((_, idx) => idx !== i));
  const upd = (i: number, patch: Partial<CostInput>) => onChange(costs.map((c, idx) => idx === i ? { ...c, ...patch } : c));

  const total = costs.reduce((sum, c) => sum + c.bedragCents, 0);

  return (
    <div>
      <div className="flex flex-col gap-3">
        {costs.map((c, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <input className={`${inputClass} col-span-6`} placeholder="Label (bv. Locatiehuur)" value={c.label} onChange={(e) => upd(i, { label: e.target.value })} />
            <div className="col-span-5 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.4)] text-[13px]">€</span>
              <input
                type="number"
                step="0.01"
                className={`${inputClass} w-full pl-7`}
                placeholder="0,00"
                value={c.bedragCents === 0 ? '' : (c.bedragCents / 100).toFixed(2)}
                onChange={(e) => upd(i, { bedragCents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : 0 })}
              />
            </div>
            <button onClick={() => remove(i)} className="col-span-1 h-9 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 cursor-pointer" title="Verwijderen">
              <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166M18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79" /></svg>
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-3">
        <button onClick={add} className="h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.06)] ring-1 ring-[rgba(255,255,255,0.15)] text-white text-[12px] hover:bg-[rgba(255,255,255,0.12)] cursor-pointer">+ Kostenpost</button>
        <div className="text-white font-semibold text-[14px]">
          Totaal: {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(total / 100)}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Integreer in detailpagina**

In `LocatieDetailPage.tsx`:

```typescript
import LocatieCostsSection from './LocatieCostsSection';
```

Voeg sectie toe (na Voorzieningen, voor of na Contactpersonen):

```tsx
<Section title="Kosten">
  <LocatieCostsSection costs={form.costs} onChange={(costs) => set('costs', costs)} />
</Section>
```

- [ ] **Step 3: Verifieer + commit**

```bash
git add client/src/components/locatie/LocatieCostsSection.tsx \
         client/src/components/locatie/LocatieDetailPage.tsx
git commit -m "feat(ui): add LocatieCostsSection with totaal"
```

---

## Task 18: Frontend — LocatiePhotoManager

**Files:**
- Create: `client/src/components/locatie/LocatiePhotoManager.tsx`
- Modify: `client/src/components/locatie/LocatieDetailPage.tsx`

- [ ] **Step 1: Schrijf foto-manager**

```tsx
import { useRef } from 'react';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useToast } from '../ui/Toast';
import { uploadLocationPhotos, deleteLocationPhoto, reorderLocationPhotos, setLocationPhotoMain, LocationPhoto } from '../../api';

interface Props {
  locationId: number;
  photos: LocationPhoto[];
  onChange: (photos: LocationPhoto[]) => void;
}

function SortablePhoto({ photo, locationId, onSetMain, onDelete }: { photo: LocationPhoto; locationId: number; onSetMain: () => void; onDelete: () => void; }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="relative w-[150px] h-[150px] rounded-lg overflow-hidden ring-1 ring-[rgba(255,255,255,0.08)] group">
      <img src={`/uploads/Locaties/${locationId}/${photo.filename}`} alt="" className="w-full h-full object-cover" />
      <button {...attributes} {...listeners} className="absolute inset-0 cursor-grab active:cursor-grabbing" aria-label="Sleep om volgorde aan te passen" />
      <button
        onClick={(e) => { e.stopPropagation(); onSetMain(); }}
        className={`absolute top-1 left-1 w-7 h-7 flex items-center justify-center rounded-full ${photo.isMain ? 'bg-accent-teal text-[#1a3a38]' : 'bg-black/60 text-white opacity-0 group-hover:opacity-100'} transition-opacity cursor-pointer`}
        title={photo.isMain ? 'Hoofdfoto' : 'Als hoofdfoto instellen'}
      >
        <svg className="w-4 h-4" fill={photo.isMain ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute top-1 right-1 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500/80 transition-all cursor-pointer"
        title="Verwijderen"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
}

export default function LocatiePhotoManager({ locationId, photos, onChange }: Props) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const newPhotos = await uploadLocationPhotos(locationId, Array.from(files));
      onChange([...photos, ...newPhotos]);
      toast.success(`${newPhotos.length} foto's geüpload`);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Upload mislukt');
    }
  };

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const oldIdx = photos.findIndex((p) => p.id === e.active.id);
    const newIdx = photos.findIndex((p) => p.id === e.over!.id);
    const reordered = arrayMove(photos, oldIdx, newIdx);
    onChange(reordered);
    await reorderLocationPhotos(locationId, reordered.map((p) => p.id));
  };

  const setMain = async (photoId: number) => {
    await setLocationPhotoMain(locationId, photoId);
    onChange(photos.map((p) => ({ ...p, isMain: p.id === photoId })));
  };

  const del = async (photoId: number) => {
    if (!confirm('Foto verwijderen?')) return;
    await deleteLocationPhoto(locationId, photoId);
    // Als dit de hoofdfoto was, promoveer eerste remaining
    const wasMain = photos.find((p) => p.id === photoId)?.isMain;
    let next = photos.filter((p) => p.id !== photoId);
    if (wasMain && next.length) next = next.map((p, i) => ({ ...p, isMain: i === 0 }));
    onChange(next);
  };

  return (
    <div>
      <input ref={inputRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => onUpload(e.target.files)} />
      <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
          <div className="flex flex-wrap gap-3">
            {photos.map((p) => (
              <SortablePhoto key={p.id} photo={p} locationId={locationId} onSetMain={() => setMain(p.id)} onDelete={() => del(p.id)} />
            ))}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-[150px] h-[150px] rounded-lg border-2 border-dashed border-[rgba(255,255,255,0.15)] text-[rgba(255,255,255,0.5)] flex flex-col items-center justify-center gap-2 hover:border-[rgba(255,255,255,0.3)] hover:text-white transition-colors cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              <span className="text-[11px]">Foto uploaden</span>
            </button>
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
```

- [ ] **Step 2: Integreer in detailpagina**

In `LocatieDetailPage.tsx` imports:

```typescript
import LocatiePhotoManager from './LocatiePhotoManager';
```

Voeg state toe voor `photos` omdat die niet in de write-input zitten (foto's beheer je via aparte endpoints). Breid `FormState` uit:

```typescript
type FormState = LocationWriteInput & { lat: number | null; lng: number | null; photos: LocationPhoto[] };
```

Update `emptyForm()` om `photos: []` toe te voegen.

Update `fromLocation()`:

```typescript
photos: loc.photos,
```

Sectie in de render (alleen zichtbaar als locatie opgeslagen is — foto-endpoints vereisen een ID):

```tsx
{locationId !== 'new' && (
  <Section title="Foto's">
    <LocatiePhotoManager locationId={locationId} photos={form.photos} onChange={(photos) => set('photos', photos)} />
  </Section>
)}
```

In `save()`: strip `photos` uit de write-input (zoals je al doet met `lat`/`lng`):

```typescript
const { lat: _la, lng: _ln, photos: _ph, ...writeInput } = form;
```

- [ ] **Step 3: Verifieer**

Open een bestaande locatie → sectie "Foto's" toont upload-tile. Klik, selecteer foto → verschijnt. Sleep om te herordenen. Klik ster → wordt hoofdfoto. X → verwijdert.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/locatie/LocatiePhotoManager.tsx \
         client/src/components/locatie/LocatieDetailPage.tsx
git commit -m "feat(ui): add LocatiePhotoManager with upload/reorder/main/delete"
```

---

## Task 19: Frontend — Unsaved-changes waarschuwing

**Files:**
- Modify: `client/src/components/locatie/LocatieDetailPage.tsx`

- [ ] **Step 1: Integreer `useUnsavedChanges`**

In `LocatieDetailPage.tsx`:

```typescript
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
```

Helper om dirty te detecteren (diepe compare tegen `originalLocation`):

```typescript
const isDirty = (() => {
  if (locationId === 'new') {
    // 'new' is dirty zodra iets ingevuld is
    return !!(form.naam || form.adres || form.contacts.length > 0);
  }
  if (!originalLocation) return false;
  const orig = fromLocation(originalLocation);
  return JSON.stringify({ ...form, photos: null, lat: null, lng: null }) !==
         JSON.stringify({ ...orig, photos: null, lat: null, lng: null });
})();

useUnsavedChanges(isDirty);
```

(Check eerst het pattern in `client/src/hooks/useUnsavedChanges.ts` — gebruik dezelfde API als `ProjectForm`.)

Pas `onBack` aan om ook te waarschuwen:

```typescript
const tryBack = () => {
  if (isDirty && !confirm('Je hebt niet-opgeslagen wijzigingen. Toch terug?')) return;
  onBack();
};
```

En in de JSX: `<button onClick={tryBack}>← Terug</button>`.

- [ ] **Step 2: Verifieer**

Open locatie, wijzig naam, probeer weg te navigeren → confirm dialog verschijnt. Sla op → terug-knop werkt zonder dialog.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/locatie/LocatieDetailPage.tsx
git commit -m "feat(ui): warn on unsaved changes in location detail"
```

---

## Task 20: End-to-end verificatie

- [ ] **Step 1: Volledige flow**

1. Log in als admin
2. Header → Locatie man → Locaties
3. Klik `+ Nieuwe locatie`
4. Vul naam "Test Spui", land "Nederland", adres "Spui Amsterdam"
5. Vink geschiktActivatie + stroom aan
6. Vul lengte 5 × breedte 4 → m² wordt 20
7. Contactpersoon toevoegen: naam "Jan"
8. Kostenpost toevoegen: "Schoonmaak" à €50
9. Klik **Opslaan**
10. Kaart toont marker
11. Upload 2 foto's
12. Sleep foto's om te herordenen
13. Stel tweede foto als hoofdfoto
14. Terug naar lijst → card toont met foto en kosten-totaal €50
15. Filter op "Stroom aanwezig" — locatie blijft zichtbaar
16. Filter op "Vergunning nodig" — locatie verdwijnt (klopt)
17. Wissen → weer zichtbaar
18. Open locatie → Verwijderen → bevestig → card weg
19. Backup test:
    ```bash
    curl -s http://localhost:3001/api/backup/export \
      -H "Authorization: Bearer $TOKEN" --output /tmp/loc-backup.zip
    unzip -p /tmp/loc-backup.zip data.json | python3 -m json.tool | grep -A1 locations
    ```

- [ ] **Step 2: Finale commit**

Als er wijzigingen zijn door verificatie:
```bash
git add -A
git commit -m "chore: final tweaks from E2E verification"
```

Als niet, dan is de feature klaar.

---

## Self-Review Checklist

Checklist die uitgevoerd moet worden bij het afsluiten van implementatie:

**Spec coverage:**
- [ ] Data-model — 4 modellen (Task 1) ✓
- [ ] Navigatie dropdown — Task 10 ✓
- [ ] Lijst met 2-koloms grid + filters + zoekbalk + add button — Tasks 11-13 ✓
- [ ] Detail met alle 9 secties (Algemeen, Omgeving, Geschikt voor, Afmetingen, Voorzieningen, Contactpersonen, Kosten, Foto's, Notities) — Tasks 14-18 ✓
- [ ] Geocoding via Nominatim met rate-limit — Task 2 ✓
- [ ] Kaart via Leaflet — Task 14 ✓
- [ ] Foto-upload met Sharp compressie + reorder + main — Tasks 7, 18 ✓
- [ ] Delete met cascade + foto-cleanup — Task 6 ✓
- [ ] Backup integratie — Task 8 ✓
- [ ] Unsaved-changes warning — Task 19 ✓
- [ ] Permissies: users met `locatie` tab → alle CRUD (geen `adminOnly`) — Tasks 3-7 ✓

**Placeholder scan:** Geen "TBD" / "TODO" / vage stappen in tasks.

**Type consistency:** `Location`, `LocationContact`, `LocationPhoto`, `LocationCost` interfaces komen overeen tussen backend (Prisma) en frontend (`api.ts`). `LocationWriteInput` sluit uit wat niet geschreven wordt (`id`, `lat`, `lng`, `createdAt`, `updatedAt`, `contacts[].id`, etc.).
