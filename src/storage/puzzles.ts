import AsyncStorage from '@react-native-async-storage/async-storage';

// Avance en los desafíos sin reloj (Conecta la red, Parejas TEL, Binario, Mensaje cifrado).
const PUZZLES_KEY = '@soytel/puzzles';

export type PuzzleId = 'red' | 'memoria' | 'binario' | 'cifrado';
export const puzzleIds: PuzzleId[] = ['red', 'memoria', 'binario', 'cifrado'];

export interface PuzzleProgress {
  // Nivel más alto resuelto (0 = ninguno).
  level: number;
  best: number;
  solved: number;
}

export type PuzzleProgressMap = Record<PuzzleId, PuzzleProgress>;

const empty = (): PuzzleProgressMap => ({
  red: { level: 0, best: 0, solved: 0 },
  memoria: { level: 0, best: 0, solved: 0 },
  binario: { level: 0, best: 0, solved: 0 },
  cifrado: { level: 0, best: 0, solved: 0 },
});

export async function loadPuzzleProgress(): Promise<PuzzleProgressMap> {
  const base = empty();
  try {
    const raw = await AsyncStorage.getItem(PUZZLES_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<PuzzleProgressMap>) : {};
    puzzleIds.forEach((id) => {
      const item = parsed[id];
      if (item) base[id] = { level: Number(item.level) || 0, best: Number(item.best) || 0, solved: Number(item.solved) || 0 };
    });
  } catch {
    // Datos dañados: se parte de cero.
  }
  return base;
}

export async function recordPuzzleSolved(id: PuzzleId, level: number, score: number): Promise<PuzzleProgressMap> {
  const progress = await loadPuzzleProgress();
  const previous = progress[id];
  progress[id] = { level: Math.max(previous.level, level), best: Math.max(previous.best, score), solved: previous.solved + 1 };
  await AsyncStorage.setItem(PUZZLES_KEY, JSON.stringify(progress));
  return progress;
}

export const PUZZLE_KEYS = [PUZZLES_KEY];
