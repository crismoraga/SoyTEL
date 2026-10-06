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
  rutixAccessory,
  rutixBody,
  rutixExtras,
  rutixFace,
  rutixGradients,
  rutixSignalArcs,
  type RutixAccessory,
  type RutixExpression,
  type RutixPose,
} from '@/graphics/rutix';
import { useMotionLevel } from '@/lib/motion';
import { useSettings } from '@/storage/settings';
import { motion } from '@/theme';

export type { RutixAccessory, RutixExpression, RutixPose } from '@/graphics/rutix';

interface RutixProps {
  size?: number;
  expression?: RutixExpression;
  pose?: RutixPose;
  signal?: number;
  animated?: boolean;
  // Cambiar este valor dispara un rebote de reacción (p. ej. tras una interacción).
  reactKey?: number | string;
  // Por defecto usa el accesorio elegido en el guardarropa de Rutix.
  accessory?: RutixAccessory;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const BLINKING: RutixExpression[] = ['neutral', 'sad', 'alert', 'think', 'wink', 'worried', 'focus'];
const VIEWBOX = '0 0 200 200';

export function Rutix({
  size = 160,
  expression = 'neutral',
  pose = 'idle',
  signal = 3,
  animated = true,
  reactKey,
  accessory,
  style,
  accessibilityLabel = 'Rutix, la mascota de SoyTEL',
}: RutixProps) {
  const level = useMotionLevel();
  const chosen = useSettings().rutixAccessory;
  const worn = accessory ?? chosen;
  const motionEnabled = level !== 'minimal' && animated;
  // Las ondas de señal laten solo con animaciones completas; flotar y parpadear es barato.
  const pulseEnabled = level === 'full' && animated;
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
    if (pulseEnabled) {
      pulse.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 900 })), -1);
    } else {
      cancelAnimation(pulse);
      pulse.value = 0.6;
    }
    return () => {
      cancelAnimation(float);
      cancelAnimation(pulse);
    };
  }, [expression, float, motionEnabled, pulse, pulseEnabled]);

  const canBlink = motionEnabled && BLINKING.includes(expression);

  useEffect(() => {
    if (!canBlink) return;
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
  }, [canBlink]);

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

  const body = useMemo(() => rutixBody(pose, signal), [pose, signal]);
  const eyesClosed = canBlink && blink;
  const face = useMemo(() => rutixFace(expression, eyesClosed), [eyesClosed, expression]);
  const extras = useMemo(() => rutixExtras(expression), [expression]);
  const arcs = useMemo(() => rutixSignalArcs(), []);
  const outfit = useMemo(() => rutixAccessory(worn), [worn]);
  const showArcs = signal > 0 && worn !== 'graduation' && worn !== 'crown';

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
      <Animated.View style={[StyleSheet.absoluteFill, bodyStyle]} pointerEvents="none" renderToHardwareTextureAndroid={motionEnabled} shouldRasterizeIOS={motionEnabled}>
        {showArcs && (
          <Animated.View style={[StyleSheet.absoluteFill, signalStyle]} renderToHardwareTextureAndroid={pulseEnabled}>
            <Svg width={size} height={size} viewBox={VIEWBOX}>
              <ShapeLayer shapes={arcs} />
            </Svg>
          </Animated.View>
        )}
        <Svg width={size} height={size} viewBox={VIEWBOX} style={StyleSheet.absoluteFill}>
          <GradientDefs gradients={rutixGradients} />
          <ShapeLayer shapes={body} />
          <ShapeLayer shapes={outfit} />
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
