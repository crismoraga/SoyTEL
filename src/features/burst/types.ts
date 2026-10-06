import type { ComponentType } from 'react';
import type { MicroGameInfo } from './catalog';

export interface MicroGameProps {
  durationSeconds: number;
  active: boolean;
  // 0 en la primera ronda; sube a medida que avanza la ráfaga (más difícil).
  level: number;
  // Ritmo de juego: multiplica los tiempos internos (1 = original; mayor = más lento).
  pace: number;
  // `note` es una explicación breve que Rutix muestra al cerrar la ronda.
  onAnswer: (correct: boolean, bonus?: number, note?: string) => void;
}

export interface MicroGameDefinition extends MicroGameInfo {
  Component: ComponentType<MicroGameProps>;
}
