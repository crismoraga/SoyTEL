import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { gameNow } from '../../kit';
import type { RoundProps, RoundResult } from '../types';
import { createZipPuzzle, zipAccuracy, zipSizeForRoundLevel, zipSolvedScore, zipTimeUpScore, type ZipState } from './logic';
import { ZipBoard } from './ZipBoard';

// Duración de la ronda en ritmo normal (el circuito la multiplica por el ritmo).
export const ZIP_ROUND_SECONDS = 45;
// Tras resolver, el tablero se deja ver un momento (con su estallido) antes de pasar al resultado.
const SOLVED_PAUSE_MS = 900;

// Ronda «Ruta del paquete»: lleva el paquete del 1 al último punto pasando por todas las casillas.
// Nivel 0 → 4×4, 1 → 5×5, 2 → 6×6. Resuelta vale 0,85 más hasta 0,15 por el tiempo que sobró; si se acaba
// el tiempo, 0,6 por la parte del tablero cubierta.
export function ZipRound({ seed, level, pace, timeUp, onDone }: RoundProps) {
  const [puzzle] = useState(() => createZipPuzzle(zipSizeForRoundLevel(level), seed));
  const [startedAt] = useState(() => gameNow());
  const [solved, setSolved] = useState<RoundResult | null>(null);
  // Último recorrido del jugador (lo deja el tablero en cada cambio) para puntuar si se acaba el tiempo.
  const latest = useRef<ZipState | null>(null);
  const report = useRef(onDone);
  const reported = useRef(false);
  const total = puzzle.size * puzzle.size;

  useEffect(() => {
    report.current = onDone;
  });

  const finish = useCallback((result: RoundResult) => {
    if (reported.current) return;
    reported.current = true;
    report.current(result);
  }, []);

  useEffect(() => {
    if (!solved) return;
    const timer = setTimeout(() => finish(solved), SOLVED_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [finish, solved]);

  useEffect(() => {
    if (!timeUp) return;
    if (solved) {
      finish(solved);
      return;
    }
    const state = latest.current;
    const covered = state ? state.path.length : 1;
    finish({ score: zipTimeUpScore(covered, total), accuracy: state ? zipAccuracy(state) : 0, detail: `Cubriste ${covered} de ${total} casillas.` });
  }, [finish, solved, timeUp, total]);

  function handleSolved(state: ZipState) {
    const budget = ZIP_ROUND_SECONDS * (pace > 0 ? pace : 1) * 1000;
    const elapsed = Math.max(0, gameNow() - startedAt);
    setSolved({
      score: zipSolvedScore(1 - elapsed / budget),
      accuracy: zipAccuracy(state),
      detail: `¡Paquete entregado! Pasaste por las ${total} casillas en ${Math.max(1, Math.round(elapsed / 1000))} s.`,
    });
  }

  return (
    <View style={styles.root}>
      <ZipBoard
        puzzle={puzzle}
        disabled={timeUp || solved !== null}
        onChange={(state) => {
          latest.current = state;
        }}
        onSolved={handleSolved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
  },
});
