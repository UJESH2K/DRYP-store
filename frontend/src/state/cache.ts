import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type CacheState = {
  categories: { data: string[], timestamp: number | null };
  brands: { data: string[], timestamp: number | null };
  recentSearches: { query: string; image: string }[];
  setCategories: (data: string[]) => void;
  setBrands: (data: string[]) => void;
  setRecentSearches: (searches: { query: string; image: string }[]) => void;
};

export const useCacheStore = create<CacheState>()(
  persist(
    (set) => ({
      categories: { data: [], timestamp: null },
      brands: { data: [], timestamp: null },
      recentSearches: [],
      setCategories: (data) => set({ categories: { data, timestamp: Date.now() } }),
      setBrands: (data) => set({ brands: { data, timestamp: Date.now() } }),
      setRecentSearches: (searches) => set({ recentSearches: searches }),
    }),
    {
      name: 'api-cache-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
