import { getSettings, useSettings, type GamePace } from '@/storage/settings';

// Ritmo de juego: multiplica los tiempos límite y frena lo que se mueve solo.
// "fast" es el ritmo original de la feria; "relaxed" (por defecto) da dos veces y media ese tiempo.
export const PACE_FACTORS: Record<GamePace, number> = {
  relaxed: 2.5,
  calm: 1.7,
  normal: 1.35,
  fast: 1,
};

// Cuánto acelera la Ráfaga en cada ronda según el ritmo (0 = no acelera).
export const PACE_ACCELERATION: Record<GamePace, number> = {
  relaxed: 0,
  calm: 0,
  normal: 0.04,
  fast: 0.08,
};

export const paceLabels: Record<GamePace, { label: string; description: string }> = {
  relaxed: { label: 'Sin apuro', description: 'El reloj casi no apura: todo el tiempo para leer, entender y responder. Recomendado.' },
  calm: { label: 'Tranquilo', description: 'Tiempo de sobra para leer y pensar.' },
  normal: { label: 'Normal', description: 'Un poco más ágil, todavía con margen.' },
  fast: { label: 'Rápido', description: 'El ritmo original: para quienes buscan el desafío.' },
};

export function paceFactor(pace: GamePace): number {
  return PACE_FACTORS[pace] ?? PACE_FACTORS.relaxed;
}

export function currentPaceFactor(): number {
  return paceFactor(getSettings().pace);
}

export function usePaceFactor(): number {
  return paceFactor(useSettings().pace);
}

// Ritmo más cercano a un factor (para mostrar el de una ruta en vivo).
export function paceFromFactor(factor: number): GamePace {
  return (Object.keys(PACE_FACTORS) as GamePace[]).reduce((best, pace) =>
    Math.abs(PACE_FACTORS[pace] - factor) < Math.abs(PACE_FACTORS[best] - factor) ? pace : best,
  );
}
