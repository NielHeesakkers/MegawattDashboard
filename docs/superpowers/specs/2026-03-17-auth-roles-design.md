# Auth & Roles Design Spec

## Overview

Add site-wide authentication and role-based tab visibility to the MegawattDashboard. Currently the public frontend (`/`) is open and only `/admin` requires login. After this change, the entire site requires login, with two roles (admin/user) and per-user tab configuration.

## Requirements

1. **Site-wide login**: navigating to `/` shows a login screen if not authenticated
2. **Two roles**: `admin` (full access including Settings + admin panel) and `user` (frontend tabs only)
3. **Per-user tab visibility**: each user has a configurable list of allowed tabs (e.g. `["intern","planning"]`). Tab visibility controls what users can see and interact with on the frontend. Server-side tab enforcement is not needed for v1 — this is a small internal tool with trusted users. All authenticated API routes are accessible to any logged-in user; the frontend controls which sections are visible.
4. **Future-proof**: new tabs can be added later without schema changes — just a new string in the allowedTabs array
5. **User management**: admins create/edit/delete users in the existing Settings page

## Database Changes

### Rename `Admin` → `User`, add `role` + `allowedTabs`

```prisma
model User {
  id           Int    @id @default(autoincrement())
  username     String @unique
  passwordHash String
  role         String @default("user")   // "admin" or "user"
  allowedTabs  String @default("[]")     // JSON string: ["intern","planning"]
}
```

**Migration strategy — custom SQL migration (SQLite-safe):**

Prisma's auto-generated migrations can drop-and-recreate tables on rename, risking data loss. Instead, use a custom migration with raw SQL:

```sql
-- Step 1: Rename table
ALTER TABLE Admin RENAME TO User;

-- Step 2: Add new columns with defaults
ALTER TABLE User ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE User ADD COLUMN allowedTabs TEXT NOT NULL DEFAULT '[]';

-- Step 3: Set all existing accounts to admin with all tabs
UPDATE User SET role = 'admin', allowedTabs = '["intern","planning"]';
```

The Prisma migration file is created with `prisma migrate dev --create-only`, then the auto-generated SQL is replaced with the custom SQL above. After applying, run `prisma generate` to update the client.

**Tab registry** (defined as constant, not in DB):
```typescript
const AVAILABLE_TABS = [
  { key: 'intern', label: 'Intern' },
  { key: 'planning', label: 'Planning' },
] as const;
```

New tabs are added by extending this array. No schema change needed.

## Server Changes

### Protect all public GET routes

Currently many GET routes are public (no auth required): teams, executives, members, client-teams, clients, projects, klanten. Since the entire site now requires login, **add `authMiddleware` to all GET routes** that currently lack it. This ensures API data is not accessible without a valid JWT.

### Auth routes (`server/routes/auth.ts`)

**Login response** — include role and allowedTabs:
```typescript
// POST /api/auth/login response:
{ token, username, role, allowedTabs: ["intern","planning"] }
```

The JWT payload includes: `{ id, username, role }`. Note: `allowedTabs` is NOT in the JWT — it is returned in the login response and stored client-side, but the server reads it from the database when needed. This avoids JWT staleness when an admin changes a user's tab permissions (the change takes effect on next page refresh or API call, not requiring re-login).

**User CRUD** — update existing admin management endpoints:
- `GET /api/auth/users` — returns all users (id, username, role, allowedTabs). Protected, admin-only.
- `POST /api/auth/users` — create user with `{ username, password, role, allowedTabs }`. Protected, admin-only.
- `PUT /api/auth/users/:id` — update user. Protected, admin-only. **Demotion check**: if changing role from admin to user, verify at least one other admin remains (count where `role = 'admin' AND id != targetId`).
- `DELETE /api/auth/users/:id` — delete user. Protected, admin-only. **Last admin check**: count users where `role = 'admin' AND id != targetId` must be >= 1.

**Validation:**
- `role` must be `"admin"` or `"user"`
- `allowedTabs` must be a valid JSON array of known tab keys (validated against `AVAILABLE_TABS`)
- Admin role automatically gets all tabs (enforced server-side on create/update: if role=admin, set allowedTabs to all tabs)

### Auth middleware (`server/middleware/auth.ts`)

Update to read from `User` table instead of `Admin`. The middleware verifies the JWT, looks up the user in the DB, and attaches `req.userId`, `req.username`, and `req.userRole` to the request object.

**New middleware: `adminOnly`** — used on admin-specific routes (Settings, user management):
```typescript
function adminOnly(req, res, next) {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}
```

### All existing server routes

- Replace `Admin` references with `User` in Prisma queries
- Rename `req.adminId` → `req.userId`, `req.adminUsername` → `req.username`
- Add `adminOnly` middleware to Settings and user management routes
- Add `authMiddleware` to all currently-public GET routes
- All authenticated routes are accessible to both roles (frontend controls tab visibility)

## Client Changes

### AuthContext (`client/src/context/AuthContext.tsx`)

Extend state:
```typescript
interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  role: 'admin' | 'user' | null;
  allowedTabs: string[];
}

// Helpers exposed via context:
isAdmin: boolean;           // role === 'admin'
hasTab(tab: string): boolean; // allowedTabs.includes(tab)
```

Login stores `role` and `allowedTabs` in localStorage alongside token and username. On mount, these are restored from localStorage.

**Logout** must clear all stored fields: `token`, `username`, `role`, `allowedTabs`.

### API client — 401 interceptor fix (`client/src/api.ts`)

The current 401 interceptor redirects to `/admin`. Update to redirect to `/` instead, since that's now the login page for all users:
```typescript
// On 401: clear localStorage and redirect to /
window.location.href = '/';
```

### Login on root page (`/`)

**OrganigramPage** gets wrapped in an auth check:
- If `!isAuthenticated` → render `<LoginForm />` (reuse existing component from AdminLayout, extracted to shared location)
- If authenticated → render the current OrganigramPage content

The `<LoginForm />` component is extracted from `AdminLayout` into `client/src/components/ui/LoginForm.tsx` so both OrganigramPage and AdminLayout can use it.

### Header tab filtering (`OrganigramPage`)

The Intern and Planning dropdown buttons in the header are conditionally rendered based on `allowedTabs`:

```tsx
{hasTab('intern') && <InternDropdown />}
{hasTab('planning') && <PlanningDropdown />}
```

- If user only has `["planning"]`, they see only the Planning button
- If user has `["intern","planning"]`, they see both
- The admin gear icon is only shown when `isAdmin`
- A logout button is shown for all users (replaces or sits next to the gear icon)

**Default view on login**: validate the persisted `viewMode` from localStorage against `allowedTabs`. If the stored viewMode references a tab the user doesn't have access to, reset to the first allowed tab's default view (intern→dashboard, planning→planning-lopend). This prevents showing a blank page after permission changes.

### Admin panel access

- The entire `/admin` route is restricted to admin role only
- AdminLayout checks: if `!isAdmin`, redirect to `/` (they shouldn't be here)
- The gear icon in OrganigramPage header is only visible to admins
- Non-admin users have no way to reach `/admin` through the UI

### Settings — User management UI

Extend the existing "Beheerders" section:

**User table columns:**
| Username | Rol | Tabs | Acties |
|----------|-----|------|--------|
| niel | Admin | Intern, Planning | Bewerk \| Verwijder |
| jan | Gebruiker | Planning | Bewerk \| Verwijder |

**Create/Edit form fields:**
- Username (text input)
- Wachtwoord (password input, optional on edit)
- Rol (dropdown: Admin / Gebruiker)
- Tabs (checkbox list): ☑ Intern ☑ Planning
  - When rol = Admin: checkboxes are checked and disabled (admin gets all tabs)
  - When rol = Gebruiker: checkboxes are freely togglable

### API client (`client/src/api.ts`)

Update the `login()` function to return and store `role` and `allowedTabs`. Update user management API functions to include role and allowedTabs in create/update payloads. Update the `AdminUser` interface to include `role` and `allowedTabs` fields.

## Migration Plan

1. Prisma migration: custom SQL to rename Admin → User, add role + allowedTabs columns, set existing accounts to admin
2. Update server auth middleware (User table, req.userId/username/userRole)
3. Update server auth routes (login response, user CRUD with role/tabs)
4. Add authMiddleware to all public GET routes
5. Update all server routes (Admin → User references, req.adminId → req.userId)
6. Extract LoginForm to shared component
7. Update AuthContext with role + allowedTabs + logout cleanup
8. Fix 401 interceptor to redirect to `/`
9. Add auth gate to OrganigramPage
10. Filter header tabs based on allowedTabs + add logout button
11. Update Settings UI for user management with roles + tabs
12. Restrict /admin to admin role only

## Edge Cases

- **Last admin protection**: cannot delete or demote the last admin account. Check is `count(role='admin' AND id != target) >= 1`.
- **Token expiry**: existing tokens (without role) will fail validation → user is logged out and must re-login (acceptable for a one-time migration)
- **Admin tab override**: admin role always gets all tabs server-side, regardless of what's stored in allowedTabs
- **No tabs assigned**: if a user has no allowed tabs, they see a message: "Geen toegang tot secties. Neem contact op met een beheerder."
- **localStorage stale data**: on login, always overwrite stored role/tabs with server response
- **Stale viewMode**: on login, validate persisted viewMode against allowedTabs; reset if the tab is not available
- **401 redirect**: interceptor redirects to `/` (not `/admin`) and clears all auth data from localStorage
- **Tab permission changes**: since allowedTabs is not in the JWT, changes take effect on next page refresh when the frontend re-reads from the server (via a lightweight check or on next API call)
- **Server-side tab enforcement**: explicitly not implemented in v1 — this is a trusted internal tool. All authenticated users can call any API endpoint. The frontend controls visibility.
