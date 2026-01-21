/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Gen Z Light Theme
        'light-bg': '#FFFFFF',
        'light-surface': '#FFFFFF',
        'light-surface-alt': '#F8F9FA',
        'light-text': '#000000',
        'light-text-secondary': '#6B7280',
        'light-border': '#E5E7EB',
        'light-accent': '#000000',
        
        // Gen Z Dark Theme
        'dark-bg': '#000000',
        'dark-surface': '#000000',
        'dark-surface-alt': '#111111',
        'dark-text': '#FFFFFF',
        'dark-text-secondary': '#A1A1AA',
        'dark-border': '#27272A',
        'dark-accent': '#FFFFFF',
        
        // Semantic colors
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl': '16px',
        '2xl': '20px',
        '3xl': '24px',
      },
      boxShadow: {
        'genz': '0 4px 20px rgba(0, 0, 0, 0.08)',
        'genz-dark': '0 4px 20px rgba(255, 255, 255, 0.05)',
      },
    },
  },
  plugins: [],
}