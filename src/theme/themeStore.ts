import { Appearance, Platform } from 'react-native';
import { reloadAppAsync } from 'expo';
import * as SecureStore from 'expo-secure-store';
import { applyTheme, currentTheme, type ThemeName } from './colors';

// Preferencia de tema guardada donde se puede leer de forma síncrona al arrancar
// (llavero en Android/iOS, localStorage en la web): los estilos se crean una sola vez al cargar.

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

function writeThemePreference(preference: ThemePreference): void {
  try {
    if (Platform.OS === 'web') {
      if (preference === 'system') webStorage()?.removeItem(KEY);
      else webStorage()?.setItem(KEY, preference);
    } else {
      SecureStore.setItem(KEY, preference);
    }
  } catch {
    // Sin llavero disponible la app sigue el tema del sistema.
  }
}

// Se llama una vez, antes de cargar las pantallas (ver index.js).
export function bootTheme(): ThemeName {
  const theme = resolveTheme(readThemePreference());
  applyTheme(theme);
  return theme;
}

// Guarda la preferencia. Si cambia el tema visible, reinicia la interfaz para recrear los estilos.
export async function setThemePreference(preference: ThemePreference): Promise<void> {
  writeThemePreference(preference);
  if (resolveTheme(preference) === currentTheme()) return;
  if (Platform.OS === 'web') {
    (globalThis as { location?: { reload: () => void } }).location?.reload();
    return;
  }
  await reloadAppAsync('Cambio de tema');
}
