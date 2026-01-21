import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SettingsState = {
  currency: string;
  setCurrency: (currency: string) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      currency: 'USD', // Default currency
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
