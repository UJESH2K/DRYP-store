/**
 * Centralized app configuration.
 *
 * Import this module everywhere instead of reaching for process.env directly.
 * This gives us ONE fallback line and ONE place to manage environment logic.
 */
import { Platform } from 'react-native';

const IS_SIMULATOR =
  typeof Platform !== 'undefined' && Platform.OS === 'ios' && typeof __DEV__ !== 'undefined';

export const API_BASE_URL: string = IS_SIMULATOR
  ? 'http://10.213.145.26:8083'
  : process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8083';

export const SUPABASE_URL: string =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ztxryljoqcsvjqwmdvnm.supabase.co';

export const SUPABASE_ANON_KEY: string =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
