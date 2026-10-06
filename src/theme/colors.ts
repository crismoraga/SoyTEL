// Paleta oficial Telemática USM (hojas de marca en assets/ y Claude Design), con tema claro y oscuro.
//
// Hay dos familias de colores:
// - De marca (fijos): azul noche, celeste, crema, estados. No cambian con el tema.
// - De superficie (cambian): fondos de pantalla y tarjetas, bordes y el texto que va sobre ellos
//   (`ink`, `inkSoft`, `inkAccent`). Regla: sobre una superficie del tema se escribe con `ink*`;
//   sobre un relleno de marca (crema, celeste, color de pilar) se escribe con `primary`/`secondary`.

export type ThemeName = 'light' | 'dark';

const brand = {
  primary: '#0B2D45',
  primarySoft: '#123D5C',
  primaryDeep: '#071F31',
  primaryInput: '#0F3A58',
  secondary: '#1E5B7F',
  accent: '#6FB3D9',
  accentSoft: '#A7D4ED',
  cream: '#F4ECD7',
  creamSoft: '#FBF6E9',
  creamShade: '#E6D9B8',
  slate: '#8CA3B4',
  muted: '#5E6F7E',
  onDark: '#D6E2EC',
  success: '#2E7D5B',
  warning: '#D4A017',
  danger: '#C73E3E',
  info: '#3B82F6',
  white: '#FFFFFF',
  black: '#000000',
};

const lightSurface = {
  paper: '#F8FBFF',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF4FA',
  border: '#D6E2EC',
  borderStrong: '#C5D5E2',
  highlight: '#DCEBF6',
  // Texto sobre superficies del tema.
  ink: '#0B2D45',
  inkSoft: '#5E6F7E',
  inkAccent: '#1E5B7F',
  // Estados suaves (fondo + texto van siempre en pareja).
  successSoft: '#E3F1EA',
  successInk: '#1F5E43',
  warningSoft: '#FBF1D6',
  warningInk: '#6B5320',
  dangerSoft: '#FBEAEA',
  dangerInk: '#8E2B2B',
  // Acción principal (botón primario, pestaña activa, chip seleccionado) y su texto.
  action: '#0B2D45',
  actionInk: '#F4ECD7',
  overlay: 'rgba(11, 45, 69, 0.68)',
};

const darkSurface: typeof lightSurface = {
  paper: '#061724',
  surface: '#0E2A3F',
  surfaceAlt: '#153850',
  border: '#22495F',
  borderStrong: '#2F5F7C',
  highlight: '#18425D',
  ink: '#EAF2F9',
  inkSoft: '#9DB2C3',
  inkAccent: '#8FC6E8',
  successSoft: '#11382B',
  successInk: '#93DDB9',
  warningSoft: '#3A3010',
  warningInk: '#EFD58B',
  dangerSoft: '#3F191A',
  dangerInk: '#F3ABAB',
  action: '#6FB3D9',
  actionInk: '#0B2D45',
  overlay: 'rgba(2, 10, 18, 0.74)',
};

export const palettes: Record<ThemeName, typeof brand & typeof lightSurface> = {
  light: { ...brand, ...lightSurface },
  dark: { ...brand, ...darkSurface },
};

export type ColorToken = keyof typeof brand | keyof typeof lightSurface;

// Objeto vivo: `applyTheme` lo muta al arrancar (antes de que se creen los estilos), así todos los
// StyleSheet.create de la app leen ya el tema elegido. Cambiar de tema reinicia la interfaz.
export const colors: Record<ColorToken, string> = { ...palettes.light };

let activeTheme: ThemeName = 'light';

export function applyTheme(theme: ThemeName): void {
  activeTheme = theme;
  Object.assign(colors, palettes[theme]);
  Object.assign(gradients, buildGradients());
}

export function currentTheme(): ThemeName {
  return activeTheme;
}

export function isDarkTheme(): boolean {
  return activeTheme === 'dark';
}

export type Tier = 'bronce' | 'plata' | 'oro' | 'platino';

// Anillo de medallas por rareza: [claro, medio, oscuro].
export const tierColors: Record<Tier, { ring: [string, string, string]; label: string; ink: string }> = {
  bronce: { ring: ['#E8B98F', '#B7794A', '#7F4D2B'], label: 'Bronce', ink: '#7F4D2B' },
  plata: { ring: ['#EEF3F7', '#AFC0CD', '#71869A'], label: 'Plata', ink: '#51677B' },
  oro: { ring: ['#FBE3A1', '#DDAE3E', '#9C7418'], label: 'Oro', ink: '#8A6512' },
  platino: { ring: ['#E4F3FC', '#9FD2EE', '#4F97C2'], label: 'Platino', ink: '#2F6F95' },
};

function buildGradients() {
  return {
    night: [colors.primary, colors.primarySoft] as [string, string],
    deep: [colors.primaryDeep, colors.primary] as [string, string],
    accent: [colors.secondary, colors.accent] as [string, string],
    hero: [colors.primary, colors.secondary, colors.accent] as [string, string, string],
    paper: [colors.paper, colors.surfaceAlt] as [string, string],
  };
}

export const gradients = buildGradients();
