import type { PropsWithChildren } from 'react';
import { Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { feedbackTap } from '@/lib/feedback';
import { useMotionEnabled } from '@/lib/motion';
import { motion } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: boolean;
}

// Botón con leve encogimiento al presionar (resorte en el hilo de UI).
export function PressableScale({
  style,
  scaleTo = motion.pressScale,
  haptic = false,
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  children,
  ...props
}: PropsWithChildren<PressableScaleProps>) {
  const enabled = useMotionEnabled();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function handlePressIn(event: GestureResponderEvent) {
    if (enabled) scale.set(withSpring(scaleTo, motion.spring.snappy));
    onPressIn?.(event);
  }

  function handlePressOut(event: GestureResponderEvent) {
    if (enabled) scale.set(withSpring(1, motion.spring.gentle));
    onPressOut?.(event);
  }

  function handlePress(event: GestureResponderEvent) {
    if (haptic) void feedbackTap();
    onPress?.(event);
  }

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
