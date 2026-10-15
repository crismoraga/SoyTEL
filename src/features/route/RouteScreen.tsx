import type { ComponentProps, PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { useDesktopLayout } from '@/lib/useDesktopLayout';
import { spacing } from '@/theme';
import { desktopLayout } from '@/theme/desktop';

// La ruta tiene pantallas de lectura y tableros: cada una conserva todo su alto
// disponible y recibe un ancho de escritorio acorde a su contenido.
export function RouteScreen({ desktopWidth, scroll = true, contentStyle, ...props }: ComponentProps<typeof Screen>) {
  const { isDesktop } = useDesktopLayout();
  return (
    <Screen
      {...props}
      scroll={scroll}
      desktopWidth={desktopWidth ?? (scroll ? 'route' : 'routeGame')}
      contentStyle={[isDesktop && scroll && styles.desktopContent, contentStyle]}
    />
  );
}

// La jerarquía permanece estable al redimensionar: no se remontan los juegos
// ni los campos. Bajo 1024 px se conserva la columna y su separación original.
export function RouteColumns({ children }: PropsWithChildren) {
  const { isDesktop } = useDesktopLayout();
  return <View style={[styles.stack, isDesktop && styles.desktopColumns]}>{children}</View>;
}

export function RoutePanel({ children, aside = false }: PropsWithChildren<{ aside?: boolean }>) {
  const { isDesktop } = useDesktopLayout();
  return <View style={[styles.stack, isDesktop && styles.desktopPanel, isDesktop && aside && styles.desktopAside]}>{children}</View>;
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  desktopContent: {
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  desktopColumns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  desktopPanel: {
    flex: 1,
    minWidth: 0,
    gap: spacing.lg,
  },
  desktopAside: {
    flexBasis: desktopLayout.routeSidebarWidth,
    flexGrow: 0,
    flexShrink: 0,
    width: desktopLayout.routeSidebarWidth,
  },
});
