import type { ComponentType } from 'react';
import type { MicroGameId } from '@/types/game';

export interface MicroGameProps {
  durationSeconds: number;
  active: boolean;
  onAnswer: (correct: boolean, bonus?: number) => void;
}

export interface MicroGameDefinition {
  id: MicroGameId;
  title: string;
  instruction: string;
  durationSeconds: number;
  Component: ComponentType<MicroGameProps>;
}
