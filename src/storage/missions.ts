import AsyncStorage from '@react-native-async-storage/async-storage';
import { MISSION_REWARD_DATA, MISSION_REWARD_MOOD } from '@/lib/dailyMissions';
import { withLock } from './locks';
import { updateMascotMood } from './profile';
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
//
// Cada parte es idempotente por día (lleva el id `mission:<día>`), y el día recién se marca como
// reclamado cuando ambas quedaron entregadas. Si algo falla a medio camino, reintentar completa lo que
// faltaba sin duplicar lo que ya se entregó; dos toques seguidos entregan una sola recompensa.
// Devuelve false si ya estaba reclamada; lanza si no se pudo completar (se puede reintentar).
export function claimMissionReward(day: string): Promise<boolean> {
  return withLock('missions', async () => {
    if ((await AsyncStorage.getItem(MISSIONS_KEY)) === day) return false;
    const grant = `mission:${day}`;
    await addRunnerData(MISSION_REWARD_DATA, grant);
    await updateMascotMood(MISSION_REWARD_MOOD, grant);
    await AsyncStorage.setItem(MISSIONS_KEY, day);
    return true;
  });
}

export const MISSION_KEYS = [MISSIONS_KEY];
