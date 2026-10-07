/**
 * @jest-environment node
 */
import { ACHIEVEMENT_IDS } from '@/account/catalog';
import { XP_BURST_ALLOWANCE, XP_SIGNUP_CAP, isRecoveryCode, isSessionToken, recoveryCodeFromBytes } from '@/account/rules';
import { achievements } from '@/data/achievements';
import { levelFromXp } from '@/lib/progression';
import { setQueryExecutor } from '../api/_lib/db';
import { resetReadLimits } from '../api/_lib/http';
import { levelSql } from '../api/_lib/players';
import { encryptField, openField } from '../api/_lib/security';
import * as adminPlayers from '../api/v1/admin/players';
import * as health from '../api/v1/health';
import * as leaderboard from '../api/v1/leaderboard';
import * as me from '../api/v1/me';
import * as players from '../api/v1/players';
import * as recover from '../api/v1/recover';
import * as recovery from '../api/v1/recovery';
import * as sync from '../api/v1/sync';
import { startTestDatabase, type TestDatabase } from './support/pg';

// API contra Postgres de verdad (PGlite, en memoria): los manejadores HTTP reales, el esquema real
// aplicado con las migraciones reales, y las reglas de la base (restricciones, disparadores,
// `update` atómico). No toca Neon ni ninguna base fuera de este proceso.

interface Migration {
  version: string;
  sql: string;
  checksum: string;
}

interface MigrationClient {
  query(text: string, params?: unknown[]): Promise<unknown[]>;
  transaction(statements: string[]): Promise<void>;
}

const { listMigrations, migrate, splitStatements } = require('../scripts/db/migrator') as {
  listMigrations(dir?: string): Migration[];
  migrate(client: MigrationClient, options?: { dryRun?: boolean; migrations?: Migration[]; log?: (line: string) => void }): Promise<{ applied: string[]; pending: string[] }>;
  splitStatements(sql: string): string[];
};

interface MigrateArgs {
  target: string | null;
  dryRun: boolean;
  confirm: string | null;
}

const { describeDatabase, parseArgs, planProblem } = require('../scripts/db-migrate') as {
  describeDatabase(url: string): { endpoint: string; database: string; host: string };
  parseArgs(argv: string[]): MigrateArgs;
  planProblem(options: MigrateArgs, env: Record<string, string | undefined>): string | null;
};

jest.setTimeout(120_000);

let db: TestDatabase;
const DATA_KEY = Buffer.alloc(32, 7).toString('base64');
const OTHER_KEY = Buffer.alloc(32, 9).toString('base64');
const ADMIN_KEY = 'llave-de-administracion-de-prueba';

// Antes de ejecutar la consulta que calce con `match`, corre `run` (una sola vez): permite intercalar
// otra solicitud entre la lectura y la escritura de un manejador, como ocurriría con dos a la vez.
let hooks: { match: RegExp; run: () => Promise<void> }[] = [];
let failing: RegExp | null = null;

function client() {
  return { query: (text: string, params: unknown[] = []) => db.query(text, params), transaction: (statements: string[]) => db.transaction(statements) };
}

beforeAll(async () => {
  process.env.SOYTEL_DATA_KEY = DATA_KEY;
  process.env.SOYTEL_PEPPER = 'pimienta-de-prueba-larga';
  process.env.SOYTEL_ADMIN_KEY = ADMIN_KEY;
  delete process.env.SOYTEL_DATA_KEY_PREVIOUS;
  db = await startTestDatabase();
  setQueryExecutor(async (text, params) => {
    const index = hooks.findIndex((hook) => hook.match.test(text));
    if (index >= 0) {
      const [hook] = hooks.splice(index, 1);
      await hook.run();
    }
    if (failing && failing.test(text)) throw new Error('consulta rechazada por la prueba');
    return db.query(text, params);
  });
});

afterAll(async () => {
  setQueryExecutor(null);
  await db.stop();
});

beforeEach(async () => {
  hooks = [];
  failing = null;
  process.env.SOYTEL_DATA_KEY = DATA_KEY;
  delete process.env.SOYTEL_DATA_KEY_PREVIOUS;
  await db.reset();
  await migrate(client());
  resetReadLimits();
  leaderboard.resetLeaderboardCache();
  health.resetHealthCache();
  db.drainLog();
});

type Handler = (request: Request) => Promise<Response>;

async function call<T = Record<string, unknown>>(handler: Handler, method: string, path: string, options: { body?: unknown; token?: string; headers?: Record<string, string>; raw?: BodyInit; ip?: string } = {}) {
  const headers: Record<string, string> = { 'x-forwarded-for': options.ip ?? '10.0.0.1', ...(options.headers ?? {}) };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  let body: BodyInit | undefined = options.raw;
  if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers['content-type'] = headers['content-type'] ?? 'application/json';
  }
  const response = await handler(new Request(`https://soytel.test/api/v1${path}`, { method, headers, body }));
  const text = await response.text();
  let data: unknown = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: response.status, data: data as T, headers: response.headers };
}

let serial = 0;

function credentials() {
  serial += 1;
  const bytes = Buffer.alloc(32, serial % 251);
  bytes.writeUInt32BE(serial, 0);
  return { token: bytes.toString('base64url'), recoveryCode: recoveryCodeFromBytes(Buffer.from(`semilla-${serial}-de-prueba`)) };
}

interface Signed {
  token: string;
  recoveryCode: string;
  player: { id: string; alias: string; xp: number; level: number; achievements: string[]; contact: unknown; contactError: boolean; grade: string | null };
  rank: { rank: number; total: number } | null;
}

async function signUp(profile: Record<string, unknown> = { alias: 'Ana', avatar: 1 }, progress: Record<string, unknown> = {}, given = credentials()) {
  const result = await call<Signed>(players.POST, 'POST', '/players', { body: { profile, progress, credentials: given } });
  return { ...result, given };
}

async function rowOf(id: string) {
  const rows = await db.query<Record<string, unknown>>('select * from players where id = $1', [id]);
  return rows[0];
}

describe('migraciones (REL-05, REL-06)', () => {
  it('una base limpia queda con el esquema completo y lo aplicado anotado con su huella', async () => {
    const applied = await db.query<{ version: string; checksum: string }>('select version, checksum from schema_migrations order by version');
    expect(applied.map((row) => row.version)).toEqual(listMigrations().map((migration) => migration.version));
    applied.forEach((row) => expect(row.checksum).toMatch(/^[0-9a-f]{64}$/));
    const columns = await db.query<{ column_name: string }>("select column_name from information_schema.columns where table_name = 'players'");
    expect(columns.map((row) => row.column_name)).toEqual(expect.arrayContaining(['xp_budget', 'budget_at', 'token_hash', 'recovery_hash']));
  });

  it('volver a ejecutar no repite nada, y --dry-run no escribe', async () => {
    const before = await db.query<{ total: number }>('select count(*)::int as total from schema_migrations');
    expect(await migrate(client())).toEqual({ applied: [], pending: [] });
    await db.reset();
    db.drainLog();
    const plan = await migrate(client(), { dryRun: true });
    expect(plan.applied).toEqual([]);
    expect(plan.pending).toHaveLength(before[0].total);
    // Solo lecturas: ni tablas nuevas ni anotaciones.
    expect(db.drainLog().every((text) => /^select/i.test(text.trim()))).toBe(true);
    expect((await db.query<{ present: boolean }>("select to_regclass('public.players') is not null as present"))[0].present).toBe(false);
  });

  it('actualiza una base anterior (sin historial) conservando a sus jugadores', async () => {
    await db.reset();
    const initial = listMigrations()[0];
    // Así estaba producción: el esquema inicial aplicado a mano, sin tabla de migraciones.
    await db.transaction(splitStatements(initial.sql));
    await db.query("insert into players (token_hash, recovery_hash, alias, xp, level) values ('t-viejo', 'r-viejo', 'Veterana', 900, 4)");
    const result = await migrate(client());
    expect(result.applied).toEqual(listMigrations().map((migration) => migration.version));
    const rows = await db.query<{ alias: string; xp: number; xp_budget: number }>("select alias, xp, xp_budget from players where token_hash = 't-viejo'");
    expect(rows[0]).toMatchObject({ alias: 'Veterana', xp: 900, xp_budget: XP_BURST_ALLOWANCE });
  });

  it('una migración que falla a medias deja la base como estaba', async () => {
    const broken = { version: '9999_rota', checksum: 'x'.repeat(64), sql: 'create table recien_creada (id int); insert into tabla_que_no_existe values (1);' };
    await expect(migrate(client(), { migrations: [...listMigrations(), broken] })).rejects.toThrow();
    expect((await db.query<{ present: boolean }>("select to_regclass('public.recien_creada') is not null as present"))[0].present).toBe(false);
    expect((await db.query("select 1 from schema_migrations where version = '9999_rota'"))).toHaveLength(0);
  });

  it('no acepta que cambie una migración ya aplicada ni una base con migraciones desconocidas', async () => {
    const [first, ...rest] = listMigrations();
    await expect(migrate(client(), { migrations: [{ ...first, checksum: 'f'.repeat(64) }, ...rest] })).rejects.toThrow(/otro contenido/);
    await expect(migrate(client(), { migrations: [first] })).rejects.toThrow(/no conoce/);
  });

  it('separa sentencias respetando comillas, comentarios y cuerpos de funciones', () => {
    const sql = `-- un comentario; con punto y coma
      insert into t values ('a;b', 'it''s'); /* otro; comentario */
      create function f() returns trigger language plpgsql as $cuerpo$ begin perform 1; return new; end; $cuerpo$;
      select "col;umna" from t;`;
    const statements = splitStatements(sql);
    expect(statements).toHaveLength(3);
    expect(statements[0]).toBe("insert into t values ('a;b', 'it''s')");
    expect(statements[1]).toContain('perform 1; return new; end;');
    expect(statements[2]).toBe('select "col;umna" from t');
  });

  it('el comando exige un destino explícito y, en producción, confirmarlo por su identificador', () => {
    const url = 'postgres://usuario:clave-secreta@ep-quiet-sun-123456-pooler.sa-east-1.aws.neon.tech/soytel';
    // Sin destino no hay nada por defecto, aunque exista la URL.
    expect(planProblem(parseArgs([]), { DATABASE_URL: url })).toMatch(/--target/);
    expect(planProblem(parseArgs(['--target', 'cualquiera']), { DATABASE_URL: url })).toMatch(/uno de/);
    expect(planProblem(parseArgs(['--target', 'preview']), {})).toMatch(/no lee archivos \.env/);
    expect(planProblem(parseArgs(['--target', 'preview']), { DATABASE_URL: url })).toBeNull();
    expect(planProblem(parseArgs(['--target', 'production', '--dry-run']), { DATABASE_URL: url })).toBeNull();
    expect(planProblem(parseArgs(['--target', 'production']), { DATABASE_URL: url })).toMatch(/--confirm/);
    expect(planProblem(parseArgs(['--target', 'production', '--confirm', 'otra-base']), { DATABASE_URL: url })).toMatch(/--confirm/);
    expect(planProblem(parseArgs(['--target', 'production', '--confirm', 'ep-quiet-sun-123456']), { DATABASE_URL: url })).toBeNull();
    // Lo que se muestra del destino no incluye usuario ni clave.
    const identity = describeDatabase(url);
    expect(identity).toEqual({ endpoint: 'ep-quiet-sun-123456', database: 'soytel', host: '….sa-east-1.aws.neon.tech' });
    expect(JSON.stringify(identity)).not.toMatch(/clave-secreta|usuario/);
  });
});

describe('alta de cuenta (BE-06)', () => {
  it('crea la cuenta con las credenciales del dispositivo y solo guarda sus huellas', async () => {
    const { status, data, given } = await signUp({ alias: 'Ana', avatar: 2 }, { xp: 500, games: 3, achievements: ['first-signal'] });
    expect(status).toBe(201);
    expect(data.token).toBe(given.token);
    expect(data.recoveryCode).toBe(given.recoveryCode);
    expect(data.player).toMatchObject({ alias: 'Ana', xp: 500, level: levelFromXp(500), achievements: ['first-signal'] });
    expect(data.rank).toEqual({ rank: 1, total: 1 });
    const row = await rowOf(data.player.id);
    expect(JSON.stringify(row)).not.toContain(given.token);
    expect(JSON.stringify(row)).not.toContain(given.recoveryCode);
  });

  it('repetir la solicitud (respuesta perdida) devuelve la misma cuenta, sin crear otra', async () => {
    const given = credentials();
    const first = await signUp({ alias: 'Ana', avatar: 2 }, { xp: 100 }, given);
    const again = await signUp({ alias: 'Ana', avatar: 2 }, { xp: 100 }, given);
    expect(again.status).toBe(200);
    expect(again.data.player.id).toBe(first.data.player.id);
    expect(again.data.token).toBe(given.token);
    expect((await db.query('select 1 from players'))).toHaveLength(1);
    // Con ese mismo token la cuenta se puede usar y eliminar.
    expect((await call(me.GET, 'GET', '/me', { token: given.token })).status).toBe(200);
    expect((await call(me.DELETE, 'DELETE', '/me', { token: given.token })).status).toBe(200);
    expect((await db.query('select 1 from players'))).toHaveLength(0);
  });

  it('si el ranking falla después de crear la cuenta, las credenciales se entregan igual', async () => {
    failing = /count\(\*\) from players where not hidden and/;
    const { status, data, given } = await signUp();
    expect(status).toBe(201);
    expect(data.token).toBe(given.token);
    expect(data.rank).toBeNull();
    failing = null;
    expect((await call(me.GET, 'GET', '/me', { token: given.token })).status).toBe(200);
  });

  it('credenciales mal formadas o ya usadas por otra cuenta se rechazan sin crear nada', async () => {
    const first = await signUp();
    const clash = await call(players.POST, 'POST', '/players', { body: { profile: { alias: 'Otra' }, credentials: { token: first.given.token, recoveryCode: credentials().recoveryCode } } });
    expect(clash.status).toBe(409);
    const weak = await call(players.POST, 'POST', '/players', { body: { profile: { alias: 'Otra' }, credentials: { token: 'corto', recoveryCode: 'TEL-AAAA-BBBB-CCCC' } } });
    expect(weak.status).toBe(400);
    expect((await db.query('select 1 from players'))).toHaveLength(1);
    expect(isSessionToken(first.given.token) && isRecoveryCode(first.given.recoveryCode)).toBe(true);
  });

  it('una app anterior (sin credenciales propias) sigue pudiendo crear su cuenta', async () => {
    const result = await call<Signed>(players.POST, 'POST', '/players', { body: { profile: { alias: 'Antigua' }, progress: {} } });
    expect(result.status).toBe(201);
    expect(isSessionToken(result.data.token)).toBe(true);
    expect(isRecoveryCode(result.data.recoveryCode)).toBe(true);
  });

  it('el XP con que parte la cuenta tiene tope', async () => {
    const { data } = await signUp({ alias: 'Ana' }, { xp: 999_999 });
    expect(data.player.xp).toBe(XP_SIGNUP_CAP);
  });
});

describe('contacto de menores y curso (BE-01, BE-19)', () => {
  const contact = { contact: { kind: 'email', value: 'ana@correo.cl' }, contactConsent: true };

  it('7° y 8° básico sin autorización del apoderado: no se guarda contacto', async () => {
    expect((await signUp({ alias: 'Ana', grade: '7b', ...contact })).status).toBe(422);
    expect((await signUp({ alias: 'Ana', grade: '8b', ...contact, guardianConsent: true })).status).toBe(201);
  });

  it('sin curso informado no se guarda contacto (pero la cuenta se crea igual sin él)', async () => {
    const refused = await signUp({ alias: 'Ana', ...contact, guardianConsent: true });
    expect(refused.status).toBe(422);
    expect(JSON.stringify(refused.data)).toMatch(/elige tu curso/);
    expect((await signUp({ alias: 'Ana' })).status).toBe(201);
    expect((await signUp({ alias: 'Ana', grade: 'otro', ...contact })).status).toBe(201);
  });

  it('cambiar solo el curso a 7° básico con un contacto guardado exige la autorización', async () => {
    const { data, given } = await signUp({ alias: 'Ana', grade: '4m', ...contact });
    const refused = await call(me.PATCH, 'PATCH', '/me', { token: given.token, body: { grade: '7b' } });
    expect(refused.status).toBe(422);
    expect(await rowOf(data.player.id)).toMatchObject({ grade: '4m' });
    // Con la autorización, o quitando el contacto, sí se puede.
    expect((await call(me.PATCH, 'PATCH', '/me', { token: given.token, body: { grade: '7b', ...contact, guardianConsent: true } })).status).toBe(200);
    expect((await call(me.PATCH, 'PATCH', '/me', { token: given.token, body: { grade: '8b', contactConsent: false } })).status).toBe(200);
    expect(await rowOf(data.player.id)).toMatchObject({ grade: '8b', contact_value: null, contact_consent: false });
    // Y quitar el curso con un contacto guardado tampoco.
    await call(me.PATCH, 'PATCH', '/me', { token: given.token, body: { grade: '4m', ...contact } });
    expect((await call(me.PATCH, 'PATCH', '/me', { token: given.token, body: { grade: null } })).status).toBe(422);
  });

  it('dos cambios simultáneos (uno pone 7° básico, el otro un contacto sin autorización) no dejan un contacto no autorizado', async () => {
    const { data, given } = await signUp({ alias: 'Ana', grade: '4m' });
    // Los dos leen la misma fila (sin contacto, IV° medio) y cada uno, por separado, es válido.
    let second: Awaited<ReturnType<typeof call>> | null = null;
    hooks.push({
      match: /update players set grade/,
      run: async () => {
        second = await call(me.PATCH, 'PATCH', '/me', { token: given.token, body: contact });
      },
    });
    const first = await call(me.PATCH, 'PATCH', '/me', { token: given.token, body: { grade: '7b' } });
    const statuses = [first.status, second!.status].sort();
    expect(statuses).toEqual([200, 422]);
    const row = (await rowOf(data.player.id)) as { grade: string | null; contact_value: string | null; guardian_consent: boolean };
    expect(row.contact_value !== null && row.grade === '7b' && !row.guardian_consent).toBe(false);
  });

  it('la exportación retiene el contacto de filas anteriores a la regla', async () => {
    const { data } = await signUp({ alias: 'Antigua', grade: 'otro', ...contact });
    // Una fila como las que pudo dejar la versión anterior: contacto en 7° básico sin autorización.
    await db.query('alter table players disable trigger players_contact_policy');
    await db.query("update players set grade = '7b', guardian_consent = false where id = $1", [data.player.id]);
    await db.query('alter table players enable trigger players_contact_policy');
    const exported = await call<{ players: { contact: string | null; contactWithheld: boolean }[] }>(adminPlayers.GET, 'GET', '/admin/players', { headers: { 'x-admin-key': ADMIN_KEY } });
    expect(exported.data.players[0]).toMatchObject({ contact: null, contactWithheld: true });
    // Y esa cuenta puede seguir sincronizando su progreso.
    const session = await db.query<{ token_hash: string }>('select token_hash from players where id = $1', [data.player.id]);
    expect(session).toHaveLength(1);
  });
});

describe('progreso (BE-02, BE-03, BE-10)', () => {
  it('el nivel calculado en la base es el mismo que calcula la app', async () => {
    const samples = [0, 1, 154, 155, 156, 379, 380, 381, 5999, 6000, 123_456, 999_999, 9_999_999];
    for (let level = 2; level <= 60; level += 1) samples.push(120 * (level - 1) + 35 * (level - 1) ** 2 - 1, 120 * (level - 1) + 35 * (level - 1) ** 2);
    const rows = await db.query<{ xp: number; level: number }>(`select xp, ${levelSql('xp')} as level from unnest($1::int[]) as xp`, [samples]);
    rows.forEach((row) => expect({ xp: row.xp, level: row.level }).toEqual({ xp: row.xp, level: levelFromXp(row.xp) }));
  });

  it('treinta sincronizaciones seguidas gastan una sola franquicia de XP', async () => {
    const { data, given } = await signUp({ alias: 'Ana' }, { xp: 1000 });
    let last = 0;
    for (let index = 0; index < 30; index += 1) {
      const result = await call<{ player: { xp: number }; clamped: boolean }>(sync.POST, 'POST', '/sync', { token: given.token, body: { progress: { xp: 1_000_000 } } });
      expect(result.status).toBe(200);
      expect(result.data.clamped).toBe(true);
      expect(result.data.player.xp).toBeGreaterThanOrEqual(last);
      last = result.data.player.xp;
    }
    // 400 de franquicia más lo poco que se recarga en lo que duran las llamadas (3 por segundo).
    expect(last).toBeGreaterThanOrEqual(1000 + XP_BURST_ALLOWANCE);
    expect(last).toBeLessThan(1000 + XP_BURST_ALLOWANCE + 200);
    expect((await rowOf(data.player.id)) as { flags: number }).toMatchObject({ flags: 30 });
  });

  it('el máximo aceptable en un intervalo no depende de cuántas veces se sincronice', async () => {
    const once = await signUp({ alias: 'Una' }, { xp: 0 });
    const many = await signUp({ alias: 'Muchas' }, { xp: 0 });
    // Pasaron 100 segundos desde el último gasto para las dos cuentas (presupuesto ya gastado).
    await db.query("update players set xp_budget = 0, budget_at = now() - interval '100 seconds'");
    const single = await call<{ player: { xp: number } }>(sync.POST, 'POST', '/sync', { token: once.given.token, body: { progress: { xp: 50_000 } } });
    let multiple = 0;
    for (let index = 0; index < 10; index += 1) {
      multiple = (await call<{ player: { xp: number } }>(sync.POST, 'POST', '/sync', { token: many.given.token, body: { progress: { xp: 50_000 } } })).data.player.xp;
    }
    expect(single.data.player.xp).toBeGreaterThanOrEqual(300);
    expect(single.data.player.xp).toBeLessThan(330);
    expect(multiple).toBeLessThan(single.data.player.xp + 30);
  });

  it('lo jugado de verdad se acepta completo, y el XP nunca baja', async () => {
    const { given } = await signUp({ alias: 'Ana' }, { xp: 1000 });
    const up = await call<{ player: { xp: number; level: number }; clamped: boolean }>(sync.POST, 'POST', '/sync', { token: given.token, body: { progress: { xp: 1250, games: 9 } } });
    expect(up.data).toMatchObject({ clamped: false, player: { xp: 1250, level: levelFromXp(1250) } });
    const down = await call<{ player: { xp: number }; clamped: boolean }>(sync.POST, 'POST', '/sync', { token: given.token, body: { progress: { xp: 10 } } });
    expect(down.data).toMatchObject({ clamped: false, player: { xp: 1250 } });
  });

  it('dos sincronizaciones cruzadas no bajan el XP ni descuadran el nivel', async () => {
    const { data, given } = await signUp({ alias: 'Ana' }, { xp: 0 });
    // A (pide 100) ya leyó la cuenta; antes de que escriba, B (pide 300) termina completa.
    let second: Awaited<ReturnType<typeof call>> | null = null;
    hooks.push({
      match: /update players set\s+xp = xp \+/,
      run: async () => {
        second = await call(sync.POST, 'POST', '/sync', { token: given.token, body: { progress: { xp: 300 } } });
      },
    });
    const first = await call<{ player: { xp: number; level: number } }>(sync.POST, 'POST', '/sync', { token: given.token, body: { progress: { xp: 100 } } });
    expect(second!.status).toBe(200);
    expect(first.data.player.xp).toBe(300);
    const row = (await rowOf(data.player.id)) as { xp: number; level: number; xp_budget: number };
    expect(row).toMatchObject({ xp: 300, level: levelFromXp(300) });
    // El presupuesto se gastó una vez: 400 − 300 (más la recarga de unos milisegundos).
    expect(row.xp_budget).toBeGreaterThanOrEqual(100);
    expect(row.xp_budget).toBeLessThan(110);
  });

  it('solo se guardan logros del catálogo y la lista no crece más que él', async () => {
    // La lista de la API y el catálogo de la app son los mismos.
    expect([...ACHIEVEMENT_IDS].sort()).toEqual(achievements.map((item) => item.id).sort());
    const { data, given } = await signUp({ alias: 'Ana' }, { achievements: ['first-signal', 'logro-inventado'] });
    expect(data.player.achievements).toEqual(['first-signal']);
    // Basura que pudo quedar guardada antes de validar contra el catálogo.
    await db.query("update players set achievements = achievements || array['inventado-1', 'inventado-2'] where id = $1", [data.player.id]);
    for (let batch = 0; batch < 5; batch += 1) {
      const invented = Array.from({ length: 60 }, (_, index) => `lote-${batch}-${index}`);
      await call(sync.POST, 'POST', '/sync', { token: given.token, body: { progress: { achievements: [...invented, ...ACHIEVEMENT_IDS] } } });
    }
    const row = (await rowOf(data.player.id)) as { achievements: string[] };
    expect([...row.achievements].sort()).toEqual([...ACHIEVEMENT_IDS].sort());
  });
});

describe('sesiones y recuperación (BE-07, BE-16)', () => {
  it('recuperar la cuenta en otro teléfono desconecta al anterior', async () => {
    const { given } = await signUp({ alias: 'Ana' });
    const fresh = credentials().token;
    const recovered = await call<{ token: string }>(recover.POST, 'POST', '/recover', { body: { code: given.recoveryCode, token: fresh } });
    expect(recovered.status).toBe(200);
    expect(recovered.data.token).toBe(fresh);
    expect((await call(me.GET, 'GET', '/me', { token: given.token })).status).toBe(401);
    expect((await call(me.GET, 'GET', '/me', { token: fresh })).status).toBe(200);
    // Repetir la recuperación con el mismo token (respuesta perdida) deja todo igual.
    expect((await call(recover.POST, 'POST', '/recover', { body: { code: given.recoveryCode, token: fresh } })).status).toBe(200);
    expect((await call(me.GET, 'GET', '/me', { token: fresh })).status).toBe(200);
    expect((await call(recover.POST, 'POST', '/recover', { body: { code: 'TEL-2222-2222-2222' } })).status).toBe(404);
  });

  it.each([
    ['PATCH', /update players set alias/, () => ({ handler: me.PATCH, method: 'PATCH', path: '/me', body: { alias: 'Intrusa' } })],
    ['sync', /update players set\s+xp = xp \+/, () => ({ handler: sync.POST, method: 'POST', path: '/sync', body: { progress: { xp: 300 } } })],
    ['DELETE', /delete from players/, () => ({ handler: me.DELETE, method: 'DELETE', path: '/me', body: undefined })],
  ])('una solicitud en vuelo con el token ya revocado no cambia la cuenta (%s)', async (_name, match, build) => {
    const { data, given } = await signUp({ alias: 'Ana' }, { xp: 0 });
    const fresh = credentials().token;
    // El teléfono A ya se autenticó; antes de que su cambio llegue a la base, la cuenta se recupera en B.
    hooks.push({
      match,
      run: async () => {
        expect((await call(recover.POST, 'POST', '/recover', { body: { code: given.recoveryCode, token: fresh } })).status).toBe(200);
      },
    });
    const request = build();
    const result = await call(request.handler, request.method, request.path, { token: given.token, body: request.body });
    expect(result.status).toBe(401);
    expect(await rowOf(data.player.id)).toMatchObject({ alias: 'Ana', xp: 0 });
    // Con el token nuevo todo funciona.
    expect((await call(me.PATCH, 'PATCH', '/me', { token: fresh, body: { alias: 'Ana B' } })).status).toBe(200);
  });

  it('cambiar el código de recuperación invalida el anterior en el acto', async () => {
    const { given } = await signUp({ alias: 'Ana' });
    const next = credentials().recoveryCode;
    expect((await call(recovery.POST, 'POST', '/recovery', { token: given.token, body: { code: next } })).status).toBe(200);
    // Repetirlo (respuesta perdida) no rompe nada.
    expect((await call(recovery.POST, 'POST', '/recovery', { token: given.token, body: { code: next } })).status).toBe(200);
    expect((await call(recover.POST, 'POST', '/recover', { body: { code: given.recoveryCode } })).status).toBe(404);
    expect((await call(recover.POST, 'POST', '/recover', { body: { code: next } })).status).toBe(200);
    expect((await call(recovery.POST, 'POST', '/recovery', { body: { code: next } })).status).toBe(401);
    expect((await call(recovery.POST, 'POST', '/recovery', { token: given.token, body: { code: 'no-es-un-codigo' } })).status).toBe(401);
  });

  it('un código que ya usa otra cuenta se rechaza', async () => {
    const first = await signUp({ alias: 'Ana' });
    const second = await signUp({ alias: 'Beto' });
    expect((await call(recovery.POST, 'POST', '/recovery', { token: second.given.token, body: { code: first.given.recoveryCode } })).status).toBe(409);
    expect((await call(recover.POST, 'POST', '/recover', { body: { code: second.given.recoveryCode } })).status).toBe(200);
  });
});

describe('datos de contacto cifrados (BE-17)', () => {
  const profile = { alias: 'Ana', grade: '4m', contact: { kind: 'email', value: 'ana@correo.cl' }, contactConsent: true };

  it('con la llave equivocada el contacto se informa como ilegible, no como ausente, y la API deja de estar sana', async () => {
    const { given } = await signUp(profile);
    expect((await call<{ ok: boolean }>(health.GET, 'GET', '/health')).data.ok).toBe(true);
    process.env.SOYTEL_DATA_KEY = OTHER_KEY;
    health.resetHealthCache();
    const mine = await call<{ player: { contact: unknown; contactError: boolean; contactConsent: boolean } }>(me.GET, 'GET', '/me', { token: given.token });
    expect(mine.data.player).toMatchObject({ contact: null, contactError: true, contactConsent: true });
    const state = await call<{ ok: boolean; problems: string[] }>(health.GET, 'GET', '/health');
    expect(state.status).toBe(503);
    expect(state.data).toMatchObject({ ok: false, problems: ['data_key_mismatch'] });
    const exported = await call<{ players: { contact: string | null; contactError: boolean }[] }>(adminPlayers.GET, 'GET', '/admin/players', { headers: { 'x-admin-key': ADMIN_KEY } });
    expect(exported.data.players[0]).toMatchObject({ contact: null, contactError: true });
  });

  it('sin llave configurada la API no está sana y no dice por qué con valores', async () => {
    delete process.env.SOYTEL_DATA_KEY;
    const state = await call<{ ok: boolean; problems: string[] }>(health.GET, 'GET', '/health');
    expect(state.status).toBe(503);
    expect(state.data.problems).toEqual(['data_key']);
    expect(JSON.stringify(state.data)).not.toContain(DATA_KEY);
  });

  it('al cambiar la llave se leen los datos antiguos y los nuevos', async () => {
    const before = await signUp(profile);
    process.env.SOYTEL_DATA_KEY = OTHER_KEY;
    process.env.SOYTEL_DATA_KEY_PREVIOUS = DATA_KEY;
    const after = await signUp({ ...profile, alias: 'Beto', contact: { kind: 'email', value: 'beto@correo.cl' } });
    const read = async (token: string) => (await call<{ player: { contact: { value: string } | null } }>(me.GET, 'GET', '/me', { token })).data.player.contact?.value;
    expect(await read(before.given.token)).toBe('ana@correo.cl');
    expect(await read(after.given.token)).toBe('beto@correo.cl');
    // Lo nuevo queda cifrado con la llave vigente y marcado con su huella.
    const sealed = encryptField('dato');
    expect(sealed).toMatch(/^g2:[0-9a-f]{8}:/);
    delete process.env.SOYTEL_DATA_KEY_PREVIOUS;
    expect(openField(sealed)).toEqual({ state: 'ok', value: 'dato' });
    expect((await read(before.given.token)) ?? null).toBeNull();
  });
});

describe('lecturas públicas (BE-11, BE-13)', () => {
  it('una ráfaga de consultas anónimas al ranking no se convierte en una ráfaga de consultas a la base', async () => {
    await signUp({ alias: 'Ana' }, { xp: 500 });
    await signUp({ alias: 'Beto' }, { xp: 900 });
    db.drainLog();
    for (let index = 0; index < 50; index += 1) {
      const result = await call<{ top: { alias: string; me: boolean }[]; me: unknown }>(leaderboard.GET, 'GET', '/leaderboard?limit=10', { ip: `10.0.1.${index}` });
      expect(result.status).toBe(200);
      expect(result.data.top.map((entry) => entry.alias)).toEqual(['Beto', 'Ana']);
      expect(result.data.me).toBeNull();
      expect(result.headers.get('cache-control')).toMatch(/public/);
    }
    expect(db.drainLog().length).toBeLessThanOrEqual(2);
  });

  it('lo personal no entra a la copia compartida', async () => {
    const { given } = await signUp({ alias: 'Ana' }, { xp: 500 });
    await call(leaderboard.GET, 'GET', '/leaderboard');
    const mine = await call<{ top: { me: boolean }[]; me: { rank: number } | null }>(leaderboard.GET, 'GET', '/leaderboard', { token: given.token });
    expect(mine.data.me).toMatchObject({ rank: 1 });
    expect(mine.data.top[0].me).toBe(true);
    expect(mine.headers.get('cache-control')).toMatch(/private/);
    const anonymous = await call<{ top: { me: boolean }[]; me: unknown }>(leaderboard.GET, 'GET', '/leaderboard');
    expect(anonymous.data.me).toBeNull();
    expect(anonymous.data.top[0].me).toBe(false);
  });

  it('un mismo origen que insiste recibe 429 sin llegar a la base', async () => {
    let limited = 0;
    for (let index = 0; index < 130; index += 1) {
      if ((await call(leaderboard.GET, 'GET', '/leaderboard', { ip: '10.9.9.9' })).status === 429) limited += 1;
    }
    expect(limited).toBe(10);
  });

  it('el estado de la API se revisa contra la base a lo más una vez por ventana', async () => {
    db.drainLog();
    for (let index = 0; index < 40; index += 1) expect((await call(health.GET, 'GET', '/health')).status).toBe(200);
    expect(db.drainLog().length).toBeLessThanOrEqual(2);
  });

  it.each(['7.5', '1e2', '-3', '0', '4', '101', 'Infinity', 'abc', '50; drop table players'])('limit=%s se rechaza antes de consultar', async (limit) => {
    db.drainLog();
    const result = await call(leaderboard.GET, 'GET', `/leaderboard?limit=${encodeURIComponent(limit)}`);
    expect(result.status).toBe(400);
    expect(db.drainLog()).toEqual([]);
  });

  it('limit entero dentro del rango funciona', async () => {
    expect((await call(leaderboard.GET, 'GET', '/leaderboard?limit=5')).status).toBe(200);
    expect((await call(leaderboard.GET, 'GET', '/leaderboard?limit=100')).status).toBe(200);
  });
});

describe('cuerpos de las solicitudes (BE-12)', () => {
  it('rechaza por bytes, no por caracteres', async () => {
    // 2.100 «ñ» son 2.100 caracteres pero 4.200 bytes.
    const big = await call(players.POST, 'POST', '/players', { body: { profile: { alias: 'Ana', school: 'ñ'.repeat(2100) } } });
    expect(big.status).toBe(413);
    expect((await db.query('select 1 from players'))).toHaveLength(0);
  });

  it('deja de leer un cuerpo sin tamaño declarado en cuanto pasa el límite', async () => {
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new TextEncoder().encode('x'.repeat(1024)));
        if (pulled > 200) controller.close();
      },
    });
    const response = await players.POST(new Request('https://soytel.test/api/v1/players', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.0.0.1' }, body: stream, duplex: 'half' } as RequestInit));
    expect(response.status).toBe(413);
    expect(pulled).toBeLessThan(20);
  });

  it('distingue lo que no es JSON, lo que no es un objeto y lo que no se puede leer', async () => {
    expect((await call(players.POST, 'POST', '/players', { raw: 'alias=Ana', headers: { 'content-type': 'application/x-www-form-urlencoded' } })).status).toBe(415);
    expect((await call(players.POST, 'POST', '/players', { raw: '[1,2,3]', headers: { 'content-type': 'application/json' } })).status).toBe(400);
    expect((await call(players.POST, 'POST', '/players', { raw: '{"profile":', headers: { 'content-type': 'application/json' } })).status).toBe(400);
    expect((await call(players.POST, 'POST', '/players', { raw: '"texto"', headers: { 'content-type': 'application/json' } })).status).toBe(400);
  });
});

describe('administración (BE-13, BE-14)', () => {
  const admin = { 'x-admin-key': ADMIN_KEY };

  it('la exportación va por páginas y siempre dice si quedan más', async () => {
    const created: string[] = [];
    for (let index = 0; index < 12; index += 1) {
      const { data } = await signUp({ alias: `Jugador ${index}`, grade: '4m', contact: { kind: 'email', value: `j${index}@correo.cl` }, contactConsent: true });
      created.push(data.player.id);
    }
    await signUp({ alias: 'Sin contacto' });
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page: { data: { total: number; count: number; hasMore: boolean; nextCursor: string | null; players: { id: string; contact: string }[] } } = await call(
        adminPlayers.GET,
        'GET',
        `/admin/players?limit=5${cursor ? `&cursor=${cursor}` : ''}`,
        { headers: admin },
      );
      expect(page.data.total).toBe(12);
      expect(page.data.hasMore).toBe(page.data.nextCursor !== null);
      seen.push(...page.data.players.map((player) => player.id));
      cursor = page.data.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);
    expect(pages).toBe(3);
    // Todos, una sola vez y en orden de registro.
    expect(seen).toEqual(created);
  });

  it('el CSV parcial se declara parcial', async () => {
    for (let index = 0; index < 3; index += 1) await signUp({ alias: `Jugador ${index}`, grade: '4m', contact: { kind: 'phone', value: '912345678' }, contactConsent: true });
    const response = await adminPlayers.GET(new Request('https://soytel.test/api/v1/admin/players?format=csv&limit=2', { headers: { ...admin, 'x-forwarded-for': '10.0.0.1' } }));
    expect(response.headers.get('x-total-count')).toBe('3');
    expect(response.headers.get('x-has-more')).toBe('true');
    expect(response.headers.get('x-next-cursor')).toBeTruthy();
    expect(response.headers.get('content-disposition')).toMatch(/parcial/);
    expect((await response.text()).split('\r\n')).toHaveLength(3);
  });

  it('quien retira su consentimiento deja de aparecer desde la página siguiente', async () => {
    const tokens: string[] = [];
    for (let index = 0; index < 4; index += 1) tokens.push((await signUp({ alias: `Jugador ${index}`, grade: '4m', contact: { kind: 'email', value: `j${index}@correo.cl` }, contactConsent: true })).given.token);
    const first = await call<{ nextCursor: string; players: unknown[] }>(adminPlayers.GET, 'GET', '/admin/players?limit=2', { headers: admin });
    await call(me.PATCH, 'PATCH', '/me', { token: tokens[3], body: { contactConsent: false } });
    const second = await call<{ players: { alias: string }[]; hasMore: boolean }>(adminPlayers.GET, 'GET', `/admin/players?limit=2&cursor=${first.data.nextCursor}`, { headers: admin });
    expect(second.data.players.map((player) => player.alias)).toEqual(['Jugador 2']);
    expect(second.data.hasMore).toBe(false);
  });

  it.each(['-'.repeat(36), '12345678123412341234123456789012', 'zzzzzzzz-zzzz-4zzz-8zzz-zzzzzzzzzzzz', "x' or '1'='1"])('un id mal formado (%s) no llega a la base', async (id) => {
    db.drainLog();
    const result = await call(adminPlayers.POST, 'POST', '/admin/players', { headers: admin, body: { id, hidden: true } });
    expect(result.status).toBe(400);
    // Solo el contador de intentos de administración: ninguna consulta sobre jugadores.
    expect(db.drainLog().filter((text) => /players/.test(text))).toEqual([]);
  });

  it('ocultar a un jugador lo saca del ranking; sin la llave no se puede', async () => {
    const { data } = await signUp({ alias: 'Ana' }, { xp: 100 });
    expect((await call(adminPlayers.POST, 'POST', '/admin/players', { body: { id: data.player.id } })).status).toBe(401);
    expect((await call(adminPlayers.POST, 'POST', '/admin/players', { headers: admin, body: { id: data.player.id, hidden: true } })).status).toBe(200);
    expect((await call<{ total: number }>(leaderboard.GET, 'GET', '/leaderboard')).data.total).toBe(0);
  });
});
