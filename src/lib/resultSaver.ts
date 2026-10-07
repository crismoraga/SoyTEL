import { useCallback, useEffect, useRef, useState } from 'react';
import { recordGameResult, type RecordOptions } from '@/storage/profile';
import type { GameOutcome, GameResult } from '@/types/game';

// Identificador de una partida. Va en el resultado: guardarlo dos veces suma una sola.
export function newRunId(kind: string): string {
  return `${kind}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

interface SaverState {
  status: SaveStatus;
  outcome: GameOutcome | null;
}

const IDLE: SaverState = { status: 'idle', outcome: null };

// Guarda el resultado de una partida desde una pantalla:
// - un doble toque no lo guarda dos veces (y el id del resultado lo respalda);
// - si falla, lo dice y se puede reintentar sin duplicar;
// - si la pantalla ya empezó otra partida (o se cerró), la respuesta de la anterior se descarta.
export function useResultSaver() {
  const [state, setState] = useState<SaverState>(IDLE);
  const session = useRef(0);
  const busy = useRef(false);
  const last = useRef<{ result: GameResult; options?: RecordOptions } | null>(null);

  useEffect(
    () => () => {
      session.current += 1;
    },
    [],
  );

  // Marca de la partida en curso: `isCurrent()` deja de ser cierto al reiniciar o salir.
  const mark = useCallback(() => {
    const token = session.current;
    return () => token === session.current;
  }, []);

  const save = useCallback(async (result: GameResult, options?: RecordOptions): Promise<GameOutcome | null> => {
    if (busy.current) return null;
    busy.current = true;
    last.current = { result, options };
    const token = session.current;
    setState({ status: 'saving', outcome: null });
    try {
      const outcome = await recordGameResult(result, options);
      if (token === session.current) setState({ status: 'saved', outcome });
      return outcome;
    } catch {
      if (token === session.current) setState({ status: 'failed', outcome: null });
      return null;
    } finally {
      if (token === session.current) busy.current = false;
    }
  }, []);

  const retry = useCallback((): Promise<GameOutcome | null> => {
    const pending = last.current;
    return pending ? save(pending.result, pending.options) : Promise.resolve(null);
  }, [save]);

  // Nueva partida: lo que quede en curso de la anterior ya no toca esta pantalla.
  const reset = useCallback(() => {
    session.current += 1;
    busy.current = false;
    last.current = null;
    setState(IDLE);
  }, []);

  return { status: state.status, outcome: state.outcome, save, retry, reset, mark };
}
