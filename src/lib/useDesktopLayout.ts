import { createContext, useContext } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { desktopLayout, desktopWidths, type DesktopWidth } from '@/theme/desktop';
import { spacing } from '@/theme/spacing';

export const DesktopWidthContext = createContext<DesktopWidth>('content');

// Única condición de activación. El contexto alinea contenido, cabecera y pie
// sin agregar contenedores a la vista móvil ni consultar rutas de navegación.
export function useDesktopLayout(widthOverride?: DesktopWidth) {
  const { width } = useWindowDimensions();
  const inheritedWidth = useContext(DesktopWidthContext);
  const frame = widthOverride ?? inheritedWidth;
  const maxWidth = desktopWidths[frame];
  const gutter = frame === 'full' ? spacing.md : desktopLayout.gutter;

  return {
    isDesktop: Platform.OS === 'web' && width >= desktopLayout.breakpoint,
    maxWidth,
    gutter,
    inset: Math.max(gutter, (width - (maxWidth ?? width)) / 2 + gutter),
  };
}
