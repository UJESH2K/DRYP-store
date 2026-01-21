import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import { apiCall } from '../lib/api'; // REMOVED to break cycle
import { useToastStore } from './toast';
import { useWishlistStore } from './wishlist'; // Import the wishlist store

// This should match the User model from the backend
export interface User {
  _id: string;
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
  token: string | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  guestId: string | null;
  isLoading: boolean;
  // Actions
  initGuestUser: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<User | null>;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  updateUser: (user: User) => Promise<void>;
}

const generateGuestId = () => `guest_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
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
  
  logout: async () => {
    set({ isLoading: true });
    try {
      await AsyncStorage.removeItem('user_token');
      await AsyncStorage.removeItem('user_data');
      useWishlistStore.getState().setWishlist([]);
      // Instead of clearing everything, initialize a new guest session
      await get().initGuestUser();
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  loadUser: async () => {
    const { apiCall } = require('../lib/api'); // LAZY REQUIRE
    set({ isLoading: true });
    try {
      const token = await AsyncStorage.getItem('user_token');
      const userData = await AsyncStorage.getItem('user_data');
      if (token && userData) {
        const user = JSON.parse(userData);
        set({ user, token, isAuthenticated: true, isGuest: false, guestId: null });
        
        const wishlistItems = await apiCall('/api/wishlist');
        if (Array.isArray(wishlistItems)) {
          const validWishlistProducts = wishlistItems
            .filter(item => item && item.product)
            .map(item => item.product);
          useWishlistStore.getState().setWishlist(validWishlistProducts);
        }
      } else {
        await get().initGuestUser();
      }
    } catch (error) {
      console.error('Error loading user:', error);
      await get().initGuestUser(); // Fallback to guest session on error
    } finally {
      set({ isLoading: false });
    }
  },

  updateUser: async (user: User) => {
    set({ user });
    await AsyncStorage.setItem('user_data', JSON.stringify(user));
  },
}));