import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useEntering } from '@/lib/motion';
import { colors, radius, spacing, type ColorToken } from '@/theme';
import { Illustration, type IllustrationName } from './graphics/Illustration';
import { PressableScale } from './PressableScale';
import { TelButton } from './TelButton';
import { TelIcon, type IconName } from './TelIcon';
import { TelText } from './TelText';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'light' | 'dark';
}

export function SectionHeader({ title, subtitle, actionLabel, onAction, tone = 'light' }: SectionHeaderProps) {
  return (
    <View style={styles.section}>
      <View style={styles.flex}>
        <TelText variant="heading" color={tone === 'dark' ? 'cream' : 'primary'} accessibilityRole="header">
          {title}
        </TelText>
        {subtitle && (
          <TelText variant="caption" color={tone === 'dark' ? 'accentSoft' : 'muted'}>
            {subtitle}
          </TelText>
        )}
      </View>
      {actionLabel && onAction && (
        <PressableScale accessibilityRole="link" onPress={onAction} hitSlop={8}>
          <TelText variant="label" color={tone === 'dark' ? 'accent' : 'secondary'}>
            {actionLabel}
          </TelText>
        </PressableScale>
      )}
    </View>
  );
}

interface EmptyStateProps {
  illustration: IllustrationName;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'light' | 'dark';
}

export function EmptyState({ illustration, title, body, actionLabel, onAction, tone = 'light' }: EmptyStateProps) {
  const entering = useEntering();
  return (
    <Animated.View entering={entering.fade()} style={styles.empty}>
      <Illustration name={illustration} width={180} tone={tone} />
      <TelText variant="subtitle" color={tone === 'dark' ? 'cream' : 'primary'} align="center">
        {title}
      </TelText>
      <TelText variant="body" color={tone === 'dark' ? 'accentSoft' : 'muted'} align="center" style={styles.emptyBody}>
        {body}
      </TelText>
      {actionLabel && onAction && <TelButton label={actionLabel} variant={tone === 'dark' ? 'cream' : 'primary'} fullWidth={false} onPress={onAction} />}
    </Animated.View>
  );
}

interface StatTileProps {
  icon: IconName;
  value: string | number;
  label: string;
  tone?: 'light' | 'dark';
  accent?: ColorToken;
  style?: StyleProp<ViewStyle>;
}

export function StatTile({ icon, value, label, tone = 'light', accent = 'secondary', style }: StatTileProps) {
  const dark = tone === 'dark';
  return (
    <View style={[styles.stat, dark ? styles.statDark : styles.statLight, style]} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={[styles.statIcon, { backgroundColor: dark ? colors.primary : colors.highlight }]}>
        <TelIcon name={icon} size={18} color={dark ? colors.accent : colors[accent]} />
      </View>
      <TelText variant={String(value).length >= 5 ? 'subtitle' : 'heading'} color={dark ? 'cream' : 'primary'} tabular numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </TelText>
      <TelText variant="small" color={dark ? 'accentSoft' : 'muted'} numberOfLines={1}>
        {label}
      </TelText>
    </View>
  );
}

// Fila de lista con ícono en cuadro redondeado (avisos, historial, enlaces).
export function ListRow({
  icon,
  iconTint = [colors.highlight, colors.secondary],
  title,
  body,
  meta,
  onPress,
  trailing,
  children,
}: PropsWithChildren<{
  icon?: IconName;
  iconTint?: [string, string];
  title: string;
  body?: string;
  meta?: string;
  onPress?: () => void;
  trailing?: ReactNode;
}>) {
  const inner = (
    <>
      {icon && (
        <View style={[styles.rowIcon, { backgroundColor: iconTint[0] }]}>
          <TelIcon name={icon} size={20} color={iconTint[1]} />
        </View>
      )}
      <View style={styles.flex}>
        {meta && (
          <TelText variant="small" color="secondary" style={styles.meta}>
            {meta}
          </TelText>
        )}
        <TelText variant="subtitle" color="primary" style={styles.rowTitle}>
          {title}
        </TelText>
        {body && (
          <TelText variant="caption" color="muted">
            {body}
          </TelText>
        )}
        {children}
      </View>
      {trailing ?? (onPress ? <TelIcon name="chevronRight" size={18} color={colors.primary} /> : null)}
    </>
  );
  if (onPress) {
    return (
      <PressableScale accessibilityRole="button" accessibilityLabel={title} onPress={onPress} scaleTo={0.98} style={styles.row}>
        {inner}
      </PressableScale>
    );
  }
  return <View style={styles.row}>{inner}</View>;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    gap: 2,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.gutter,
  },
  emptyBody: {
    maxWidth: 300,
  },
  stat: {
    flex: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 4,
  },
  statLight: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statDark: {
    backgroundColor: colors.primarySoft,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  meta: {
    fontSize: 11,
    letterSpacing: 0.8,
  },
});
