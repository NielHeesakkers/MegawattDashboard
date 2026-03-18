# Auth & Roles Design Spec

## Overview

Add site-wide authentication and role-based tab visibility to the MegawattDashboard. Currently the public frontend (`/`) is open and only `/admin` requires login. After this change, the entire site requires login, with two roles (admin/user) and per-user tab configuration.

## Requirements

1. **Site-wide login**: navigating to `/` shows a login screen if not authenticated
2. **Two roles**: `admin` (full access including Settings + admin panel) and `user` (frontend tabs only)
3. **Per-user tab visibility**: each user has a configurable list of allowed tabs (e.g. `["intern","planning"]`). Tab visibility = full edit permission for that tab's content
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

**Migration strategy:**
- Prisma migration renames `Admin` table to `User`
- Adds `role` column with default `"user"`
- Adds `allowedTabs` column with default `"[]"`
- Post-migration SQL sets all existing accounts to `role = "admin"` and `allowedTabs = '["intern","planning"]'`

**Tab registry** (defined as constant, not in DB):
```typescript
const AVAILABLE_TABS = [
  { key: 'intern', label: 'Intern' },
  { key: 'planning', label: 'Planning' },
] as const;
```

New tabs are added by extending this array. No schema change needed.

## Server Changes

### Auth routes (`server/routes/auth.ts`)

**Login response** — include role and allowedTabs:
```typescript
// POST /api/auth/login response:
{ token, username, role, allowedTabs: ["intern","planning"] }
```

The JWT payload includes: `{ id, username, role, allowedTabs }`.

**User CRUD** — update existing admin management endpoints:
- `GET /api/auth/users` — returns all users (id, username, role, allowedTabs). Protected, admin-only.
- `POST /api/auth/users` — create user with `{ username, password, role, allowedTabs }`. Protected, admin-only.
- `PUT /api/auth/users/:id` — update user. Protected, admin-only.
- `DELETE /api/auth/users/:id` — delete user. Protected, admin-only. Prevent deleting last admin.

**Validation:**
- `role` must be `"admin"` or `"user"`
- `allowedTabs` must be a valid JSON array of known tab keys
- Admin role automatically gets all tabs (enforced server-side)

### Auth middleware (`server/middleware/auth.ts`)

Update to read from `User` table instead of `Admin`. Add `req.userRole` and `req.allowedTabs` to the request object.

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
- All other authenticated routes remain accessible to both roles (the frontend controls what users see via tab visibility)

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

**Default view on login**: if the user's first allowed tab is "intern", show the dashboard (organigram). If it's "planning", show planning-lopend. This prevents showing a blank page.

### Admin panel access

- The `/admin` route remains as-is with AdminLayout
- AdminLayout checks: if `!isAdmin`, redirect to `/` (they shouldn't be here)
- The gear icon in OrganigramPage header is only visible to admins

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

Update the `login()` function to return and store `role` and `allowedTabs`. Update user management API functions to include role and allowedTabs in create/update payloads.

## Migration Plan

1. Prisma migration: rename Admin → User, add role + allowedTabs columns
2. Seed migration: set existing accounts to admin role with all tabs
3. Update server auth routes and middleware
4. Update all server routes (Admin → User references)
5. Extract LoginForm to shared component
6. Update AuthContext with role + allowedTabs
7. Add auth gate to OrganigramPage
8. Filter header tabs based on allowedTabs
9. Update Settings UI for user management with roles + tabs
10. Restrict /admin to admin role only

## Edge Cases

- **Last admin protection**: cannot delete or demote the last admin account
- **Token expiry**: existing tokens (without role) will fail validation → user is logged out and must re-login (acceptable for a one-time migration)
- **Admin tab override**: admin role always gets all tabs server-side, regardless of what's in allowedTabs
- **No tabs assigned**: if a user has no allowed tabs, they see a message like "Geen toegang tot secties. Neem contact op met een beheerder."
- **localStorage stale data**: on login, always overwrite stored role/tabs with server response
