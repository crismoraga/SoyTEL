import type { GameResult } from '@/types/game';

// Desafío diario: una ráfaga con los mismos microjuegos para todos durante el día.
export const DAILY_ROUNDS = 5;
export const DAILY_BONUS = 250;

// Día local en formato AAAA-MM-DD.
export function dailyKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
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

export function isDailyDone(results: GameResult[], key: string): boolean {
  return results.some((result) => result.gameId === 'burst' && result.metadata?.daily === key);
}

// Días (distintos) con el desafío completado.
export function dailyDays(results: GameResult[]): number {
  return new Set(results.filter((result) => result.gameId === 'burst' && typeof result.metadata?.daily === 'string' && result.metadata.daily).map((result) => String(result.metadata?.daily))).size;
}
