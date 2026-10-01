import { contactLabels, gradeLabel, isContactKind } from '../../../src/account/rules';
import { query } from '../../_lib/db';
import { clientIp, fail, handler, json, readJson } from '../../_lib/http';
import type { PlayerRow } from '../../_lib/players';
import { decryptField, isAdmin, rateLimit } from '../../_lib/security';

// Exportación para el equipo de Telemática (encabezado x-admin-key). Por defecto solo incluye a quienes
// aceptaron ser contactados; ?contacto=todos agrega al resto (sin datos de contacto). ?format=csv descarga.

function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  // Evita fórmulas al abrir el archivo en una planilla.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function guard(request: Request): Promise<Response | null> {
  if (!(await rateLimit('admin', clientIp(request), 60, 3600))) return fail(request, 429, 'rate_limited', 'Demasiados intentos.');
  return isAdmin(request) ? null : fail(request, 401, 'unauthorized', 'No autorizado.');
}

export const GET = handler(async (request) => {
  const denied = await guard(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const everyone = url.searchParams.get('contacto') === 'todos';
  const rows = await query<PlayerRow>(
    `select * from players ${everyone ? '' : 'where contact_consent'} order by xp desc, created_at asc limit 5000`,
  );
  const players = rows.map((row, index) => ({
    position: index + 1,
    id: row.id,
    alias: row.alias,
    grade: gradeLabel(row.grade),
    school: row.school,
    contactKind: isContactKind(row.contact_kind) ? contactLabels[row.contact_kind].label : null,
    contact: row.contact_consent ? decryptField(row.contact_value) : null,
    guardianConsent: row.guardian_consent,
    consentAt: row.consent_at,
    xp: row.xp,
    level: row.level,
    games: row.games,
    routes: row.routes,
    bestRoute: row.best_route,
    flags: row.flags,
    hidden: row.hidden,
    createdAt: row.created_at,
  }));
  if (url.searchParams.get('format') === 'csv') {
    const header = Object.keys(players[0] ?? { position: '', alias: '' });
    const lines = [header.join(','), ...players.map((player) => header.map((key) => csvCell(player[key as keyof typeof player])).join(','))];
    return new Response(`﻿${lines.join('\r\n')}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="soytel-jugadores.csv"',
        'Cache-Control': 'no-store',
      },
    });
  }
  return json(request, { count: players.length, players });
});

// POST { id, hidden } — oculta (o vuelve a mostrar) a un jugador del ranking, p. ej. por un alias inapropiado.
export const POST = handler(async (request) => {
  const denied = await guard(request);
  if (denied) return denied;
  const body = await readJson<{ id?: unknown; hidden?: unknown }>(request);
  if (!body || typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id)) return fail(request, 400, 'bad_request', 'Falta el id.');
  const rows = await query<{ id: string; hidden: boolean }>('update players set hidden = $1, updated_at = now() where id = $2 returning id, hidden', [
    body.hidden !== false,
    body.id,
  ]);
  if (!rows[0]) return fail(request, 404, 'not_found', 'No existe ese jugador.');
  return json(request, rows[0]);
});
