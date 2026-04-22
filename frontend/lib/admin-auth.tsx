"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { adminAuthApi } from './admin-api';

interface AdminUser {
  id: number;
  email: string;
  name: string;
  company: string;
  role: string;
  group_id?: number;
  status: string;
  trust_level: string;
  two_fa: boolean;
}

interface AdminAuthContextType {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  isAuthenticated: false,
});

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const savedUser = localStorage.getItem('admin_user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await adminAuthApi.login(email, password);
    localStorage.setItem('admin_token', res.access_token);
    localStorage.setItem('admin_user', JSON.stringify(res.user));
    setUser(res.user);
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setUser(null);
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    window.location.href = `${basePath}/admin/login`;
  };

  return (
    <AdminAuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
