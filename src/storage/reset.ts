import AsyncStorage from '@react-native-async-storage/async-storage';
import { CAREER_KEYS } from './career';
import { INBOX_KEYS, resetInboxCache } from './inbox';
import { PROFILE_KEYS } from './profile';
import { resetSettingsCache } from './settings';
import { STORY_KEYS } from './story';

// Borra todo lo que SoyTEL guarda en el dispositivo (perfil, resultados, historia, avisos, ajustes).
export async function resetAllData({ keepOnboarding = true }: { keepOnboarding?: boolean } = {}): Promise<void> {
  const storyKeys = keepOnboarding ? STORY_KEYS.filter((key) => key !== '@soytel/onboarded') : STORY_KEYS;
  await AsyncStorage.multiRemove([...PROFILE_KEYS, ...storyKeys, ...INBOX_KEYS, ...CAREER_KEYS, '@soytel/settings', '@soytel/route/member', '@soytel/route/recorded']);
  resetInboxCache();
  resetSettingsCache();
}
