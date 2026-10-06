import type { Href } from 'expo-router';
import { dailySeed } from '@/features/burst/daily';
import type { IconName } from '@/graphics/icons';
import { mulberry32 } from '@/route/random';
import type { GameResult } from '@/types/game';
import { isSameLocalDay } from './format';

// Misiones de Rutix: tres metas pequeñas que cambian cada día (una de la Ráfaga, una de TEL Runner
// y una para aprender). Se cumplen jugando; al completar las tres, Rutix entrega una recompensa.
export interface DailyMission {
  id: string;
  title: string;
  icon: IconName;
  route: Href;
  goal: number;
  // Avance con las partidas de hoy.
  measure: (today: GameResult[]) => number;
}

export const MISSION_REWARD_DATA = 25;
export const MISSION_REWARD_MOOD = 8;

const of = (results: GameResult[], gameId: string) => results.filter((result) => result.gameId === gameId);
const count = (gameId: string) => (results: GameResult[]) => of(results, gameId).length;
const best = (gameId: string, key: string) => (results: GameResult[]) => of(results, gameId).reduce((max, result) => Math.max(max, Number(result.metadata?.[key] ?? 0)), 0);
const sum = (gameId: string, key: string) => (results: GameResult[]) => of(results, gameId).reduce((total, result) => total + Number(result.metadata?.[key] ?? 0), 0);

const burstMissions: DailyMission[] = [
  { id: 'burst-1', title: 'Juega una Ráfaga', icon: 'bolt', route: '/burst', goal: 1, measure: count('burst') },
  { id: 'burst-lives', title: 'Termina una Ráfaga con 2 vidas o más', icon: 'heart', route: '/burst', goal: 2, measure: best('burst', 'lives') },
  {
    id: 'burst-daily',
    title: 'Completa el desafío de hoy',
    icon: 'calendar',
    route: { pathname: '/burst', params: { diario: '1' } },
    goal: 1,
    measure: (results) => of(results, 'burst').filter((result) => Boolean(result.metadata?.daily)).length,
  },
];

const runnerMissions: DailyMission[] = [
  { id: 'runner-200', title: 'Corre 200 metros en TEL Runner', icon: 'rocket', route: '/runner', goal: 200, measure: best('runner', 'distance') },
  { id: 'runner-400', title: 'Corre 400 metros en TEL Runner', icon: 'rocket', route: '/runner', goal: 400, measure: best('runner', 'distance') },
  { id: 'runner-data', title: 'Junta 30 paquetes en TEL Runner', icon: 'packet', route: '/runner', goal: 30, measure: sum('runner', 'data') },
];

const learnMissions: DailyMission[] = [
  { id: 'puzzle-1', title: 'Resuelve un desafío sin reloj', icon: 'network', route: { pathname: '/puzzle', params: { juego: 'memoria' } }, goal: 1, measure: count('puzzle') },
  { id: 'practice-1', title: 'Responde una práctica de la carrera', icon: 'school', route: '/career', goal: 1, measure: count('practice') },
  { id: 'station-1', title: 'Practica un juego de la ruta', icon: 'router', route: '/games', goal: 1, measure: count('station') },
  { id: 'quiz-5', title: 'Acierta 5 preguntas en el concurso', icon: 'help', route: '/millionaire', goal: 5, measure: best('millionaire', 'correctAnswers') },
];

export const missionPools = [burstMissions, runnerMissions, learnMissions];

// Las mismas tres misiones para todos durante el día.
export function missionsFor(date: Date): DailyMission[] {
  const random = mulberry32((dailySeed(date) ^ 0x51ed270b) >>> 0);
  return missionPools.map((pool) => pool[Math.floor(random() * pool.length)]);
}

export function todaysResults(results: GameResult[], now = new Date()): GameResult[] {
  return results.filter((result) => isSameLocalDay(new Date(result.completedAt), now));
}

export interface MissionState {
  mission: DailyMission;
  value: number;
  done: boolean;
}

export function missionStates(results: GameResult[], now = new Date()): MissionState[] {
  const today = todaysResults(results, now);
  return missionsFor(now).map((mission) => {
    const value = Math.min(mission.goal, mission.measure(today));
    return { mission, value, done: value >= mission.goal };
  });
}
