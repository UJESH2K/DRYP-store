'use client';

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

type AuthContextType = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: Record<string, any> | null;
  token: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  login: (userData: Record<string, any>, userToken: string, redirectTo?: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
  isApprovedVendor: boolean;
  // Mirrors backend decideStudioAccess: active vendor OR active admin may enter the studio.
  hasStudioAccess: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    let cancelled = false;

    if (
      !storedToken ||
      storedToken === 'null' ||
      storedToken === 'undefined' ||
      !storedUser
    ) {
      setLoading(false);
      return;
    }

    try {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setLoading(false);
      return;
    }

    // Validate + refresh the restored session against the backend so stale,
    // expired, or suspended tokens never leave the UI thinking it is approved.
    (async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        if (cancelled) return;

        if (res.ok) {
          const data = await res.json().catch(() => null);
          // Only adopt the fresh payload if no newer login happened mid-hydration
          // (e.g. an OAuth callback page logging in with a different token).
          if (data?.user && localStorage.getItem('token') === storedToken) {
            setUser(data.user);
          }
        } else if (res.status === 401 || res.status === 403) {
          if (localStorage.getItem('token') === storedToken) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
          }
        }
        // Other failures (5xx / network) keep the restored session.
      } catch {
        // Backend unreachable — keep the restored session.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = (userData: Record<string, unknown>, userToken: string, redirectTo = '/dashboard') => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', userToken);
    setUser(userData);
    setToken(userToken);
    router.push(redirectTo);
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
    setToken(null);
    router.push('/login');
  };

  const isApprovedVendor = Boolean(
    user && user.role === 'vendor' && user.isActive !== false,
  );

  const hasStudioAccess = Boolean(
    user &&
      user.isActive !== false &&
      (user.role === 'vendor' || user.role === 'admin'),
  );

  const authContextValue: AuthContextType = {
    user,
    token,
    login,
    logout,
    isAuthenticated: Boolean(token && user),
    loading,
    isApprovedVendor,
    hasStudioAccess,
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};