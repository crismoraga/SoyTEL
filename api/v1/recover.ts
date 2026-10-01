import { formatRecoveryCode, isRecoveryCode } from '../../src/account/rules';
import { query } from '../_lib/db';
import { clientIp, fail, handler, json, preflight, readJson } from '../_lib/http';
import { ownerView, rankOf, type PlayerRow } from '../_lib/players';
import { hashSecret, newToken, rateLimit } from '../_lib/security';

// POST /api/v1/recover — entra a la cuenta en otro dispositivo con el código de recuperación.
// Emite un token nuevo: el dispositivo anterior queda desconectado.
export const POST = handler(async (request) => {
  if (!(await rateLimit('recover', clientIp(request), 40, 3600))) {
    return fail(request, 429, 'rate_limited', 'Demasiados intentos. Espera un rato e intenta de nuevo.');
  }
  const body = await readJson<{ code?: unknown }>(request);
  const code = formatRecoveryCode(typeof body?.code === 'string' ? body.code : '');
  if (!isRecoveryCode(code)) return fail(request, 400, 'invalid_code', 'El código tiene el formato TEL-XXXX-XXXX-XXXX.');
  const token = newToken();
  const rows = await query<PlayerRow>('update players set token_hash = $1, updated_at = now() where recovery_hash = $2 returning *', [
    hashSecret(token),
    hashSecret(code),
  ]);
  const row = rows[0];
  if (!row) return fail(request, 404, 'not_found', 'No encontramos una cuenta con ese código.');
  return json(request, { token, player: ownerView(row), rank: await rankOf(row) });
});

export const OPTIONS = preflight;
