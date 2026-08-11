/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0B0E14',
          card: '#121824',
          border: '#1E2638',
          hover: '#192030',
          accent: '#26324A',
        },
        gold: {
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
        },
        brand: {
          primary: '#3B82F6',
          secondary: '#8B5CF6',
          emerald: '#10B981',
          rose: '#F43F5E',
          amber: '#F59E0B',
          cyan: '#06B6D4',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow-primary': '0 0 20px -5px rgba(59, 130, 246, 0.5)',
        'glow-gold': '0 0 20px -5px rgba(245, 158, 11, 0.5)',
        'glow-emerald': '0 0 20px -5px rgba(16, 185, 129, 0.5)',
        'glow-purple': '0 0 20px -5px rgba(139, 92, 246, 0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
