# Locatie-voorkeur op de deel-link — Design

**Datum:** 2026-06-09
**Doel:** Klanten die de publieke deel-link openen kunnen per locatie een voorkeur aangeven; de admin ziet per locatie wie welke locatie verkoos.

## Flow (publieke pagina `/locaties/deel/:token`)
1. *(Bestaand)* eventueel wachtwoord-gate.
2. **Identificatie-gate**: naam + e-mail invullen → opgeslagen in `localStorage` (per token). Pas hierna verschijnen de locaties.
3. Bij terugkeer (naam+e-mail bekend in browser) → direct naar de locaties.
4. Per locatie een **"Voorkeur"-vinkje**. Aanvinken = voorkeur, uitvinken = weg. Meerdere mag; niets aanvinken ("nee") is geldig.
5. Bezoeker ziet **alleen z'n eigen** vinkjes — niet de keuzes/tellers van anderen.

## Admin (projectpagina, `LocProjectForm`)
- Per locatie-tab: **"Voorkeur: N — naam1, naam2, …"** (aantal + namen).

## Data
`LocationPreference`:
- `id` (autoincrement)
- `projectId` (FK Project, onDelete Cascade)
- `locationId` (FK Location, onDelete Cascade)
- `voterName` (String)
- `voterEmail` (String)
- `createdAt`
- `@@unique([projectId, locationId, voterEmail])` — e-mail is de identiteit; vinkje aan/uit = rij erbij/eraf.
- index op `projectId`.

## Backend
Publiek (geen auth), onder de share-routes:
- `GET /share/locations/:token/my-preferences?email=<email>` → lijst van `locationId`'s die deze e-mail al verkoos.
- `POST /share/locations/:token/preference` `{ voterName, voterEmail, locationId, preferred }` → rij toevoegen/verwijderen. Valideert e-mailformaat + dat de locatie bij het project hoort.

Admin (auth):
- `GET /projects/:id/preferences` → `{ [locationId]: [{ name, email }] }` voor de per-locatie weergave.

## Frontend
- **SharedLocationsPage**: voter-state uit localStorage; gate-component (naam+e-mail); per `LocationCard` een voorkeur-checkbox die de POST aanroept en de eigen staat bijwerkt.
- **LocProjectForm**: haalt de project-voorkeuren op en toont per locatie-tab "Voorkeur: N — namen".

## Buiten scope (bewust)
- Geen aparte viewers/leads-tracking (alleen wie een voorkeur aanvinkte).
- Geen anti-abuse/identiteitsverificatie (low-stakes, link al achter optioneel wachtwoord).
- Bezoeker ziet andermans keuzes niet.
