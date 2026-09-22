import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors, radius, spacing } from '@/theme';

interface TelCardProps extends ViewProps {
  tone?: 'light' | 'dark' | 'accent' | 'cream';
}

export function TelCard({ tone = 'light', style, children, ...props }: PropsWithChildren<TelCardProps>) {
  return (
    <View {...props} style={[styles.base, styles[tone], style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  light: {
    backgroundColor: colors.white,
  },
  dark: {
    backgroundColor: colors.primarySoft,
  },
  accent: {
    backgroundColor: colors.accentSoft,
  },
  cream: {
    backgroundColor: colors.cream,
  },
});
