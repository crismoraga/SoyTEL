import { bearerToken, fail } from './http';
import { findPlayerByToken, type PlayerRow } from './players';

// Devuelve el jugador dueño del token o una respuesta 401 lista para enviar.
export async function requirePlayer(request: Request): Promise<PlayerRow | Response> {
  const token = bearerToken(request);
  if (!token) return fail(request, 401, 'unauthorized', 'Inicia sesión para continuar.');
  const player = await findPlayerByToken(token);
  if (!player) return fail(request, 401, 'session_expired', 'Tu sesión ya no es válida en este dispositivo.');
  return player;
}
