import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

// Postgres (Neon) por HTTP: una consulta por llamada, ideal para funciones sin estado.
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

export async function query<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await db().query(text, params)) as T[];
}
