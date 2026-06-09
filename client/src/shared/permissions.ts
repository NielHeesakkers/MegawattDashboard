// Single source of truth voor de zichtbaarheids-rechten per gebruiker.
// `key` is tevens de sidebar-ViewMode (behalve 'nieuw-project', dat is de + knop).
// Gebruikt door zowel de Settings-UI (gegroepeerde checkboxes) als de Sidebar (filtering).

export interface PermissionItem { key: string; label: string }
export interface PermissionGroup { group: string; items: PermissionItem[] }

export const PERMISSION_GROUPS: PermissionGroup[] = [
  { group: 'Contacten', items: [
    { key: 'klanten', label: 'Klanten' },
    { key: 'toeleveranciers', label: 'Toeleveranciers' },
  ]},
  { group: 'Projecten', items: [
    { key: 'nieuw-project', label: 'Nieuw Project' },
    { key: 'projecten-actief', label: 'Lopend' },
    { key: 'projecten-afgerond', label: 'Gearchiveerd' },
    { key: 'projecten-geannuleerd', label: 'Afgewezen' },
  ]},
  { group: 'Resources', items: [
    { key: 'locaties', label: 'Locaties' },
    { key: 'superchargers', label: 'Superchargers' },
  ]},
  { group: 'Intern', items: [
    { key: 'dashboard', label: 'Organigram' },
    { key: 'klantteams', label: 'Klantteams' },
  ]},
];

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));
