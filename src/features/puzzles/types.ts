import type { CoachMood } from '@/data/coachLines';

export interface PuzzleResult {
  score: number;
  accuracy: number;
  // Resumen breve para la pantalla de resultado ("12 giros · mínimo 9").
  detail: string;
}

export interface PuzzleGameProps {
  level: number;
  seed: number;
  onSolved: (result: PuzzleResult) => void;
  // Rutix comenta lo que pasa en el tablero.
  say: (text: string, mood?: CoachMood) => void;
}
