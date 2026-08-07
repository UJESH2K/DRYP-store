/**
 * Centralized app configuration.
 *
 * Import this module everywhere instead of reaching for process.env directly.
 * This gives us ONE fallback line and ONE place to manage environment logic.
 */

// Backend runs on port 8083 (NOT 8080/8081). Metro uses 8081, backend uses 8083
// so they don't collide. The fallback below only kicks in for Metro dev runs
// where EXPO_PUBLIC_API_BASE_URL is unset; EAS builds bake the env at build
// time, so this fallback must never run in a TestFlight install.
const IS_SIMULATOR =
  typeof Platform !== 'undefined' && Platform.OS === 'ios' && typeof __DEV__ !== 'undefined';

// In simulator we point at the Mac's LAN IP (NOT localhost — the sim's
// localhost is itself, not the host). On a real device or EAS build,
// EXPO_PUBLIC_API_BASE_URL is baked at build time.
export const API_BASE_URL: string = IS_SIMULATOR
  ? 'http://10.213.145.26:8083'
  : process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8083';

export const SUPABASE_URL: string =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ztxryljoqcsvjqwmdvnm.supabase.co';

export const SUPABASE_ANON_KEY: string =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
