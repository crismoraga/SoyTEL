import { ACHIEVEMENT_IDS } from '../../src/account/catalog';
import { XP_BUDGET_CAP, XP_PER_SECOND } from '../../src/account/rules';
import { requireSession, sessionExpired } from '../_lib/auth';
import { query } from '../_lib/db';
import { fail, handler, json, preflight, readJson } from '../_lib/http';
import { levelSql, ownerView, rankOrNull, sanitizeProgress, type PlayerRow } from '../_lib/players';
import { rateLimit } from '../_lib/security';

// Presupuesto de XP disponible ahora: lo que quedaba más lo recargado desde el último gasto, con tope.
const TOKENS = `least($2::double precision, xp_budget + $3::double precision * greatest(0, extract(epoch from (now() - budget_at))))`;
// XP que se acepta de lo pedido ($1): nunca negativo, nunca más que el presupuesto.
const GRANTED = `greatest(0, least($1::int - xp, floor(${TOKENS})))::int`;

// POST /api/v1/sync — sube el progreso del dispositivo.
//
// Los juegos corren en el teléfono, así que el servidor no confía a ciegas: el XP nunca baja y solo
// sube lo que permite el presupuesto de la cuenta. Todo ocurre en una sola sentencia que lee y escribe
// la misma fila: dos sincronizaciones simultáneas no pueden bajar el XP, gastar dos veces el mismo
// presupuesto ni dejar un nivel que no corresponda al XP.
export const POST = handler(async (request) => {
  const { player, tokenHash } = await requireSession(request);
  if (!(await rateLimit('sync', player.id, 30, 60))) return fail(request, 429, 'rate_limited', 'Demasiadas sincronizaciones seguidas.');
  const body = await readJson<{ progress?: unknown }>(request);
  const progress = sanitizeProgress(body.progress);

  const rows = await query<PlayerRow>(
    `update players set
       xp = xp + ${GRANTED},
       level = ${levelSql(`xp + ${GRANTED}`)},
       xp_budget = ${TOKENS} - ${GRANTED},
       budget_at = now(),
       games = greatest(games, $4),
       streak = $5,
       best_route = greatest(best_route, $6),
       routes = greatest(routes, $7),
       achievements = array(select distinct item from unnest(achievements || $8::text[]) as item where item = any($9::text[]) order by item),
       flags = flags + case when $1::int - xp > floor(${TOKENS}) then 1 else 0 end,
       last_sync_at = now(),
       updated_at = now()
     where id = $10 and token_hash = $11
     returning *`,
    [progress.xp, XP_BUDGET_CAP, XP_PER_SECOND, progress.games, progress.streak, progress.bestRoute, progress.routes, progress.achievements, ACHIEVEMENT_IDS, player.id, tokenHash],
  );
  const row = rows[0];
  if (!row) throw sessionExpired();
  // Quedó XP sin aceptar: se sumará en las próximas sincronizaciones, a medida que el presupuesto se recargue.
  return json(request, { player: ownerView(row), rank: await rankOrNull(row), clamped: progress.xp > row.xp });
});

export const OPTIONS = preflight;
