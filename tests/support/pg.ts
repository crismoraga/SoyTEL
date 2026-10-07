import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';
import { createInterface } from 'readline';

// Cliente del Postgres de pruebas (tests/support/pgServer.mjs).

export interface PgError extends Error {
  code: string | null;
}

export interface TestDatabase {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  transaction(statements: string[]): Promise<void>;
  // Deja la base vacía (sin tablas).
  reset(): Promise<void>;
  stop(): Promise<void>;
  // Consultas ejecutadas desde la última vez que se pidió (texto SQL), para contar accesos a la base.
  drainLog(): string[];
}

export async function startTestDatabase(): Promise<TestDatabase> {
  const child: ChildProcessWithoutNullStreams = spawn(process.execPath, [path.join(__dirname, 'pgServer.mjs')], { stdio: 'pipe' });
  const waiting = new Map<number, { resolve: (rows: unknown[]) => void; reject: (error: Error) => void }>();
  let nextId = 1;
  let log: string[] = [];
  let ready: () => void = () => undefined;
  const whenReady = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const stderr: string[] = [];
  child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk.toString()));
  child.once('exit', (code) => {
    waiting.forEach(({ reject }) => reject(new Error(`El Postgres de pruebas terminó (código ${code}). ${stderr.join('').slice(-400)}`)));
    waiting.clear();
  });

  createInterface({ input: child.stdout }).on('line', (line) => {
    const message = JSON.parse(line) as { ready?: boolean; id?: number; rows?: unknown[]; error?: { message: string; code: string | null } };
    if (message.ready) {
      ready();
      return;
    }
    const pending = message.id === undefined ? undefined : waiting.get(message.id);
    if (!pending || message.id === undefined) return;
    waiting.delete(message.id);
    if (message.error) {
      const error = new Error(message.error.message) as PgError;
      error.code = message.error.code;
      pending.reject(error);
    } else {
      pending.resolve(message.rows ?? []);
    }
  });

  const send = (command: Record<string, unknown>) =>
    new Promise<unknown[]>((resolve, reject) => {
      const id = nextId++;
      waiting.set(id, { resolve, reject });
      child.stdin.write(`${JSON.stringify({ id, ...command })}\n`);
    });

  await Promise.race([
    whenReady,
    new Promise<void>((_, reject) => {
      const timer = setTimeout(() => reject(new Error(`El Postgres de pruebas no partió. ${stderr.join('').slice(-400)}`)), 60_000);
      void whenReady.then(() => clearTimeout(timer));
    }),
  ]);

  return {
    query: <T,>(text: string, params: unknown[] = []) => {
      log.push(text);
      return send({ op: 'query', text, params }) as Promise<T[]>;
    },
    transaction: async (statements) => {
      await send({ op: 'transaction', statements });
    },
    reset: async () => {
      await send({ op: 'reset' });
    },
    stop: () =>
      new Promise<void>((resolve) => {
        if (child.exitCode !== null) {
          resolve();
          return;
        }
        const timer = setTimeout(() => child.kill(), 3000);
        child.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
        child.stdin.write(`${JSON.stringify({ id: 0, op: 'quit' })}\n`);
      }),
    drainLog: () => {
      const taken = log;
      log = [];
      return taken;
    },
  };
}
