import { contactLabels, gradeLabel, isContactKind } from '../../../src/account/rules';
import { levelFromXp } from '../../../src/lib/progression';
import { query } from '../../_lib/db';
import { clientIp, fail, handler, HttpError, json, readJson } from '../../_lib/http';
import { contactAllowed, type PlayerRow } from '../../_lib/players';
import { isAdmin, openField, rateLimit } from '../../_lib/security';

// Exportación para el equipo de Telemática (encabezado x-admin-key). Por defecto solo incluye a quienes
// aceptaron ser contactados; ?contacto=todos agrega al resto (sin datos de contacto). ?format=csv descarga.
//
// Va por páginas, en orden de registro: `limit` (hasta 5000, por defecto 1000) y `cursor` (el
// `nextCursor` de la página anterior). Cada respuesta dice cuántos hay en total y si quedan más
// (`total`, `hasMore`; en CSV, los encabezados X-Total-Count, X-Has-More y X-Next-Cursor): una
// exportación parcial nunca pasa por completa. Cada página refleja el estado al momento de leerla:
// quien retira su consentimiento deja de aparecer desde la página siguiente.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PAGE = 5000;

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

function parseCursor(raw: string | null): { createdAt: string; id: string } | null {
  if (!raw) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(raw, 'base64url').toString('utf8');
  } catch {
    throw new HttpError(400, 'bad_request', 'Cursor no válido.');
  }
  const [createdAt, id] = decoded.split('|');
  if (!createdAt || !id || !UUID.test(id) || !Number.isFinite(Date.parse(createdAt))) throw new HttpError(400, 'bad_request', 'Cursor no válido.');
  return { createdAt, id };
}

function parsePage(raw: string | null): number {
  if (raw === null || raw === '') return 1000;
  if (!/^\d{1,4}$/.test(raw) || Number(raw) < 1 || Number(raw) > MAX_PAGE) throw new HttpError(400, 'bad_request', `El parámetro limit debe ser un entero entre 1 y ${MAX_PAGE}.`);
  return Number(raw);
}

export const GET = handler(async (request) => {
  const denied = await guard(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const everyone = url.searchParams.get('contacto') === 'todos';
  const limit = parsePage(url.searchParams.get('limit'));
  const cursor = parseCursor(url.searchParams.get('cursor'));
  const filter = everyone ? 'true' : 'contact_consent';
  const [rows, totals] = await Promise.all([
    // Una fila más que la página: así se sabe si quedan más sin otra consulta.
    query<PlayerRow & { created_key: string }>(
      `select *, to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_key from players
       where ${filter} and ($1::timestamptz is null or (created_at, id) > ($1::timestamptz, $2::uuid))
       order by created_at asc, id asc limit $3`,
      [cursor?.createdAt ?? null, cursor?.id ?? null, limit + 1],
    ),
    query<{ total: string }>(`select count(*) as total from players where ${filter}`),
  ]);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const lastRow = page[page.length - 1];
  const nextCursor = hasMore && lastRow ? Buffer.from(`${lastRow.created_key}|${lastRow.id}`).toString('base64url') : null;
  const total = Number(totals[0]?.total ?? 0);

  const players = page.map((row) => {
    // Un contacto guardado sin cumplir la regla (anterior a ella) no se entrega: queda retenido.
    const allowed = contactAllowed(row);
    const field = row.contact_consent && allowed ? openField(row.contact_value) : ({ state: 'empty' } as const);
    return {
      id: row.id,
      alias: row.alias,
      grade: gradeLabel(row.grade),
      school: row.school,
      contactKind: allowed && isContactKind(row.contact_kind) ? contactLabels[row.contact_kind].label : null,
      contact: field.state === 'ok' ? field.value : null,
      contactWithheld: Boolean(row.contact_value) && !allowed,
      contactError: field.state === 'unreadable',
      guardianConsent: row.guardian_consent,
      consentAt: row.consent_at,
      xp: row.xp,
      level: levelFromXp(row.xp),
      games: row.games,
      routes: row.routes,
      bestRoute: row.best_route,
      flags: row.flags,
      hidden: row.hidden,
      createdAt: row.created_at,
    };
  });

  if (url.searchParams.get('format') === 'csv') {
    const header = ['id', 'alias', 'grade', 'school', 'contactKind', 'contact', 'contactWithheld', 'contactError', 'guardianConsent', 'consentAt', 'xp', 'level', 'games', 'routes', 'bestRoute', 'flags', 'hidden', 'createdAt'];
    const lines = [header.join(','), ...players.map((player) => header.map((key) => csvCell(player[key as keyof typeof player])).join(','))];
    return new Response(`﻿${lines.join('\r\n')}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="soytel-jugadores${hasMore || cursor ? '-parcial' : ''}.csv"`,
        'Cache-Control': 'no-store',
        'X-Total-Count': String(total),
        'X-Has-More': String(hasMore),
        ...(nextCursor ? { 'X-Next-Cursor': nextCursor } : {}),
      },
    });
  }
  return json(request, { total, count: players.length, hasMore, nextCursor, players });
});

// POST { id, hidden } — oculta (o vuelve a mostrar) a un jugador del ranking, p. ej. por un alias inapropiado.
export const POST = handler(async (request) => {
  const denied = await guard(request);
  if (denied) return denied;
  const body = await readJson<{ id?: unknown; hidden?: unknown }>(request);
  if (typeof body.id !== 'string' || !UUID.test(body.id)) return fail(request, 400, 'bad_request', 'El id no es válido.');
  const rows = await query<{ id: string; hidden: boolean }>('update players set hidden = $1, updated_at = now() where id = $2 returning id, hidden', [
    body.hidden !== false,
    body.id,
  ]);
  if (!rows[0]) return fail(request, 404, 'not_found', 'No existe ese jugador.');
  return json(request, rows[0]);
});
