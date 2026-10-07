import { levelFromXp } from '../../src/lib/progression';
import { query } from '../_lib/db';
import { allowRead, bearerToken, clientIp, fail, handler, HttpError, json, preflight } from '../_lib/http';
import { findPlayerByToken, rankOrNull } from '../_lib/players';

interface TopRow {
  [key: string]: unknown;
  id: string;
  alias: string;
  avatar: number;
  xp: number;
}

interface Board {
  total: number;
  top: TopRow[];
  updatedAt: string;
  loadedAt: number;
}

// La tabla es la misma para todos: se lee de la base a lo más una vez cada 15 s por instancia, y la
// respuesta sin sesión además la puede guardar la red de borde. Lo propio de quien consulta (su
// posición, cuál fila es la suya) nunca entra a esa copia compartida.
const BOARD_TTL_MS = 15_000;
const MAX_LIMIT = 100;
let board: Board | null = null;
let loading: Promise<Board> | null = null;

async function loadBoard(now: number): Promise<Board> {
  if (board && now - board.loadedAt < BOARD_TTL_MS) return board;
  if (!loading) {
    loading = (async () => {
      const [top, totals] = await Promise.all([
        query<TopRow>('select id, alias, avatar, xp from players where not hidden order by xp desc, created_at asc limit $1', [MAX_LIMIT]),
        query<{ total: string }>('select count(*) as total from players where not hidden'),
      ]);
      board = { total: Number(totals[0]?.total ?? 0), top, updatedAt: new Date().toISOString(), loadedAt: Date.now() };
      return board;
    })().finally(() => {
      loading = null;
    });
  }
  return loading;
}

export function resetLeaderboardCache(): void {
  board = null;
  loading = null;
}

// `limit` es un entero entre 5 y 100 (por defecto 50). Otra cosa es un error de quien llama, no algo
// que se corrige en silencio ni que llega a la base.
function parseLimit(raw: string | null): number {
  if (raw === null || raw === '') return 50;
  if (!/^\d{1,3}$/.test(raw)) throw new HttpError(400, 'bad_request', 'El parámetro limit debe ser un número entero entre 5 y 100.');
  const limit = Number(raw);
  if (limit < 5 || limit > MAX_LIMIT) throw new HttpError(400, 'bad_request', 'El parámetro limit debe ser un número entero entre 5 y 100.');
  return limit;
}

// GET /api/v1/leaderboard?limit=50 — ranking global por XP. Solo alias, avatar, nivel y XP (nada personal).
export const GET = handler(async (request) => {
  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get('limit'));
  if (!allowRead('leaderboard', clientIp(request), 120, 60_000)) return fail(request, 429, 'rate_limited', 'Demasiadas consultas seguidas.');
  const token = bearerToken(request);
  const [me, current] = await Promise.all([token ? findPlayerByToken(token) : Promise.resolve(null), loadBoard(Date.now())]);
  const entries = current.top.slice(0, limit).map((row, index) => ({
    rank: index + 1,
    alias: row.alias,
    avatar: row.avatar,
    level: levelFromXp(row.xp),
    xp: row.xp,
    me: me?.id === row.id,
  }));
  let mine = null;
  if (me && !me.hidden) {
    const position = await rankOrNull(me);
    if (position) mine = { rank: position.rank, alias: me.alias, avatar: me.avatar, level: levelFromXp(me.xp), xp: me.xp, me: true };
  }
  // Sin sesión la respuesta es igual para todos y se puede compartir un momento; con sesión es privada.
  const cache = token ? 'private, no-store' : 'public, max-age=10, s-maxage=15, stale-while-revalidate=30';
  return json(request, { total: current.total, top: entries, me: mine, updatedAt: current.updatedAt }, 200, { 'Cache-Control': cache, Vary: 'Authorization, Origin' });
});

export const OPTIONS = preflight;
