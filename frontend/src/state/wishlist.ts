import { create } from 'zustand';
// import { apiCall } from '../lib/api'; // REMOVED to break cycle
import { Product } from '../types'; // Assuming you have a Product type defined

interface WishlistItem extends Product {}

interface WishlistState {
  items: WishlistItem[];
  setWishlist: (items: WishlistItem[]) => void;
  addToWishlist: (product: Product) => Promise<void>;
  removeFromWishlist: (productId: string) => Promise<void>;
  isWishlisted: (productId: string) => boolean;
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  items: [],
  setWishlist: (items) => set({ items }),
  addToWishlist: async (product) => {
    try {
      const { apiCall } = require('../lib/api'); // LAZY REQUIRE
      const existingItem = get().items.find(item => item._id === product._id);
      if (existingItem) return; // Don't add if it's already there

      set(state => ({ items: [...state.items, product] }));
      await apiCall(`/api/wishlist/${product._id}`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Failed to add item to wishlist:', error);
      // Revert state on failure
      set(state => ({ items: state.items.filter(item => item._id !== product._id) }));
    }
  },
  removeFromWishlist: async (productId) => {
    const { apiCall } = require('../lib/api'); // LAZY REQUIRE
    const originalItems = get().items;
    try {
      set(state => ({ items: state.items.filter(item => item._id !== productId) }));
      await apiCall(`/api/wishlist/${productId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Failed to remove item from wishlist:', error);
      // Revert state on failure
      set({ items: originalItems });
    }
  },
  isWishlisted: (productId) => {
    return get().items.some(item => item._id === productId);
  },
}));
