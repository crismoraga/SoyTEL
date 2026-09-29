import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';
import { GradientDefs, ShapeLayer } from '@/graphics/ShapeLayer';
import {
  telixBody,
  telixExtras,
  telixFace,
  telixGradients,
  telixSignalArcs,
  type TelixExpression,
  type TelixPose,
} from '@/graphics/telix';
import { useMotionEnabled } from '@/lib/motion';
import { motion } from '@/theme';

export type { TelixExpression, TelixPose } from '@/graphics/telix';

interface TelixProps {
  size?: number;
  expression?: TelixExpression;
  pose?: TelixPose;
  signal?: number;
  animated?: boolean;
  // Cambiar este valor dispara un rebote de reacción (p. ej. tras una interacción).
  reactKey?: number | string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const BLINKING: TelixExpression[] = ['neutral', 'sad', 'alert', 'think'];
const VIEWBOX = '0 0 200 200';

export function Telix({
  size = 160,
  expression = 'neutral',
  pose = 'idle',
  signal = 3,
  animated = true,
  reactKey,
  style,
  accessibilityLabel = 'Telix, la mascota de SoyTEL',
}: TelixProps) {
  const motionEnabled = useMotionEnabled() && animated;
  const [blink, setBlink] = useState(false);
  const float = useSharedValue(0);
  const pulse = useSharedValue(0);
  const bounce = useSharedValue(1);

  useEffect(() => {
    if (!motionEnabled) {
      cancelAnimation(float);
      cancelAnimation(pulse);
      float.value = 0;
      pulse.value = 0;
      return;
    }
    const ease = Easing.inOut(Easing.sin);
    const floatDuration = expression === 'celebrate' ? 520 : expression === 'sleep' ? 2400 : 1500;
    float.value = withRepeat(
      withSequence(withTiming(1, { duration: floatDuration, easing: ease }), withTiming(0, { duration: floatDuration, easing: ease })),
      -1,
    );
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 900 })), -1);
    return () => {
      cancelAnimation(float);
      cancelAnimation(pulse);
    };
  }, [expression, float, motionEnabled, pulse]);

  useEffect(() => {
    if (!motionEnabled || !BLINKING.includes(expression)) {
      setBlink(false);
      return;
    }
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!active) return;
        setBlink(true);
        timer = setTimeout(() => {
          if (!active) return;
          setBlink(false);
          schedule();
        }, 130);
      }, 2400 + Math.random() * 2800);
    };
    schedule();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [expression, motionEnabled]);

  useEffect(() => {
    if (reactKey === undefined || !motionEnabled) return;
    bounce.value = withSequence(withSpring(1.14, motion.spring.bouncy), withSpring(1, motion.spring.gentle));
  }, [bounce, motionEnabled, reactKey]);

  const amplitude = size * (expression === 'celebrate' ? 0.07 : 0.035);
  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -amplitude * float.value }, { scale: bounce.value }],
  }));
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 0.2 - 0.07 * float.value,
    transform: [{ scaleX: 1 - 0.14 * float.value }],
  }));
  const signalStyle = useAnimatedStyle(() => ({ opacity: 0.35 + 0.65 * pulse.value }));

  const body = useMemo(() => telixBody(pose, signal), [pose, signal]);
  const face = useMemo(() => telixFace(expression, blink), [blink, expression]);
  const extras = useMemo(() => telixExtras(expression), [expression]);
  const arcs = useMemo(() => telixSignalArcs(), []);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[{ width: size, height: size }, style]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shadow,
          { width: size * 0.44, height: size * 0.07, left: size * 0.28, top: size * 0.895, borderRadius: size },
          shadowStyle,
        ]}
      />
      <Animated.View style={[StyleSheet.absoluteFill, bodyStyle]} pointerEvents="none">
        {signal > 0 && (
          <Animated.View style={[StyleSheet.absoluteFill, signalStyle]}>
            <Svg width={size} height={size} viewBox={VIEWBOX}>
              <ShapeLayer shapes={arcs} />
            </Svg>
          </Animated.View>
        )}
        <Svg width={size} height={size} viewBox={VIEWBOX} style={StyleSheet.absoluteFill}>
          <GradientDefs gradients={telixGradients} />
          <ShapeLayer shapes={body} />
          <ShapeLayer shapes={face} />
          <ShapeLayer shapes={extras} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    position: 'absolute',
    backgroundColor: '#000000',
  },
});
