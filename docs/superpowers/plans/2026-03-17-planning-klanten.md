# Planning & Klanten Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Klanten CRUD, Projects with Activations, and restructure the admin sidebar with Intern/Planning group menus.

**Architecture:** Prisma models (Klant, Project, Activation) with Express REST routes following existing patterns. React frontend with admin manager pages matching MemberManager/TeamManager patterns (using existing Modal, ConfirmDialog, useToast). Menu uses discriminated union types for group headers vs regular items.

**Tech Stack:** Prisma ORM + SQLite, Express + authMiddleware + logAudit, React + TypeScript + Tailwind CSS + React Router v6

**Spec:** `docs/superpowers/specs/2026-03-17-planning-klanten-design.md`

---

## File Structure

### New files to create:
- `prisma/migrations/<timestamp>_add_klant_project_activation/migration.sql` (auto-generated)
- `server/routes/klanten.ts` — Klant CRUD routes
- `server/routes/projects.ts` — Project CRUD + nested activation routes
- `client/src/components/admin/KlantenManager.tsx` — Klanten CRUD page
- `client/src/components/admin/ProjectList.tsx` — Active/completed projects overview
- `client/src/components/admin/ProjectForm.tsx` — New/edit project form with activation tabs
- `client/src/components/admin/SuperchargersPlaceholder.tsx` — Placeholder page

### Files to modify:
- `prisma/schema.prisma` — Add Klant, Project, Activation models
- `server/index.ts` — Mount new route files
- `client/src/api.ts` — Add types + API functions for Klant, Project, Activation
- `client/src/App.tsx` — Add new routes
- `client/src/components/admin/AdminLayout.tsx` — Restructure navItems with group headers

---

## Chunk 1: Menu Restructure

### Task 1: Update AdminLayout navItems and rendering

**Files:**
- Modify: `client/src/components/admin/AdminLayout.tsx:59-111`

- [ ] **Step 1: Update navItems type and data**

Replace lines 59-67 in `AdminLayout.tsx`:

```typescript
type NavItem = { type: 'item'; to: string; label: string; divider?: boolean };
type NavGroup = { type: 'group'; label: string; divider?: boolean; children: NavItem[] };
type NavEntry = NavItem | NavGroup;

const navItems: NavEntry[] = [
  { type: 'item', to: '/admin', label: 'Dashboard' },
  { type: 'item', to: '/admin/members', label: 'Medewerkers' },
  { type: 'item', to: '/admin/directie', label: 'Directie' },
  { type: 'item', to: '/admin/klanten', label: 'Klanten' },
  {
    type: 'group',
    label: 'Intern',
    divider: true,
    children: [
      { type: 'item', to: '/admin/overzicht', label: 'Organigram' },
      { type: 'item', to: '/admin/client-teams', label: 'Klantteams' },
    ],
  },
  {
    type: 'group',
    label: 'Planning',
    divider: true,
    children: [
      { type: 'item', to: '/admin/projects', label: 'Projecten' },
      { type: 'item', to: '/admin/superchargers', label: 'Superchargers' },
    ],
  },
  { type: 'item', to: '/admin/settings', label: 'Instellingen', divider: true },
  { type: 'item', to: '/admin/versions', label: 'Versiegeschiedenis' },
];
```

- [ ] **Step 2: Update sidebar rendering logic**

Replace the nav rendering block (lines 94-111) inside `sidebarContent` with:

```tsx
<nav className="flex-1 flex flex-col gap-[2px]">
  {navItems.map((entry) => {
    if (entry.type === 'group') {
      return (
        <div key={entry.label}>
          {entry.divider && (
            <div className="border-t border-[rgba(255,255,255,0.06)] my-2" />
          )}
          <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[rgba(255,255,255,0.4)]">
            {entry.label}
          </div>
          {entry.children.map((child) => (
            <Link
              key={child.to}
              to={child.to}
              className={`block px-3 py-2 pl-5 rounded-[6px] text-[14px] transition-all duration-150 ${
                location.pathname === child.to
                  ? 'bg-accent-teal text-[#1a3a38]'
                  : 'text-[rgba(255,255,255,0.7)] hover:text-[rgba(255,255,255,0.9)]'
              }`}
            >
              {child.label}
            </Link>
          ))}
        </div>
      );
    }
    return (
      <div key={entry.to}>
        {entry.divider && (
          <div className="border-t border-[rgba(255,255,255,0.06)] my-2" />
        )}
        <Link
          to={entry.to}
          className={`block px-3 py-2 rounded-[6px] text-[14px] transition-all duration-150 ${
            location.pathname === entry.to
              ? 'bg-accent-teal text-[#1a3a38]'
              : 'text-[rgba(255,255,255,0.7)] hover:text-[rgba(255,255,255,0.9)]'
          }`}
        >
          {entry.label}
        </Link>
      </div>
    );
  })}
</nav>
```

- [ ] **Step 3: Create Superchargers placeholder page**

Create `client/src/components/admin/SuperchargersPlaceholder.tsx`:

```tsx
export default function SuperchargersPlaceholder() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-text-primary mb-2">Superchargers</h2>
        <p className="text-text-secondary">Binnenkort beschikbaar</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add placeholder routes to App.tsx**

Add imports in `App.tsx`:

```typescript
import SuperchargersPlaceholder from './components/admin/SuperchargersPlaceholder';
```

Add inside the `<Route path="/admin" element={<AdminLayout />}>` block:

```tsx
<Route path="klanten" element={<div>Klanten - coming soon</div>} />
<Route path="projects" element={<div>Projecten - coming soon</div>} />
<Route path="superchargers" element={<SuperchargersPlaceholder />} />
```

- [ ] **Step 5: Verify the menu renders correctly**

Run: `cd megawatt-dashboard && npm run dev`

Verify:
- Sidebar shows the new menu structure with Intern and Planning groups
- Group headers are bold, uppercase, non-clickable
- Sub-items (Organigram, Klantteams, Projecten, Superchargers) are indented
- Klanten menu item appears between Directie and Intern divider
- Active state highlighting works for all items including sub-items
- Superchargers page shows "Binnenkort beschikbaar"

- [ ] **Step 6: Commit**

```bash
git add client/src/components/admin/AdminLayout.tsx client/src/components/admin/SuperchargersPlaceholder.tsx client/src/App.tsx
git commit -m "feat: restructure admin sidebar with Intern and Planning group menus"
```

---

## Chunk 2: Klanten Backend

### Task 2: Add Klant, Project, Activation models to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma` (append after existing models)

- [ ] **Step 1: Add models to schema.prisma**

Append to the end of `prisma/schema.prisma`:

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

model Project {
  id            Int          @id @default(autoincrement())
  klantId       Int
  klant         Klant        @relation(fields: [klantId], references: [id], onDelete: Restrict)
  projectNumber String       @unique
  startDate     DateTime
  endDate       DateTime
  status        String       @default("active")
  contactPerson String?
  email         String?
  activations   Activation[]
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@index([klantId])
}

model Activation {
  id        Int       @id @default(autoincrement())
  projectId Int
  project   Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  location  String    @default("")
  date      DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@index([projectId])
}
```

- [ ] **Step 2: Run Prisma migration**

Run: `cd megawatt-dashboard && npx prisma migrate dev --name add_klant_project_activation`

Expected: Migration created successfully, 3 new tables in SQLite.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Klant, Project, Activation models to Prisma schema"
```

### Task 3: Create Klanten API routes

**Files:**
- Create: `server/routes/klanten.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Create klanten routes file**

Create `server/routes/klanten.ts`:

```typescript
import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAudit } from '../lib/audit';

const router = Router();
const prisma = new PrismaClient();

// List all klanten
router.get('/', async (_req, res: Response) => {
  const klanten = await prisma.klant.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { projects: true } } },
  });
  res.json(klanten);
});

// Get single klant
router.get('/:id', async (req, res: Response) => {
  const klant = await prisma.klant.findUnique({
    where: { id: Number(req.params.id) },
    include: { projects: true },
  });
  if (!klant) {
    res.status(404).json({ error: 'Klant niet gevonden' });
    return;
  }
  res.json(klant);
});

// Create klant
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { name, contactPerson, email } = req.body;
  try {
    const klant = await prisma.klant.create({
      data: { name, contactPerson, email },
    });
    await logAudit('CREATE', 'Klant', klant.id, { name, contactPerson, email }, req.adminUsername!);
    res.status(201).json(klant);
  } catch (err: unknown) {
    const prismaErr = err as { code?: string };
    if (prismaErr.code === 'P2002') {
      res.status(400).json({ error: 'Er bestaat al een klant met deze naam' });
      return;
    }
    throw err;
  }
});

// Update klant
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { name, contactPerson, email } = req.body;
  try {
    const klant = await prisma.klant.update({
      where: { id: Number(req.params.id) },
      data: { name, contactPerson, email },
    });
    await logAudit('UPDATE', 'Klant', klant.id, { name, contactPerson, email }, req.adminUsername!);
    res.json(klant);
  } catch (err: unknown) {
    const prismaErr = err as { code?: string };
    if (prismaErr.code === 'P2002') {
      res.status(400).json({ error: 'Er bestaat al een klant met deze naam' });
      return;
    }
    throw err;
  }
});

// Delete klant (only if no linked projects)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const projectCount = await prisma.project.count({ where: { klantId: id } });
  if (projectCount > 0) {
    res.status(400).json({ error: 'Kan klant niet verwijderen: er zijn nog projecten gekoppeld' });
    return;
  }
  await prisma.klant.delete({ where: { id } });
  await logAudit('DELETE', 'Klant', id, {}, req.adminUsername!);
  res.json({ success: true });
});

export default router;
```

- [ ] **Step 2: Mount klanten routes in server/index.ts**

Add import near other route imports (around line 15):

```typescript
import klantenRoutes from './routes/klanten';
```

Add route mounting near other `app.use` lines (around line 40):

```typescript
app.use('/api/klanten', klantenRoutes);
```

- [ ] **Step 3: Verify API works**

Run: `cd megawatt-dashboard && npm run dev`

Test: `curl http://localhost:3001/api/klanten`

Expected: `[]`

- [ ] **Step 4: Commit**

```bash
git add server/routes/klanten.ts server/index.ts
git commit -m "feat: add Klanten API routes with CRUD endpoints"
```

---

## Chunk 3: Klanten Frontend

### Task 4: Add Klant types and API functions

**Files:**
- Modify: `client/src/api.ts`

- [ ] **Step 1: Add Klant interface and API functions**

Add the `Klant` interface near the other type definitions (around line 150):

```typescript
export interface Klant {
  id: number;
  name: string;
  contactPerson: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { projects: number };
}
```

Add API functions near the other CRUD functions:

```typescript
// Klanten
export const fetchKlanten = () => api.get<Klant[]>('/klanten').then((r) => r.data);
export const fetchKlant = (id: number) => api.get<Klant>(`/klanten/${id}`).then((r) => r.data);
export const createKlant = (data: Partial<Klant>) => api.post<Klant>('/klanten', data).then((r) => r.data);
export const updateKlant = (id: number, data: Partial<Klant>) => api.put<Klant>(`/klanten/${id}`, data).then((r) => r.data);
export const deleteKlant = (id: number) => api.delete(`/klanten/${id}`);
```

- [ ] **Step 2: Commit**

```bash
git add client/src/api.ts
git commit -m "feat: add Klant types and API functions"
```

### Task 5: Create KlantenManager page

**Files:**
- Create: `client/src/components/admin/KlantenManager.tsx`
- Modify: `client/src/App.tsx`

Uses existing `Modal`, `ConfirmDialog`, and `useToast` components to match codebase patterns.

- [ ] **Step 1: Create KlantenManager component**

Create `client/src/components/admin/KlantenManager.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { Klant, fetchKlanten, createKlant, updateKlant, deleteKlant } from '../../api';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

export default function KlantenManager() {
  const toast = useToast();
  const [klanten, setKlanten] = useState<Klant[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', contactPerson: '', email: '' });
  const [deletingKlant, setDeletingKlant] = useState<Klant | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const data = await fetchKlanten();
    setKlanten(data);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm({ name: '', contactPerson: '', email: '' });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (klant: Klant) => {
    setForm({
      name: klant.name,
      contactPerson: klant.contactPerson || '',
      email: klant.email || '',
    });
    setEditingId(klant.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await updateKlant(editingId, form);
        toast.success('Klant bijgewerkt');
      } else {
        await createKlant(form);
        toast.success('Klant aangemaakt');
      }
      setShowForm(false);
      await load();
    } catch {
      toast.error('Klant opslaan mislukt');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingKlant) return;
    try {
      await deleteKlant(deletingKlant.id);
      toast.success(`Klant "${deletingKlant.name}" verwijderd`);
      await load();
    } catch {
      toast.error('Kan klant niet verwijderen — er zijn nog projecten gekoppeld');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Klanten</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-[6px] bg-accent-teal text-[#1a3a38] font-semibold hover:opacity-85 transition-opacity cursor-pointer"
        >
          + Nieuwe klant
        </button>
      </div>

      <div className="bg-bg-surface rounded-[12px] border border-[rgba(255,255,255,0.08)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[rgba(255,255,255,0.08)]">
              <th className="text-left px-4 py-3 text-text-secondary text-sm font-medium">Naam</th>
              <th className="text-left px-4 py-3 text-text-secondary text-sm font-medium">Contactpersoon</th>
              <th className="text-left px-4 py-3 text-text-secondary text-sm font-medium">Email</th>
              <th className="text-left px-4 py-3 text-text-secondary text-sm font-medium">Projecten</th>
              <th className="text-right px-4 py-3 text-text-secondary text-sm font-medium">Acties</th>
            </tr>
          </thead>
          <tbody>
            {klanten.map((klant) => (
              <tr key={klant.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]">
                <td className="px-4 py-3 text-text-primary font-medium">{klant.name}</td>
                <td className="px-4 py-3 text-text-secondary">{klant.contactPerson || '—'}</td>
                <td className="px-4 py-3 text-text-secondary">{klant.email || '—'}</td>
                <td className="px-4 py-3 text-text-secondary">{klant._count?.projects ?? 0}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => openEdit(klant)}
                    className="text-accent-teal hover:opacity-80 text-sm mr-3 cursor-pointer"
                  >
                    Bewerk
                  </button>
                  <button
                    onClick={() => setDeletingKlant(klant)}
                    className="text-red-400 hover:opacity-80 text-sm cursor-pointer"
                  >
                    Verwijder
                  </button>
                </td>
              </tr>
            ))}
            {klanten.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  Nog geen klanten. Klik op "+ Nieuwe klant" om er een toe te voegen.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit modal — uses existing Modal component */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? 'Klant bewerken' : 'Nieuwe klant'}
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-text-secondary text-sm mb-1">Naam *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px]"
              />
            </div>
            <div>
              <label className="block text-text-secondary text-sm mb-1">Contactpersoon</label>
              <input
                type="text"
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                className="w-full px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px]"
              />
            </div>
            <div>
              <label className="block text-text-secondary text-sm mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg bg-white/10 text-text-primary hover:bg-white/20 transition-colors cursor-pointer"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-[6px] bg-accent-teal text-[#1a3a38] font-semibold hover:opacity-85 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation — uses existing ConfirmDialog */}
      <ConfirmDialog
        isOpen={!!deletingKlant}
        onClose={() => setDeletingKlant(null)}
        onConfirm={handleDelete}
        title="Klant verwijderen?"
        message={`Weet je zeker dat je "${deletingKlant?.name}" wilt verwijderen?`}
      />
    </div>
  );
}
```

- [ ] **Step 2: Update App.tsx route for Klanten**

Add import in `App.tsx`:

```typescript
import KlantenManager from './components/admin/KlantenManager';
```

Change the placeholder route:
```tsx
<Route path="klanten" element={<KlantenManager />} />
```

- [ ] **Step 3: Verify Klanten CRUD works**

Run: `cd megawatt-dashboard && npm run dev`

Verify:
- Navigate to `/admin/klanten`
- Create a klant → toast "Klant aangemaakt"
- Klant appears in table with project count 0
- Edit the klant → toast "Klant bijgewerkt"
- Delete the klant → confirm dialog → toast "Klant verwijderd"
- Escape key closes modal

- [ ] **Step 4: Commit**

```bash
git add client/src/components/admin/KlantenManager.tsx client/src/App.tsx client/src/api.ts
git commit -m "feat: add Klanten CRUD page with Modal, ConfirmDialog, and toast notifications"
```

---

## Chunk 4: Projecten & Activaties Backend

### Task 6: Create Projects API routes (with nested activations)

**Files:**
- Create: `server/routes/projects.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Create projects routes file**

Create `server/routes/projects.ts`. This includes nested activation routes under `/projects/:projectId/activations` matching the spec, plus standalone activation update/delete.

```typescript
import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAudit } from '../lib/audit';

const router = Router();
const prisma = new PrismaClient();

// ── Projects ──

// List projects (filterable by status)
router.get('/', async (req, res: Response) => {
  const status = req.query.status as string | undefined;
  const where = status ? { status } : {};
  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      klant: true,
      _count: { select: { activations: true } },
    },
  });
  res.json(projects);
});

// Get single project with activations
router.get('/:id', async (req, res: Response) => {
  const project = await prisma.project.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      klant: true,
      activations: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!project) {
    res.status(404).json({ error: 'Project niet gevonden' });
    return;
  }
  res.json(project);
});

// Create project (with first activation in transaction)
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { klantId, projectNumber, startDate, endDate, contactPerson, email } = req.body;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          klantId,
          projectNumber,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          contactPerson,
          email,
        },
      });
      await tx.activation.create({
        data: { projectId: project.id, location: '', date: null },
      });
      return tx.project.findUnique({
        where: { id: project.id },
        include: { klant: true, activations: true },
      });
    });
    await logAudit('CREATE', 'Project', result!.id, { projectNumber, klantId }, req.adminUsername!);
    res.status(201).json(result);
  } catch (err: unknown) {
    const prismaErr = err as { code?: string };
    if (prismaErr.code === 'P2002') {
      res.status(400).json({ error: 'Er bestaat al een project met dit projectnummer' });
      return;
    }
    throw err;
  }
});

// Update project
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { klantId, projectNumber, startDate, endDate, status, contactPerson, email } = req.body;
  if (status && !['active', 'completed'].includes(status)) {
    res.status(400).json({ error: 'Ongeldige status' });
    return;
  }
  try {
    const project = await prisma.project.update({
      where: { id: Number(req.params.id) },
      data: {
        klantId,
        projectNumber,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        status,
        contactPerson,
        email,
      },
      include: { klant: true, activations: true },
    });
    await logAudit('UPDATE', 'Project', project.id, { projectNumber, status }, req.adminUsername!);
    res.json(project);
  } catch (err: unknown) {
    const prismaErr = err as { code?: string };
    if (prismaErr.code === 'P2002') {
      res.status(400).json({ error: 'Er bestaat al een project met dit projectnummer' });
      return;
    }
    throw err;
  }
});

// Delete project (cascades to activations)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  await prisma.project.delete({ where: { id } });
  await logAudit('DELETE', 'Project', id, {}, req.adminUsername!);
  res.json({ success: true });
});

// ── Activations (nested under project) ──

// List activations for a project
router.get('/:projectId/activations', async (req, res: Response) => {
  const activations = await prisma.activation.findMany({
    where: { projectId: Number(req.params.projectId) },
    orderBy: { createdAt: 'asc' },
  });
  res.json(activations);
});

// Create activation for a project
router.post('/:projectId/activations', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { location, date } = req.body;
  const activation = await prisma.activation.create({
    data: {
      projectId: Number(req.params.projectId),
      location: location || '',
      date: date ? new Date(date) : null,
    },
  });
  await logAudit('CREATE', 'Activation', activation.id, { projectId: req.params.projectId, location }, req.adminUsername!);
  res.status(201).json(activation);
});

// Update activation
router.put('/activations/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { location, date } = req.body;
  const activation = await prisma.activation.update({
    where: { id: Number(req.params.id) },
    data: {
      location,
      date: date ? new Date(date) : null,
    },
  });
  await logAudit('UPDATE', 'Activation', activation.id, { location, date }, req.adminUsername!);
  res.json(activation);
});

// Delete activation
router.delete('/activations/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  await prisma.activation.delete({ where: { id } });
  await logAudit('DELETE', 'Activation', id, {}, req.adminUsername!);
  res.json({ success: true });
});

export default router;
```

**Note on route order:** `/activations/:id` routes use the prefix `activations/` to avoid clashing with `/:id` (project by id). Put these after the project CRUD routes.

- [ ] **Step 2: Mount projects routes in server/index.ts**

Add import:

```typescript
import projectRoutes from './routes/projects';
```

Add mounting:

```typescript
app.use('/api/projects', projectRoutes);
```

- [ ] **Step 3: Verify API works**

Run: `cd megawatt-dashboard && npm run dev`

Test: `curl http://localhost:3001/api/projects`

Expected: `[]`

- [ ] **Step 4: Commit**

```bash
git add server/routes/projects.ts server/index.ts
git commit -m "feat: add Projects and Activations API routes with validation and error handling"
```

---

## Chunk 5: Projecten & Activaties Frontend

### Task 7: Add Project and Activation types and API functions

**Files:**
- Modify: `client/src/api.ts`

- [ ] **Step 1: Add interfaces and API functions**

Add to `client/src/api.ts`:

```typescript
export interface Activation {
  id: number;
  projectId: number;
  location: string;
  date: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: number;
  klantId: number;
  klant?: Klant;
  projectNumber: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed';
  contactPerson: string | null;
  email: string | null;
  activations?: Activation[];
  _count?: { activations: number };
  createdAt: string;
  updatedAt: string;
}

// Projects
export const fetchProjects = (status?: string) =>
  api.get<Project[]>('/projects', { params: status ? { status } : {} }).then((r) => r.data);
export const fetchProject = (id: number) =>
  api.get<Project>(`/projects/${id}`).then((r) => r.data);
export const createProject = (data: Partial<Project>) =>
  api.post<Project>('/projects', data).then((r) => r.data);
export const updateProject = (id: number, data: Partial<Project>) =>
  api.put<Project>(`/projects/${id}`, data).then((r) => r.data);
export const deleteProject = (id: number) => api.delete(`/projects/${id}`);

// Activations (nested under projects)
export const createActivation = (projectId: number, data: Partial<Activation>) =>
  api.post<Activation>(`/projects/${projectId}/activations`, data).then((r) => r.data);
export const updateActivation = (id: number, data: Partial<Activation>) =>
  api.put<Activation>(`/projects/activations/${id}`, data).then((r) => r.data);
export const deleteActivation = (id: number) => api.delete(`/projects/activations/${id}`);
```

- [ ] **Step 2: Commit**

```bash
git add client/src/api.ts
git commit -m "feat: add Project and Activation types and API functions"
```

### Task 8: Create ProjectList component

**Files:**
- Create: `client/src/components/admin/ProjectList.tsx`

- [ ] **Step 1: Create ProjectList component**

Create `client/src/components/admin/ProjectList.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Project, fetchProjects, deleteProject } from '../../api';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

export default function ProjectList() {
  const toast = useToast();
  const location = useLocation();
  const isCompleted = location.pathname.includes('completed');
  const status = isCompleted ? 'completed' : 'active';

  const [projects, setProjects] = useState<Project[]>([]);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);

  const load = async () => {
    const data = await fetchProjects(status);
    setProjects(data);
  };

  useEffect(() => { load(); }, [status]);

  const handleDelete = async () => {
    if (!deletingProject) return;
    try {
      await deleteProject(deletingProject.id);
      toast.success(`Project "${deletingProject.projectNumber}" verwijderd`);
      await load();
    } catch {
      toast.error('Project verwijderen mislukt');
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('nl-NL');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">
          {isCompleted ? 'Afgeronde projecten' : 'Lopende projecten'}
        </h1>
        <div className="flex gap-3">
          <Link
            to={isCompleted ? '/admin/projects' : '/admin/projects/completed'}
            className="px-4 py-2 rounded-[6px] text-text-secondary hover:text-text-primary border border-[rgba(255,255,255,0.12)] transition-colors"
          >
            {isCompleted ? 'Lopende projecten' : 'Afgeronde projecten'}
          </Link>
          <Link
            to="/admin/projects/new"
            className="px-4 py-2 rounded-[6px] bg-accent-teal text-[#1a3a38] font-semibold hover:opacity-85 transition-opacity"
          >
            + Nieuw project
          </Link>
        </div>
      </div>

      <div className="bg-bg-surface rounded-[12px] border border-[rgba(255,255,255,0.08)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[rgba(255,255,255,0.08)]">
              <th className="text-left px-4 py-3 text-text-secondary text-sm font-medium">Projectnummer</th>
              <th className="text-left px-4 py-3 text-text-secondary text-sm font-medium">Klant</th>
              <th className="text-left px-4 py-3 text-text-secondary text-sm font-medium">Startdatum</th>
              <th className="text-left px-4 py-3 text-text-secondary text-sm font-medium">Einddatum</th>
              <th className="text-left px-4 py-3 text-text-secondary text-sm font-medium">Activaties</th>
              <th className="text-right px-4 py-3 text-text-secondary text-sm font-medium">Acties</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]">
                <td className="px-4 py-3">
                  <Link to={`/admin/projects/${project.id}`} className="text-accent-teal hover:opacity-80 font-medium">
                    {project.projectNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-text-primary">{project.klant?.name || '—'}</td>
                <td className="px-4 py-3 text-text-secondary">{formatDate(project.startDate)}</td>
                <td className="px-4 py-3 text-text-secondary">{formatDate(project.endDate)}</td>
                <td className="px-4 py-3 text-text-secondary">{project._count?.activations ?? 0}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/admin/projects/${project.id}`}
                    className="text-accent-teal hover:opacity-80 text-sm mr-3"
                  >
                    Bewerk
                  </Link>
                  <button
                    onClick={() => setDeletingProject(project)}
                    className="text-red-400 hover:opacity-80 text-sm cursor-pointer"
                  >
                    Verwijder
                  </button>
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                  {isCompleted ? 'Geen afgeronde projecten.' : 'Nog geen lopende projecten.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={!!deletingProject}
        onClose={() => setDeletingProject(null)}
        onConfirm={handleDelete}
        title="Project verwijderen?"
        message={`Weet je zeker dat je project "${deletingProject?.projectNumber}" wilt verwijderen? Alle activaties worden ook verwijderd.`}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/admin/ProjectList.tsx
git commit -m "feat: add ProjectList component for active/completed projects"
```

### Task 9: Create ProjectForm component with activation tabs

**Files:**
- Create: `client/src/components/admin/ProjectForm.tsx`

**Important:** Activation edits use local state with an explicit "Opslaan" button per activation — NOT onChange API calls (which would fire on every keystroke).

- [ ] **Step 1: Create ProjectForm component**

Create `client/src/components/admin/ProjectForm.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Klant, Activation,
  fetchKlanten, fetchProject,
  createProject, updateProject,
  createActivation, updateActivation, deleteActivation,
} from '../../api';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

const toDateInput = (d: string | null | undefined) => {
  if (!d) return '';
  // Parse ISO string safely — avoid UTC off-by-one
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function ProjectForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = Boolean(id);

  const [klanten, setKlanten] = useState<Klant[]>([]);
  const [form, setForm] = useState({
    klantId: 0,
    projectNumber: '',
    startDate: '',
    endDate: '',
    contactPerson: '',
    email: '',
    status: 'active',
  });
  const [activations, setActivations] = useState<Activation[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [activationForm, setActivationForm] = useState({ location: '', date: '' });
  const [saving, setSaving] = useState(false);
  const [savingActivation, setSavingActivation] = useState(false);
  const [deletingActivation, setDeletingActivation] = useState<Activation | null>(null);

  useEffect(() => {
    const load = async () => {
      const k = await fetchKlanten();
      setKlanten(k);

      if (id) {
        const project = await fetchProject(Number(id));
        setForm({
          klantId: project.klantId,
          projectNumber: project.projectNumber,
          startDate: toDateInput(project.startDate),
          endDate: toDateInput(project.endDate),
          contactPerson: project.contactPerson || '',
          email: project.email || '',
          status: project.status,
        });
        setActivations(project.activations || []);
      }
    };
    load();
  }, [id]);

  // Sync activation form when switching tabs or activations change
  useEffect(() => {
    const current = activations[activeTab];
    if (current) {
      setActivationForm({
        location: current.location,
        date: toDateInput(current.date),
      });
    }
  }, [activeTab, activations]);

  const handleKlantChange = (klantId: number) => {
    const klant = klanten.find((k) => k.id === klantId);
    setForm({
      ...form,
      klantId,
      contactPerson: klant?.contactPerson || '',
      email: klant?.email || '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await updateProject(Number(id), form);
        toast.success('Project bijgewerkt');
        // Reload activations
        const project = await fetchProject(Number(id));
        setActivations(project.activations || []);
      } else {
        const project = await createProject(form);
        toast.success('Project aangemaakt');
        navigate(`/admin/projects/${project.id}`);
      }
    } catch {
      toast.error('Project opslaan mislukt');
    } finally {
      setSaving(false);
    }
  };

  const handleAddActivation = async () => {
    if (!id) return;
    try {
      const activation = await createActivation(Number(id), { location: '', date: null });
      setActivations([...activations, activation]);
      setActiveTab(activations.length);
      toast.success('Activatie toegevoegd');
    } catch {
      toast.error('Activatie toevoegen mislukt');
    }
  };

  const handleSaveActivation = async () => {
    const current = activations[activeTab];
    if (!current) return;
    setSavingActivation(true);
    try {
      const updated = await updateActivation(current.id, {
        location: activationForm.location,
        date: activationForm.date || null,
      });
      setActivations(activations.map((a) => (a.id === updated.id ? updated : a)));
      toast.success('Activatie bijgewerkt');
    } catch {
      toast.error('Activatie opslaan mislukt');
    } finally {
      setSavingActivation(false);
    }
  };

  const handleDeleteActivation = async () => {
    if (!deletingActivation || activations.length <= 1) return;
    try {
      await deleteActivation(deletingActivation.id);
      const newActivations = activations.filter((a) => a.id !== deletingActivation.id);
      setActivations(newActivations);
      setActiveTab(Math.min(activeTab, newActivations.length - 1));
      toast.success('Activatie verwijderd');
    } catch {
      toast.error('Activatie verwijderen mislukt');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">
          {isEdit ? `Project ${form.projectNumber}` : 'Nieuw project'}
        </h1>
        <button
          onClick={() => navigate('/admin/projects')}
          className="px-4 py-2 rounded-[6px] text-text-secondary hover:text-text-primary border border-[rgba(255,255,255,0.12)] transition-colors cursor-pointer"
        >
          Terug
        </button>
      </div>

      {/* Project form */}
      <form onSubmit={handleSubmit} className="bg-bg-surface rounded-[12px] border border-[rgba(255,255,255,0.08)] p-6 mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Projectgegevens</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-text-secondary text-sm mb-1">Klant *</label>
            <select
              value={form.klantId}
              onChange={(e) => handleKlantChange(Number(e.target.value))}
              required
              className="w-full px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px]"
            >
              <option value={0} disabled>Selecteer een klant</option>
              {klanten.map((k) => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-text-secondary text-sm mb-1">Projectnummer *</label>
            <input
              type="text"
              value={form.projectNumber}
              onChange={(e) => setForm({ ...form, projectNumber: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px]"
            />
          </div>
          <div>
            <label className="block text-text-secondary text-sm mb-1">Startdatum *</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px]"
            />
          </div>
          <div>
            <label className="block text-text-secondary text-sm mb-1">Einddatum *</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px]"
            />
          </div>
          <div>
            <label className="block text-text-secondary text-sm mb-1">Contactpersoon</label>
            <input
              type="text"
              value={form.contactPerson}
              onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              className="w-full px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px]"
            />
          </div>
          <div>
            <label className="block text-text-secondary text-sm mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px]"
            />
          </div>
          {isEdit && (
            <div>
              <label className="block text-text-secondary text-sm mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px]"
              >
                <option value="active">Actief</option>
                <option value="completed">Afgerond</option>
              </select>
            </div>
          )}
        </div>
        <div className="mt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-[6px] bg-accent-teal text-[#1a3a38] font-semibold hover:opacity-85 transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Opslaan...' : 'Project opslaan'}
          </button>
        </div>
      </form>

      {/* Activations (only shown when editing) */}
      {isEdit && activations.length > 0 && (
        <div className="bg-bg-surface rounded-[12px] border border-[rgba(255,255,255,0.08)] p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Activaties</h2>

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-4 border-b border-[rgba(255,255,255,0.08)] pb-2">
            {activations.map((activation, idx) => (
              <button
                key={activation.id}
                onClick={() => setActiveTab(idx)}
                className={`px-3 py-1.5 rounded-t-[6px] text-[14px] transition-all cursor-pointer ${
                  activeTab === idx
                    ? 'bg-accent-teal text-[#1a3a38] font-semibold'
                    : 'text-[rgba(255,255,255,0.6)] hover:text-[rgba(255,255,255,0.9)]'
                }`}
              >
                {activation.location || 'Nieuwe activatie'}
              </button>
            ))}
            <button
              onClick={handleAddActivation}
              className="px-3 py-1.5 text-accent-teal hover:opacity-80 text-[18px] cursor-pointer"
              title="Activatie toevoegen"
            >
              +
            </button>
          </div>

          {/* Active tab content — local state, explicit save */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-text-secondary text-sm mb-1">Locatie</label>
              <input
                type="text"
                value={activationForm.location}
                onChange={(e) => setActivationForm({ ...activationForm, location: e.target.value })}
                placeholder="Voer locatie in"
                className="w-full px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px]"
              />
            </div>
            <div>
              <label className="block text-text-secondary text-sm mb-1">Datum</label>
              <input
                type="date"
                value={activationForm.date}
                onChange={(e) => setActivationForm({ ...activationForm, date: e.target.value })}
                className="w-full px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px]"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <button
              onClick={handleSaveActivation}
              disabled={savingActivation}
              className="px-4 py-2 rounded-[6px] bg-accent-teal text-[#1a3a38] font-semibold hover:opacity-85 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              {savingActivation ? 'Opslaan...' : 'Activatie opslaan'}
            </button>
            {activations.length > 1 && (
              <button
                onClick={() => setDeletingActivation(activations[activeTab])}
                className="text-red-400 hover:opacity-80 text-sm cursor-pointer"
              >
                Activatie verwijderen
              </button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deletingActivation}
        onClose={() => setDeletingActivation(null)}
        onConfirm={handleDeleteActivation}
        title="Activatie verwijderen?"
        message={`Weet je zeker dat je activatie "${deletingActivation?.location || 'Nieuwe activatie'}" wilt verwijderen?`}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/admin/ProjectForm.tsx
git commit -m "feat: add ProjectForm with klant auto-fill and activation tabs with explicit save"
```

### Task 10: Add project routes to App.tsx

**Files:**
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Add imports and routes**

Add imports in `App.tsx`:

```typescript
import ProjectList from './components/admin/ProjectList';
import ProjectForm from './components/admin/ProjectForm';
```

Replace the placeholder project route and add new routes inside the `<Route path="/admin" element={<AdminLayout />}>` block.

**IMPORTANT: Route order matters.** `projects/new` and `projects/completed` MUST come BEFORE `projects/:id`, otherwise React Router matches "new" and "completed" as an `:id` parameter.

```tsx
<Route path="projects" element={<ProjectList />} />
<Route path="projects/new" element={<ProjectForm />} />
<Route path="projects/completed" element={<ProjectList />} />
<Route path="projects/:id" element={<ProjectForm />} />
```

- [ ] **Step 2: Verify full flow**

Run: `cd megawatt-dashboard && npm run dev`

Verify:
1. Navigate to `/admin/klanten`, create a klant
2. Navigate to `/admin/projects` via sidebar → "Lopende projecten" page
3. Click "+ Nieuw project"
4. Select klant → contactperson and email auto-fill
5. Fill in projectnumber, dates, save → toast + redirect to detail page
6. First activation tab visible ("Nieuwe activatie")
7. Type location, pick date, click "Activatie opslaan" → toast + tab label updates
8. Click + → second tab appears
9. Navigate back to projects → project in table
10. Toggle to "Afgeronde projecten" → empty list
11. Edit project → change status to "Afgerond" → save → disappears from active list, appears in completed list

- [ ] **Step 3: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat: add project routes to App.tsx with correct ordering"
```
