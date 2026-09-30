import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { arcPath, star4Path } from '@/graphics/shapes';
import { useMotionEnabled } from '@/lib/motion';
import { colors } from '@/theme';

function useLoop(duration: number, enabled: boolean): SharedValue<number> {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!enabled) {
      cancelAnimation(progress);
      progress.value = 0.5;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(progress);
  }, [duration, enabled, progress]);
  return progress;
}

interface SpinnerProps {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

// Ondas de señal que se encienden en secuencia, como el ícono Wi-Fi de la marca.
export function SignalSpinner({ size = 48, color = colors.accent, style, accessibilityLabel = 'Cargando' }: SpinnerProps) {
  const enabled = useMotionEnabled();
  const clock = useLoop(1300, enabled);
  const arcs = [
    arcPath(24, 34, 7, 225, 315),
    arcPath(24, 34, 14, 225, 315),
    arcPath(24, 34, 21, 225, 315),
  ];

  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel} style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 48 48" style={StyleSheet.absoluteFill}>
        <Circle cx={24} cy={34} r={3.6} fill={color} />
      </Svg>
      {arcs.map((d, index) => (
        <SignalArc key={d} d={d} index={index} clock={clock} size={size} color={color} />
      ))}
    </View>
  );
}

function SignalArc({ d, index, clock, size, color }: { d: string; index: number; clock: SharedValue<number>; size: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const phase = (clock.value - index * 0.18 + 1) % 1;
    return { opacity: interpolate(phase, [0, 0.25, 0.6, 1], [0.18, 1, 0.35, 0.18]) };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Path d={d} stroke={color} strokeWidth={4} strokeLinecap="round" fill="none" />
      </Svg>
    </Animated.View>
  );
}

// Nodos que orbitan un anillo: "paquetes" circulando por la red.
export function OrbitSpinner({ size = 56, color = colors.accent, style, accessibilityLabel = 'Cargando' }: SpinnerProps) {
  const enabled = useMotionEnabled();
  const clock = useLoop(1500, enabled);
  const rotate = useAnimatedStyle(() => ({ transform: [{ rotate: `${clock.value * 360}deg` }] }));

  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel} style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 56 56" style={StyleSheet.absoluteFill}>
        <Circle cx={28} cy={28} r={20} stroke={color} strokeOpacity={0.25} strokeWidth={3} fill="none" />
        <Path d={star4Path(28, 28, 7)} fill={colors.cream} />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, rotate]}>
        <Svg width={size} height={size} viewBox="0 0 56 56">
          <Path d={arcPath(28, 28, 20, -90, 10)} stroke={color} strokeWidth={3.5} strokeLinecap="round" fill="none" />
          <Circle cx={48} cy={28} r={4.5} fill={color} />
          <Circle cx={18} cy={45.3} r={3.2} fill={colors.cream} />
          <Circle cx={18} cy={10.7} r={2.4} fill={color} fillOpacity={0.7} />
        </Svg>
      </Animated.View>
    </View>
  );
}

// Tres puntos que rebotan; para botones y estados en línea.
export function DotsLoader({ color = colors.cream, size = 8, style }: { color?: string; size?: number; style?: StyleProp<ViewStyle> }) {
  const enabled = useMotionEnabled();
  const clock = useLoop(900, enabled);
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Cargando" style={[styles.dots, style]}>
      {[0, 1, 2].map((index) => (
        <Dot key={index} index={index} clock={clock} color={color} size={size} />
      ))}
    </View>
  );
}

function Dot({ index, clock, color, size }: { index: number; clock: SharedValue<number>; color: string; size: number }) {
  const style = useAnimatedStyle(() => {
    const phase = (clock.value - index * 0.16 + 1) % 1;
    const lift = interpolate(phase, [0, 0.3, 0.6, 1], [0, -size * 0.8, 0, 0]);
    return { transform: [{ translateY: lift }], opacity: interpolate(phase, [0, 0.3, 0.6, 1], [0.5, 1, 0.5, 0.5]) };
  });
  return <Animated.View style={[{ width: size, height: size, borderRadius: size, backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 20,
  },
});
