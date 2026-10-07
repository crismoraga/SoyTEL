import { bearerToken, HttpError } from './http';
import { findPlayerByToken, type PlayerRow } from './players';
import { hashSecret } from './security';

export interface Session {
  player: PlayerRow;
  // Hash del token con que se autenticó. Toda sentencia que modifique la cuenta lo exige además del
  // id: si el token se revocó entre la lectura y el cambio (la cuenta se abrió en otro teléfono), el
  // cambio no encuentra la fila y la solicitud termina como sesión vencida.
  tokenHash: string;
}

export function sessionExpired(): HttpError {
  return new HttpError(401, 'session_expired', 'Tu sesión ya no es válida en este dispositivo.');
}

// Devuelve la sesión del dueño del token o corta la solicitud con 401.
export async function requireSession(request: Request): Promise<Session> {
  const token = bearerToken(request);
  if (!token) throw new HttpError(401, 'unauthorized', 'Inicia sesión para continuar.');
  const player = await findPlayerByToken(token);
  if (!player) throw sessionExpired();
  return { player, tokenHash: hashSecret(token) };
}
