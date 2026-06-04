import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Attach JWT token to admin requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on expired/invalid token
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      localStorage.removeItem('role');
      localStorage.removeItem('allowedTabs');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Types
export interface Team {
  id: number;
  name: string;
  color: string;
  order: number;
  executiveId: number | null;
  executive?: Executive | null;
  members: Member[];
}

export interface Member {
  id: number;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  photo: string | null;
  teamId: number | null;
  team?: Team | null;
  isVacancy: boolean;
  isTeamLead: boolean;
  order: number;
  subGroup: string | null;
}

export interface Executive {
  id: number;
  name: string;
  role: string;
  photo: string | null;
  email: string | null;
  phone: string | null;
  level: number;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string | null;
  role: string;
  allowedTabs: string[];
}

export interface AuditLogEntry {
  id: number;
  action: string;
  entity: string;
  entityId: number;
  changes: string;
  performedBy: string;
  createdAt: string;
}

// API calls
export const fetchTeams = () => api.get<Team[]>('/teams').then((r) => r.data);
export const fetchExecutives = () => api.get<Executive[]>('/executives').then((r) => r.data);
export const fetchMembers = () => api.get<Member[]>('/members').then((r) => r.data);

export const login = (username: string, password: string) =>
  api.post<{ token: string; username: string; role: string; allowedTabs: string[] }>('/auth/login', { username, password }).then((r) => r.data);

// Admin CRUD
export const createTeam = (data: Partial<Team>) => api.post<Team>('/teams', data).then((r) => r.data);
export const updateTeam = (id: number, data: Partial<Team>) => api.put<Team>(`/teams/${id}`, data).then((r) => r.data);
export const deleteTeam = (id: number) => api.delete(`/teams/${id}`);
export const reorderTeams = (orders: { id: number; order: number }[]) =>
  api.put('/teams/reorder/batch', { orders });

export const createMember = (data: FormData) => api.post<Member>('/members', data).then((r) => r.data);
export const updateMember = (id: number, data: FormData) => api.put<Member>(`/members/${id}`, data).then((r) => r.data);
export const deleteMember = (id: number) => api.delete(`/members/${id}`);
export const reorderMembers = (orders: { id: number; order: number }[]) =>
  api.put('/members/reorder/batch', { orders });

export const createExecutive = (data: FormData) => api.post<Executive>('/executives', data).then((r) => r.data);
export const updateExecutive = (id: number, data: FormData) => api.put<Executive>(`/executives/${id}`, data).then((r) => r.data);
export const deleteExecutive = (id: number) => api.delete(`/executives/${id}`);

export const fetchAdminUsers = () => api.get<AdminUser[]>('/auth/users').then((r) => r.data);
export const createAdminUser = (data: { email: string; role: string; allowedTabs: string[]; username?: string; password?: string }) =>
  api.post<AdminUser>('/auth/users', data).then((r) => r.data);
export const updateAdminUser = (id: number, data: { username?: string; password?: string; email?: string; role?: string; allowedTabs?: string[] }) =>
  api.put<AdminUser>(`/auth/users/${id}`, data).then((r) => r.data);
export const deleteAdminUser = (id: number) => api.delete(`/auth/users/${id}`);
export const sendWelcomeEmail = (id: number) =>
  api.post<{ success: boolean }>(`/auth/users/${id}/send-welcome`).then((r) => r.data);

// Wachtwoord reset via e-mail
export const forgotPassword = (email: string) =>
  api.post<{ success: boolean; message: string }>('/auth/forgot-password', { email }).then((r) => r.data);
export const checkResetToken = (token: string) =>
  api.get<{ valid: boolean; username?: string; error?: string }>(`/auth/reset-password/${token}/check`).then((r) => r.data);
export const resetPassword = (token: string, newPassword: string) =>
  api.post<{ success: boolean }>('/auth/reset-password', { token, newPassword }).then((r) => r.data);

// Globale zoekopdracht
export interface GlobalSearchResults {
  members: Array<{ id: number; name: string; role: string | null; email: string | null; photo: string | null; team: { id: number; name: string } | null }>;
  executives: Array<{ id: number; name: string; role: string | null; email: string | null; photo: string | null }>;
  klanten: Array<{ id: number; name: string; logo: string | null; stad: string | null; land: string | null }>;
  toeleveranciers: Array<{ id: number; name: string; logo: string | null; stad: string | null; land: string | null }>;
  locaties: Array<{ id: number; code: string | null; naam: string | null; stad: string | null; land: string | null }>;
  projecten: Array<{ id: number; name: string | null; projectNumber: string; klant: { name: string } }>;
}
export const globalSearch = (q: string) =>
  api.get<GlobalSearchResults>(`/search?q=${encodeURIComponent(q)}`).then((r) => r.data);

export const fetchAuditLogs = (page = 1, limit = 50) =>
  api.get<{ logs: AuditLogEntry[]; total: number; page: number; pages: number }>(
    `/audit-logs?page=${page}&limit=${limit}`
  ).then((r) => r.data);

export const fetchChangelog = () =>
  api.get<{ content: string }>('/audit-logs/changelog').then((r) => r.data.content);

export interface Supercharger {
  id: number;
  firstName: string;
  lastName: string;
  function: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  photo: string | null;
  createdAt: string;
  updatedAt: string;
}

// Client Teams types
export interface ClientTeam {
  id: number;
  name: string;
  order: number;
  executiveId: number | null;
  executive?: Executive | null;
  members: ClientTeamMemberWithMember[];
  clients: Client[];
}

export interface ClientTeamMember {
  id: number;
  clientTeamId: number;
  memberId: number | null;
  executiveId: number | null;
  role: string;
  order: number;
}

export interface ClientTeamMemberWithMember extends ClientTeamMember {
  member: Member | null;
  executive: Executive | null;
}

export interface Client {
  id: number;
  name: string;
  url: string | null;
  clientTeamId: number;
  order: number;
}

export interface KlantContact {
  id: number;
  klantId: number;
  naam: string;
  email: string | null;
  telefoon: string | null;
  order: number;
}

export interface Klant {
  id: number;
  name: string;
  contactPerson: string | null;
  email: string | null;
  logo: string | null;
  adres: string | null;
  postcode: string | null;
  stad: string | null;
  land: string | null;
  contacts?: KlantContact[];
  createdAt: string;
  updatedAt: string;
  _count?: { projects: number };
}

export interface ToeleverancierContact {
  id: number;
  toeleverancierId: number;
  naam: string;
  email: string | null;
  telefoon: string | null;
  order: number;
}

export interface Specialisme {
  id: number;
  naam: string;
}

export interface ToeleverancierSpecialisme {
  toeleverancierId: number;
  specialismeId: number;
  specialisme: Specialisme;
}

export interface Toeleverancier {
  id: number;
  name: string;
  contactPerson: string | null;
  email: string | null;
  logo: string | null;
  adres: string | null;
  postcode: string | null;
  stad: string | null;
  land: string | null;
  contacts?: ToeleverancierContact[];
  specialismes?: ToeleverancierSpecialisme[];
  createdAt: string;
  updatedAt: string;
}

export interface ActivationStaffMember {
  id: number;
  activationId: number;
  superchargerId: number;
  role: string;
  supercharger: Supercharger;
}

export interface Activation {
  id: number;
  projectId: number;
  location: string;
  locationLat: number | null;
  locationLon: number | null;
  locationZoom: number | null;
  date: string | null;
  briefingToken: string | null;
  startTime: string | null;
  endTime: string | null;
  scheduleItems: string; // JSON string of {time, description}[]
  tasks: string | null;
  storeList: string | null;
  photoRequirements: string | null;
  extraInfo: string | null;
  evaluationLink: string | null;
  target: string | null;
  staff?: ActivationStaffMember[];
  createdAt: string;
  updatedAt: string;
}

export type ProjectStatus = 'active' | 'completed' | 'cancelled';
export type AvailabilityState = 'yes' | 'no' | 'unknown';

export interface ProjectContact {
  id: number;
  projectId: number;
  naam: string;
  email: string | null;
  telefoon: string | null;
  order: number;
}

export interface ProjectLocationSupercharger {
  id: number;
  projectLocationId: number;
  superchargerId: number;
  /** JSON-string: { "2026-06-05": true, ... } */
  availability: string;
  order: number;
  supercharger?: { id: number; firstName: string; lastName: string; function: string; photo: string | null };
}

export interface ProjectLocation {
  id: number;
  projectId: number;
  locationId: number;
  order: number;
  startDate: string | null;
  endDate: string | null;
  available: AvailabilityState;
  actionOpen: boolean;
  actionLabel: string | null;
  opmerkingen: string;
  location?: Location;
  superchargers?: ProjectLocationSupercharger[];
}

export interface Project {
  id: number;
  klantId: number;
  klant?: { id: number; name: string; logo: string | null };
  projectNumber: string;
  name: string | null;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
  contactPerson: string | null;
  email: string | null;
  needsLocations: boolean;
  needsSuperchargers: boolean;
  notities: string;
  campaignDescription: string | null;
  campaignMessage: string | null;
  campaignTargetAudience: string | null;
  campaignTarget: string | null;
  clothing: string | null;
  settingInstructions: string | null;
  extraInfo: string | null;
  activations?: Activation[];
  contacts?: ProjectContact[];
  locations?: ProjectLocation[];
  toeleveranciers?: Array<{ toeleverancierId: number; telefoon?: string | null; toeleverancier?: { id: number; name: string; logo: string | null } }>;
  _count?: { activations: number; locations: number };
  createdAt: string;
  updatedAt: string;
}

export interface ProjectWriteInput {
  klantId: number;
  projectNumber: string;
  name?: string | null;
  startDate?: string;
  endDate?: string;
  status?: ProjectStatus;
  contactPerson?: string | null;
  email?: string | null;
  needsLocations?: boolean;
  needsSuperchargers?: boolean;
  notities?: string;
  campaignDescription?: string | null;
  campaignMessage?: string | null;
  campaignTargetAudience?: string | null;
  campaignTarget?: string | null;
  clothing?: string | null;
  settingInstructions?: string | null;
  extraInfo?: string | null;
  contacts?: Array<{ naam: string; email?: string | null; telefoon?: string | null }>;
  locations?: Array<{
    locationId: number;
    startDate?: string | null;
    endDate?: string | null;
    available?: AvailabilityState;
    actionOpen?: boolean;
    actionLabel?: string | null;
    opmerkingen?: string;
    superchargers?: Array<{ superchargerId: number; availability?: Record<string, boolean> }>;
  }>;
  toeleverancierIds?: Array<{ id: number; telefoon?: string | null }>;
}

// Location types
export interface LocationContact {
  id: number;
  locationId: number;
  naam: string;
  email: string | null;
  telefoon: string | null;
  website: string | null;
  rol: string | null;
  order: number;
}

export interface LocationPhoto {
  id: number;
  locationId: number;
  filename: string;
  isMain: boolean;
  order: number;
  createdAt: string;
}

export interface LocationCost {
  id: number;
  locationId: number;
  label: string;
  bedragCents: number;
  order: number;
}

export type OmgevingType = 'centrum' | 'winkelstraat' | 'park' | 'plein' | 'stationsplein';
export type Orientatie = 'N' | 'NO' | 'O' | 'ZO' | 'Z' | 'ZW' | 'W' | 'NW';
export type EigendomType = 'particulier' | 'gemeentelijk' | 'bedrijf';

export interface Location {
  id: number;
  code: string | null;
  naam: string;
  land: string;
  stad: string | null;
  adres: string;
  lat: number | null;
  lng: number | null;
  omgevingType: OmgevingType;
  orientatie: Orientatie;
  eigendomType: EigendomType;
  vergunningNodig: boolean;
  vergunningLink: string | null;
  truckBereikbaar: boolean;
  geschiktActivatie: boolean;
  geschiktSampling: boolean;
  geschiktHotspot: boolean;
  geschiktAnder: string | null;
  stroom: boolean;
  verlichting: boolean;
  lengte: number | null;
  breedte: number | null;
  m2: number | null;
  notities: string;
  createdAt: string;
  updatedAt: string;
  contacts: LocationContact[];
  photos: LocationPhoto[];
  costs: LocationCost[];
  projects?: Array<{
    id: number;
    projectId: number;
    project: { id: number; projectNumber: string; name: string | null; klant: { id: number; name: string; logo: string | null } };
  }>;
}

export type LocationWriteInput = Omit<Location, 'id' | 'code' | 'stad' | 'lat' | 'lng' | 'createdAt' | 'updatedAt' | 'contacts' | 'photos' | 'costs' | 'projects'> & {
  contacts: Array<Omit<LocationContact, 'id' | 'locationId' | 'order'>>;
  costs: Array<Omit<LocationCost, 'id' | 'locationId' | 'order'>>;
};

// (LocProject types vervangen door unified Project hierboven)

// Superchargers
export const fetchSuperchargers = () => api.get<Supercharger[]>('/superchargers').then((r) => r.data);
export const createSupercharger = (data: FormData) => api.post<Supercharger>('/superchargers', data).then((r) => r.data);
export const updateSupercharger = (id: number, data: FormData) => api.put<Supercharger>(`/superchargers/${id}`, data).then((r) => r.data);
export const deleteSupercharger = (id: number) => api.delete(`/superchargers/${id}`);

// Client Teams API
export const fetchClientTeams = () => api.get<ClientTeam[]>('/client-teams').then((r) => r.data);
export const createClientTeam = (data: Partial<ClientTeam>) => api.post<ClientTeam>('/client-teams', data).then((r) => r.data);
export const updateClientTeam = (id: number, data: Partial<ClientTeam>) => api.put<ClientTeam>(`/client-teams/${id}`, data).then((r) => r.data);
export const deleteClientTeam = (id: number) => api.delete(`/client-teams/${id}`);
export const reorderClientTeams = (orders: { id: number; order: number }[]) =>
  api.put('/client-teams/reorder/batch', { orders });

// Client Team Members API
export const createClientTeamMember = (data: { clientTeamId: number; memberId?: number; executiveId?: number; role: string; order?: number }) =>
  api.post<ClientTeamMemberWithMember>('/client-team-members', data).then((r) => r.data);
export const updateClientTeamMember = (id: number, data: { role?: string; order?: number }) =>
  api.put<ClientTeamMemberWithMember>(`/client-team-members/${id}`, data).then((r) => r.data);
export const deleteClientTeamMember = (id: number) => api.delete(`/client-team-members/${id}`);
export const reorderClientTeamMembers = (orders: { id: number; order: number }[]) =>
  api.put('/client-team-members/reorder/batch', { orders });

// Clients (companies) API
export const fetchClients = () => api.get<Client[]>('/clients').then((r) => r.data);
export const createClient = (data: Partial<Client>) => api.post<Client>('/clients', data).then((r) => r.data);
export const updateClient = (id: number, data: Partial<Client>) => api.put<Client>(`/clients/${id}`, data).then((r) => r.data);
export const deleteClient = (id: number) => api.delete(`/clients/${id}`);
export const reorderClients = (orders: { id: number; order: number }[]) =>
  api.put('/clients/reorder/batch', { orders });

// Klanten
export const fetchKlanten = () => api.get<Klant[]>('/klanten').then((r) => r.data);
export const fetchKlant = (id: number) => api.get<Klant>(`/klanten/${id}`).then((r) => r.data);
export const createKlant = (data: FormData) => api.post<Klant>('/klanten', data).then((r) => r.data);
export const updateKlant = (id: number, data: FormData) => api.put<Klant>(`/klanten/${id}`, data).then((r) => r.data);
export const deleteKlant = (id: number) => api.delete(`/klanten/${id}`);

// Toeleveranciers (zelfde shape als Klanten, geen project-relaties)
export const fetchToeleveranciers = () => api.get<Toeleverancier[]>('/toeleveranciers').then((r) => r.data);
export const fetchToeleverancier = (id: number) => api.get<Toeleverancier>(`/toeleveranciers/${id}`).then((r) => r.data);
export const createToeleverancier = (data: FormData) => api.post<Toeleverancier>('/toeleveranciers', data).then((r) => r.data);
export const updateToeleverancier = (id: number, data: FormData) => api.put<Toeleverancier>(`/toeleveranciers/${id}`, data).then((r) => r.data);
export const deleteToeleverancier = (id: number) => api.delete(`/toeleveranciers/${id}`);

// Specialismes
export const fetchSpecialismes = () => api.get<Specialisme[]>('/specialismes').then((r) => r.data);
export const createSpecialisme = (naam: string) => api.post<Specialisme>('/specialismes', { naam }).then((r) => r.data);
export const deleteSpecialisme = (id: number) => api.delete(`/specialismes/${id}`);

// Projects
export const fetchProject = (id: number) =>
  api.get<Project>(`/projects/${id}`).then((r) => r.data);

export const fetchProjects = (status?: string) =>
  api.get<Project[]>('/projects', { params: status ? { status } : {} }).then((r) => r.data);
export const createProject = (data: ProjectWriteInput | Partial<Project>) =>
  api.post<Project>('/projects', data).then((r) => r.data);
export const updateProject = (id: number, data: ProjectWriteInput | Partial<Project>) =>
  api.put<Project>(`/projects/${id}`, data).then((r) => r.data);
export const deleteProject = (id: number) => api.delete(`/projects/${id}`);

// Activations (nested under projects)
export const createActivation = (projectId: number, data: Partial<Activation>) =>
  api.post<Activation>(`/projects/${projectId}/activations`, data).then((r) => r.data);
export const updateActivation = (id: number, data: Record<string, unknown>) =>
  api.put<Activation>(`/projects/activations/${id}`, data).then((r) => r.data);
export const deleteActivation = (id: number) => api.delete(`/projects/activations/${id}`);

// Public briefing (no auth needed)
export const fetchBriefing = (token: string) =>
  axios.get<Activation & { project: Project }>(`/api/projects/briefing/${token}`).then((r) => r.data);

// Backup operations
export const exportBackup = () =>
  api.get('/backup/export', { responseType: 'blob' }).then((r) => {
    const url = window.URL.createObjectURL(r.data);
    const a = document.createElement('a');
    a.href = url;
    const disposition = r.headers['content-disposition'];
    a.download = disposition
      ? disposition.split('filename=')[1]?.replace(/"/g, '') || 'megawatt-backup.zip'
      : (() => { const d = new Date(); return `megawatt-backup-${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}.zip`; })();
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  });

export const importBackup = (file: File) => {
  const fd = new FormData();
  fd.append('backup', file);
  return api.post<{ success: boolean; imported: { executives: number; teams: number; members: number } }>(
    '/backup/import', fd
  ).then((r) => r.data);
};

export const clearAllData = () =>
  api.delete<{ success: boolean; deleted: { members: number; teams: number; executives: number } }>(
    '/backup/clear'
  ).then((r) => r.data);

// Backup list & download
export interface BackupFile {
  filename: string;
  size: number;
  createdAt: string;
}

export const fetchBackupList = () =>
  api.get<{ backups: BackupFile[] }>('/backup/list').then((r) => r.data.backups);

export const downloadBackup = (filename: string) =>
  api.get(`/backup/download/${filename}`, { responseType: 'blob' }).then((r) => {
    const url = window.URL.createObjectURL(r.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  });

export const deleteBackup = (filename: string) =>
  api.delete(`/backup/delete/${filename}`).then((r) => r.data);

export const triggerAutoBackup = () =>
  api.post<{ success: boolean; filename: string }>('/backup/auto').then((r) => r.data);

// Email settings
export interface EmailSettings {
  configured: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  fromName: string;
}

export const fetchEmailSettings = () =>
  api.get<EmailSettings>('/settings/email').then((r) => r.data);

export const updateEmailSettings = (data: {
  smtpHost: string; smtpPort: number; smtpUser: string; smtpPass: string;
  fromEmail: string; fromName: string;
}) => api.put<{ success: boolean }>('/settings/email', data).then((r) => r.data);

export const sendTestEmail = (testEmail: string) =>
  api.post<{ success: boolean }>('/settings/email/test', { testEmail }).then((r) => r.data);

export const shareViaEmail = (data: { to: string; subject?: string; pdfBase64: string; fileName?: string }) =>
  api.post<{ success: boolean }>('/share-email', data).then((r) => r.data);

// Locations
export async function fetchLocations(): Promise<Location[]> {
  const { data } = await api.get('/locations');
  return data;
}

export async function fetchLocation(id: number): Promise<Location> {
  const { data } = await api.get(`/locations/${id}`);
  return data;
}

export async function createLocation(input: LocationWriteInput): Promise<Location> {
  const { data } = await api.post('/locations', input);
  return data;
}

export async function updateLocation(id: number, input: LocationWriteInput): Promise<Location> {
  const { data } = await api.put(`/locations/${id}`, input);
  return data;
}

export interface LocationDeleteConflict {
  error: string;
  projects: Array<{ id: number; projectNumber: string; name: string | null }>;
}

export async function deleteLocation(id: number, force = false): Promise<void> {
  await api.delete(`/locations/${id}`, { params: force ? { force: 'true' } : undefined });
}

export async function geocodeLocation(id: number): Promise<{ lat: number | null; lng: number | null; adres: string; found: boolean }> {
  const { data } = await api.post(`/locations/${id}/geocode`);
  return data;
}

export async function uploadLocationPhotos(id: number, files: File[]): Promise<LocationPhoto[]> {
  const form = new FormData();
  for (const f of files) form.append('photos', f);
  const { data } = await api.post(`/locations/${id}/photos`, form);
  return data;
}

export async function deleteLocationPhoto(id: number, photoId: number): Promise<void> {
  await api.delete(`/locations/${id}/photos/${photoId}`);
}

export async function reorderLocationPhotos(id: number, order: number[]): Promise<void> {
  await api.patch(`/locations/${id}/photos/order`, { order });
}

export async function setLocationPhotoMain(id: number, photoId: number): Promise<void> {
  await api.patch(`/locations/${id}/photos/${photoId}/main`);
}

export async function backfillLocationCodes(): Promise<{ count: number }> {
  const { data } = await api.post('/locations/backfill-codes');
  return data;
}

export interface AdresSuggestion { display_name: string; lat: number; lng: number }
export async function suggestAdres(q: string, land: string): Promise<AdresSuggestion[]> {
  if (q.trim().length < 3) return [];
  const { data } = await api.get<AdresSuggestion[]>('/locations/suggest', { params: { q, land } });
  return data;
}

// Project bestanden
export interface ProjectFile {
  filename: string;
  size: number;
  uploadedAt: string;
  url: string;
  notitie: string;
}
export const fetchProjectFiles = (id: number) =>
  api.get<ProjectFile[]>(`/projects/${id}/files`).then((r) => r.data);
export const uploadProjectFiles = (id: number, files: File[]) => {
  const fd = new FormData();
  files.forEach((f) => fd.append('files', f));
  return api.post<{ saved: string[] }>(`/projects/${id}/files`, fd).then((r) => r.data);
};
export const deleteProjectFile = (id: number, filename: string) =>
  api.delete(`/projects/${id}/files/${encodeURIComponent(filename)}`);
export const updateProjectFileNote = (id: number, filename: string, notitie: string) =>
  api.patch<{ filename: string; notitie: string }>(`/projects/${id}/files/${encodeURIComponent(filename)}`, { notitie }).then((r) => r.data);

// Logo refresh
export const refreshKlantLogo = (id: number) =>
  api.post<{ logo: string }>(`/klanten/${id}/refresh-logo`).then((r) => r.data);
export const refreshToeleverancierLogo = (id: number) =>
  api.post<{ logo: string }>(`/toeleveranciers/${id}/refresh-logo`).then((r) => r.data);

export default api;
