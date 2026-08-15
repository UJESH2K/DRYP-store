export type Theme = 'light' | 'dark'

export const themes = {
  light: {
    // Gen Z Light Theme - Clean, high contrast
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceAlt: '#F8F9FA',
    surfaceElevated: '#FFFFFF',
    text: '#000000',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    border: '#E5E7EB',
    borderStrong: '#D1D5DB',
    accent: '#000000',
    accentSecondary: '#374151',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    shadow: 'rgba(0, 0, 0, 0.1)',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  dark: {
    // Gen Z Dark Theme - Pure black with white accents
    background: '#000000',
    surface: '#000000',
    surfaceAlt: '#111111',
    surfaceElevated: '#1A1A1A',
    text: '#FFFFFF',
    textSecondary: '#A1A1AA',
    textMuted: '#71717A',
    border: '#27272A',
    borderStrong: '#3F3F46',
    accent: '#FFFFFF',
    accentSecondary: '#D4D4D8',
    success: '#22C55E',
    warning: '#EAB308',
    error: '#F87171',
    shadow: 'rgba(255, 255, 255, 0.1)',
    overlay: 'rgba(0, 0, 0, 0.8)',
  },
}

export const getTheme = (theme: Theme) => themes[theme]
