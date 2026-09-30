// Paleta oficial Telemática USM (hojas de marca en assets/ y export de Claude Design).
export const colors = {
  primary: '#0B2D45',
  primarySoft: '#123D5C',
  primaryDeep: '#071F31',
  primaryInput: '#0F3A58',
  secondary: '#1E5B7F',
  accent: '#6FB3D9',
  accentSoft: '#A7D4ED',
  highlight: '#DCEBF6',
  cream: '#F4ECD7',
  creamSoft: '#FBF6E9',
  creamShade: '#E6D9B8',
  slate: '#8CA3B4',
  paper: '#F8FBFF',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF4FA',
  border: '#D6E2EC',
  borderStrong: '#C5D5E2',
  ink: '#0B2D45',
  muted: '#5E6F7E',
  onDark: '#D6E2EC',
  success: '#2E7D5B',
  successSoft: '#E3F1EA',
  successInk: '#1F5E43',
  warning: '#D4A017',
  warningSoft: '#FBF1D6',
  warningInk: '#6B5320',
  danger: '#C73E3E',
  dangerSoft: '#FBEAEA',
  dangerInk: '#8E2B2B',
  info: '#3B82F6',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(11, 45, 69, 0.68)',
} as const;

export type ColorToken = keyof typeof colors;

export type Tier = 'bronce' | 'plata' | 'oro' | 'platino';

// Anillo de medallas por rareza: [claro, medio, oscuro].
export const tierColors: Record<Tier, { ring: [string, string, string]; label: string; ink: string }> = {
  bronce: { ring: ['#E8B98F', '#B7794A', '#7F4D2B'], label: 'Bronce', ink: '#7F4D2B' },
  plata: { ring: ['#EEF3F7', '#AFC0CD', '#71869A'], label: 'Plata', ink: '#51677B' },
  oro: { ring: ['#FBE3A1', '#DDAE3E', '#9C7418'], label: 'Oro', ink: '#8A6512' },
  platino: { ring: ['#E4F3FC', '#9FD2EE', '#4F97C2'], label: 'Platino', ink: '#2F6F95' },
};

export const gradients = {
  night: [colors.primary, colors.primarySoft] as const,
  deep: [colors.primaryDeep, colors.primary] as const,
  accent: [colors.secondary, colors.accent] as const,
  hero: [colors.primary, colors.secondary, colors.accent] as const,
  paper: [colors.paper, colors.surfaceAlt] as const,
};
