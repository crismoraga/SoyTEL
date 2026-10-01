import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACCOUNT_KEYS, resetAccountLocal } from '@/account/store';
import { hostManager } from '@/route/hostManager';
import { routeMember } from '@/route/member';
import { clearRouteStorage } from '@/route/storage';
import { CAREER_KEYS } from './career';
import { INBOX_KEYS, resetInboxCache } from './inbox';
import { PROFILE_KEYS } from './profile';
import { resetSettingsCache, SETTINGS_KEYS } from './settings';
import { STORY_KEYS } from './story';

// Borra todo lo que SoyTEL guarda en el dispositivo: perfil, resultados, historia, avisos, ajustes,
// la sesión de la cuenta y todo lo de la ruta (credenciales, rutas del stand y concesiones).
// La cuenta del servidor no se elimina: se puede recuperar con su código.
export async function resetAllData({ keepOnboarding = true }: { keepOnboarding?: boolean } = {}): Promise<void> {
  routeMember.reset();
  hostManager.stopAll();
  const storyKeys = keepOnboarding ? STORY_KEYS.filter((key) => key !== '@soytel/onboarded') : STORY_KEYS;
  await AsyncStorage.multiRemove([...PROFILE_KEYS, ...storyKeys, ...INBOX_KEYS, ...CAREER_KEYS, ...SETTINGS_KEYS, ...ACCOUNT_KEYS]);
  await clearRouteStorage();
  await resetAccountLocal();
  resetInboxCache();
  resetSettingsCache();
}
