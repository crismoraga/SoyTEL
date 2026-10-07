import AsyncStorage from '@react-native-async-storage/async-storage';

// Fallos y demoras inyectados en el AsyncStorage de pruebas.
//
// Sus métodos ya son `jest.fn`: `jest.spyOn(...).mockRestore()` sobre ellos borraría su implementación
// para el resto del archivo. Aquí se guarda la implementación original y se repone a mano.

type Method = 'getItem' | 'setItem' | 'multiSet' | 'multiRemove' | 'removeItem';
type Implementation = (...args: unknown[]) => Promise<unknown>;

const restorers: (() => void)[] = [];

function swap(method: Method, wrap: (original: Implementation) => Implementation): () => void {
  const mock = AsyncStorage[method] as unknown as jest.Mock;
  const original = mock.getMockImplementation() as Implementation;
  mock.mockImplementation(wrap(original));
  const restore = () => {
    mock.mockImplementation(original);
  };
  restorers.push(restore);
  return restore;
}

// Deja todos los métodos como estaban (llamar en afterEach).
export function restoreStorage(): void {
  restorers.splice(0).forEach((restore) => restore());
}

// La clave que escribe o lee una llamada (o las claves, si es una escritura múltiple).
function keysOf(args: unknown[]): string[] {
  const first = args[0];
  if (typeof first === 'string') return [first];
  if (Array.isArray(first)) return first.map((item) => (Array.isArray(item) ? String(item[0]) : String(item)));
  return [];
}

// Hace fallar las próximas `times` llamadas que toquen `key` (todas las llamadas si no se indica clave).
export function failStorage(method: Method, options: { key?: string; times?: number; error?: Error } = {}): () => void {
  let left = options.times ?? 1;
  return swap(method, (original) => (...args) => {
    if (left > 0 && (options.key === undefined || keysOf(args).includes(options.key))) {
      left -= 1;
      return Promise.reject(options.error ?? new Error('sin espacio'));
    }
    return original(...args);
  });
}

// Retiene las llamadas que toquen `key` hasta llamar a `release`.
export function holdStorage(method: Method, key: string): { release: () => void; restore: () => void } {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const restore = swap(method, (original) => async (...args) => {
    if (keysOf(args).includes(key)) await held;
    return original(...args);
  });
  return { release, restore };
}
