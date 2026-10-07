import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACCOUNT_KEYS, resetAccountLocal } from '@/account/store';
import { hostManager } from '@/route/hostManager';
import { routeMember } from '@/route/member';
import { clearRouteStorage } from '@/route/storage';
import { CAREER_KEYS } from './career';
import { INBOX_KEYS, resetInboxCache } from './inbox';
import { exclusive } from './locks';
import { MISSION_KEYS } from './missions';
import { PROFILE_KEYS } from './profile';
import { PUZZLE_KEYS } from './puzzles';
import { RUNNER_KEYS } from './runner';
import { resetSettingsCache, SETTINGS_KEYS } from './settings';
import { STORY_KEYS } from './story';
import { resetTutorialsCache, TUTORIAL_KEYS } from './tutorials';

// Alguna etapa del borrado falló. `stages` dice cuáles; se puede volver a intentar.
export class ResetError extends Error {
  constructor(readonly stages: string[]) {
    super(`reset-incomplete:${stages.join(',')}`);
    this.name = 'ResetError';
  }
}

// Borra todo lo que SoyTEL guarda en el dispositivo: perfil, resultados, historia, TEL Runner, avisos, ajustes,
// la sesión de la cuenta y todo lo de la ruta (credenciales, rutas del stand y concesiones).
// La cuenta del servidor no se elimina: se puede recuperar con su código.
//
// Corre en exclusiva: primero termina lo que ya se estaba guardando y lo que llegue mientras tanto
// espera, así ninguna escritura que venía en camino deja datos después del borrado. Las memorias en
// caché se limpian siempre, aunque una etapa falle (en ese caso lanza ResetError).
export function resetAllData({ keepOnboarding = true }: { keepOnboarding?: boolean } = {}): Promise<void> {
  return exclusive(async () => {
    routeMember.reset();
    hostManager.stopAll();
    const failed: string[] = [];
    const stage = async (name: string, task: () => Promise<unknown>) => {
      try {
        await task();
      } catch {
        failed.push(name);
      }
    };
    const storyKeys = keepOnboarding ? STORY_KEYS.filter((key) => key !== '@soytel/onboarded') : STORY_KEYS;
    await stage('datos', () => AsyncStorage.multiRemove([...PROFILE_KEYS, ...storyKeys, ...INBOX_KEYS, ...CAREER_KEYS, ...PUZZLE_KEYS, ...RUNNER_KEYS, ...MISSION_KEYS, ...TUTORIAL_KEYS, ...SETTINGS_KEYS, ...ACCOUNT_KEYS]));
    await stage('ruta', clearRouteStorage);
    await stage('cuenta', resetAccountLocal);
    resetInboxCache();
    resetSettingsCache();
    resetTutorialsCache();
    if (failed.length > 0) throw new ResetError(failed);
  });
}
