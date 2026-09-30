export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  gutter: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
  pill: 999,
} as const;

// Área táctil mínima recomendada (iOS HIG 44pt / Material 48dp).
export const touch = {
  min: 44,
  comfortable: 52,
} as const;
