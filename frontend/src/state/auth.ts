import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToastStore } from './toast';
import { useWishlistStore } from './wishlist';

export interface User {
  _id: string;
  email: string;
  name: string;
  role: 'user' | 'vendor' | 'admin';
  authProvider?: 'local' | 'shopify' | 'google' | 'invited';
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
  token: string | null;
  session: any | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  guestId: string | null;
  isLoading: boolean;
  initGuestUser: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<User | null>;
  login: (email: string, password: string) => Promise<User | null>;
  loginWithToken: (token: string) => Promise<User | null>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  updateUser: (user: User) => Promise<void>;
}

function generateGuestId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  session: null,
  isAuthenticated: false,
  isGuest: false,
  guestId: null,
  isLoading: false,

  initGuestUser: async () => {
    try {
      let guestId = await AsyncStorage.getItem('guest_id');
      if (!guestId) {
        guestId = generateGuestId();
        await AsyncStorage.setItem('guest_id', guestId);
      }
      set({ isGuest: true, guestId, isAuthenticated: false, user: null, token: null });
    } catch (error) {
      console.error('Error initializing guest user:', error);
    }
  },

  register: async (name, email, password) => {
    const { apiCall } = require('../lib/api'); // LAZY REQUIRE
    set({ isLoading: true });
    try {
      const guestId = get().guestId;
      const response = await apiCall('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, guestId }),
      });

      if (response && response.token) {
        const { token, user } = response;
        set({ user, token, isAuthenticated: true, isGuest: false, guestId: null });
        await AsyncStorage.setItem('user_token', token);
        await AsyncStorage.setItem('user_data', JSON.stringify(user));
        await AsyncStorage.removeItem('guest_id');

        useWishlistStore.getState().setWishlist([]);
        useToastStore.getState().showToast('Registered successfully!');
        return user;
      } else {
        useToastStore.getState().showToast(response?.message || 'An unknown error occurred.', 'error');
        return null;
      }
    } catch (error) {
      console.error('Error registering:', error);
      useToastStore.getState().showToast('An unexpected error occurred. Please try again.', 'error');
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    const { apiCall } = require('../lib/api'); // LAZY REQUIRE
    set({ isLoading: true });
    try {
      const guestId = get().guestId;
      const response = await apiCall('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, guestId }),
      });

      if (response && response.token) {
        const { token, user } = response;
        set({ user, token, isAuthenticated: true, isGuest: false, guestId: null });
        await AsyncStorage.setItem('user_token', token);
        await AsyncStorage.setItem('user_data', JSON.stringify(user));
        await AsyncStorage.removeItem('guest_id');

        const wishlistItems = await apiCall('/api/wishlist');
        if (Array.isArray(wishlistItems)) {
          const validWishlistProducts = wishlistItems
            .filter(item => item && item.product)
            .map(item => item.product);
          useWishlistStore.getState().setWishlist(validWishlistProducts);
        }

        useToastStore.getState().showToast('Logged in successfully!');
        return user;
      } else {
        useToastStore.getState().showToast(response?.message || 'Invalid credentials.', 'error');
        return null;
      }
    } catch (error) {
      console.error('Error logging in:', error);
      useToastStore.getState().showToast('An unexpected error occurred. Please try again.', 'error');
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  // Hydrates the auth store from a DRYP JWT minted by a backend OAuth redirect
  // (e.g. after the Shopify OAuth callback), which only carries a token.
  loginWithToken: async (token: string) => {
    const { apiCall } = require('../lib/api'); // LAZY REQUIRE
    set({ isLoading: true, token });
    try {
      const response = await apiCall('/api/auth/me');

      if (response && response.user) {
        const { user } = response;
        set({ user, token, isAuthenticated: true, isGuest: false, guestId: null });
        await AsyncStorage.setItem('user_token', token);
        await AsyncStorage.setItem('user_data', JSON.stringify(user));
        await AsyncStorage.removeItem('guest_id');

        const wishlistItems = await apiCall('/api/wishlist');
        if (Array.isArray(wishlistItems)) {
          const validWishlistProducts = wishlistItems
            .filter(item => item && item.product)
            .map(item => item.product);
          useWishlistStore.getState().setWishlist(validWishlistProducts);
        }

        useToastStore.getState().showToast('Logged in successfully!');
        return user;
      } else {
        set({ token: null });
        useToastStore.getState().showToast('Failed to complete login.', 'error');
        return null;
      }
    } catch (error) {
      set({ token: null });
      console.error('Error completing token login:', error);
      useToastStore.getState().showToast('An unexpected error occurred. Please try again.', 'error');
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await AsyncStorage.removeItem('user_token');
      await AsyncStorage.removeItem('user_data');
      useWishlistStore.getState().setWishlist([]);
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    } catch (error) {
      console.error('Error logging out:', error);
      set({ isLoading: false });
    }
  },

  loadUser: async () => {
    // ponytail: mobile hydrates via loginWithToken after OAuth redirect
  },

  updateUser: async (user) => {
    set({ user });
    await AsyncStorage.setItem('user_data', JSON.stringify(user));
  },
}));
