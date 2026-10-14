import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { createZipPuzzle, zipAccuracy, zipPuzzleScore, zipSizeForPuzzleLevel, type ZipState } from '@/features/stations/b215/zip/logic';
import { ZipBoard, type ZipEvent } from '@/features/stations/b215/zip/ZipBoard';
import type { PuzzleGameProps, PuzzleResult } from './types';

// Tras resolver, el tablero se deja ver un momento antes de pasar al resultado.
const SOLVED_PAUSE_MS = 900;

// Desafío sin reloj «Ruta del paquete»: lleva el paquete del 1 al último punto pasando por todas las
// casillas. Nivel 1 → 4×4, 2 → 5×5, 3 → 6×6, 4 o más → 7×7. Rutix comenta cada jugada.
export function ZipPuzzleGame({ level, seed, onSolved, say }: PuzzleGameProps) {
  const [puzzle] = useState(() => createZipPuzzle(zipSizeForPuzzleLevel(level), seed));
  const [result, setResult] = useState<PuzzleResult | null>(null);
  const report = useRef(onSolved);
  const last = puzzle.checkpoints.length;
  const cells = puzzle.size * puzzle.size;

  useEffect(() => {
    report.current = onSolved;
  });

  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => report.current(result), SOLVED_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [result]);

  function comment(event: ZipEvent) {
    switch (event.type) {
      case 'point':
        say(`¡Punto ${event.number}! Ahora ve al ${event.number + 1}.`, 'good');
        break;
      case 'refused':
        say(event.fault === 'early' ? `El ${last} va al final: antes cubre todas las casillas.` : `Primero pasa por el ${event.next}: el paquete visita los routers en orden.`, 'tip');
        break;
      case 'cut':
        say('Retrocediste. Prueba otro camino.', 'idle');
        break;
      case 'stuck':
        say('Así quedarán casillas sin paso. Retrocede un poco o toca Deshacer.', 'bad');
        break;
      case 'reset':
        say('Volvimos al inicio. Parte desde el 1.', 'idle');
        break;
      case 'solved':
        say('¡Paquete entregado! Pasaste por todas las casillas.', 'great');
        break;
      default:
        break;
    }
  }

  function handleSolved(state: ZipState) {
    const accuracy = zipAccuracy(state);
    const extra = Math.max(0, state.steps - (cells - 1));
    setResult({
      score: zipPuzzleScore(accuracy),
      accuracy,
      detail: `${cells} casillas · ${extra > 0 ? `${extra} ${extra === 1 ? 'paso' : 'pasos'} de más` : 'sin retroceder'}`,
    });
  }

  return (
    <View style={styles.root}>
      <ZipBoard puzzle={puzzle} messages={false} minBoard={260} onEvent={comment} onSolved={handleSolved} />
    </View>
  );
}

const styles = StyleSheet.create({
  // La pantalla se desplaza: el tablero ocupa lo que sobra, pero nunca queda diminuto.
  root: {
    flex: 1,
    minHeight: 400,
  },
});
