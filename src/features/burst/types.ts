import type { ComponentType } from 'react';
import type { MicroGameInfo } from './catalog';

export interface MicroGameProps {
  durationSeconds: number;
  active: boolean;
  // 0 en la primera ronda; sube a medida que avanza la ráfaga (más difícil).
  level: number;
  // Ritmo de juego: multiplica los tiempos internos (1 = original; mayor = más lento).
  pace: number;
  onAnswer: (correct: boolean, bonus?: number) => void;
}

export interface MicroGameDefinition extends MicroGameInfo {
  Component: ComponentType<MicroGameProps>;
}
