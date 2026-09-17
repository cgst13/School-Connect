/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Global Neumorphic Soft 3D Pastel Palette
        sc: {
          bg: 'var(--sc-background)',
          surface: 'var(--sc-surface)',
          'surface-neu': 'var(--sc-surface-neu)',
          'surface-soft': 'var(--sc-surface-soft)',
          'surface-hover': 'var(--sc-surface-hover)',
          text: 'var(--sc-text-primary)',
          'text-muted': 'var(--sc-text-secondary)',
          border: 'var(--sc-border)',

          primary: 'var(--sc-primary)',
          'primary-soft': 'var(--sc-primary-soft)',
          'primary-hover': 'var(--sc-primary-hover)',

          'pastel-purple': 'var(--sc-pastel-purple)',
          'pastel-purple-soft': 'var(--sc-pastel-purple-soft)',
          'pastel-blue': 'var(--sc-pastel-blue)',
          'pastel-blue-soft': 'var(--sc-pastel-blue-soft)',
          'pastel-green': 'var(--sc-pastel-green)',
          'pastel-green-soft': 'var(--sc-pastel-green-soft)',
          'pastel-yellow': 'var(--sc-pastel-yellow)',
          'pastel-yellow-soft': 'var(--sc-pastel-yellow-soft)',
          'pastel-pink': 'var(--sc-pastel-pink)',
          'pastel-pink-soft': 'var(--sc-pastel-pink-soft)',
        },

        // Legacy compatibility
        deped: {
          blue: '#6675E8',
          'blue-accent': '#6675E8',
          'blue-light': '#EEF0FF',
          'blue-mid': '#5463DA',
          'blue-dark': '#1F2937',
          gold: '#FCD34D',
          'gold-light': '#FFFBEB',
          red: '#FCA5A5',
          'red-light': '#FEF2F2',
          green: '#6EE7B7',
          'green-light': '#ECFDF5',
        },
        sidebar: {
          bg: '#EFF3F9',
          border: 'transparent',
          hover: '#FFFFFF',
          active: '#FFFFFF',
          text: '#64748B',
          'text-active': '#6675E8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'neu-out-sm': 'var(--sc-neu-out-sm)',
        'neu-out': 'var(--sc-neu-out)',
        'neu-out-lg': 'var(--sc-neu-out-lg)',
        'neu-in': 'var(--sc-neu-in)',
        'neu-in-deep': 'var(--sc-neu-in-deep)',
        'neu-btn': 'var(--sc-neu-btn)',
        card: 'var(--sc-neu-out)',
        floating: 'var(--sc-neu-out-lg)',
      },
      borderRadius: {
        DEFAULT: '16px',
        sm: '12px',
        md: '16px',
        lg: '20px',
        xl: '24px',
        '2xl': '28px',
        '3xl': '32px',
        '4xl': '36px',
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
