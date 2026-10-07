import { formatRecoveryCode, isRecoveryCode } from '../../src/account/rules';
import { requireSession, sessionExpired } from '../_lib/auth';
import { query } from '../_lib/db';
import { fail, handler, json, preflight, readJson } from '../_lib/http';
import { hashSecret, rateLimit } from '../_lib/security';

// POST /api/v1/recovery — cambia el código de recuperación de la cuenta (con sesión iniciada).
//
// Para cuando el código quedó expuesto (una foto compartida, un teléfono prestado): el anterior deja
// de servir en la misma sentencia en que empieza a valer el nuevo. El código nuevo lo genera el
// dispositivo y lo guarda antes de enviarlo; repetir la solicitud con el mismo código no cambia nada más.
export const POST = handler(async (request) => {
  const { player, tokenHash } = await requireSession(request);
  if (!(await rateLimit('recovery', player.id, 10, 3600))) return fail(request, 429, 'rate_limited', 'Demasiados cambios seguidos. Intenta más tarde.');
  const body = await readJson<{ code?: unknown }>(request);
  const code = formatRecoveryCode(typeof body.code === 'string' ? body.code : '');
  if (!isRecoveryCode(code)) return fail(request, 400, 'invalid_code', 'El código tiene el formato TEL-XXXX-XXXX-XXXX.');
  // Si otro jugador ya usa ese código, la base lo rechaza (409) y el dispositivo genera otro.
  const rows = await query<{ id: string }>('update players set recovery_hash = $1, updated_at = now() where id = $2 and token_hash = $3 returning id', [
    hashSecret(code),
    player.id,
    tokenHash,
  ]);
  if (!rows[0]) throw sessionExpired();
  return json(request, { rotated: true });
});

export const OPTIONS = preflight;
