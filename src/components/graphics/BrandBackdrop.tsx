import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg from 'react-native-svg';
import { networkMesh, orbitRings, signalRings, starField } from '@/graphics/patterns';
import { ShapeLayer } from '@/graphics/ShapeLayer';
import { useMotionEnabled } from '@/lib/motion';

export type BackdropVariant = 'stars' | 'network' | 'signal' | 'orbits' | 'none';

interface BrandBackdropProps {
  variant?: BackdropVariant;
  seed?: number;
  opacity?: number;
}

// Fondo decorativo de las pantallas oscuras: patrón estático + capa de estrellas que titilan.
export const BrandBackdrop = memo(function BrandBackdrop({ variant = 'stars', seed = 7, opacity = 1 }: BrandBackdropProps) {
  const { width, height } = useWindowDimensions();
  const motionEnabled = useMotionEnabled();
  const twinkle = useSharedValue(0.3);

  useEffect(() => {
    if (!motionEnabled || variant === 'none') {
      cancelAnimation(twinkle);
      twinkle.value = 0.7;
      return;
    }
    twinkle.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(twinkle);
  }, [motionEnabled, twinkle, variant]);

  const base = useMemo(() => {
    switch (variant) {
      case 'stars':
        return starField({ width, height, seed, stars: 10, dots: 22 });
      case 'network':
        return [...networkMesh({ width, height, seed, nodes: 14 }), ...starField({ width, height, seed: seed + 3, stars: 4, dots: 10 })];
      case 'signal':
        return [...signalRings({ cx: width * 0.85, cy: height * 0.12, rings: 6, gap: 34, start: 36 }), ...starField({ width, height, seed, stars: 6, dots: 14 })];
      case 'orbits':
        return [...orbitRings({ width, height }), ...starField({ width, height, seed, stars: 6, dots: 16 })];
      default:
        return [];
    }
  }, [height, seed, variant, width]);

  const sparkles = useMemo(
    () => (variant === 'none' ? [] : starField({ width, height, seed: seed + 101, stars: 7, dots: 8 })),
    [height, seed, variant, width],
  );

  const twinkleStyle = useAnimatedStyle(() => ({ opacity: twinkle.value }));

  if (variant === 'none') {
    return null;
  }

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
      <Svg width={width} height={height}>
        <ShapeLayer shapes={base} />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, twinkleStyle]}>
        <Svg width={width} height={height}>
          <ShapeLayer shapes={sparkles} />
        </Svg>
      </Animated.View>
    </View>
  );
});
