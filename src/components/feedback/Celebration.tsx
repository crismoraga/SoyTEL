import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { seededRandom, star4Path } from '@/graphics/shapes';
import { useMotionEnabled } from '@/lib/motion';
import { colors } from '@/theme';

interface Particle {
  angle: number;
  distance: number;
  spin: number;
  size: number;
  color: string;
  kind: 'star' | 'dot' | 'bar';
  delay: number;
}

const palette = [colors.cream, colors.accent, colors.accentSoft, '#F2CE63', colors.white];

function buildParticles(count: number, seed: number): Particle[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => {
    const pick = random();
    return {
      angle: random() * Math.PI * 2,
      distance: 90 + random() * 150,
      spin: (random() - 0.5) * 720,
      size: 6 + random() * 10,
      color: palette[Math.floor(random() * palette.length)],
      kind: pick < 0.45 ? 'star' : pick < 0.75 ? 'dot' : 'bar',
      delay: random() * 120,
    };
  });
}

interface CelebrationProps {
  // Cada valor distinto dispara una nueva explosión de confeti.
  burstKey: number | string | null;
  count?: number;
}

// Explosión de estrellas y confeti en colores de marca; se dibuja encima sin bloquear toques.
export const Celebration = memo(function Celebration({ burstKey, count = 28 }: CelebrationProps) {
  const enabled = useMotionEnabled();
  const seed = typeof burstKey === 'number' ? burstKey : String(burstKey ?? '').length + 3;
  const particles = useMemo(() => buildParticles(count, seed * 7919 + 17), [count, seed]);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (burstKey === null || !enabled) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) });
  }, [burstKey, enabled, progress]);

  if (burstKey === null || !enabled) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.layer}>
      {particles.map((particle, index) => (
        <ConfettiPiece key={`${burstKey}-${index}`} particle={particle} progress={progress} />
      ))}
    </View>
  );
});

function ConfettiPiece({ particle, progress }: { particle: Particle; progress: SharedValue<number> }) {
  const local = useSharedValue(0);
  useEffect(() => {
    local.value = withDelay(particle.delay, withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }));
  }, [local, particle.delay]);

  const style = useAnimatedStyle(() => {
    const t = local.value;
    const gravity = 120 * t * t;
    return {
      opacity: progress.value >= 1 ? 0 : 1 - t * t * t,
      transform: [
        { translateX: Math.cos(particle.angle) * particle.distance * t },
        { translateY: Math.sin(particle.angle) * particle.distance * t + gravity },
        { rotate: `${particle.spin * t}deg` },
        { scale: 0.4 + 0.6 * Math.min(1, t * 4) },
      ],
    };
  });

  const size = particle.size;
  return (
    <Animated.View style={[styles.piece, style]}>
      {particle.kind === 'star' ? (
        <Svg width={size * 1.6} height={size * 1.6} viewBox="0 0 20 20">
          <Path d={star4Path(10, 10, 9.5)} fill={particle.color} />
        </Svg>
      ) : (
        <View
          style={{
            width: particle.kind === 'bar' ? size * 0.45 : size * 0.8,
            height: particle.kind === 'bar' ? size * 1.2 : size * 0.8,
            borderRadius: particle.kind === 'dot' ? size : 2,
            backgroundColor: particle.color,
          }}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  piece: {
    position: 'absolute',
  },
});
