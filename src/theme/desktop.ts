import { spacing } from './spacing';
import { typography } from './typography';

// Tokens exclusivos de web de escritorio; las escalas existentes quedan intactas.
export const desktopLayout = {
  breakpoint: 1024,
  gutter: spacing.xl,
  tabBarWidth: 800,
  buttonWidth: 360,
  routeSidebarWidth: 320,
  routeAvatarColumns: 7,
  routeTempleWidth: 400,
} as const;

export const desktopWidths = {
  content: 1200,
  form: 680,
  wide: 1440,
  route: 1000,
  routeGame: 1200,
  // Los juegos sin scroll conservan todo el espacio que miden sus tableros.
  full: undefined,
} as const;

export type DesktopWidth = keyof typeof desktopWidths;

export const desktopTypography = {
  headerTitle: {
    fontSize: typography.hero.fontSize,
    lineHeight: typography.hero.lineHeight,
    letterSpacing: typography.hero.letterSpacing,
  },
  headerSubtitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  tabLabel: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
  },
} as const;
