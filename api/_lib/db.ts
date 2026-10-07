import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

// Postgres (Neon) por HTTP: una consulta por llamada, ideal para funciones sin estado.
// Cada cambio de la API es una sola sentencia SQL (atómica en Postgres): no hay transacciones de
// varias consultas que puedan quedar a medias entre una llamada y la siguiente.
let client: NeonQueryFunction<false, false> | null = null;

export function db(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL no está configurada');
    client = neon(url);
  }
  return client;
}

export type Row = Record<string, unknown>;

export type QueryExecutor = (text: string, params: unknown[]) => Promise<Row[]>;

let executor: QueryExecutor | null = null;

// Solo para pruebas: dirige las consultas a otro Postgres (el embebido de tests/support).
export function setQueryExecutor(next: QueryExecutor | null): void {
  executor = next;
}

export async function query<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  if (executor) return (await executor(text, params)) as T[];
  return (await db().query(text, params)) as T[];
}

// Código SQLSTATE del error de Postgres, si lo trae (23505: valor repetido; 23514: regla incumplida).
export function sqlState(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}
