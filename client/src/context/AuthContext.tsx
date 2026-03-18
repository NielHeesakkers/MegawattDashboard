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
