/**
 * Centralized app configuration.
 *
 * Import this module everywhere instead of reaching for process.env directly.
 * This gives us ONE fallback line and ONE place to manage environment logic.
 */

export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.dryp.store';
