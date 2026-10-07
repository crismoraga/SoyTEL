import { isRecoveryCode, isSessionToken, XP_BURST_ALLOWANCE, XP_SIGNUP_CAP } from '../../src/account/rules';
import { query } from '../_lib/db';
import { clientIp, fail, handler, HttpError, json, preflight, readJson } from '../_lib/http';
import { levelSql, ownerView, profileColumns, rankOrNull, sanitizeProgress, validateProfile, type PlayerRow, type ProfileInput } from '../_lib/players';
import { hashSecret, newRecoveryCode, newToken, rateLimit } from '../_lib/security';

interface SignupBody {
  profile?: ProfileInput;
  progress?: unknown;
  // Credenciales generadas por el dispositivo (ver src/account/rules.ts). Repetir la solicitud con las
  // mismas devuelve la misma cuenta: una respuesta perdida no deja una cuenta sin dueño.
  credentials?: { token?: unknown; recoveryCode?: unknown };
}

// POST /api/v1/players — crea una cuenta. Devuelve el token y el código de recuperación.
export const POST = handler(async (request) => {
  if (!(await rateLimit('register', clientIp(request), 200, 3600))) {
    return fail(request, 429, 'rate_limited', 'Hay demasiados registros desde esta red. Intenta en unos minutos.');
  }
  const body = await readJson<SignupBody>(request);
  const check = validateProfile(body.profile ?? {}, 'create');
  if (!check.ok) return fail(request, 422, 'invalid_profile', check.message);

  let token: string;
  let recoveryCode: string;
  if (body.credentials !== undefined) {
    const given = body.credentials ?? {};
    if (!isSessionToken(given.token) || typeof given.recoveryCode !== 'string' || !isRecoveryCode(given.recoveryCode)) {
      throw new HttpError(400, 'bad_credentials', 'Solicitud no válida.');
    }
    token = given.token;
    recoveryCode = given.recoveryCode.toUpperCase();
  } else {
    // Versiones anteriores de la app: las genera el servidor.
    token = newToken();
    recoveryCode = newRecoveryCode();
  }

  const progress = sanitizeProgress(body.progress);
  // Lo jugado antes de crear la cuenta se acepta con un tope (el resto se suma al sincronizar).
  const xp = Math.min(progress.xp, XP_SIGNUP_CAP);
  const profile = profileColumns(check.value);
  const columns = ['token_hash', 'recovery_hash', ...profile.columns, 'xp', 'games', 'streak', 'best_route', 'routes', 'achievements', 'xp_budget'];
  const values = [hashSecret(token), hashSecret(recoveryCode), ...profile.params, xp, progress.games, progress.streak, progress.bestRoute, progress.routes, progress.achievements, XP_BURST_ALLOWANCE];
  const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
  const xpIndex = columns.indexOf('xp') + 1;
  const inserted = await query<PlayerRow>(
    `insert into players (${columns.join(', ')}, level, last_sync_at, budget_at)
     values (${placeholders}, ${levelSql(`$${xpIndex}::int`)}, now(), now())
     on conflict do nothing
     returning *`,
    values,
  );
  let row = inserted[0];
  let created = true;
  if (!row) {
    // Ya existe una cuenta con esas credenciales: si son las dos, es este mismo dispositivo repitiendo.
    const existing = await query<PlayerRow>('select * from players where token_hash = $1 and recovery_hash = $2', [hashSecret(token), hashSecret(recoveryCode)]);
    row = existing[0];
    created = false;
    if (!row) return fail(request, 409, 'credentials_conflict', 'No se pudo crear la cuenta. Intenta de nuevo.');
  }
  return json(request, { token, recoveryCode, player: ownerView(row), rank: await rankOrNull(row) }, created ? 201 : 200);
});

export const OPTIONS = preflight;
