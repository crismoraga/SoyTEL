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
import { useMotionEnabled } from '@/lib/motion';
import { colors } from '@/theme';

interface PulseRingsProps {
  size: number;
  color?: string;
  rings?: number;
  style?: StyleProp<ViewStyle>;
}

// Ondas concéntricas que se expanden (señal emitida), detrás del logo o de una estación.
export function PulseRings({ size, color = colors.accent, rings = 3, style }: PulseRingsProps) {
  const enabled = useMotionEnabled();
  const clock = useSharedValue(0);

  useEffect(() => {
    if (!enabled) {
      cancelAnimation(clock);
      clock.value = 0.35;
      return;
    }
    clock.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(clock);
  }, [clock, enabled]);

  return (
    <View pointerEvents="none" style={[{ width: size, height: size }, styles.center, style]}>
      {Array.from({ length: rings }, (_, index) => (
        <Ring key={index} index={index} rings={rings} clock={clock} size={size} color={color} />
      ))}
    </View>
  );
}

function Ring({ index, rings, clock, size, color }: { index: number; rings: number; clock: SharedValue<number>; size: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const phase = (clock.value + index / rings) % 1;
    return {
      opacity: interpolate(phase, [0, 0.15, 1], [0, 0.55, 0]),
      transform: [{ scale: interpolate(phase, [0, 1], [0.55, 1]) }],
    };
  });
  return (
    <Animated.View
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2, borderColor: color },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
});
