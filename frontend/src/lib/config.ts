/**
 * Centralized app configuration.
 *
 * Import this module everywhere instead of reaching for process.env directly.
 * This gives us ONE fallback line and ONE place to manage environment logic.
 */

// In development the Metro bundler inlines EXPO_PUBLIC_* at bundle time.
// In production (EAS Build) they are baked in at build time.
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8080';

export const SUPABASE_URL: string =
  process.env.EXPO_PUBLIC_SUPABASE_URL || '';

export const SUPABASE_ANON_KEY: string =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
