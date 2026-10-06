import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAccount } from '@/account/store';

// Tutoriales ya vistos: cada juego explica cómo se juega la primera vez y después solo si se pide.
const TUTORIALS_KEY = '@soytel/tutorials';

let cache: Set<string> | null = null;

export async function loadSeenTutorials(): Promise<Set<string>> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(TUTORIALS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cache = new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    cache = new Set();
  }
  return cache;
}

export async function markTutorialSeen(id: string): Promise<void> {
  const seen = await loadSeenTutorials();
  if (seen.has(id)) return;
  seen.add(id);
  await AsyncStorage.setItem(TUTORIALS_KEY, JSON.stringify([...seen])).catch(() => undefined);
}

export function resetTutorialsCache(): void {
  cache = null;
}

export interface TutorialControl {
  visible: boolean;
  // Aún no se sabe si ya se vio (o hay otra ventana delante): conviene no partir el juego.
  pending: boolean;
  open: () => void;
  close: () => void;
}

// Abre el tutorial la primera vez que se entra a un juego. Espera a que se cierre la invitación a
// crear cuenta para no apilar dos ventanas.
export function useTutorial(id: string | null): TutorialControl {
  const account = useAccount();
  const [state, setState] = useState<{ id: string | null; seen: boolean | null; open: boolean }>({ id, seen: null, open: false });
  const blocked = account.status === 'loading' || (account.status === 'guest' && !account.offerDismissed);

  useEffect(() => {
    if (!id) return;
    let active = true;
    void loadSeenTutorials().then((seen) => {
      if (active) setState({ id, seen: seen.has(id), open: false });
    });
    return () => {
      active = false;
    };
  }, [id]);

  const current = state.id === id ? state : { id, seen: null, open: false };
  const auto = Boolean(id) && current.seen === false && !blocked;

  const open = useCallback(() => setState((value) => ({ ...value, id, open: true })), [id]);
  const close = useCallback(() => {
    if (id) void markTutorialSeen(id);
    setState({ id, seen: true, open: false });
  }, [id]);

  return { visible: current.open || auto, pending: Boolean(id) && (current.seen === null || (current.seen === false && blocked)), open, close };
}

export const TUTORIAL_KEYS = [TUTORIALS_KEY];
