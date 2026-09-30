import { useSyncExternalStore } from 'react';
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
