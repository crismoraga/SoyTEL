export const colors = {
  primary: '#0B2D45',
  primarySoft: '#123F5F',
  secondary: '#1E5B7F',
  accent: '#6FB3D9',
  accentSoft: '#A7D4ED',
  cream: '#F4ECD7',
  paper: '#FAF9F5',
  ink: '#1F1E1D',
  muted: '#66717C',
  success: '#38A169',
  warning: '#D69E2E',
  danger: '#E53E3E',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(11, 45, 69, 0.68)',
} as const;

export type ColorToken = keyof typeof colors;
