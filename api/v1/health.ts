import { query } from '../_lib/db';
import { handler, json, preflight } from '../_lib/http';
import { configProblems, openField } from '../_lib/security';

interface Check {
  ok: boolean;
  problems: string[];
  latencyMs: number;
  at: number;
}

// El estado se revisa contra la base a lo más una vez cada 20 s por instancia: una ráfaga de
// consultas a esta dirección pública no se convierte en una ráfaga de consultas a Postgres.
const TTL_MS = 20_000;
let last: Check | null = null;
let running: Promise<Check> | null = null;

async function check(): Promise<Check> {
  const started = Date.now();
  // Solo nombres de lo que falla, nunca valores ni mensajes del servidor de base de datos.
  const problems = configProblems();
  try {
    await query('select 1');
    if (!problems.includes('data_key')) {
      // La llave puede tener el formato correcto y aun así no ser la que cifró lo guardado: se prueba
      // con un dato real (sin devolverlo ni registrarlo).
      const rows = await query<{ contact_value: string | null }>('select contact_value from players where contact_value is not null order by updated_at desc limit 1');
      if (rows[0] && openField(rows[0].contact_value).state === 'unreadable') problems.push('data_key_mismatch');
    }
  } catch {
    problems.push('database');
  }
  return { ok: problems.length === 0, problems, latencyMs: Date.now() - started, at: Date.now() };
}

export function resetHealthCache(): void {
  last = null;
  running = null;
}

// GET /api/v1/health — ¿la API puede atender? Revisa la base y la configuración de los datos sensibles.
// Responde 503 si algo falta: un monitor externo lo ve sin tener que interpretar el cuerpo.
export const GET = handler(async (request) => {
  if (!last || Date.now() - last.at >= TTL_MS) {
    if (!running) {
      running = check().finally(() => {
        running = null;
      });
    }
    last = await running;
  }
  return json(
    request,
    { ok: last.ok, db: !last.problems.includes('database'), problems: last.problems, latencyMs: last.latencyMs, region: process.env.VERCEL_REGION ?? null },
    last.ok ? 200 : 503,
    { 'Cache-Control': 'public, max-age=10, s-maxage=20' },
  );
});

export const OPTIONS = preflight;
