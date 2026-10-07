/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Minimalist Royal Blue CRM Dashboard Palette
        sc: {
          bg: 'var(--sc-background)',
          surface: 'var(--sc-surface)',
          'surface-neu': 'var(--sc-surface)',
          'surface-soft': 'var(--sc-surface-soft)',
          'surface-hover': 'var(--sc-surface-hover)',
          text: 'var(--sc-text-primary)',
          'text-muted': 'var(--sc-text-secondary)',
          border: 'var(--sc-border)',

          primary: '#2563EB',
          'primary-soft': '#EFF6FF',
          'primary-hover': '#1D4ED8',
          'primary-active': '#1E40AF',

          'pastel-purple': '#8B5CF6',
          'pastel-purple-soft': '#F3E8FF',
          'pastel-blue': '#2563EB',
          'pastel-blue-soft': '#EFF6FF',
          'pastel-green': '#10B981',
          'pastel-green-soft': '#ECFDF5',
          'pastel-yellow': '#F59E0B',
          'pastel-yellow-soft': '#FEF3C7',
          'pastel-pink': '#EC4899',
          'pastel-pink-soft': '#FCE7F3',
        },

        // Legacy compatibility & system palette
        deped: {
          blue: '#2563EB',
          'blue-accent': '#2563EB',
          'blue-light': '#EFF6FF',
          'blue-mid': '#1D4ED8',
          'blue-dark': '#0F172A',
          gold: '#F59E0B',
          'gold-light': '#FEF3C7',
          red: '#EF4444',
          'red-light': '#FEF2F2',
          green: '#10B981',
          'green-light': '#ECFDF5',
        },
        sidebar: {
          bg: '#FFFFFF',
          border: '#E5E7EB',
          hover: '#F3F4F6',
          active: '#EFF6FF',
          text: '#64748B',
          'text-active': '#2563EB',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'neu-out-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'neu-out': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'neu-out-lg': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        'neu-in': 'inset 0 1px 2px rgba(0, 0, 0, 0.04)',
        'neu-in-deep': 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
        'neu-btn': '0 1px 2px rgba(37, 99, 235, 0.2)',
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
        floating: '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04)',
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
        '2xl': '14px',
        '3xl': '16px',
        '4xl': '18px',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out forwards',
        'scale-up': 'scaleUp 200ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'slide-down': 'slideDown 250ms ease-out forwards',
        'pulse-subtle': 'pulseSubtle 2s infinite ease-in-out',
        'genie-expand': 'genieExpand 520ms cubic-bezier(0.22, 1.25, 0.36, 1) forwards',
        'button-sparkle': 'buttonSparkle 400ms cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleUp: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        genieExpand: {
          '0%': {
            opacity: '0.05',
            transform: 'translate(var(--genie-origin-x, 0px), var(--genie-origin-y, 0px)) scale(0.12) rotate(-3deg)',
            filter: 'blur(8px)',
            borderRadius: '48px',
          },
          '45%': {
            opacity: '1',
            transform: 'translate(calc(var(--genie-origin-x, 0px) * 0.12), calc(var(--genie-origin-y, 0px) * 0.12)) scale(1.06) rotate(1deg)',
            filter: 'blur(0px)',
            borderRadius: '32px',
          },
          '75%': {
            transform: 'translate(0px, 0px) scale(0.985) rotate(-0.5deg)',
            borderRadius: '28px',
          },
          '100%': {
            opacity: '1',
            transform: 'translate(0px, 0px) scale(1) rotate(0deg)',
            filter: 'blur(0px)',
            borderRadius: '28px',
          },
        },
        buttonSparkle: {
          '0%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(102, 117, 232, 0.7)' },
          '50%': { transform: 'scale(0.93)', boxShadow: '0 0 0 14px rgba(102, 117, 232, 0)' },
          '100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(102, 117, 232, 0)' },
        },
      },
    },
  },
  plugins: [],
}
