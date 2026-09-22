import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = '@soytel/settings';

export interface AppSettings {
  haptics: boolean;
  reducedMotion: boolean;
}

export const defaultSettings: AppSettings = {
  haptics: true,
  reducedMotion: false,
};

let cachedSettings: AppSettings = defaultSettings;

export async function loadSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return defaultSettings;
  }

  try {
    return { ...defaultSettings, ...JSON.parse(raw) as Partial<AppSettings> };
  } catch {
    return defaultSettings;
  }
}

export async function initSettings(): Promise<AppSettings> {
  cachedSettings = await loadSettings();
  return cachedSettings;
}

export function getSettings(): AppSettings {
  return cachedSettings;
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  cachedSettings = { ...cachedSettings, ...patch };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(cachedSettings));
  return cachedSettings;
}
