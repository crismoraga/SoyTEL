import { useRef, useState, type PropsWithChildren, type ReactElement, type ReactNode, type RefObject } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing } from '@/theme';
import { BrandBackdrop, type BackdropVariant } from './graphics/BrandBackdrop';

interface ScreenProps {
  tone?: 'light' | 'dark';
  // Alias histórico de tone="dark".
  dark?: boolean;
  scroll?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  backdrop?: BackdropVariant;
  padded?: boolean;
  keyboard?: boolean;
  // Dentro de las pestañas la barra inferior ya respeta el área segura.
  inTabs?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: ReactElement<RefreshControlProps>;
  scrollRef?: RefObject<ScrollView | null>;
}

export function Screen({
  tone,
  dark = false,
  scroll = true,
  header,
  footer,
  backdrop,
  padded = true,
  keyboard = true,
  inTabs = false,
  contentStyle,
  refreshControl,
  scrollRef,
  children,
}: PropsWithChildren<ScreenProps>) {
  const insets = useSafeAreaInsets();
  const isDark = (tone ?? (dark ? 'dark' : 'light')) === 'dark';
  const topInset = header ? 0 : insets.top;
  const bottomInset = footer || inTabs ? 0 : insets.bottom;
  // Al desplazar, el contenido pasaría por debajo de la barra de estado (la app dibuja de borde a
  // borde): una franja azul noche la mantiene legible en ambos temas.
  const [scrolled, setScrolled] = useState(false);
  const scrolledRef = useRef(false);

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = event.nativeEvent.contentOffset.y > 6;
    if (next === scrolledRef.current) return;
    scrolledRef.current = next;
    setScrolled(next);
  }

  const content = (
    <View
      style={[
        styles.content,
        padded && styles.padded,
        { paddingTop: (padded ? spacing.gutter : 0) + topInset, paddingBottom: (padded ? spacing.xl : 0) + bottomInset },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      style={styles.flex}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
      onScroll={insets.top > 0 ? onScroll : undefined}
      scrollEventThrottle={48}
    >
      {header}
      {content}
    </ScrollView>
  ) : (
    <View style={styles.flex}>
      {header}
      {content}
    </View>
  );

  // En Android de borde a borde la ventana ya no se encoge con el teclado: el relleno deja a la
  // vista el campo que se está escribiendo (y no agrega nada si la ventana sí se encogió).
  const wrapped = keyboard ? (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      {body}
      {footer}
    </KeyboardAvoidingView>
  ) : (
    <>
      {body}
      {footer}
    </>
  );
  const scrim = scroll && scrolled ? <View pointerEvents="none" style={[styles.statusScrim, { height: insets.top }]} /> : null;

  if (isDark) {
    return (
      <LinearGradient colors={[colors.primary, colors.primarySoft]} style={styles.flex}>
        <BrandBackdrop variant={backdrop ?? 'stars'} />
        {wrapped}
        {scrim}
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.flex, styles.light]}>
      {wrapped}
      {scrim}
    </View>
  );
}

// Barra inferior fija (acciones principales), como la de "Reto de estación".
export function ScreenFooter({ children, tone = 'light' }: PropsWithChildren<{ tone?: 'light' | 'dark' }>) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.footer,
        tone === 'dark' ? styles.footerDark : styles.footerLight,
        { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.xs },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  light: {
    backgroundColor: colors.paper,
  },
  scrollContent: {
    flexGrow: 1,
  },
  statusScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.primary,
  },
  content: {
    flexGrow: 1,
    gap: spacing.md,
  },
  padded: {
    paddingHorizontal: spacing.md,
  },
  footer: {
    paddingTop: 14,
    paddingHorizontal: spacing.gutter,
    gap: spacing.sm,
  },
  footerLight: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerDark: {
    backgroundColor: colors.primary,
    borderTopWidth: 1,
    borderTopColor: 'rgba(167, 212, 237, 0.15)',
  },
});
