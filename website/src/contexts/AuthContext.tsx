'use client';

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '../types';

// ✅ Define proper type
type AuthContextType = {
  user: User | null;
  token: string | null;
  login: (userData: User, userToken: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
};

// ✅ Context can be undefined initially
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch (e) {
        // Corrupted or stale shape in localStorage — clear it so the
        // website stays renderable rather than crashing the whole provider.
        console.warn('Clearing corrupted auth storage:', e);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }

    setLoading(false);
  }, []);

  const login = (userData: User, userToken: string) => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', userToken);
    // Mirror to a non-HttpOnly cookie so the Next.js middleware
    // (Edge runtime, runs before page render) can gate /dashboard and
    // /admin without a flash of unauthed content. The HttpOnly flag
    // would be safer but can't be set from client JS — this is a
    // best-effort defence, not a security boundary. Real authz still
    // happens server-side in the API.
    document.cookie = `dryp_token=${encodeURIComponent(userToken)}; path=/; max-age=86400; SameSite=Lax`;
    setUser(userData);
    setToken(userToken);
    router.push('/dashboard');
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    document.cookie = 'dryp_token=; path=/; max-age=0; SameSite=Lax';
    setUser(null);
    setToken(null);
    router.push('/login');
  };

  const authContextValue: AuthContextType = {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!token,
    loading
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// ✅ Safe hook
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};