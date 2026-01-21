import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Theme, getTheme } from '../lib/theme'

interface ThemeStore {
  theme: Theme
  colors: ReturnType<typeof getTheme>
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      colors: getTheme('dark'),
      toggleTheme: () => {
        const newTheme = get().theme === 'light' ? 'dark' : 'light'
        set({
          theme: newTheme,
          colors: getTheme(newTheme),
        })
      },
      setTheme: (theme: Theme) => {
        set({
          theme,
          colors: getTheme(theme),
        })
      },
    }),
    {
      name: 'theme-storage',
      storage: {
        getItem: async (name: string) => {
          const value = await AsyncStorage.getItem(name)
          return value ? JSON.parse(value) : null
        },
        setItem: async (name: string, value: any) => {
          await AsyncStorage.setItem(name, JSON.stringify(value))
        },
        removeItem: async (name: string) => {
          await AsyncStorage.removeItem(name)
        },
      },
    }
  )
)
