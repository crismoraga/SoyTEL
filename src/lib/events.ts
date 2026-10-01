// Bus de eventos mínimo para avisos globales (logros, subida de nivel) sin acoplar la UI al almacenamiento.
export type AppEvent =
  | { type: 'achievement'; id: string }
  | { type: 'levelUp'; level: number }
  | { type: 'toast'; title: string; body?: string }
  // El progreso local cambió (partida, logro): la cuenta lo sincroniza en segundo plano.
  | { type: 'progress' };

type Listener = (event: AppEvent) => void;

const listeners = new Set<Listener>();

export function emitAppEvent(event: AppEvent): void {
  listeners.forEach((listener) => listener(event));
}

export function onAppEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
