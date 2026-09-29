import { FadeIn, FadeInDown, FadeInUp, ReduceMotion, useReducedMotion, ZoomIn } from 'react-native-reanimated';
import { useSettings } from '@/storage/settings';
import { motion } from '@/theme';

// Respeta tanto el ajuste del sistema operativo como el interruptor "Reducir animaciones" de la app.
export function useMotionEnabled(): boolean {
  const systemReduced = useReducedMotion();
  const { reducedMotion } = useSettings();
  return !(systemReduced || reducedMotion);
}

export function useEntering() {
  const enabled = useMotionEnabled();
  const policy = enabled ? ReduceMotion.System : ReduceMotion.Always;
  return {
    enabled,
    fadeUp: (index = 0) => FadeInDown.delay(index * motion.stagger).duration(420).reduceMotion(policy),
    fadeDown: (index = 0) => FadeInUp.delay(index * motion.stagger).duration(420).reduceMotion(policy),
    fade: (index = 0) => FadeIn.delay(index * motion.stagger).duration(360).reduceMotion(policy),
    pop: (index = 0) => ZoomIn.delay(index * motion.stagger).springify().damping(14).reduceMotion(policy),
  };
}
