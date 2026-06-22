# Extra locatiefilters — ontwerp

**Doel:** Vijf nieuwe, gestructureerde kenmerken aan locaties toevoegen en daarop kunnen filteren: stroomvoorziening-type, aanvraagtijd, volume sampling, doelgroepen en event type.

**Architectuur:** Getypte kolommen op het bestaande `Location`-model (enkelvoudig als tekst, meervoudig als JSON-array in een tekstkolom — zelfde patroon als `allowedTabs`/`scheduleItems`). Filtering blijft client-side in de pure functie `applyFilters`. Geen nieuwe tabellen.

**Tech stack:** Prisma/SQLite (migratie), Express create/update-handlers, React-formulier (`LocatieDetailPage`), filter-sidebar (`LocatieFilterSidebar` + `applyFilters`), Vitest voor de filterlogica.

**Buiten scope (later):** Excel-import-template-kolommen voor deze velden. Wordt apart opgepakt.

---

## 1. Datavelden

Vijf nieuwe velden op `Location`. Bestaande locaties blijven geldig (lege defaults).

| Veld | Type (DB) | Default | Card. | Filter-semantiek |
|---|---|---|---|---|
| `stroomvoorzieningTypes` | String (JSON-array) | `"[]"` | meervoudig | match-any |
| `aanvraagtijd` | String | `""` | enkel | drempel ≤ (binnen-X-weken) |
| `volumeSampling` | String | `""` | enkel | drempel ≤ (klasse en alles eronder) |
| `doelgroepen` | String (JSON-array) | `"[]"` | meervoudig | match-any |
| `eventTypes` | String (JSON-array) | `"[]"` | meervoudig | match-any |

### Presetwaarden (canonieke opslagwaarden)

- **stroomvoorzieningTypes** (extensible, "anders…" toegestaan): `stroomput`, `paddenstoel`, `walaansluiting`
- **aanvraagtijd** (gesloten, geordend): `2_weken` → `4_weken` → `8_weken` → `langer`
- **volumeSampling** (gesloten, geordend): `0-2500` → `2501-5000` → `5001-10000` → `10000+`
- **doelgroepen** (extensible, "anders…" toegestaan): `18-25`, `25-35`, `35-50`, `50+`, `gezinnen`
- **eventTypes** (extensible, "anders…" toegestaan): `weekmarkt`, `introweek`, `festivals`, `beurzen`, `sportevenement`, `winkelcentra`, `station`, `luchthavens`, `parken`, `event_locatie`

Labels (NL-weergave) worden in de UI gemapt; de opslagwaarden hierboven zijn stabiel.

De twee enkelvoudige velden (`aanvraagtijd`, `volumeSampling`) zijn **gesloten** — geen "anders…", omdat de geordende klassen de drempel-filter aansturen. De drie meervoudige velden staan vrije ("anders…") waarden toe; die worden opgeslagen en zijn doorzoekbaar, maar krijgen geen eigen vinkje in de sidebar (alleen presets staan daar).

---

## 2. Schema + migratie

`prisma/schema.prisma` — toevoegen aan `model Location`:

```prisma
stroomvoorzieningTypes String @default("[]")
aanvraagtijd           String @default("")
volumeSampling         String @default("")
doelgroepen            String @default("[]")
eventTypes             String @default("[]")
```

Migratie (`ALTER TABLE "Location" ADD COLUMN …` met defaults), toegepast via `prisma migrate deploy` (idempotent, bewaart data). Draait automatisch mee in `docker-entrypoint.sh` bij deploy.

---

## 3. API / backend

- **`client/src/api.ts`** — `Location` + `LocationWriteInput` uitbreiden: meervoudige velden als `string[]`, enkelvoudige als `string`.
- **`server/routes/locations.ts`** — create- én update-handler: de drie array-velden bij lezen JSON-parsen naar `string[]` en bij schrijven `JSON.stringify`-en (volgens de bestaande JSON-kolom-conventie in de codebase). Enkelvoudige velden 1-op-1. Onbekende/lege waarden → default.

De (de)serialisatie volgt exact hoe bestaande JSON-tekstkolommen worden afgehandeld; implementatie checkt het bestaande patroon (bv. `scheduleItems`/`allowedTabs`) en spiegelt dat.

---

## 4. Formulier (`LocatieDetailPage.tsx`)

Nieuwe presetlijsten (key + NL-label), in lijn met `OMGEVING_PRESETS`.

- **Stroomvoorziening** — chip-/checkbox-groep (meervoudig) met "anders…"-vrije toevoeging. **Alleen zichtbaar wanneer `form.stroom === true`.** Wordt `stroom` op `false` gezet, dan wordt `stroomvoorzieningTypes` geleegd (geen weesdata).
- **Aanvraagtijd** — `<select>` (enkel), 4 opties.
- **Volume sampling** — `<select>` (enkel), 4 klassen.
- **Doelgroepen** — chip-/checkbox-groep (meervoudig) + "anders…".
- **Event type** — chip-/checkbox-groep (meervoudig) + "anders…".

Plaatsing: stroomvoorziening bij de sectie **Voorzieningen** (onder de stroom-checkbox); aanvraagtijd/volume/doelgroepen/event type in een logische nieuwe sectie ("Inzet & doelgroep"). Styling volgt bestaande `Field`/`Section`/`inputClass`.

---

## 5. Filter-sidebar (`LocatieFilterSidebar.tsx` + `applyFilters`)

`LocatieFilters` uitbreiden met vijf arrays:

```ts
stroomvoorziening: string[]; // match-any op stroomvoorzieningTypes
aanvraagtijd: string[];      // drempel ≤
volumeSampling: string[];    // drempel ≤
doelgroepen: string[];       // match-any
eventTypes: string[];        // match-any
```

`EMPTY_FILTERS` en `isEmpty` meenemen.

**`applyFilters`-semantiek:**
- **match-any** (stroomvoorziening, doelgroepen, eventTypes): locatie matcht als zijn array **minstens één** geselecteerde waarde bevat. Niets geselecteerd → geen filtering. (Zoals het Land-filter.)
- **drempel ≤** (volumeSampling): geordende klassen met index 0..3. Locatie matcht als zijn klasse-index **≤ de hoogste** geselecteerde index (gekozen klasse én alles eronder). Identiek aan aanvraagtijd. Lege waarde op de locatie matcht nooit als er een selectie is.
- **drempel ≤** (aanvraagtijd): geordende klassen index 0..3. Locatie matcht als zijn index **≤ de hoogste** geselecteerde index ("binnen X weken"). Lege waarde matcht nooit als er een selectie is.

Sidebar: vijf nieuwe `Section`-blokken met `Check`-vinkjes. Alleen presets als vinkjes. Event type heeft 10 opties — acceptabel als lange lijst; geen collapse nodig (YAGNI).

---

## 6. Handleiding (`helpContent.tsx`)

Korte aanvulling onder **Locaties → Zoeken & filteren**: noem de nieuwe filters (stroomvoorziening, aanvraagtijd, volume sampling, doelgroepen, event type) en leg drempel vs. match-any in één zin uit.

---

## 7. Tests

`applyFilters` is een pure functie → Vitest-unittest (`LocatieFilterSidebar.test.ts` of naast de bestaande tests):
- match-any: locatie met `['festivals']` matcht filter `['festivals','beurzen']`; matcht niet `['parken']`.
- drempel ≤ volume: locatie `2501-5000` matcht selectie `5001-10000` (eronder); locatie `5001-10000` matcht niet selectie `2501-5000`.
- drempel ≤ aanvraagtijd: locatie `2_weken` matcht selectie `4_weken`; locatie `langer` matcht niet selectie `4_weken`.
- lege locatiewaarde matcht niet bij een actieve drempel-selectie.
- lege filters → alles ongewijzigd.

---

## Implementatievolgorde

1. Schema + migratie → `migrate deploy` lokaal, `prisma generate`.
2. API-types + backend (de)serialisatie.
3. `applyFilters` + filtertypes + Vitest (TDD: test eerst).
4. Filter-sidebar UI.
5. Formuliervelden.
6. Handleiding.
7. Type-check + build + tests groen.

Mechanisch werk (2, 4, 5, 6) delegeerbaar naar Sonnet/Haiku; schema/filter-semantiek (1, 3) en eindintegratie op Opus.
