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
  level: number;
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

export const fetchAuditLogs = (page = 1, limit = 50) =>
  api.get<{ logs: AuditLogEntry[]; total: number; page: number; pages: number }>(
    `/audit-logs?page=${page}&limit=${limit}`
  ).then((r) => r.data);

export default api;
