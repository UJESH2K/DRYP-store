import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import { apiCall } from '../lib/api'; // REMOVED to break cycle
import { Product } from '../types'; // Assuming you have a Product type defined

interface WishlistItem extends Product {}

interface WishlistState {
  items: WishlistItem[];
  hydrated: boolean;
  setWishlist: (items: WishlistItem[]) => void;
  hydrate: () => Promise<void>;
  addToWishlist: (product: Product) => Promise<void>;
  removeFromWishlist: (productId: string) => Promise<void>;
  isWishlisted: (productId: string) => boolean;
}

const STORAGE_KEY = 'dryp:wishlist';

export const useWishlistStore = create<WishlistState>((set, get) => ({
  items: [],
  hydrated: false,
  setWishlist: (items) => {
    set({ items });
    // Persist asynchronously. Failure here is non-fatal: the next
    // hydration will reconcile with the server.
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch((e) => {
      if (__DEV__) console.warn('wishlist persist failed', e);
    });
  },
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          set({ items: parsed, hydrated: true });
          return;
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('wishlist hydrate failed', e);
    }
    set({ hydrated: true });
  },
  addToWishlist: async (product) => {
    try {
      const { apiCall } = require('../lib/api'); // LAZY REQUIRE
      const existingItem = get().items.find(item => item._id === product._id);
      if (existingItem) return; // Don't add if it's already there

      const next = [...get().items, product];
      set({ items: next });
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((e) => {
        if (__DEV__) console.warn('wishlist persist failed', e);
      });
      await apiCall(`/api/wishlist/${product._id}`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Failed to add item to wishlist:', error);
      // Revert state on failure
      const reverted = get().items.filter(item => item._id !== product._id);
      set({ items: reverted });
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reverted)).catch((e) => {
        if (__DEV__) console.warn('wishlist persist failed', e);
      });
    }
  },
  removeFromWishlist: async (productId) => {
    const { apiCall } = require('../lib/api'); // LAZY REQUIRE
    const originalItems = get().items;
    try {
      const next = originalItems.filter(item => item._id !== productId);
      set({ items: next });
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((e) => {
        if (__DEV__) console.warn('wishlist persist failed', e);
      });
      await apiCall(`/api/wishlist/${productId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Failed to remove item from wishlist:', error);
      // Revert state on failure
      set({ items: originalItems });
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(originalItems)).catch((e) => {
        if (__DEV__) console.warn('wishlist persist failed', e);
      });
    }
  },
  isWishlisted: (productId: string) => {
    return get().items.some(item => item._id === productId);
  },
}));
