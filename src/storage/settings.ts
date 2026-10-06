import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { rutixAccessories, type RutixAccessory } from '@/graphics/rutix';

const SETTINGS_KEY = '@soytel/settings';

// "auto" elige según el equipo: los teléfonos de gama baja parten con animaciones mínimas.
export type MotionPreference = 'auto' | 'full' | 'balanced' | 'minimal';

// Ritmo de los juegos: cuánto tiempo hay para leer y responder. "relaxed" es el más holgado.
export type GamePace = 'relaxed' | 'calm' | 'normal' | 'fast';

// Versión del ajuste de ritmo. Quien tenía el valor por defecto anterior ("calm") pasa al nuevo.
const PACE_REV = 2;

// Tema visual. "system" sigue al teléfono; el cambio se aplica reiniciando la interfaz.
export type ThemePreference = 'system' | 'light' | 'dark';

export interface AppSettings {
  haptics: boolean;
  motion: MotionPreference;
  pace: GamePace;
  paceRev: number;
  theme: ThemePreference;
  // Rutix comenta y da pistas durante los juegos.
  coach: boolean;
  // Accesorio que lleva Rutix (guardarropa).
  rutixAccessory: RutixAccessory;
}

export const defaultSettings: AppSettings = {
  haptics: true,
  motion: 'auto',
  pace: 'relaxed',
  paceRev: PACE_REV,
  theme: 'system',
  coach: true,
  rutixAccessory: 'none',
};

let cachedSettings: AppSettings = defaultSettings;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const MOTION_VALUES: MotionPreference[] = ['auto', 'full', 'balanced', 'minimal'];
const PACE_VALUES: GamePace[] = ['relaxed', 'calm', 'normal', 'fast'];
const THEME_VALUES: ThemePreference[] = ['system', 'light', 'dark'];

// Acepta el formato anterior ({ reducedMotion: true }) y descarta valores desconocidos.
export function parseSettings(raw: string | null): AppSettings {
  if (!raw) return defaultSettings;
  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings> & { reducedMotion?: boolean };
    const motion = MOTION_VALUES.includes(parsed.motion as MotionPreference)
      ? (parsed.motion as MotionPreference)
      : parsed.reducedMotion
        ? 'minimal'
        : 'auto';
    return {
      haptics: parsed.haptics !== false,
      motion,
      pace: !PACE_VALUES.includes(parsed.pace as GamePace) || (parsed.pace === 'calm' && parsed.paceRev !== PACE_REV) ? defaultSettings.pace : (parsed.pace as GamePace),
      paceRev: PACE_REV,
      theme: THEME_VALUES.includes(parsed.theme as ThemePreference) ? (parsed.theme as ThemePreference) : defaultSettings.theme,
      coach: parsed.coach !== false,
      rutixAccessory: rutixAccessories.includes(parsed.rutixAccessory as RutixAccessory) ? (parsed.rutixAccessory as RutixAccessory) : 'none',
    };
  } catch {
    return defaultSettings;
  }
}

export async function loadSettings(): Promise<AppSettings> {
  return parseSettings(await AsyncStorage.getItem(SETTINGS_KEY));
}

export async function initSettings(): Promise<AppSettings> {
  cachedSettings = await loadSettings();
  emit();
  return cachedSettings;
}

export function getSettings(): AppSettings {
  return cachedSettings;
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  cachedSettings = { ...cachedSettings, ...patch };
  emit();
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(cachedSettings));
  return cachedSettings;
}

export function resetSettingsCache(): void {
  cachedSettings = defaultSettings;
  emit();
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribeSettings, getSettings, getSettings);
}

export const SETTINGS_KEYS = [SETTINGS_KEY];
