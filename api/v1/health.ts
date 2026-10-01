import { query } from '../_lib/db';
import { handler, json, preflight } from '../_lib/http';

// GET /api/v1/health — estado de la API y de la base de datos.
export const GET = handler(async (request) => {
  const started = Date.now();
  await query('select 1');
  return json(request, { ok: true, db: true, latencyMs: Date.now() - started, region: process.env.VERCEL_REGION ?? null });
});

export const OPTIONS = preflight;
