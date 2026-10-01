import { query } from '../_lib/db';
import { bearerToken, handler, json, preflight } from '../_lib/http';
import { findPlayerByToken, rankOf } from '../_lib/players';

interface TopRow {
  [key: string]: unknown;
  id: string;
  alias: string;
  avatar: number;
  level: number;
  xp: number;
}

// GET /api/v1/leaderboard?limit=50 — ranking global por XP. Solo alias, avatar, nivel y XP (nada personal).
export const GET = handler(async (request) => {
  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(5, Number(url.searchParams.get('limit')) || 50));
  const token = bearerToken(request);
  const [me, top, totals] = await Promise.all([
    token ? findPlayerByToken(token) : Promise.resolve(null),
    query<TopRow>('select id, alias, avatar, level, xp from players where not hidden order by xp desc, created_at asc limit $1', [limit]),
    query<{ total: string }>('select count(*) as total from players where not hidden'),
  ]);
  const entries = top.map((row, index) => ({
    rank: index + 1,
    alias: row.alias,
    avatar: row.avatar,
    level: row.level,
    xp: row.xp,
    me: me?.id === row.id,
  }));
  let mine = null;
  if (me && !me.hidden) {
    const { rank } = await rankOf(me);
    mine = { rank, alias: me.alias, avatar: me.avatar, level: me.level, xp: me.xp, me: true };
  }
  return json(request, { total: Number(totals[0]?.total ?? 0), top: entries, me: mine, updatedAt: new Date().toISOString() });
});

export const OPTIONS = preflight;
