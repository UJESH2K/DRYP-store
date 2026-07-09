import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useToastStore } from './toast';
import { useWishlistStore } from './wishlist';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { API_BASE_URL } from '../lib/config';

export interface User {
  _id: string;
  supabaseId: string;
  email: string;
  name: string;
  role: 'user' | 'vendor' | 'admin';
  createdAt: string;
  preferences: {
    currency: string;
    categories: string[];
    colors: string[];
    brands: string[];
  };
}

interface AuthState {
  user: User | null;
  session: any | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  register: (name: string, email: string, password: string) => Promise<User | null>;
  login: (email: string, password: string) => Promise<User | null>;
  loginWithToken: (token: string) => Promise<User | null>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  updateUser: (user: User) => Promise<void>;
}

async function fetchMongoUser(token: string): Promise<User | null> {
  const res = await fetch(`${API_BASE_URL}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.user || null;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Listen for Supabase session changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      set({ user: null, session: null, isAuthenticated: false });
      await AsyncStorage.multiRemove(['user_token', 'user_data']);
      useWishlistStore.getState().setWishlist([]);
    }
  });

  return {
    user: null,
    session: null,
    isAuthenticated: false,
    isLoading: false,

    register: async (name, email, password) => {
      set({ isLoading: true });
      try {
        const { data: sbData, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (error || !sbData.session) {
          useToastStore.getState().showToast(error?.message || 'Registration failed', 'error');
          return null;
        }
        const token = sbData.session.access_token;
        const mongoUser = await fetchMongoUser(token);
        if (mongoUser) {
          set({ user: mongoUser, session: sbData.session, isAuthenticated: true });
          await AsyncStorage.setItem('user_token', token);
          await AsyncStorage.setItem('user_data', JSON.stringify(mongoUser));
          useWishlistStore.getState().setWishlist([]);
          useToastStore.getState().showToast('Registered successfully!');
          return mongoUser;
        }
        useToastStore.getState().showToast('Failed to load profile.', 'error');
        return null;
      } catch (e) {
        useToastStore.getState().showToast('An unexpected error occurred.', 'error');
        return null;
      } finally {
        set({ isLoading: false });
      }
    },

    loginWithToken: async (token) => {
      set({ isLoading: true });
      try {
        const mongoUser = await fetchMongoUser(token);
        if (mongoUser) {
          const { data: { session } } = await supabase.auth.getSession();
          set({ user: mongoUser, session, isAuthenticated: true });
          await AsyncStorage.setItem('user_token', token);
          await AsyncStorage.setItem('user_data', JSON.stringify(mongoUser));
          useWishlistStore.getState().setWishlist([]);
          useToastStore.getState().showToast('Logged in successfully!');
          return mongoUser;
        }
        useToastStore.getState().showToast('Failed to load profile.', 'error');
        return null;
      } catch (e) {
        useToastStore.getState().showToast('An unexpected error occurred.', 'error');
        return null;
      } finally {
        set({ isLoading: false });
      }
    },

    login: async (email, password) => {
      set({ isLoading: true });
      try {
        const { data: sbData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error || !sbData.session) {
          useToastStore.getState().showToast(error?.message || 'Invalid credentials.', 'error');
          return null;
        }
        const token = sbData.session.access_token;
        const mongoUser = await fetchMongoUser(token);
        if (mongoUser) {
          set({ user: mongoUser, session: sbData.session, isAuthenticated: true });
          await AsyncStorage.setItem('user_token', token);
          await AsyncStorage.setItem('user_data', JSON.stringify(mongoUser));
          useWishlistStore.getState().setWishlist([]);
          useToastStore.getState().showToast('Logged in successfully!');
          return mongoUser;
        }
        useToastStore.getState().showToast('Failed to load profile.', 'error');
        return null;
      } catch (e) {
        useToastStore.getState().showToast('An unexpected error occurred.', 'error');
        return null;
      } finally {
        set({ isLoading: false });
      }
    },

    signInWithGoogle: async () => {
      set({ isLoading: true });
      try {
        const redirectTo = makeRedirectUri({ scheme: 'dryp' });
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo },
        });
        if (error || !data?.url) {
          useToastStore.getState().showToast(error?.message || 'Failed to start Google sign-in.', 'error');
          set({ isLoading: false });
          return;
        }
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type !== 'success') {
          set({ isLoading: false });
          return;
        }
        const urlParams = new URL(result.url).searchParams;
        const code = urlParams.get('code');
        if (code) {
          const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError || !session) {
            useToastStore.getState().showToast(exchangeError?.message || 'Failed to complete sign-in.', 'error');
            set({ isLoading: false });
            return;
          }
          const token = session.access_token;
          const mongoUser = await fetchMongoUser(token);
          if (mongoUser) {
            set({ user: mongoUser, session, isAuthenticated: true });
            await AsyncStorage.setItem('user_token', token);
            await AsyncStorage.setItem('user_data', JSON.stringify(mongoUser));
            useWishlistStore.getState().setWishlist([]);
            useToastStore.getState().showToast('Logged in successfully!');
          }
        } else {
          useToastStore.getState().showToast('No code returned from sign-in.', 'error');
        }
      } catch (e) {
        useToastStore.getState().showToast('Google sign-in failed.', 'error');
      } finally {
        set({ isLoading: false });
      }
    },

    logout: async () => {
      set({ isLoading: true });
      try {
        await supabase.auth.signOut();
        await AsyncStorage.multiRemove(['user_token', 'user_data']);
        useWishlistStore.getState().setWishlist([]);
        set({ user: null, session: null, isAuthenticated: false });
      } catch (error) {
        console.error('Error logging out:', error);
      } finally {
        set({ isLoading: false });
      }
    },

    loadUser: async () => {
      set({ isLoading: true });
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const mongoUser = await fetchMongoUser(session.access_token);
          if (mongoUser) {
            set({ user: mongoUser, session, isAuthenticated: true });
            await AsyncStorage.setItem('user_token', session.access_token);
            await AsyncStorage.setItem('user_data', JSON.stringify(mongoUser));
          }
        }
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        set({ isLoading: false });
      }
    },

    updateUser: async (user: User) => {
      set({ user });
      await AsyncStorage.setItem('user_data', JSON.stringify(user));
    },
  };
});
