import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { rutixAccessories, type RutixAccessory } from '@/graphics/rutix';
import { emitAppEvent } from '@/lib/events';
import { withLock } from './locks';

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

// Los ajustes se leen del disco una sola vez. Lo que el usuario cambie antes de que termine esa
// lectura se aplica encima de lo leído (no al revés), y cada cambio lleva un número: si un guardado
// falla, se deshace solo lo que nadie volvió a tocar.
let hydration: Promise<AppSettings> | null = null;
let hydrationToken = 0;
let early: Partial<AppSettings> = {};
let hydrated = false;
let revision = 0;
const touched = new Map<keyof AppSettings, number>();

export function initSettings(): Promise<AppSettings> {
  if (!hydration) {
    hydrationToken += 1;
    const token = hydrationToken;
    hydration = (async () => {
      let loaded = defaultSettings;
      try {
        loaded = await loadSettings();
      } catch {
        loaded = defaultSettings;
      }
      // Hubo un borrado total mientras se leía: esta lectura ya no vale.
      if (token !== hydrationToken) return cachedSettings;
      cachedSettings = { ...loaded, ...early };
      early = {};
      hydrated = true;
      emit();
      return cachedSettings;
    })();
  }
  return hydration;
}

export function getSettings(): AppSettings {
  return cachedSettings;
}

// Aplica el cambio de inmediato en pantalla y lo guarda. Si no se puede guardar, lo deshace y avisa:
// nunca queda mostrando un ajuste que al reabrir la app no va a estar.
export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  revision += 1;
  const mine = revision;
  const keys = Object.keys(patch) as (keyof AppSettings)[];
  const before = Object.fromEntries(keys.map((key) => [key, cachedSettings[key]])) as Partial<AppSettings>;
  keys.forEach((key) => touched.set(key, mine));
  cachedSettings = { ...cachedSettings, ...patch };
  if (!hydrated) early = { ...early, ...patch };
  emit();
  try {
    await withLock('settings', async () => {
      await initSettings();
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(cachedSettings));
    });
  } catch {
    // Vuelve atrás solo lo que este cambio tocó y nadie modificó después.
    const undo = Object.fromEntries(keys.filter((key) => touched.get(key) === mine).map((key) => [key, before[key]])) as Partial<AppSettings>;
    if (Object.keys(undo).length > 0) {
      cachedSettings = { ...cachedSettings, ...undo };
      emit();
    }
    emitAppEvent({ type: 'toast', title: 'No se pudo guardar el ajuste', body: 'Revisa el espacio del teléfono e inténtalo de nuevo.' });
  }
  return cachedSettings;
}

export function resetSettingsCache(): void {
  cachedSettings = defaultSettings;
  hydration = null;
  hydrationToken += 1;
  early = {};
  hydrated = false;
  touched.clear();
  emit();
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribeSettings, getSettings, getSettings);
}

export const SETTINGS_KEYS = [SETTINGS_KEY];
