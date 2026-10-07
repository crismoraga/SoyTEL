// Coordinación de las escrituras locales.
//
// Casi todo lo que se guarda en el dispositivo se lee, se modifica y se vuelve a escribir. Si dos de
// esas operaciones se cruzan (dos resultados seguidos, un premio mientras se edita el alias), la
// segunda pisa a la primera. `withLock` las ordena por agregado: las de un mismo nombre corren de a una.
//
// `exclusive` es para el borrado total: espera a que termine todo lo que ya estaba en curso, corre
// solo, y lo que llegue mientras tanto espera a que termine. Así una escritura que venía en camino no
// "resucita" datos después de borrar.
//
// Una operación puede tomar otros candados mientras corre (guardar una partida también guarda un
// aviso); siempre en el mismo orden: perfil → carrera / avisos / TEL Runner. La tarea de `exclusive`
// no debe llamar a `withLock`.

const chains = new Map<string, Promise<unknown>>();
let barrier: Promise<void> | null = null;
let generation = 0;
// Operaciones con candado en curso o en cola (sin contar las que esperan a que termine un borrado).
let pending = 0;
let idleWaiters: (() => void)[] = [];

function settle() {
  pending -= 1;
  if (pending === 0) idleWaiters.splice(0).forEach((wake) => wake());
}

export function withLock<T>(name: string, task: () => Promise<T>): Promise<T> {
  // Con un borrado en curso y nada más ejecutándose, esto es una operación nueva: espera al borrado.
  // Si hay operaciones en curso, puede ser parte de una de ellas (un candado anidado): no se frena,
  // y el borrado espera a que terminen todas antes de empezar.
  const waits = barrier !== null && pending === 0;
  if (!waits) pending += 1;
  const run = async () => {
    if (waits) {
      while (barrier !== null) await barrier;
      pending += 1;
    }
    try {
      return await task();
    } finally {
      settle();
    }
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
  while (barrier !== null) await barrier;
  let release: () => void = () => undefined;
  barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    while (pending > 0) {
      await new Promise<void>((resolve) => {
        idleWaiters.push(resolve);
      });
    }
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
