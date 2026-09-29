import { Platform, type TextStyle } from 'react-native';

// Montserrat para títulos y Nunito Sans para texto, igual que las pantallas de Claude Design.
export const fontFamilies = {
  display: 'Montserrat_800ExtraBold',
  displayBold: 'Montserrat_700Bold',
  displaySemi: 'Montserrat_600SemiBold',
  body: 'NunitoSans_400Regular',
  bodySemi: 'NunitoSans_600SemiBold',
  bodyBold: 'NunitoSans_700Bold',
  bodyHeavy: 'NunitoSans_800ExtraBold',
} as const;

export type FontRole = keyof typeof fontFamilies;

const fallbackWeights: Record<FontRole, TextStyle['fontWeight']> = {
  display: '800',
  displayBold: '700',
  displaySemi: '600',
  body: '400',
  bodySemi: '600',
  bodyBold: '700',
  bodyHeavy: '800',
};

export const monoFamily = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

let fontsLoaded = false;

export function setFontsLoaded(value: boolean): void {
  fontsLoaded = value;
}

export function areFontsLoaded(): boolean {
  return fontsLoaded;
}

// Con fuentes propias no se debe mezclar fontWeight (Android sintetiza negritas);
// si la carga falla se usa la fuente del sistema con el peso equivalente.
export function font(role: FontRole): TextStyle {
  return fontsLoaded ? { fontFamily: fontFamilies[role] } : { fontWeight: fallbackWeights[role] };
}

interface TypeToken {
  fontSize: number;
  lineHeight: number;
  role: FontRole;
  letterSpacing?: number;
  textTransform?: TextStyle['textTransform'];
}

export const typography = {
  display: { fontSize: 44, lineHeight: 48, role: 'display', letterSpacing: -1.2 },
  hero: { fontSize: 32, lineHeight: 38, role: 'display', letterSpacing: -0.6 },
  title: { fontSize: 26, lineHeight: 32, role: 'display', letterSpacing: -0.3 },
  heading: { fontSize: 19, lineHeight: 25, role: 'display' },
  subtitle: { fontSize: 17, lineHeight: 23, role: 'displayBold' },
  body: { fontSize: 16, lineHeight: 24, role: 'body' },
  bodyStrong: { fontSize: 16, lineHeight: 24, role: 'bodyBold' },
  label: { fontSize: 14, lineHeight: 20, role: 'bodyBold' },
  caption: { fontSize: 13, lineHeight: 18, role: 'bodySemi' },
  small: { fontSize: 12, lineHeight: 16, role: 'bodyHeavy' },
  overline: { fontSize: 12, lineHeight: 16, role: 'displayBold', letterSpacing: 2.4, textTransform: 'uppercase' },
  button: { fontSize: 16, lineHeight: 20, role: 'displayBold' },
  number: { fontSize: 28, lineHeight: 32, role: 'display' },
} satisfies Record<string, TypeToken>;

export type TypeVariant = keyof typeof typography;

export function textStyle(variant: TypeVariant): TextStyle {
  const token: TypeToken = typography[variant];
  return {
    fontSize: token.fontSize,
    lineHeight: token.lineHeight,
    letterSpacing: token.letterSpacing,
    textTransform: token.textTransform,
    ...font(token.role),
  };
}
