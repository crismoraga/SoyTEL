import { allowedXp } from '../../src/account/rules';
import { levelFromXp } from '../../src/lib/progression';
import { requirePlayer } from '../_lib/auth';
import { query } from '../_lib/db';
import { fail, handler, json, preflight, readJson } from '../_lib/http';
import { ownerView, rankOf, sanitizeProgress, type PlayerRow } from '../_lib/players';
import { rateLimit } from '../_lib/security';

// POST /api/v1/sync — sube el progreso del dispositivo. El XP nunca baja y su alza se limita según el
// tiempo transcurrido (los juegos corren en el teléfono, así que el servidor no confía a ciegas).
export const POST = handler(async (request) => {
  const player = await requirePlayer(request);
  if (player instanceof Response) return player;
  if (!(await rateLimit('sync', player.id, 30, 60))) return fail(request, 429, 'rate_limited', 'Demasiadas sincronizaciones seguidas.');
  const body = await readJson<{ progress?: unknown }>(request);
  if (!body) return fail(request, 400, 'bad_request', 'Solicitud no válida.');

  const progress = sanitizeProgress(body.progress);
  const since = Date.parse(player.last_sync_at ?? player.created_at);
  const elapsedSeconds = Number.isFinite(since) ? (Date.now() - since) / 1000 : 0;
  const allowed = allowedXp(player.xp, elapsedSeconds);
  const xp = Math.max(player.xp, Math.min(progress.xp, Math.floor(allowed)));
  const clamped = progress.xp > allowed;

  const rows = await query<PlayerRow>(
    `update players set
       xp = $1,
       level = $2,
       games = greatest(games, $3),
       streak = $4,
       best_route = greatest(best_route, $5),
       routes = greatest(routes, $6),
       achievements = array(select distinct unnest(achievements || $7::text[])),
       flags = flags + $8,
       last_sync_at = now(),
       updated_at = now()
     where id = $9
     returning *`,
    [xp, levelFromXp(xp), progress.games, progress.streak, progress.bestRoute, progress.routes, progress.achievements, clamped ? 1 : 0, player.id],
  );
  const row = rows[0];
  return json(request, { player: ownerView(row), rank: await rankOf(row), clamped });
});

export const OPTIONS = preflight;
