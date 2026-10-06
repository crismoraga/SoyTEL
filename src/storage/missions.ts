import AsyncStorage from '@react-native-async-storage/async-storage';
import { MISSION_REWARD_DATA, MISSION_REWARD_MOOD } from '@/lib/dailyMissions';
import { loadProfile, saveProfile } from './profile';
import { addRunnerData } from './runner';

// Día (AAAA-MM-DD) en que se reclamó por última vez la recompensa de las misiones de Rutix.
const MISSIONS_KEY = '@soytel/missions';

export async function loadMissionClaim(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(MISSIONS_KEY);
  } catch {
    return null;
  }
}

// Entrega la recompensa del día una sola vez: paquetes para TEL Runner y señal para Rutix.
export async function claimMissionReward(day: string): Promise<boolean> {
  if ((await loadMissionClaim()) === day) return false;
  await AsyncStorage.setItem(MISSIONS_KEY, day);
  const profile = await loadProfile();
  await Promise.all([addRunnerData(MISSION_REWARD_DATA), saveProfile({ ...profile, mascotMood: Math.min(100, profile.mascotMood + MISSION_REWARD_MOOD) })]);
  return true;
}

export const MISSION_KEYS = [MISSIONS_KEY];
