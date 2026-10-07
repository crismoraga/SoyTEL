import { requireSession, sessionExpired } from '../_lib/auth';
import { query } from '../_lib/db';
import { allowRead, fail, handler, json, preflight, readJson } from '../_lib/http';
import { ownerView, profileColumns, rankOrNull, validateProfile, type PlayerRow, type ProfileInput } from '../_lib/players';
import { rateLimit } from '../_lib/security';

// GET /api/v1/me — perfil propio y posición en el ranking.
export const GET = handler(async (request) => {
  const { player } = await requireSession(request);
  if (!allowRead('me', player.id, 120, 60_000)) return fail(request, 429, 'rate_limited', 'Demasiadas consultas seguidas.');
  return json(request, { player: ownerView(player), rank: await rankOrNull(player) });
});

// PATCH /api/v1/me — edita alias, avatar, curso, colegio o el consentimiento de contacto.
export const PATCH = handler(async (request) => {
  const { player, tokenHash } = await requireSession(request);
  if (!(await rateLimit('edit', player.id, 60, 3600))) return fail(request, 429, 'rate_limited', 'Demasiados cambios seguidos. Intenta más tarde.');
  const body = await readJson<ProfileInput>(request);
  const check = validateProfile(body, 'update', player);
  if (!check.ok) return fail(request, 422, 'invalid_profile', check.message);
  const { columns, params } = profileColumns(check.value);
  if (columns.length === 0) return json(request, { player: ownerView(player), rank: await rankOrNull(player) });
  const assignments = columns.map((column, index) => `${column} = $${index + 1}`).join(', ');
  // Una sola sentencia, condicionada al token: la regla del contacto la revisa la base sobre la fila
  // tal como quede (dos cambios simultáneos no pueden dejarla incumplida).
  const rows = await query<PlayerRow>(
    `update players set ${assignments}, updated_at = now() where id = $${columns.length + 1} and token_hash = $${columns.length + 2} returning *`,
    [...params, player.id, tokenHash],
  );
  if (!rows[0]) throw sessionExpired();
  return json(request, { player: ownerView(rows[0]), rank: await rankOrNull(rows[0]) });
});

// DELETE /api/v1/me — elimina la cuenta y todos sus datos de forma permanente.
export const DELETE = handler(async (request) => {
  const { player, tokenHash } = await requireSession(request);
  const rows = await query<{ id: string }>('delete from players where id = $1 and token_hash = $2 returning id', [player.id, tokenHash]);
  if (!rows[0]) throw sessionExpired();
  return json(request, { deleted: true });
});

export const OPTIONS = preflight;
