// Coordinación de las escrituras locales.
//
// Casi todo lo que se guarda en el dispositivo se lee, se modifica y se vuelve a escribir. Si dos de
// esas operaciones se cruzan (dos resultados seguidos, un premio mientras se edita el alias), la
// segunda pisa a la primera. `withLock` las ordena por agregado: las de un mismo nombre corren de a una.
//
// `exclusive` es para el borrado total: espera lo que ya estaba en curso, corre solo y deja en espera
// lo que llegue mientras tanto. Así una escritura que empezó antes de borrar no "resucita" datos.

const chains = new Map<string, Promise<unknown>>();
let barrier: Promise<void> | null = null;
let generation = 0;

export function withLock<T>(name: string, task: () => Promise<T>): Promise<T> {
  // Lo encolado antes de un borrado total termina primero; lo que llega durante el borrado espera.
  const gate = barrier;
  const run = async () => {
    if (gate) await gate;
    return task();
  };
  const previous = chains.get(name) ?? Promise.resolve();
  const next = previous.then(run, run);
  chains.set(
    name,
    next.catch(() => undefined),
  );
  return next;
}

export async function exclusive<T>(task: () => Promise<T>): Promise<T> {
  while (barrier) await barrier;
  let release: () => void = () => undefined;
  barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    await Promise.all([...chains.values()]);
    generation += 1;
    return await task();
  } finally {
    barrier = null;
    release();
  }
}

// Cambia con cada borrado total: las memorias en caché la usan para descartar lecturas anteriores.
export function storageGeneration(): number {
  return generation;
}
