import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useMotionEnabled } from '@/lib/motion';
import { colors, radius } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function useAnimatedProgress(progress: number, duration = 700) {
  const enabled = useMotionEnabled();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const value = useSharedValue(enabled ? 0 : clamped);
  useEffect(() => {
    value.value = enabled ? withTiming(clamped, { duration, easing: Easing.out(Easing.cubic) }) : clamped;
  }, [clamped, duration, enabled, value]);
  return value;
}

interface ProgressBarProps {
  progress: number;
  height?: number;
  color?: string;
  trackColor?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function ProgressBar({
  progress,
  height = 8,
  color = colors.secondary,
  trackColor = colors.surfaceAlt,
  style,
  accessibilityLabel,
}: ProgressBarProps) {
  const value = useAnimatedProgress(progress);
  const fill = useAnimatedStyle(() => ({ width: `${Math.max(value.value > 0 ? 3 : 0, value.value * 100)}%` }));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      style={[{ height, borderRadius: radius.pill, backgroundColor: trackColor, overflow: 'hidden' }, style]}
    >
      <Animated.View style={[{ height, borderRadius: radius.pill, backgroundColor: color }, fill]} />
    </View>
  );
}

interface SegmentedProgressProps {
  total: number;
  done: number;
  current?: number;
  doneColor?: string;
  currentColor?: string;
  todoColor?: string;
}

// Barra por tramos (estaciones de la ruta), igual que "Mi ruta" en Claude Design.
export function SegmentedProgress({
  total,
  done,
  current,
  doneColor = colors.accent,
  currentColor = colors.cream,
  todoColor = colors.secondary,
}: SegmentedProgressProps) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: done }}
      style={styles.segments}
    >
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[
            styles.segment,
            { backgroundColor: index < done ? doneColor : index === (current ?? done) ? currentColor : todoColor },
          ]}
        />
      ))}
    </View>
  );
}

interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function ProgressRing({
  progress,
  size = 64,
  strokeWidth = 7,
  color = colors.cream,
  trackColor = colors.secondary,
  children,
  style,
  accessibilityLabel,
}: ProgressRingProps) {
  const value = useAnimatedProgress(progress, 900);
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - value.value),
  }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      style={[{ width: size, height: size }, style]}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    gap: 6,
  },
  segment: {
    flex: 1,
    height: 8,
    borderRadius: radius.pill,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
