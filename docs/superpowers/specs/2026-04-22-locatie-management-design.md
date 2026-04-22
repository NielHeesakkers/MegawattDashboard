# Locatie Management — Design

**Datum:** 2026-04-22
**Status:** Goedgekeurd voor implementatie

## Doel

Herbruikbare, doorzoekbare database van fysieke locaties waar Megawatt activaties of mass-sampling kan doen. Vervangt de huidige per-klant/per-project Excel-bestanden met een centrale lijst die filterbaar is, foto's ondersteunt en per locatie gedetailleerde info bewaart voor toekomstig gebruik.

## Scope

### In scope
- CRUD voor locaties (aanmaken, bekijken, bewerken, verwijderen)
- Lijstweergave met live-filter zijbalk
- Detailpagina met alle velden
- Foto-upload met compressie, volgorde, hoofdfoto
- Adres-geocoding via Nominatim (OpenStreetMap)
- Kaartweergave via Leaflet (al in project)
- Meerdere contactpersonen en kostenposten per locatie
- Integratie met bestaande backup-systeem

### Out of scope (mogelijk later)
- Sub-menu "Opdrachten" — placeholder nu, wordt later uitgewerkt en mogelijk gekoppeld aan bestaand `Project`/`Activation`-model
- Exporteren van locatielijst naar Excel/PDF
- Automatische distance-to-store berekening (geen vraag uit use case)

## Permissies

- Zichtbaarheid: alleen users met tab `locatie` (al gebouwd: knop "Locatie man" in header verschijnt via `hasTab('locatie')`)
- Aanmaken / bewerken / verwijderen: iedereen met de `locatie`-tab. Admin is alleen nodig om de tab aan een gebruiker toe te kennen.

## Navigatie

"Locatie man"-knop in de header wordt uitgebreid tot een dropdown met twee items (consistent met `Intern` en `Planning`):

- **Locaties** — default, lijstweergave
- **Opdrachten** — placeholder "Binnenkort beschikbaar"

`ViewMode` uitbreiden in `OrganigramPage.tsx` van `'locatie'` naar `'locatie-lijst' | 'locatie-opdrachten' | 'locatie-detail'`. Detail gebruikt lokale state voor het actieve `locationId` (zelfde patroon als `ProjectForm`).

## Data-model (Prisma)

### `Location`
```
id                Int PK
naam              String
land              String                  // bv. "Nederland", "Duitsland"
adres             String
lat, lng          Float?                  // nullable — leeg bij geocode-mislukking

omgevingType      String                  // enum: centrum | winkelstraat | park | plein | stationsplein
orientatie        String                  // enum: N | NO | O | ZO | Z | ZW | W | NW

eigendomType      String                  // enum: particulier | gemeentelijk
vergunningNodig   Boolean                 // default false
vergunningLink    String?
truckBereikbaar   Boolean                 // default false

geschiktActivatie Boolean                 // default false
geschiktSampling  Boolean                 // default false

stroom            Boolean                 // default false
verlichting       Boolean                 // default false

lengte            Float?                  // meters
breedte           Float?                  // meters
m2                Float?                  // meters² — wordt berekend uit lengte × breedte, maar kan overschreven worden

notities          String                  // vrij tekst, default ""

createdAt         DateTime @default(now())
updatedAt         DateTime @updatedAt

contacts          LocationContact[]
photos            LocationPhoto[]
costs             LocationCost[]
```

### `LocationContact`
```
id          Int PK
locationId  Int FK → Location  (onDelete: Cascade)
naam        String
email       String?
telefoon    String?
website     String?
rol         String?            // bv. "Eigenaar", "Event manager"
order       Int                // volgorde in UI
```

### `LocationPhoto`
```
id          Int PK
locationId  Int FK → Location  (onDelete: Cascade)
filename    String             // "<photoId>.jpg"
isMain      Boolean            // hoofdfoto voor thumbnail
order       Int
createdAt   DateTime @default(now())
```

### `LocationCost`
```
id          Int PK
locationId  Int FK → Location  (onDelete: Cascade)
label       String             // default "Locatiehuur"
bedragCents Int                // in centen, valuta EUR
order       Int
```

## Lijstweergave

### Layout
Grid met linker zijbalk (filters) en main-area met 2-koloms kaartgrid. Zoekbalk bovenaan voor naam/adres/stad. Rechtsboven knop `+ Nieuwe locatie`.

### Filters (live, checkboxes in zijbalk)
Groepen (OR binnen groep, AND tussen groepen):

- **Land** — dynamisch gevuld met alle unieke `land`-waardes uit de database
- **Oppervlak** — buckets: `≤ 10 m²`, `20 m²` (11-25), `40 m²` (26-50), `60+ m²` (>50)
- **Geschikt voor** — Activatie, Mass sampling
- **Voorzieningen** — Stroom aanwezig, Verlichting, Vergunning nodig, Bereikbaar met bakwagen
- **Type** — Particulier, Gemeentelijk

Boven filters: resultaat-teller (`23 locaties`) en `Filters wissen`-knop (zichtbaar als minimaal één vinkje aan). Geen vinkjes = alle locaties zichtbaar.

### Kaart (card) — 2-koloms grid, 1 rij per card
```
┌───────────┬──────────────────────────────────────────┐
│           │  Cafe de Jaren                € 1.200    │
│  [foto]   │  Amsterdam, NL  ·  40 m²                 │
│  130×130  │  [Activatie] [Stroom] [Particulier]      │
└───────────┴──────────────────────────────────────────┘
```

- Foto = hoofdfoto (`isMain=true`); placeholder-icon als locatie geen foto heeft
- Kosten-totaal rechtsboven = som van alle `LocationCost.bedragCents`, in EUR met duizendscheiders
- Chips alleen renderen als betreffende property `true` is (maakt card compacter bij kale data)
- Hele card klikbaar → detailpagina voor die locatie

### Lege staat
Geen locaties in DB → centraal `+ Voeg je eerste locatie toe`-blok.

## Detailpagina

Single-page form, verticaal gescrolld. Sticky header met:
- Links: `← Terug` (naar lijst)
- Midden: naam van de locatie (of "Nieuwe locatie")
- Rechts: `Opslaan`-knop en `Verwijderen`-knop (rood, bevestigingsdialoog)

`useUnsavedChanges`-hook (bestaat al) waarschuwt bij weg-navigeren met vuile state.

### Secties (op volgorde)

**1. Algemeen**
- Naam (required)
- Land (dropdown met bestaande waardes + "nieuwe toevoegen")
- Adres (textarea, meerdere regels mag)
- `Geocode adres`-knop → backend roept Nominatim aan, vult lat/lng
- Leaflet-map (200px hoog) met marker op lat/lng; placeholder "Adres niet gevonden" als lat/lng ontbreekt
- Klik op kaart → opent Google Maps route in nieuw tabblad

**2. Omgeving**
- Omgevingstype (dropdown)
- Oriëntatie (dropdown N / NO / O / ZO / Z / ZW / W / NW)

**3. Geschikt voor**
- Checkbox: Activatie
- Checkbox: Mass sampling

**4. Afmetingen**
- Lengte (m) × Breedte (m) → auto-berekent m²
- m²-veld is ook direct bewerkbaar; handmatige invoer overschrijft de berekening (voor bv. onregelmatige vormen)

**5. Voorzieningen**
- Stroom aanwezig (ja/nee)
- Verlichting (ja/nee)
- Vergunning nodig (ja/nee) — indien ja, extra veld `Link waar aan te vragen`
- Eigendomstype (radio: Particulier / Gemeentelijk)
- Bereikbaar met bakwagen (ja/nee)

**6. Contactpersonen**
Lijst van rijen. Elke rij: Naam · E-mail · Telefoon · Website · Rol · prullenbak. Onderaan `+ Contact toevoegen`. Volgorde aanpasbaar via drag-handle (@dnd-kit, al in project).

**7. Kosten**
Eerste rij is default `Locatiehuur` met bedrag. Extra rijen via `+ Kostenpost toevoegen`. Per rij: label · bedrag (€) · prullenbak. Totaal onderaan in bold.

**8. Foto's**
- Upload-knop (multi-file, drag-drop ondersteund, max 10 MB per bestand)
- Grid van thumbnails (~150px)
- Per foto: ster (`isMain`-toggle, maar maximaal één hoofdfoto tegelijk), drag-handle voor volgorde, X-knop voor verwijderen
- Eerste geüploade foto wordt automatisch hoofdfoto
- Als hoofdfoto verwijderd wordt, wordt de volgende in volgorde hoofdfoto

**9. Notities**
Textarea, vrij tekst.

## Geocoding

- Endpoint: `https://nominatim.openstreetmap.org/search?q=<adres>&format=json&limit=1`
- User-Agent header vereist: `Megawatt Dashboard (familie@heesakkers.com)` (Nominatim policy)
- Rate limit: 1 request/seconde — backend houdt queue bij (simpele in-memory throttle volstaat)
- Wordt aangeroepen:
  - Bij `POST /api/locations` (nieuwe locatie)
  - Bij `PUT /api/locations/:id` als het `adres`-veld wijzigt
  - Handmatig via `POST /api/locations/:id/geocode` (voor "opnieuw proberen"-knop)
- Bij mislukking: `lat`/`lng` blijven `null`, locatie wordt normaal opgeslagen, UI toont placeholder op de kaart

## Foto-flow

### Opslag
- Pad: `uploads/Locaties/<locationId>/<photoId>.jpg`
- Alle foto's worden door Sharp gecomprimeerd: max 1600px breed, JPEG quality 80
- Max upload 10 MB per bestand (voor compressie)

### Endpoints
```
POST    /api/locations/:id/photos               multi-file upload
DELETE  /api/locations/:id/photos/:photoId
PATCH   /api/locations/:id/photos/order         body: { order: [photoId, photoId, ...] }
PATCH   /api/locations/:id/photos/:photoId/main zet als hoofdfoto (andere worden auto-false)
```

### Delete-gedrag
- Bestand van disk + DB-rij weg
- Als verwijderde foto de hoofdfoto was, krijgt de eerste remaining (op `order`) `isMain=true`

## REST API

```
GET     /api/locations                     // lijst, query-params: q, land[], m2[], geschiktVoor[], etc.
GET     /api/locations/:id                 // detail met contacts, photos, costs
POST    /api/locations                     // aanmaken (triggert geocode)
PUT     /api/locations/:id                 // updaten — contacts/costs inline in body, in één transactie
DELETE  /api/locations/:id                 // cascade verwijdert contacts, photos, costs + foto-bestanden
POST    /api/locations/:id/geocode         // handmatig opnieuw geocoden
POST    /api/locations/:id/photos          // upload (zie Foto-flow)
DELETE  /api/locations/:id/photos/:photoId
PATCH   /api/locations/:id/photos/order
PATCH   /api/locations/:id/photos/:photoId/main
```

Alle endpoints: `authMiddleware`. Geen `adminOnly` — users met de tab zijn al gefilterd.

Contacts en costs worden inline met de `POST`/`PUT` meegestuurd (full-replace strategie, zoals `Project` al doet). Photo-management loopt via aparte endpoints omdat het file-uploads betreft.

## Backup-integratie

In `server/routes/backup.ts`:
- `BackupData` interface uitbreiden met `locations`, `locationContacts`, `locationPhotos`, `locationCosts`
- `/export`: vier nieuwe `prisma.xxx.findMany()` calls toevoegen aan de `Promise.all`
- `/import`: ID-remapping voor `Location`, cascade inserts voor contacts/photos/costs (zelfde patroon als `ClientTeam`)
- `/clear`: `deleteMany` in juiste volgorde (costs/photos/contacts vóór location) in de transactie
- Foto-bestanden komen automatisch mee via bestaande `uploads/`-directory-copy

## Frontend-structuur

Nieuwe bestanden in `client/src/components/locatie/`:
```
LocatieListPage.tsx          // 2-koloms grid + filters + zoekbalk
LocatieDetailPage.tsx        // detail-form met alle secties
LocatieCard.tsx              // card-component voor lijst
LocatieFilterSidebar.tsx     // linker filterzijbalk
LocatieMap.tsx               // Leaflet-wrapper
LocatiePhotoManager.tsx      // upload/grid/reorder/main/delete
LocatieContactsSection.tsx   // meerdere contacten met add/delete
LocatieCostsSection.tsx      // meerdere kosten met totaal
```

Aanpassingen:
- `OrganigramPage.tsx`: `locatie`-knop omzetten naar dropdown, viewmode-uitbreiding, detail-state
- `LocatieManPage.tsx`: verwijderen (vervangen door `LocatieListPage`)

Nieuwe backend-bestanden:
```
server/routes/locations.ts       // alle location-endpoints
server/lib/geocode.ts            // Nominatim-wrapper met rate-limit
```

## Openstaande punten voor later

- "Opdrachten"-sub-tab: koppeling aan bestaand `Project`/`Activation`-model, meerdere locaties per opdracht, historisch overzicht "welke opdracht gebruikte deze locatie"
- Bulk-import van bestaande Excel-bestanden (C&A Amsterdam/München/Wenen)
- Export naar Excel/PDF voor delen met klanten
