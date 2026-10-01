import { XP_SIGNUP_CAP } from '../../src/account/rules';
import { levelFromXp } from '../../src/lib/progression';
import { query } from '../_lib/db';
import { clientIp, fail, handler, json, preflight, readJson } from '../_lib/http';
import { ownerView, profileColumns, rankOf, sanitizeProgress, validateProfile, type PlayerRow, type ProfileInput } from '../_lib/players';
import { hashSecret, newRecoveryCode, newToken, rateLimit } from '../_lib/security';

// POST /api/v1/players — crea una cuenta. Devuelve el token (una sola vez) y el código de recuperación.
export const POST = handler(async (request) => {
  if (!(await rateLimit('register', clientIp(request), 200, 3600))) {
    return fail(request, 429, 'rate_limited', 'Hay demasiados registros desde esta red. Intenta en unos minutos.');
  }
  const body = await readJson<{ profile?: ProfileInput; progress?: unknown }>(request);
  if (!body) return fail(request, 400, 'bad_request', 'Solicitud no válida.');
  const check = validateProfile(body.profile ?? {}, 'create');
  if (!check.ok) return fail(request, 422, 'invalid_profile', check.message);

  const progress = sanitizeProgress(body.progress);
  // Lo jugado antes de crear la cuenta se acepta con un tope (el resto se suma al sincronizar).
  const xp = Math.min(progress.xp, XP_SIGNUP_CAP);
  const token = newToken();
  const recoveryCode = newRecoveryCode();
  const profile = profileColumns(check.value);
  const columns = ['token_hash', 'recovery_hash', ...profile.columns, 'xp', 'level', 'games', 'streak', 'best_route', 'routes', 'achievements', 'last_sync_at'];
  const values = [
    hashSecret(token),
    hashSecret(recoveryCode),
    ...profile.params,
    xp,
    levelFromXp(xp),
    progress.games,
    progress.streak,
    progress.bestRoute,
    progress.routes,
    progress.achievements,
    new Date().toISOString(),
  ];
  const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
  const rows = await query<PlayerRow>(`insert into players (${columns.join(', ')}) values (${placeholders}) returning *`, values);
  const row = rows[0];
  return json(request, { token, recoveryCode, player: ownerView(row), rank: await rankOf(row) }, 201);
});

export const OPTIONS = preflight;
