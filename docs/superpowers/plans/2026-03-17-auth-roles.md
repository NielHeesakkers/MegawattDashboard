# Auth & Roles Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add site-wide authentication with two roles (admin/user) and per-user tab visibility to the MegawattDashboard.

**Architecture:** Extend the existing `Admin` model (renamed to `User`) with `role` and `allowedTabs` fields. Move login to the root page so the entire site requires authentication. Frontend tabs are filtered based on `allowedTabs`. Admin panel restricted to admin role only.

**Tech Stack:** Prisma ORM (SQLite), Express + JWT, React + TypeScript + Tailwind, React Router v6

**Spec:** `docs/superpowers/specs/2026-03-17-auth-roles-design.md`

---

## Chunk 1: Database Migration & Server Auth

### Task 1: Prisma migration — rename Admin → User, add role + allowedTabs

**Files:**
- Modify: `prisma/schema.prisma` (lines 94-98)
- Create: migration SQL file (auto-created by Prisma, then customized)

- [ ] **Step 1: Update Prisma schema**

Replace the `Admin` model in `prisma/schema.prisma` (lines 94-98) with:

```prisma
model User {
  id           Int    @id @default(autoincrement())
  username     String @unique
  passwordHash String
  role         String @default("user")
  allowedTabs  String @default("[]")
}
```

- [ ] **Step 2: Create empty migration**

Run: `cd /Users/niel/Development/MegawattDashboard/megawatt-dashboard && npx prisma migrate dev --create-only --name rename_admin_to_user_add_roles`

This creates a migration folder but does not apply it.

- [ ] **Step 3: Replace auto-generated SQL with safe custom SQL**

The auto-generated migration may drop and recreate the table. Replace the content of the generated `migration.sql` file with:

```sql
-- Rename Admin table to User (SQLite-safe)
ALTER TABLE "Admin" RENAME TO "User";

-- Add role column (default "user" for new accounts)
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';

-- Add allowedTabs column (default empty JSON array)
ALTER TABLE "User" ADD COLUMN "allowedTabs" TEXT NOT NULL DEFAULT '[]';

-- Set all existing accounts to admin with all tabs
UPDATE "User" SET "role" = 'admin', "allowedTabs" = '["intern","planning"]';
```

- [ ] **Step 4: Apply migration and regenerate client**

Run: `npx prisma migrate dev`
Then: `npx prisma generate`

Expected: Migration applied successfully, Prisma client regenerated with `User` model.

- [ ] **Step 5: Verify migration**

Run: `npx prisma studio` or check with sqlite3 that the `User` table exists with `role` and `allowedTabs` columns, and existing accounts have `role='admin'`.

- [ ] **Step 6: Commit**

```bash
git add prisma/
git commit -m "feat: rename Admin to User, add role and allowedTabs columns"
```

---

### Task 2: Update auth middleware — User table, new request fields, adminOnly

**Files:**
- Modify: `server/middleware/auth.ts`

- [ ] **Step 1: Update AuthRequest interface and authMiddleware**

Replace the entire content of `server/middleware/auth.ts` with:

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'megawatt-dashboard-secret-2026';
const prisma = new PrismaClient();

export interface AuthRequest extends Request {
  userId?: number;
  username?: string;
  userRole?: string;
  // Legacy aliases for backward compat during migration
  adminId?: number;
  adminUsername?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: number; username: string; role: string };
    req.userId = payload.id;
    req.username = payload.username;
    req.userRole = payload.role;
    // Legacy aliases
    req.adminId = payload.id;
    req.adminUsername = payload.username;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function adminOnly(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
```

- [ ] **Step 2: Verify server compiles**

Run: `cd /Users/niel/Development/MegawattDashboard/megawatt-dashboard && npx tsc --noEmit --project server/tsconfig.json 2>&1 | head -20` (or just start dev server and check for errors)

- [ ] **Step 3: Commit**

```bash
git add server/middleware/auth.ts
git commit -m "feat: update auth middleware for User model with role support"
```

---

### Task 3: Update auth routes — login response, user CRUD with roles

**Files:**
- Modify: `server/routes/auth.ts`

- [ ] **Step 1: Add AVAILABLE_TABS constant and update imports**

At the top of `server/routes/auth.ts`, after the existing imports, add:

```typescript
import { adminOnly } from '../middleware/auth';

const AVAILABLE_TABS = ['intern', 'planning'];
```

- [ ] **Step 2: Update login endpoint to return role and allowedTabs**

Replace lines 73-89 (the login query and response) with:

```typescript
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    recordAttempt(ip);
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  // Successful login — reset attempts
  resetAttempts(ip);

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  const allowedTabs = user.role === 'admin'
    ? AVAILABLE_TABS
    : JSON.parse(user.allowedTabs || '[]');

  res.json({ token, username: user.username, role: user.role, allowedTabs });
```

- [ ] **Step 3: Update GET /users to include role and allowedTabs, add adminOnly**

Replace lines 93-99 with:

```typescript
router.get('/users', authMiddleware, adminOnly, async (_req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true, allowedTabs: true },
    orderBy: { username: 'asc' },
  });
  // Parse allowedTabs from JSON string for the response
  const parsed = users.map(u => ({
    ...u,
    allowedTabs: u.role === 'admin' ? AVAILABLE_TABS : JSON.parse(u.allowedTabs || '[]'),
  }));
  res.json(parsed);
});
```

- [ ] **Step 4: Update POST /users to accept role and allowedTabs, add adminOnly**

Replace lines 102-129 with:

```typescript
router.post('/users', authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const { username, password, role, allowedTabs } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Gebruikersnaam en wachtwoord zijn verplicht' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Wachtwoord moet minimaal 6 tekens zijn' });
    return;
  }

  const userRole = role === 'admin' ? 'admin' : 'user';
  const tabs = userRole === 'admin'
    ? JSON.stringify(AVAILABLE_TABS)
    : JSON.stringify((allowedTabs || []).filter((t: string) => AVAILABLE_TABS.includes(t)));

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    res.status(409).json({ error: 'Gebruikersnaam bestaat al' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, passwordHash, role: userRole, allowedTabs: tabs },
    select: { id: true, username: true, role: true, allowedTabs: true },
  });

  await logAudit('CREATE', 'User', user.id, { username, role: userRole }, req.adminUsername);
  res.status(201).json({ ...user, allowedTabs: JSON.parse(user.allowedTabs) });
});
```

- [ ] **Step 5: Update PUT /users/:id with role, allowedTabs, demotion check, add adminOnly**

Replace lines 132-167 with:

```typescript
router.put('/users/:id', authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const { username, password, role, allowedTabs } = req.body;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Gebruiker niet gevonden' });
    return;
  }

  if (username && username !== existing.username) {
    const duplicate = await prisma.user.findUnique({ where: { username } });
    if (duplicate) {
      res.status(409).json({ error: 'Gebruikersnaam bestaat al' });
      return;
    }
  }

  if (password && password.length < 6) {
    res.status(400).json({ error: 'Wachtwoord moet minimaal 6 tekens zijn' });
    return;
  }

  // Demotion check: prevent removing last admin
  const newRole = role === 'admin' ? 'admin' : (role === 'user' ? 'user' : undefined);
  if (newRole === 'user' && existing.role === 'admin') {
    const adminCount = await prisma.user.count({ where: { role: 'admin', id: { not: id } } });
    if (adminCount < 1) {
      res.status(400).json({ error: 'Er moet minimaal één admin gebruiker bestaan' });
      return;
    }
  }

  const data: { username?: string; passwordHash?: string; role?: string; allowedTabs?: string } = {};
  if (username) data.username = username;
  if (password) data.passwordHash = await bcrypt.hash(password, 10);
  if (newRole) {
    data.role = newRole;
    if (newRole === 'admin') {
      data.allowedTabs = JSON.stringify(AVAILABLE_TABS);
    } else if (allowedTabs) {
      data.allowedTabs = JSON.stringify(allowedTabs.filter((t: string) => AVAILABLE_TABS.includes(t)));
    }
  } else if (allowedTabs && existing.role !== 'admin') {
    data.allowedTabs = JSON.stringify(allowedTabs.filter((t: string) => AVAILABLE_TABS.includes(t)));
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, username: true, role: true, allowedTabs: true },
  });

  await logAudit('UPDATE', 'User', id, { username: username || existing.username, role: user.role, passwordChanged: !!password }, req.adminUsername);
  res.json({ ...user, allowedTabs: JSON.parse(user.allowedTabs) });
});
```

- [ ] **Step 6: Update DELETE /users/:id with proper last-admin check, add adminOnly**

Replace lines 170-195 with:

```typescript
router.delete('/users/:id', authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);

  if (id === req.adminId) {
    res.status(400).json({ error: 'Je kunt jezelf niet verwijderen' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Gebruiker niet gevonden' });
    return;
  }

  // Prevent deleting the last admin
  if (existing.role === 'admin') {
    const adminCount = await prisma.user.count({ where: { role: 'admin', id: { not: id } } });
    if (adminCount < 1) {
      res.status(400).json({ error: 'Er moet minimaal één admin gebruiker bestaan' });
      return;
    }
  }

  await prisma.user.delete({ where: { id } });
  await logAudit('DELETE', 'User', id, { username: existing.username }, req.adminUsername);
  res.json({ success: true });
});
```

- [ ] **Step 7: Commit**

```bash
git add server/routes/auth.ts
git commit -m "feat: update auth routes for role-based user management"
```

---

### Task 4: Add authMiddleware to all public GET routes

**Files:**
- Modify: `server/routes/teams.ts` (lines 10, 19)
- Modify: `server/routes/members.ts` (line 11)
- Modify: `server/routes/executives.ts` (line 11)
- Modify: `server/routes/client-teams.ts` (line 10)
- Modify: `server/routes/clients.ts` (line 10)
- Modify: `server/routes/klanten.ts` (lines 10, 19)
- Modify: `server/routes/projects.ts` (lines 12, 27, 121)

- [ ] **Step 1: Add authMiddleware to teams.ts GET routes**

In `server/routes/teams.ts`, change line 10:
```typescript
// FROM:
router.get('/', async (_req: Request, res: Response) => {
// TO:
router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
```

And line 19:
```typescript
// FROM:
router.get('/:id', async (req: Request, res: Response) => {
// TO:
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
```

Ensure `AuthRequest` is imported alongside `authMiddleware` at the top.

- [ ] **Step 2: Add authMiddleware to members.ts GET route**

In `server/routes/members.ts`, change line 11:
```typescript
// FROM:
router.get('/', async (_req: Request, res: Response) => {
// TO:
router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
```

- [ ] **Step 3: Add authMiddleware to executives.ts GET route**

In `server/routes/executives.ts`, change line 11:
```typescript
// FROM:
router.get('/', async (_req: Request, res: Response) => {
// TO:
router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
```

- [ ] **Step 4: Add authMiddleware to client-teams.ts GET route**

In `server/routes/client-teams.ts`, change line 10:
```typescript
// FROM:
router.get('/', async (_req: Request, res: Response) => {
// TO:
router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
```

- [ ] **Step 5: Add authMiddleware to clients.ts GET route**

In `server/routes/clients.ts`, change line 10:
```typescript
// FROM:
router.get('/', async (_req: Request, res: Response) => {
// TO:
router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
```

- [ ] **Step 6: Add authMiddleware to klanten.ts GET routes**

In `server/routes/klanten.ts`, change lines 10 and 19 similarly.

- [ ] **Step 7: Add authMiddleware to projects.ts GET routes**

In `server/routes/projects.ts`, change lines 12, 27, and 121 similarly.

- [ ] **Step 8: Update all server routes — Admin → User in Prisma queries**

Search all route files for `prisma.admin.` and replace with `prisma.user.` (only in `auth.ts`, which was already done in Task 3).

- [ ] **Step 9: Verify server starts without errors**

Run: `cd /Users/niel/Development/MegawattDashboard/megawatt-dashboard && npm run dev` and check for compile errors.

- [ ] **Step 10: Commit**

```bash
git add server/routes/
git commit -m "feat: protect all GET routes with authMiddleware"
```

---

## Chunk 2: Client Auth & Login

### Task 5: Update API client — login types, 401 redirect, AdminUser type

**Files:**
- Modify: `client/src/api.ts` (lines 17-27, 65-68, 85-86, 105-110)

- [ ] **Step 1: Fix 401 interceptor redirect**

In `client/src/api.ts`, change line 23:
```typescript
// FROM:
window.location.href = '/admin';
// TO:
localStorage.removeItem('role');
localStorage.removeItem('allowedTabs');
window.location.href = '/';
```

- [ ] **Step 2: Update AdminUser interface**

Replace lines 65-68:
```typescript
export interface AdminUser {
  id: number;
  username: string;
  role: string;
  allowedTabs: string[];
}
```

- [ ] **Step 3: Update login return type**

Replace lines 85-86:
```typescript
export const login = (username: string, password: string) =>
  api.post<{ token: string; username: string; role: string; allowedTabs: string[] }>('/auth/login', { username, password }).then((r) => r.data);
```

- [ ] **Step 4: Update user management API functions**

Replace lines 106-110:
```typescript
export const createAdminUser = (data: { username: string; password: string; role: string; allowedTabs: string[] }) =>
  api.post<AdminUser>('/auth/users', data).then((r) => r.data);
export const updateAdminUser = (id: number, data: { username?: string; password?: string; role?: string; allowedTabs?: string[] }) =>
  api.put<AdminUser>(`/auth/users/${id}`, data).then((r) => r.data);
```

- [ ] **Step 5: Commit**

```bash
git add client/src/api.ts
git commit -m "feat: update API client for role-based auth"
```

---

### Task 6: Update AuthContext — role, allowedTabs, helpers

**Files:**
- Modify: `client/src/context/AuthContext.tsx`

- [ ] **Step 1: Replace entire AuthContext**

Replace the full content of `client/src/context/AuthContext.tsx` with:

```typescript
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { login as apiLogin } from '../api';

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  role: 'admin' | 'user' | null;
  allowedTabs: string[];
  isAdmin: boolean;
  hasTab: (tab: string) => boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<'admin' | 'user' | null>(null);
  const [allowedTabs, setAllowedTabs] = useState<string[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUsername = localStorage.getItem('username');
    const savedRole = localStorage.getItem('role') as 'admin' | 'user' | null;
    const savedTabs = localStorage.getItem('allowedTabs');
    if (token && savedUsername) {
      setIsAuthenticated(true);
      setUsername(savedUsername);
      setRole(savedRole);
      setAllowedTabs(savedTabs ? JSON.parse(savedTabs) : []);
    }
  }, []);

  const login = async (user: string, password: string) => {
    const data = await apiLogin(user, password);
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.username);
    localStorage.setItem('role', data.role);
    localStorage.setItem('allowedTabs', JSON.stringify(data.allowedTabs));
    setIsAuthenticated(true);
    setUsername(data.username);
    setRole(data.role as 'admin' | 'user');
    setAllowedTabs(data.allowedTabs);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('allowedTabs');
    setIsAuthenticated(false);
    setUsername(null);
    setRole(null);
    setAllowedTabs([]);
  };

  const isAdmin = role === 'admin';
  const hasTab = (tab: string) => allowedTabs.includes(tab);

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, role, allowedTabs, isAdmin, hasTab, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/context/AuthContext.tsx
git commit -m "feat: extend AuthContext with role, allowedTabs, isAdmin, hasTab"
```

---

### Task 7: Extract LoginForm to shared component

**Files:**
- Create: `client/src/components/ui/LoginForm.tsx`
- Modify: `client/src/components/admin/AdminLayout.tsx` (lines 5-57)

- [ ] **Step 1: Create shared LoginForm**

Create `client/src/components/ui/LoginForm.tsx` with the LoginForm extracted from AdminLayout (lines 5-57). The component stays identical — it uses `useAuth().login`:

```typescript
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function LoginForm() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch {
      setError('Ongeldige inloggegevens');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-[#1a3a38] p-8 rounded-[12px] w-full max-w-sm border border-[rgba(255,255,255,0.08)]">
        <div className="flex justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28.35 5.67" className="h-7 w-auto">
            <path fill="#FFFF00" d="M27.47,3.24v-1.82h.87v-.63h-.87v-.79h-.67v2.96-.16s0,.45,0,.45c0,.67.29.96.96.96h.58v-.62h-.53c-.26,0-.34-.08-.34-.34h0ZM26.01,4.2h.58v-.62h-.53c-.26,0-.34-.08-.34-.34v-1.82h0s.87,0,.87,0v-.63h0s-.87,0-.87,0v-.79h-.67v.79h-.55v.63h.55v1.83c0,.67.29.96.96.96h0ZM24.53,3.58c-.13,0-.17-.03-.17-.18v-1.51c0-.83-.53-1.3-1.44-1.3-.87,0-1.43.42-1.52,1.13v.06s.66,0,.66,0v-.04c.07-.34.38-.54.84-.54.51,0,.81.24.81.66v.18h-.96c-.93,0-1.44.4-1.44,1.13,0,.65.52,1.06,1.33,1.06.47,0,.84-.16,1.12-.49.05.3.27.45.67.45h.36v-.62h-.23ZM23.69,2.74c0,.57-.4.92-1.04.92-.42,0-.7-.2-.7-.51,0-.35.23-.52.72-.52h1.02v.11h0ZM20.26,4.2l1.19-3.57h-.68l-.86,2.68-.82-2.68h-.6l-.87,2.68-.82-2.68h-.7l1.15,3.57h.69l.83-2.45.79,2.45h.69ZM16.23,3.58c-.13,0-.17-.03-.17-.18v-1.51c0-.83-.53-1.3-1.44-1.3-.87,0-1.43.42-1.52,1.13v.06s.66,0,.66,0v-.04c.07-.34.38-.54.84-.54.51,0,.81.24.81.66v.18h-.96c-.93,0-1.44.4-1.44,1.13,0,.65.52,1.06,1.33,1.06.47,0,.84-.16,1.12-.49.05.3.27.45.66.45h.36v-.62h-.23ZM15.4,2.74c0,.57-.4.92-1.04.92-.42,0-.7-.2-.7-.51,0-.35.23-.52.72-.52h1.02v.11h0ZM12.72,4.05V.63h-.58l-.06.49c-.25-.35-.65-.53-1.15-.53-1.01,0-1.72.75-1.72,1.82s.67,1.82,1.72,1.82c.49,0,.87-.17,1.13-.51v.3c0,.7-.35,1.04-1.06,1.04-.55,0-.92-.23-1-.63v-.04h-.68v.06c.1.76.71,1.22,1.65,1.22,1.17,0,1.77-.55,1.77-1.62h0ZM12.06,2.43c0,.71-.45,1.21-1.08,1.21s-1.09-.49-1.09-1.22.44-1.22,1.09-1.22,1.08.5,1.08,1.23h0ZM8.93,2.58c.01-.12.01-.22.01-.29-.03-1.04-.68-1.69-1.69-1.69s-1.69.75-1.69,1.82.71,1.82,1.77,1.82c.79,0,1.41-.5,1.56-1.24v-.04s-.67,0-.67,0v.02c-.11.42-.46.66-.93.66-.61,0-1.01-.41-1.04-1.06h2.69ZM8.23,2.01h-1.94c.07-.47.48-.82.97-.82.1,0,.2.01.29.03.39.09.65.37.69.79h0ZM4.61,4.2h.67v-2.05c0-.99-.5-1.56-1.36-1.56-.53,0-.94.21-1.19.6-.21-.38-.6-.6-1.1-.6-.4,0-.72.14-.97.44l-.06-.4h-.58v3.57h.67v-1.88c0-.67.34-1.11.86-1.11s.78.34.78.97v2.01h.67v-1.9c0-.68.33-1.08.87-1.08.63,0,.76.53.76.97v2.01h0Z"/>
          </svg>
        </div>
        {error && <p className="text-danger text-sm mb-4 text-center">{error}</p>}
        <div className="mb-4">
          <label className="block text-text-secondary text-sm mb-1">Gebruikersnaam</label>
          <input
            type="text" value={username} onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-[10px] rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px]"
          />
        </div>
        <div className="mb-6">
          <label className="block text-text-secondary text-sm mb-1">Wachtwoord</label>
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-[10px] rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px]"
          />
        </div>
        <button
          type="submit" disabled={loading}
          className="w-full py-2.5 rounded-[6px] bg-accent-teal text-[#1a3a38] font-semibold hover:opacity-85 transition-opacity disabled:opacity-50 cursor-pointer"
        >
          {loading ? 'Inloggen...' : 'Inloggen'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Update AdminLayout to use shared LoginForm and restrict to admin**

In `client/src/components/admin/AdminLayout.tsx`:

1. Remove the inline `LoginForm` function (lines 5-57)
2. Add import: `import LoginForm from '../ui/LoginForm';`
3. Update the auth check in the main component — change from `if (!isAuthenticated) return <LoginForm />;` to:

```typescript
const { isAuthenticated, isAdmin } = useAuth();

if (!isAuthenticated) return <LoginForm />;
if (!isAdmin) {
  // Non-admin users cannot access /admin, redirect to /
  window.location.href = '/';
  return null;
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ui/LoginForm.tsx client/src/components/admin/AdminLayout.tsx
git commit -m "feat: extract LoginForm to shared component, restrict admin to admin role"
```

---

## Chunk 3: Frontend Auth Gate & Tab Filtering

### Task 8: Add auth gate to OrganigramPage

**Files:**
- Modify: `client/src/components/organigram/OrganigramPage.tsx`

- [ ] **Step 1: Add auth imports and gate**

In `OrganigramPage.tsx`, add import:
```typescript
import { useAuth } from '../../context/AuthContext';
import LoginForm from '../ui/LoginForm';
```

At the top of the `OrganigramPage` function body (before any other hooks), add:
```typescript
const { isAuthenticated, isAdmin, hasTab, allowedTabs, logout, username } = useAuth();

if (!isAuthenticated) {
  return <LoginForm />;
}
```

- [ ] **Step 2: Filter header tabs based on allowedTabs**

In the header section, wrap the Intern dropdown (around line 252) with a tab check:
```tsx
{hasTab('intern') && (
  <div ref={internMenuRef} className="relative">
    {/* ... existing Intern dropdown ... */}
  </div>
)}
```

Wrap the Planning dropdown (around line 295) similarly:
```tsx
{hasTab('planning') && (
  <div ref={planningMenuRef} className="relative">
    {/* ... existing Planning dropdown ... */}
  </div>
)}
```

- [ ] **Step 3: Show admin gear icon only for admins**

Change the gear icon link (around line 391) to be conditional:
```tsx
{isAdmin && (
  <a href="/admin" className="h-7 w-7 flex items-center justify-center rounded-lg bg-[rgba(255,255,255,0.06)] ring-1 ring-[rgba(255,255,255,0.15)] text-[rgba(255,255,255,0.5)] hover:bg-[rgba(255,255,255,0.12)] hover:text-white transition-all duration-150" title="Beheer">
    {/* gear SVG */}
  </a>
)}
```

- [ ] **Step 4: Add logout button to header**

After the gear icon (or in its place for non-admins), add a logout button:
```tsx
<button
  onClick={logout}
  className="h-7 w-7 flex items-center justify-center rounded-lg bg-[rgba(255,255,255,0.06)] ring-1 ring-[rgba(255,255,255,0.15)] text-[rgba(255,255,255,0.5)] hover:bg-[rgba(255,255,255,0.12)] hover:text-white transition-all duration-150"
  title={`Uitloggen (${username})`}
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
  </svg>
</button>
```

- [ ] **Step 5: Validate persisted viewMode against allowedTabs**

Update the `handleViewMode` function and initial viewMode state to validate against allowedTabs. In the useState initializer (around line 27):

```typescript
const [viewMode, setViewMode] = useState<ViewMode>(() => {
  const saved = localStorage.getItem('megawatt-view-mode');
  // Will be validated after auth loads — start with saved or dashboard
  if (saved === 'klantteams' || saved === 'planning-nieuw' || saved === 'planning-lopend' || saved === 'planning-afgerond') return saved;
  return 'dashboard';
});
```

Add a useEffect after the auth check that validates and resets if needed:
```typescript
useEffect(() => {
  if (!isAuthenticated) return;
  const isInternView = viewMode === 'dashboard' || viewMode === 'klantteams';
  const isPlanView = viewMode.startsWith('planning-');
  if (isInternView && !hasTab('intern')) {
    // User doesn't have intern access, switch to first available
    if (hasTab('planning')) {
      handleViewMode('planning-lopend');
    }
  } else if (isPlanView && !hasTab('planning')) {
    if (hasTab('intern')) {
      handleViewMode('dashboard');
    }
  }
}, [isAuthenticated, allowedTabs]);
```

- [ ] **Step 6: Handle "no tabs" edge case**

After the auth gate (after `if (!isAuthenticated) return <LoginForm />;`), add:

```typescript
if (allowedTabs.length === 0 && !isAdmin) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-white mb-2">Geen toegang</h2>
        <p className="text-[rgba(255,255,255,0.5)] text-sm mb-4">Je hebt geen toegang tot secties. Neem contact op met een beheerder.</p>
        <button onClick={logout} className="px-4 py-2 rounded-[6px] bg-accent-teal text-[#1a3a38] font-semibold hover:opacity-85 transition-opacity cursor-pointer">Uitloggen</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Verify in browser**

Start dev server, navigate to `/`. Should see login form. Login with admin credentials → should see full dashboard with all tabs.

- [ ] **Step 8: Commit**

```bash
git add client/src/components/organigram/OrganigramPage.tsx
git commit -m "feat: add auth gate to public frontend, filter tabs by allowedTabs"
```

---

### Task 9: Update Settings UI — user management with roles and tabs

**Files:**
- Modify: `client/src/components/admin/Settings.tsx` (UsersTab, lines 429-559)

- [ ] **Step 1: Update UsersTab state and form to include role and allowedTabs**

In the `UsersTab` function (line 430), update the editing state type:
```typescript
const [editingUser, setEditingUser] = useState<{ id?: number; username: string; password: string; role: string; allowedTabs: string[] } | null>(null);
```

Update the "create" button click (line 490):
```typescript
onClick={() => { setEditingUser({ username: '', password: '', role: 'user', allowedTabs: [] }); setIsCreating(true); setError(''); }}
```

Update the "edit" click in the user list (line 506):
```typescript
onClick={() => { setEditingUser({ id: user.id, username: user.username, password: '', role: user.role, allowedTabs: user.allowedTabs }); setIsCreating(false); setError(''); }}
```

- [ ] **Step 2: Update handleSave to include role and allowedTabs**

Replace the handleSave logic (around lines 452-458):
```typescript
if (editingUser.id) {
  const data: { username?: string; password?: string; role?: string; allowedTabs?: string[] } = {
    username: editingUser.username,
    role: editingUser.role,
    allowedTabs: editingUser.role === 'admin' ? ['intern', 'planning'] : editingUser.allowedTabs,
  };
  if (editingUser.password) data.password = editingUser.password;
  await updateAdminUser(editingUser.id, data);
  toast.success('Gebruiker bijgewerkt');
} else {
  await createAdminUser({
    username: editingUser.username,
    password: editingUser.password,
    role: editingUser.role,
    allowedTabs: editingUser.role === 'admin' ? ['intern', 'planning'] : editingUser.allowedTabs,
  });
  toast.success('Gebruiker aangemaakt');
}
```

- [ ] **Step 3: Add role badge to user list**

In the user list item (around line 512), after the username span, add a role badge:
```tsx
<span className="flex-1 text-text-primary font-medium">{user.username}</span>
<span className={`text-xs px-2 py-0.5 rounded-full ${user.role === 'admin' ? 'bg-accent/20 text-accent' : 'bg-white/10 text-text-secondary'}`}>
  {user.role === 'admin' ? 'Admin' : 'Gebruiker'}
</span>
{user.allowedTabs && user.role !== 'admin' && (
  <span className="text-xs text-text-muted">{user.allowedTabs.join(', ')}</span>
)}
```

- [ ] **Step 4: Add role dropdown and tab checkboxes to the edit modal**

Inside the Modal (after the password field, around line 543), add:

```tsx
<div>
  <label className="block text-text-secondary text-sm mb-1">Rol</label>
  <select
    value={editingUser.role}
    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
    className={inputClass}
  >
    <option value="user">Gebruiker</option>
    <option value="admin">Admin</option>
  </select>
</div>
<div>
  <label className="block text-text-secondary text-sm mb-2">Zichtbare tabs</label>
  <div className="flex gap-4">
    {[
      { key: 'intern', label: 'Intern' },
      { key: 'planning', label: 'Planning' },
    ].map((tab) => (
      <label key={tab.key} className={`flex items-center gap-2 text-sm ${editingUser.role === 'admin' ? 'opacity-50' : ''}`}>
        <input
          type="checkbox"
          checked={editingUser.role === 'admin' || editingUser.allowedTabs.includes(tab.key)}
          disabled={editingUser.role === 'admin'}
          onChange={(e) => {
            if (editingUser.role === 'admin') return;
            const tabs = e.target.checked
              ? [...editingUser.allowedTabs, tab.key]
              : editingUser.allowedTabs.filter(t => t !== tab.key);
            setEditingUser({ ...editingUser, allowedTabs: tabs });
          }}
          className="accent-accent-teal"
        />
        <span className="text-text-primary">{tab.label}</span>
      </label>
    ))}
  </div>
  {editingUser.role === 'admin' && (
    <p className="text-text-muted text-xs mt-1">Admins hebben automatisch toegang tot alle tabs</p>
  )}
</div>
```

- [ ] **Step 5: Verify in browser**

Navigate to `/admin` → Settings → Beheerders tab. Should see role badges, create a test user with role "user" and only "planning" tab.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/admin/Settings.tsx
git commit -m "feat: add role and tab management to Settings user management"
```

---

### Task 10: Final verification and cleanup

- [ ] **Step 1: Test full flow**

1. Login as admin → see all tabs + gear icon
2. Create a "user" role account with only "planning" tab
3. Logout → login as new user → should only see Planning tab, no gear icon
4. Try navigating to `/admin` directly → should redirect to `/`
5. Logout → see login form

- [ ] **Step 2: Test edge cases**

1. Try demoting the last admin → should get error
2. Try deleting the last admin → should get error
3. Create a user with no tabs → should see "Geen toegang" message

- [ ] **Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "feat: complete auth & roles implementation"
```
