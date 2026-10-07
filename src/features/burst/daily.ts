import { localDayKey } from '@/lib/day';
import type { GameResult } from '@/types/game';

// Desafío diario: una ráfaga con los mismos microjuegos para todos durante el día.
export const DAILY_ROUNDS = 5;
export const DAILY_BONUS = 250;

// Día local en formato AAAA-MM-DD (la misma clave que usan misiones, racha y cuidados de Rutix).
export function dailyKey(date: Date): string {
  return localDayKey(date);
}

// Id del bono de un día: se entrega una sola vez aunque el desafío se repita.
export function dailyBonusId(key: string): string {
  return `daily:${key}`;
}

// El desafío cuenta como completado al jugar todas sus rondas (perder las vidas antes no lo completa).
export function isDailyComplete(roundsPlayed: number, rounds: number): boolean {
  return rounds > 0 && roundsPlayed >= rounds;
}

// Semilla estable para el día (misma selección de microjuegos en todos los teléfonos).
export function dailySeed(date: Date): number {
  const key = dailyKey(date);
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// `metadata.daily` solo se guarda en los desafíos completados (un intento fallido no lo lleva).
export function isDailyDone(results: GameResult[], key: string): boolean {
  return results.some((result) => result.gameId === 'burst' && result.metadata?.daily === key);
}

// Días (distintos) con el desafío completado.
export function dailyDays(results: GameResult[]): number {
  return new Set(results.filter((result) => result.gameId === 'burst' && typeof result.metadata?.daily === 'string' && result.metadata.daily).map((result) => String(result.metadata?.daily))).size;
}
