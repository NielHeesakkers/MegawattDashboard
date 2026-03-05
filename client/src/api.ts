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

// Backup operations
export const exportBackup = () =>
  api.get('/backup/export', { responseType: 'blob' }).then((r) => {
    const url = window.URL.createObjectURL(r.data);
    const a = document.createElement('a');
    a.href = url;
    const disposition = r.headers['content-disposition'];
    a.download = disposition
      ? disposition.split('filename=')[1]?.replace(/"/g, '') || 'megawatt-backup.zip'
      : `megawatt-backup-${new Date().toISOString().slice(0, 10)}.zip`;
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

export default api;
