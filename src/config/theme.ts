// ============================================================
// SCHOOL CONNECT DESIGN SYSTEM TOKENS
// ============================================================

export const theme = {
  colors: {
    background: '#F7F8FC',
    surface: '#FFFFFF',
    surfaceSoft: '#FAFBFF',
    surfaceHover: '#F3F5FC',

    textPrimary: '#1F2937',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    border: '#E8EAF0',

    primary: '#6675E8',
    primarySoft: '#EEF0FF',
    primaryHover: '#5463DA',

    pastelBlue: '#BFD7FF',
    pastelBlueSoft: '#F0F5FF',
    pastelPurple: '#D9C8FF',
    pastelPurpleSoft: '#F6F2FF',
    pastelLavender: '#E8DFFF',
    pastelPink: '#F7C7D9',
    pastelPinkSoft: '#FFF0F5',
    pastelRose: '#FADBE5',
    pastelYellow: '#F8DFA3',
    pastelYellowSoft: '#FFF9EB',
    pastelPeach: '#FFD9B8',
    pastelGreen: '#BFE8D5',
    pastelGreenSoft: '#F0FAF5',
    pastelMint: '#CDEFE1',
  },

  radius: {
    xs: '6px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    full: '9999px',
  },

  shadow: {
    sm: '0 1px 3px 0 rgba(31, 41, 55, 0.03)',
    card: '0 4px 16px -2px rgba(31, 41, 55, 0.04)',
    cardHover: '0 12px 28px -4px rgba(102, 117, 232, 0.12)',
    floating: '0 20px 40px -8px rgba(31, 41, 55, 0.12)',
  },

  animation: {
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
  },
} as const

export type Theme = typeof theme
