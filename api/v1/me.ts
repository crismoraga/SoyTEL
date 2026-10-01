import { requirePlayer } from '../_lib/auth';
import { query } from '../_lib/db';
import { fail, handler, json, preflight, readJson } from '../_lib/http';
import { ownerView, profileColumns, rankOf, validateProfile, type PlayerRow, type ProfileInput } from '../_lib/players';

// GET /api/v1/me — perfil propio y posición en el ranking.
export const GET = handler(async (request) => {
  const player = await requirePlayer(request);
  if (player instanceof Response) return player;
  return json(request, { player: ownerView(player), rank: await rankOf(player) });
});

// PATCH /api/v1/me — edita alias, avatar, curso, colegio o el consentimiento de contacto.
export const PATCH = handler(async (request) => {
  const player = await requirePlayer(request);
  if (player instanceof Response) return player;
  const body = await readJson<ProfileInput>(request);
  if (!body) return fail(request, 400, 'bad_request', 'Solicitud no válida.');
  const check = validateProfile(body, 'update', player);
  if (!check.ok) return fail(request, 422, 'invalid_profile', check.message);
  const { columns, params } = profileColumns(check.value);
  if (columns.length === 0) return json(request, { player: ownerView(player), rank: await rankOf(player) });
  const assignments = columns.map((column, index) => `${column} = $${index + 1}`).join(', ');
  const rows = await query<PlayerRow>(
    `update players set ${assignments}, updated_at = now() where id = $${columns.length + 1} returning *`,
    [...params, player.id],
  );
  return json(request, { player: ownerView(rows[0]), rank: await rankOf(rows[0]) });
});

// DELETE /api/v1/me — elimina la cuenta y todos sus datos de forma permanente.
export const DELETE = handler(async (request) => {
  const player = await requirePlayer(request);
  if (player instanceof Response) return player;
  await query('delete from players where id = $1', [player.id]);
  return json(request, { deleted: true });
});

export const OPTIONS = preflight;
