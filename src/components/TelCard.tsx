import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { colors, radius, shadows, spacing } from '@/theme';
import { PressableScale } from './PressableScale';

export type CardTone = 'surface' | 'light' | 'alt' | 'dark' | 'navy' | 'accent' | 'cream' | 'success' | 'danger';

interface TelCardProps extends ViewProps {
  tone?: CardTone;
  elevated?: boolean;
  padded?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const toneStyles: Record<CardTone, ViewStyle> = {
  surface: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  light: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  alt: { backgroundColor: colors.surfaceAlt },
  dark: { backgroundColor: colors.primarySoft },
  navy: { backgroundColor: colors.primary },
  accent: { backgroundColor: colors.highlight },
  cream: { backgroundColor: colors.cream },
  success: { backgroundColor: colors.successSoft, borderColor: colors.success, borderWidth: 1 },
  danger: { backgroundColor: colors.dangerSoft, borderColor: colors.danger, borderWidth: 1 },
};

export function TelCard({
  tone = 'surface',
  elevated = false,
  padded = true,
  onPress,
  accessibilityLabel,
  style,
  children,
  ...props
}: PropsWithChildren<TelCardProps>) {
  const composed = [styles.base, padded && styles.padded, toneStyles[tone], elevated && shadows.card, style];
  if (onPress) {
    return (
      <PressableScale accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} scaleTo={0.98} haptic style={composed}>
        {children}
      </PressableScale>
    );
  }
  return (
    <View {...props} accessibilityLabel={accessibilityLabel} style={composed}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  padded: {
    padding: 18,
  },
});
