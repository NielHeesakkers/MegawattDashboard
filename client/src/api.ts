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
      window.location.href = '/admin';
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
  teamId: number;
  team?: Team;
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
  api.post<{ token: string; username: string }>('/auth/login', { username, password }).then((r) => r.data);

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
export const createAdminUser = (data: { username: string; password: string }) =>
  api.post<AdminUser>('/auth/users', data).then((r) => r.data);
export const updateAdminUser = (id: number, data: { username?: string; password?: string }) =>
  api.put<AdminUser>(`/auth/users/${id}`, data).then((r) => r.data);
export const deleteAdminUser = (id: number) => api.delete(`/auth/users/${id}`);

export const fetchAuditLogs = (page = 1, limit = 50) =>
  api.get<{ logs: AuditLogEntry[]; total: number; page: number; pages: number }>(
    `/audit-logs?page=${page}&limit=${limit}`
  ).then((r) => r.data);

export const fetchChangelog = () =>
  api.get<{ content: string }>('/audit-logs/changelog').then((r) => r.data.content);

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

export interface Klant {
  id: number;
  name: string;
  contactPerson: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { projects: number };
}

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
export const createKlant = (data: Partial<Klant>) => api.post<Klant>('/klanten', data).then((r) => r.data);
export const updateKlant = (id: number, data: Partial<Klant>) => api.put<Klant>(`/klanten/${id}`, data).then((r) => r.data);
export const deleteKlant = (id: number) => api.delete(`/klanten/${id}`);

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

export default api;
