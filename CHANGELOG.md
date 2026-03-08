# Changelog

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
