import { useSyncExternalStore } from 'react';
import { Appearance, Platform } from 'react-native';
import { reloadAppAsync } from 'expo';
import * as SecureStore from 'expo-secure-store';
import { applyTheme, currentTheme, type ThemeName } from './colors';

// Preferencia de tema. Es la única copia: vive donde se puede leer de forma síncrona al arrancar
// (llavero en Android/iOS, localStorage en la web), porque los estilos se crean una sola vez al cargar.

export type ThemePreference = 'system' | ThemeName;

const KEY = 'soytel.theme';

function webStorage(): Storage | null {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;
  }
}

export function readThemePreference(): ThemePreference {
  try {
    const raw = Platform.OS === 'web' ? webStorage()?.getItem(KEY) : SecureStore.getItem(KEY);
    return raw === 'light' || raw === 'dark' ? raw : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(preference: ThemePreference, system: string | null | undefined = Appearance.getColorScheme()): ThemeName {
  if (preference === 'system') return system === 'dark' ? 'dark' : 'light';
  return preference;
}

// Escribe y comprueba leyendo de vuelta: solo así se sabe que al reabrir la app se verá ese tema.
function writeThemePreference(preference: ThemePreference): boolean {
  try {
    if (Platform.OS === 'web') {
      const storage = webStorage();
      if (!storage) return false;
      if (preference === 'system') storage.removeItem(KEY);
      else storage.setItem(KEY, preference);
    } else {
      SecureStore.setItem(KEY, preference);
    }
  } catch {
    return false;
  }
  return readThemePreference() === preference;
}

let cached: ThemePreference | null = null;
const listeners = new Set<() => void>();

export function getThemePreference(): ThemePreference {
  if (cached === null) cached = readThemePreference();
  return cached;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, getThemePreference, getThemePreference);
}

// Se llama una vez, antes de cargar las pantallas (ver index.js).
export function bootTheme(): ThemeName {
  cached = readThemePreference();
  const theme = resolveTheme(cached);
  applyTheme(theme);
  return theme;
}

// Reinicia la interfaz para recrear los estilos con el tema que corresponde.
export async function restartInterface(reason: string): Promise<void> {
  if (Platform.OS === 'web') {
    (globalThis as { location?: { reload: () => void } }).location?.reload();
    return;
  }
  await reloadAppAsync(reason);
}

// Guarda la preferencia. Devuelve false si no se pudo guardar: en ese caso nada cambia y no se reinicia.
// Si cambia el tema visible, reinicia la interfaz.
export async function setThemePreference(preference: ThemePreference): Promise<boolean> {
  if (!writeThemePreference(preference)) return false;
  cached = preference;
  listeners.forEach((listener) => listener());
  if (resolveTheme(preference) !== currentTheme()) await restartInterface('Cambio de tema');
  return true;
}

// Con "Del teléfono": el tema que habría que aplicar porque el sistema cambió (null si ya coincide,
// si no se sabe, o si el usuario eligió un tema fijo).
export function systemThemeToApply(
  preference: ThemePreference = getThemePreference(),
  system: string | null | undefined = Appearance.getColorScheme(),
  applied: ThemeName = currentTheme(),
): ThemeName | null {
  if (preference !== 'system' || (system !== 'dark' && system !== 'light')) return null;
  return system === applied ? null : system;
}

// Aplicar el tema del sistema reinicia la interfaz: solo se hace en las pantallas principales, nunca en
// medio de un juego, de la ruta o de un formulario (ahí se espera a que el usuario vuelva).
const RESTART_SAFE = /^\/(home|games|career|achievements|inbox|profile|ajustes|ranking|malla|privacidad)?$/;

export function canRestartAt(pathname: string): boolean {
  return RESTART_SAFE.test(pathname);
}
