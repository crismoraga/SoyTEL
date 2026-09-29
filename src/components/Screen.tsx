import type { PropsWithChildren, ReactElement, ReactNode, RefObject } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
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
  keyboard = false,
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

  const wrapped = keyboard ? (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {body}
      {footer}
    </KeyboardAvoidingView>
  ) : (
    <>
      {body}
      {footer}
    </>
  );

  if (isDark) {
    return (
      <LinearGradient colors={[colors.primary, colors.primarySoft]} style={styles.flex}>
        <BrandBackdrop variant={backdrop ?? 'stars'} />
        {wrapped}
      </LinearGradient>
    );
  }

  return <View style={[styles.flex, styles.light]}>{wrapped}</View>;
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
