import { memo, type PropsWithChildren, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { arcPath, star4Path } from '@/graphics/shapes';
import { colors, radius, spacing } from '@/theme';
import { IconButton } from './IconButton';
import { TelText } from './TelText';

interface AppHeaderProps {
  kicker?: string;
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  art?: ReactNode;
  rounded?: boolean;
  overlap?: number;
  compact?: boolean;
  transparent?: boolean;
}

// Ornamento superior derecho de las hojas de marca: arco punteado, estrella y puntos.
export const HeaderDecor = memo(function HeaderDecor() {
  return (
    <Svg width={150} height={120} viewBox="0 0 150 120" style={styles.decor} pointerEvents="none">
      <Path d={arcPath(150, 20, 70, 110, 205)} stroke={colors.cream} strokeWidth={1.6} strokeDasharray="1 6" strokeLinecap="round" fill="none" opacity={0.55} />
      <Path d={star4Path(112, 30, 11)} fill={colors.cream} opacity={0.9} />
      <Circle cx={88} cy={62} r={3.2} fill={colors.cream} opacity={0.7} />
      <Circle cx={134} cy={86} r={2} fill={colors.accent} opacity={0.8} />
      <Circle cx={70} cy={20} r={1.6} fill={colors.accentSoft} opacity={0.6} />
    </Svg>
  );
});

// Cabecera azul noche de las pantallas de Claude Design (kicker + título + subtítulo).
export function AppHeader({
  kicker,
  title,
  subtitle,
  onBack,
  right,
  art,
  rounded = false,
  overlap = 0,
  compact = false,
  transparent = false,
  children,
}: PropsWithChildren<AppHeaderProps>) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.header,
        transparent && styles.transparent,
        rounded && styles.rounded,
        { paddingTop: insets.top + (compact ? spacing.xs : spacing.md), paddingBottom: (compact ? spacing.md : 22) + overlap },
      ]}
    >
      {!transparent && !right && !art && <HeaderDecor />}
      {(onBack || right) && (
        <View style={styles.topRow}>
          {onBack ? <IconButton icon="chevronLeft" tone="dark" onPress={onBack} accessibilityLabel="Volver" /> : <View />}
          {right}
        </View>
      )}
      {(title || kicker || art) && (
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            {kicker && (
              <TelText variant="overline" color="accent">
                {kicker}
              </TelText>
            )}
            {title && (
              <TelText variant="title" color="cream" accessibilityRole="header">
                {title}
              </TelText>
            )}
            {subtitle && (
              <TelText variant="label" color="accentSoft" style={styles.subtitle}>
                {subtitle}
              </TelText>
            )}
          </View>
          {art}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.gutter,
    gap: spacing.md,
    overflow: 'hidden',
  },
  transparent: {
    backgroundColor: 'transparent',
  },
  rounded: {
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
  },
  decor: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xxs,
  },
  subtitle: {
    fontSize: 14,
  },
});
