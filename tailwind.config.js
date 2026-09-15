/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Institutional DepEd palette with modern desaturated shades
        deped: {
          blue: '#1a3a6e',
          'blue-accent': '#2563eb',
          'blue-light': '#eff6ff',
          'blue-mid': '#3b82f6',
          'blue-dark': '#0f2444',
          gold: '#d97706',
          'gold-light': '#fef3c7',
          red: '#dc2626',
          'red-light': '#fef2f2',
          green: '#16a34a',
          'green-light': '#f0fdf4',
        },
        sidebar: {
          bg: '#0f1f3e',
          border: 'rgba(255, 255, 255, 0.08)',
          hover: 'rgba(255, 255, 255, 0.06)',
          active: 'rgba(37, 99, 235, 0.25)',
          text: '#94a3b8',
          'text-active': '#ffffff',
        },
        // Surface colors - ultra crisp light design
        surface: {
          white: '#ffffff',
          light: '#f8fafc',
          soft: '#f1f5f9',
          border: '#e2e8f0',
          'border-light': '#f1f5f9',
        },
        // Text colors
        content: {
          primary: '#0f172a',
          secondary: '#475569',
          tertiary: '#94a3b8',
          inverse: '#ffffff',
        },
        // Status colors
        status: {
          submitted: '#eff6ff',
          'submitted-text': '#1d4ed8',
          reviewed: '#fef3c7',
          'reviewed-text': '#b45309',
          returned: '#fef2f2',
          'returned-text': '#b91c1c',
          finalized: '#f0fdf4',
          'finalized-text': '#15803d',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        card: '0 1px 2px 0 rgb(0 0 0 / 0.03), 0 1px 3px -1px rgb(0 0 0 / 0.05)',
        'card-md': '0 4px 12px -2px rgb(15 23 42 / 0.06), 0 2px 4px -2px rgb(15 23 42 / 0.04)',
        'card-lg': '0 12px 24px -4px rgb(15 23 42 / 0.08), 0 4px 8px -4px rgb(15 23 42 / 0.04)',
        focus: '0 0 0 3px rgb(37 99 235 / 0.15)',
        glow: '0 0 20px -5px rgb(37 99 235 / 0.2)',
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(-8px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
}
