import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { FadeIn, FadeInDown, FadeInUp, ReduceMotion, useReducedMotion, ZoomIn } from 'react-native-reanimated';
import { useSettings, type MotionPreference } from '@/storage/settings';
import { motion } from '@/theme';

// Niveles de animación:
// - full: todo, incluidos los adornos en bucle (estrellas que titilan, ondas de Rutix).
// - balanced: transiciones breves y Rutix flotando; sin bucles decorativos de fondo.
// - minimal: sin animaciones de entrada ni bucles (equipos de gama baja o "reducir movimiento").
export type MotionLevel = 'full' | 'balanced' | 'minimal';

const GB = 1024 ** 3;

// Nivel sugerido para el equipo: Android con 3 GB de RAM o menos (o muy antiguo) parte en "minimal".
export function detectDeviceMotion(
  platform: string = Platform.OS,
  totalMemory: number | null = Device.totalMemory,
  yearClass: number | null = Device.deviceYearClass,
): MotionLevel {
  if (platform !== 'android') return 'balanced';
  if (totalMemory !== null && totalMemory > 0 && totalMemory <= 3.2 * GB) return 'minimal';
  if (yearClass !== null && yearClass > 0 && yearClass < 2017) return 'minimal';
  return 'balanced';
}

const deviceMotion = detectDeviceMotion();

export function resolveMotionLevel(preference: MotionPreference, systemReduced: boolean, device: MotionLevel = deviceMotion): MotionLevel {
  if (systemReduced) return 'minimal';
  return preference === 'auto' ? device : preference;
}

export function suggestedMotionLevel(): MotionLevel {
  return deviceMotion;
}

export function useMotionLevel(): MotionLevel {
  const systemReduced = useReducedMotion();
  const { motion: preference } = useSettings();
  return resolveMotionLevel(preference, systemReduced);
}

// Animaciones de interfaz (entradas, rebotes, confeti).
export function useMotionEnabled(): boolean {
  return useMotionLevel() !== 'minimal';
}

// Bucles puramente decorativos: solo con animaciones completas.
export function useAmbientMotion(): boolean {
  return useMotionLevel() === 'full';
}

// Partículas de confeti según el nivel (0 = sin confeti).
export function particleBudget(level: MotionLevel, count: number): number {
  if (level === 'minimal') return 0;
  return level === 'full' ? count : Math.max(10, Math.round(count * 0.45));
}

const BALANCED_STAGGER = 40;
const BALANCED_MAX_INDEX = 5;

export function useEntering() {
  const level = useMotionLevel();
  const enabled = level !== 'minimal';
  const policy = enabled ? ReduceMotion.System : ReduceMotion.Always;
  if (level === 'full') {
    return {
      enabled,
      level,
      fadeUp: (index = 0) => FadeInDown.delay(index * motion.stagger).duration(420).reduceMotion(policy),
      fadeDown: (index = 0) => FadeInUp.delay(index * motion.stagger).duration(420).reduceMotion(policy),
      fade: (index = 0) => FadeIn.delay(index * motion.stagger).duration(360).reduceMotion(policy),
      pop: (index = 0) => ZoomIn.delay(index * motion.stagger).springify().damping(14).reduceMotion(policy),
    };
  }
  // Equilibrado: solo fundidos cortos y una cascada que termina rápido; mínimo: nada.
  const delay = (index: number) => Math.min(index, BALANCED_MAX_INDEX) * BALANCED_STAGGER;
  return {
    enabled,
    level,
    fadeUp: (index = 0) => FadeInDown.delay(delay(index)).duration(260).reduceMotion(policy),
    fadeDown: (index = 0) => FadeInUp.delay(delay(index)).duration(260).reduceMotion(policy),
    fade: (index = 0) => FadeIn.delay(delay(index)).duration(220).reduceMotion(policy),
    pop: (index = 0) => FadeIn.delay(delay(index)).duration(220).reduceMotion(policy),
  };
}
