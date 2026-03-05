# MEGAWATT Organigram

Interactief organigram voor Megawatt Agency. Dark-themed web app met hiërarchische visualisatie van directie, teams en medewerkers.

### Functionaliteiten

- **Organigram** — Visueel overzicht van CEO, directie, teams en medewerkers met foto's
- **Zoeken** — Zoek op naam of functie, met highlight van resultaten
- **Contactgegevens** — Klik op een medewerker of directielid voor e-mail en telefoon
- **PDF Export** — Download het organigram als PDF
- **Admin panel** — Beheer teams, medewerkers, directieleden en admin gebruikers
- **Foto management** — Upload foto's met automatische face-crop
- **Backup** — Export en import van alle data als ZIP, inclusief foto's
- **Drag & drop** — Herorden teams en medewerkers via drag & drop in het admin panel

## Stack

- **Frontend:** React 18 + TypeScript + Tailwind CSS v4 + Vite
- **Backend:** Express + Prisma ORM + SQLite
- **PDF Export:** html-to-image + jsPDF
- **Photo Processing:** Python face-crop-plus (auto face detection)
- **Deploy:** Docker (multi-stage build)

## Development

```bash
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Frontend: `http://localhost:5173` | Backend: `http://localhost:3001`

## Docker Deployment

### Build & run locally

```bash
docker compose up --build -d
```

### Build from GitHub (for remote servers like Synology)

Create a `docker-compose.yml`:

```yaml
services:
  organigram:
    build:
      context: https://<GITHUB_PAT>@github.com/NielHeesakkers/megawatt-organigram.git#main
    container_name: megawatt-organigram
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DATABASE_URL=file:/app/data/dev.db
      - JWT_SECRET=your-secret-here
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
    restart: unless-stopped
```

Replace `<GITHUB_PAT>` with a GitHub Personal Access Token (repo scope).

### Update deployment

```bash
docker compose build --no-cache && docker compose up -d
```

## Upload photos to production

```bash
python3 upload-photos.py
```

Uploads all photos from `uploads/` to the production API at `https://test.heesakkers.com`.

## Admin Panel

Navigate to `/admin`. Default credentials: `admin` / `megawatt2026`

## Project Structure

```
client/               React frontend
  src/components/
    organigram/       Organigram page, member cards, modals
    admin/            Admin panel (teams, members, executives)
    ui/               Shared UI components
server/               Express API
  routes/             API endpoints
  middleware/         Auth + file upload
  lib/               Python face-crop script
prisma/               Database schema + migrations + seed
uploads/              Member photos (persistent volume)
```
