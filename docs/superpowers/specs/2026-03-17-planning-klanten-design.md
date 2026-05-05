# Planning & Klanten Feature — Design Spec

## Overview

Add a Klanten management system and a Planning module with Projects and Activations to the MegawattDashboard admin panel. Restructure the sidebar menu to group related items under "Intern" and "Planning" headers.

**Important naming note:** The existing `Client` model in Prisma represents company logos/links for ClientTeams. The new planning-oriented client entity is named `Klant` to avoid collision.

---

## 1. Menu Restructure

### New sidebar structure

```
Dashboard
Medewerkers
Directie
Klanten                    ← new standalone page
─────────────
Intern                     ← group header (bold, not clickable)
  Organigram               ← existing, moved into group
  Klantteams               ← existing, moved into group
─────────────
Planning                   ← group header (bold, not clickable)
  Superchargers            ← placeholder page
─────────────
Instellingen
Versiegeschiedenis
```

### Implementation details

- "Intern" and "Planning" are non-clickable bold group labels with a divider above
- Sub-items are visually indented under their group header
- Klanten is a regular nav item at `/admin/klanten`
- Superchargers at `/admin/superchargers` renders a placeholder page ("Binnenkort beschikbaar")
- Organigram and Klantteams keep their existing routes (`/admin/overzicht`, `/admin/client-teams`)

### Changes to AdminLayout.tsx

The `navItems` array needs a new shape supporting both regular items and group items:

```ts
type NavItem = { type: 'item'; to: string; label: string; divider?: boolean };
type NavGroup = { type: 'group'; label: string; divider?: boolean; children: NavItem[] };
type NavEntry = NavItem | NavGroup;
```

Using a discriminated union with explicit `type` field for safe runtime checks.

---

## 2. Klanten — CRUD

### Backend: Klant model (Prisma)

```prisma
model Klant {
  id            Int       @id @default(autoincrement())
  name          String    @unique
  contactPerson String?
  email         String?
  projects      Project[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

**Note:** This is separate from the existing `Client` model which belongs to `ClientTeam`. The `Klant` model represents real-world companies for the Planning module.

### API endpoints

All endpoints require `authMiddleware`. All mutations log via `logAudit()`.

| Method | Path               | Description        |
|--------|--------------------|--------------------|
| GET    | /api/klanten       | List all klanten   |
| POST   | /api/klanten       | Create klant       |
| PUT    | /api/klanten/:id   | Update klant       |
| DELETE | /api/klanten/:id   | Delete klant       |

**Cascade rule:** Deleting a Klant is only allowed if it has no linked projects (restrict). Frontend shows an error message if attempted.

### Frontend: `/admin/klanten`

- Table listing all klanten (name, contactPerson, email)
- "Nieuwe klant" button opens inline form or modal
- Edit/delete actions per row
- Follows existing admin page patterns (similar to MemberManager, TeamManager)

---

## 3. Projecten (Projects)

### Backend: Project model (Prisma)

```prisma
model Project {
  id            Int          @id @default(autoincrement())
  klantId       Int
  klant         Klant        @relation(fields: [klantId], references: [id], onDelete: Restrict)
  projectNumber String       @unique
  startDate     DateTime
  endDate       DateTime
  status        String       @default("active")  // "active" | "completed"
  contactPerson String?
  email         String?
  activations   Activation[]
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
}
```

**Validation:** `status` must be `"active"` or `"completed"` (enforced at application layer). `projectNumber` is user-entered, free-format, unique.

### API endpoints

All endpoints require `authMiddleware`. All mutations log via `logAudit()`.

| Method | Path                      | Description                          |
|--------|---------------------------|--------------------------------------|
| GET    | /api/projects             | List projects (filterable by status) |
| GET    | /api/projects/:id         | Project detail incl. activations     |
| POST   | /api/projects             | Create project                       |
| PUT    | /api/projects/:id         | Update project                       |
| DELETE | /api/projects/:id         | Delete project                       |

**POST /api/projects** creates the project AND first empty activation in a single `prisma.$transaction`. The first activation has default empty values for location and date.

**Cascade rule:** Deleting a project cascades to its activations (`onDelete: Cascade`).

### Frontend pages

- **`/admin/projects/new`** — New project form:
  - Klant dropdown (populated from klanten table)
  - On klant selection: contactPerson and email auto-fill but remain editable
  - Project number, start date, end date fields
  - On save: creates project + first empty activation automatically

- **`/admin/projects`** — Active projects overview (status = active)

- **`/admin/projects/completed`** — Completed projects overview (status = completed)

- **`/admin/projects/:id`** — Project detail/edit page with activation tabs (see section 4)

---

## 4. Activaties (Activations)

### Backend: Activation model (Prisma)

```prisma
model Activation {
  id        Int      @id @default(autoincrement())
  projectId Int
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  location  String   @default("")
  date      DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Note:** `location` defaults to empty string and `date` is nullable to support the auto-created first activation which starts with empty values.

### API endpoints

All endpoints require `authMiddleware`. All mutations log via `logAudit()`.

| Method | Path                                    | Description                    |
|--------|-----------------------------------------|--------------------------------|
| GET    | /api/projects/:projectId/activations    | List activations for project   |
| POST   | /api/projects/:projectId/activations    | Create activation              |
| PUT    | /api/activations/:id                    | Update activation              |
| DELETE | /api/activations/:id                    | Delete activation              |

### Frontend (embedded in project detail page `/admin/projects/:id`)

- Below the project form: toggle-tabs, one per activation
- Each tab label = activation's location name (or "Nieuwe activatie" if location is empty)
- Clicking a tab shows that activation's date + location fields (editable)
- A **+** button next to the tabs creates a new activation
- First activation is automatically created when a new project is saved

---

## 5. Implementation Order

1. **Menu restructure** — Update AdminLayout.tsx navItems + rendering logic
2. **Klanten backend** — Klant model, Prisma migration, API routes with auth + audit logging
3. **Klanten frontend** — KlantenManager page at `/admin/klanten`
4. **Projecten backend** — Project model, Prisma migration, API routes with auth + audit logging
5. **Projecten frontend** — New/list/completed/detail project pages
6. **Activaties backend** — Activation model, Prisma migration, API routes with auth + audit logging
7. **Activaties frontend** — Tab UI in project detail page
8. **Superchargers placeholder** — Empty page at `/admin/superchargers`

---

## 6. Tech Stack (existing)

- **Backend:** Node.js, Express, Prisma ORM with SQLite
- **Frontend:** React + TypeScript, Vite, Tailwind CSS, React Router v6
- **Auth:** JWT-based auth middleware on all admin API endpoints
- **Audit:** `logAudit()` on all mutations (existing pattern)
- **Patterns:** Follow existing admin page patterns (MemberManager, TeamManager, etc.)
