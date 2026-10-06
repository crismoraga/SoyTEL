import { useEffect, useState } from 'react';
import { StyleSheet, View, type DimensionValue, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useMotionEnabled } from '@/lib/motion';
import { colors, isDarkTheme, radius, spacing } from '@/theme';

type Tone = 'light' | 'dark';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  rounded?: number;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}

type ToneColors = { base: string; shine: readonly [string, string, string] };
const onDark: ToneColors = { base: 'rgba(167, 212, 237, 0.12)', shine: ['rgba(167,212,237,0)', 'rgba(167,212,237,0.22)', 'rgba(167,212,237,0)'] };
const onLight: ToneColors = { base: '#E4EDF5', shine: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0)'] };
// Con el tema oscuro las superficies "claras" también son oscuras.
const toneColors: Record<Tone, ToneColors> = { light: isDarkTheme() ? onDark : onLight, dark: onDark };

// Bloque de carga con brillo que recorre la forma (shimmer).
export function Skeleton({ width = '100%', height = 16, rounded = radius.xs, tone = 'light', style }: SkeletonProps) {
  const enabled = useMotionEnabled();
  const [measured, setMeasured] = useState(0);
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (!enabled || measured === 0) {
      cancelAnimation(sweep);
      return;
    }
    sweep.value = 0;
    sweep.value = withRepeat(withTiming(1, { duration: 1250, easing: Easing.inOut(Easing.quad) }), -1, false);
    return () => cancelAnimation(sweep);
  }, [enabled, measured, sweep]);

  const shineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -measured + sweep.value * measured * 2 }],
  }));

  function onLayout(event: LayoutChangeEvent) {
    setMeasured(event.nativeEvent.layout.width);
  }

  const palette = toneColors[tone];
  return (
    <View
      onLayout={onLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: rounded, backgroundColor: palette.base, overflow: 'hidden' }, style]}
    >
      {enabled && measured > 0 && (
        <Animated.View style={[StyleSheet.absoluteFill, shineStyle]}>
          <LinearGradient colors={palette.shine} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      )}
    </View>
  );
}

export function SkeletonText({ lines = 3, tone = 'light', lastWidth = '62%' }: { lines?: number; tone?: Tone; lastWidth?: DimensionValue }) {
  return (
    <View style={styles.text}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} tone={tone} height={12} width={index === lines - 1 ? lastWidth : '100%'} />
      ))}
    </View>
  );
}

export function SkeletonCircle({ size = 48, tone = 'light' }: { size?: number; tone?: Tone }) {
  return <Skeleton width={size} height={size} rounded={size} tone={tone} />;
}

export function SkeletonCard({ tone = 'light', media = false }: { tone?: Tone; media?: boolean }) {
  return (
    <View style={[styles.card, tone === 'dark' ? styles.cardDark : styles.cardLight]}>
      {media && <Skeleton tone={tone} height={110} rounded={radius.md} />}
      <View style={styles.row}>
        <SkeletonCircle tone={tone} size={52} />
        <View style={styles.flex}>
          <Skeleton tone={tone} height={14} width="55%" />
          <Skeleton tone={tone} height={12} width="80%" />
        </View>
      </View>
      <Skeleton tone={tone} height={10} rounded={radius.pill} />
    </View>
  );
}

export function SkeletonGrid({ columns = 3, items = 6, tone = 'light', size = 76 }: { columns?: number; items?: number; tone?: Tone; size?: number }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: items }, (_, index) => (
        <View key={index} style={[styles.gridCell, { flexBasis: `${100 / columns - 3}%` }]}>
          <SkeletonCircle size={size} tone={tone} />
          <Skeleton tone={tone} height={10} width="70%" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    gap: spacing.xs,
  },
  card: {
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
  },
  cardLight: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  cardDark: {
    backgroundColor: 'rgba(18, 61, 92, 0.6)',
    borderColor: 'rgba(167, 212, 237, 0.12)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
    gap: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  gridCell: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
});
