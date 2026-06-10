# Changelog

Alle noemenswaardige wijzigingen aan het Megawatt Dashboard.
Vanaf 1.6.0 per release `+0.0.1` omhoog.

## [Unreleased]

_Nog niets — volgende release wordt 1.6.1._

## v1.6.0 — 10 juni 2026

Hervatting van de changelog; samenvatting van het werk sinds v1.5.

### Nieuwe features
- **Deelbare locatie-link per project** — automatisch aangemaakt bij een project, met leesbare slug (`projectnr_klant_projectnaam`) en optioneel wachtwoord.
- **Locatie-voorkeur op de deel-link** — bezoekers identificeren zich met naam + e-mail (in browser bewaard) en markeren per locatie een voorkeur; meerdere personen elk meerdere voorkeuren. Admins zien per locatie het aantal + de namen.
- **Foto-carousel + kaart** per locatie op de deel-pagina (`< >` door de foto's), met lege fotokader als er geen foto is.
- **Auto-backup** — dagelijks, met GFS-retentie: laatste 30 dagen, laatste 12 weken (zondag) en laatste 12 maanden (laatste dag van de maand).
- **E-mail via Microsoft 365 Graph** — methode-keuze SMTP of Graph, met aparte knoppen "Test server" en "Test verzenden".
- **Nieuw Project-knop** (geel) bovenaan het menu.
- **Versielabel onderin de sidebar**, uit `package.json`.

### Gewijzigd
- **E-mail-instellingen slaan automatisch op** — de "Opslaan"-knop is vervangen door auto-save (800 ms na de laatste wijziging), met een statusindicator ("Opslaan…" / "Opgeslagen"). "Test server" en "Test verzenden" forceren eerst een opslag, zodat de test altijd de actuele waarden gebruikt.
- **Menu-benamingen**: Actief → Lopend, Afgerond → Gearchiveerd, Geannuleerd → Afgewezen; hover-rollover (gedempt) die pas bij klik activeert.
- **Fijnmazige tab-rechten** — 4 groepen (Contacten, Projecten, Resources, Intern) met per-item "Zichtbaar"-vinkjes, voor User én Super User (Admin altijd alles).
- **Deel-pagina** toont alleen locaties met "beschikbaar voor dit project = ja"; header op één regel `projectnummer · klant · projectnaam`.
- **Wachtwoord-gate samengevoegd** met de identificatie (Naam · E-mail · Wachtwoord). Wachtwoord wordt nooit in de browser bewaard, dus bij elk bezoek opnieuw vereist — ook voor terugkerende bezoekers.
- **Instellingen** — tab-volgorde Gebruikers, E-mail, Gegevensbeheer, Audit Log; actieve tab blijft behouden bij verversen via de URL.
- **CI/deploy** — Docker-image bouwt single-arch `linux/amd64` met `provenance: false`, zodat Portainer een nieuwe image betrouwbaar opnieuw pullt.

### Verwijderd
- Sectie "Contact van klant" op de projectpagina.

### Tijdelijk verborgen
- Activaties + Evaluaties en de Superchargers-sectie op de projectpagina (eenvoudig terug te zetten).

---

## v1.5 — 8 maart 2026

### Nieuwe features
- **Toast notificaties** — Feedback bij alle CRUD-acties (success/error)
- **Error Boundary** — Nette foutpagina bij crashes
- **Loading skeletons** — Pulserende placeholders tijdens laden
- **Responsive sidebar** — Hamburger menu op mobiele apparaten
- **CSV export** — Exporteer medewerkerlijst als CSV
- **Vacature filter** — Filter op vacatures in medewerkerbeheer
- **Bulk verplaatsing** — Selecteer en verplaats medewerkers naar ander team
- **Wachtwoord sterkte** — Visuele indicator (zwak/matig/sterk)
- **Login rate limiting** — Max 5 pogingen per 15 minuten per IP
- **Dashboard uitgebreid** — SMTP status, backup info, laatste activiteit
- **Onopgeslagen wijzigingen** — Browser waarschuwing bij weggaan zonder opslaan
- **Docker backup volume** — Persistent volume voor backups

---

## v1.0 — 5 maart 2026

Eerste volledige release van het Megawatt Dashboard.

### Features
- **Organigram** — Interactief organigram met CEO, directeuren en teamkolommen
- **Admin panel** — Beheer van teams, medewerkers en executives
- **Foto management** — Upload, face-crop en weergave van medewerkerfotos
- **Executive modals** — Klikbare executive cards met detailinformatie
- **Backup systeem** — Database backup/restore via admin panel
- **Audit log** — Volledige logging van alle wijzigingen met tijdstempel en gebruiker
- **Admin gebruikers** — Meerdere admin accounts met JWT authenticatie
- **Export** — PDF export van organigram
- **Zoeken** — Zoekbalk om medewerkers te filteren op naam of functie
- **Docker** — Productie-deployment via docker-compose met persistent volumes
- **Seed data** — Volledige dataset met alle medewerkers, teams en e-mailadressen
