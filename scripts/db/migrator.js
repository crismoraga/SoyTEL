// Migraciones versionadas de la base de datos de la API.
//
// Cada archivo de scripts/db/migrations (NNNN_nombre.sql) se aplica una sola vez, completo y dentro de
// una transacción: si una sentencia falla, la base queda como estaba. Lo aplicado se anota en
// `schema_migrations` con su huella; un archivo ya aplicado que cambia después es un error, no una
// segunda ejecución silenciosa.
//
// Este módulo no sabe a qué base se conecta: recibe un cliente { query, transaction } (Neon en
// scripts/db-migrate.js, Postgres embebido en las pruebas).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
// Candado de sesión para que dos ejecuciones no apliquen lo mismo a la vez (número arbitrario fijo).
const LOCK_KEY = 4172026;

// Divide SQL en sentencias respetando comillas simples y dobles, comentarios y cuerpos $etiqueta$…$etiqueta$.
function splitStatements(sql) {
  const statements = [];
  let current = '';
  let index = 0;
  const push = () => {
    const text = current.trim();
    if (text) statements.push(text);
    current = '';
  };
  while (index < sql.length) {
    const rest = sql.slice(index);
    if (rest.startsWith('--')) {
      const end = sql.indexOf('\n', index);
      index = end < 0 ? sql.length : end;
      continue;
    }
    if (rest.startsWith('/*')) {
      const end = sql.indexOf('*/', index + 2);
      if (end < 0) throw new Error('Comentario /* sin cerrar');
      index = end + 2;
      continue;
    }
    const dollar = /^\$[A-Za-z_]*\$/.exec(rest);
    if (dollar) {
      const end = sql.indexOf(dollar[0], index + dollar[0].length);
      if (end < 0) throw new Error(`Bloque ${dollar[0]} sin cerrar`);
      current += sql.slice(index, end + dollar[0].length);
      index = end + dollar[0].length;
      continue;
    }
    const char = sql[index];
    if (char === "'" || char === '"') {
      let end = index + 1;
      for (;;) {
        end = sql.indexOf(char, end);
        if (end < 0) throw new Error(`Comilla ${char} sin cerrar`);
        // Comilla duplicada dentro del literal.
        if (sql[end + 1] === char) {
          end += 2;
          continue;
        }
        break;
      }
      current += sql.slice(index, end + 1);
      index = end + 1;
      continue;
    }
    if (char === ';') {
      push();
      index += 1;
      continue;
    }
    current += char;
    index += 1;
  }
  push();
  return statements;
}

function listMigrations(dir = MIGRATIONS_DIR) {
  return fs
    .readdirSync(dir)
    .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name))
    .sort()
    .map((name) => {
      const sql = fs.readFileSync(path.join(dir, name), 'utf8').replace(/\r\n/g, '\n');
      return { version: name.replace(/\.sql$/, ''), sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
    });
}

function quote(text) {
  return `'${String(text).replace(/'/g, "''")}'`;
}

async function appliedMigrations(client) {
  const exists = await client.query("select to_regclass('public.schema_migrations') is not null as present");
  if (!exists[0] || exists[0].present !== true) return new Map();
  const rows = await client.query('select version, checksum from schema_migrations order by version');
  return new Map(rows.map((row) => [row.version, row.checksum]));
}

// Devuelve { applied, pending }. Con `dryRun` solo lee: no crea tablas ni abre transacciones de escritura.
async function migrate(client, options = {}) {
  const migrations = options.migrations ?? listMigrations(options.dir);
  const log = options.log ?? (() => undefined);
  const done = await appliedMigrations(client);

  for (const migration of migrations) {
    const recorded = done.get(migration.version);
    if (recorded && recorded !== migration.checksum) {
      throw new Error(`La migración ${migration.version} ya se aplicó con otro contenido. No se edita una migración aplicada: se agrega una nueva.`);
    }
  }
  const known = new Set(migrations.map((migration) => migration.version));
  const unknown = [...done.keys()].filter((version) => !known.has(version));
  if (unknown.length) throw new Error(`La base tiene migraciones que este código no conoce (${unknown.join(', ')}): ¿es una versión anterior de la app?`);

  const pending = migrations.filter((migration) => !done.has(migration.version));
  if (options.dryRun) {
    pending.forEach((migration) => log(`pendiente  ${migration.version}`));
    return { applied: [], pending: pending.map((migration) => migration.version) };
  }

  const applied = [];
  for (const migration of pending) {
    // La anotación va primero: si otra ejecución ya la aplicó, la clave repetida aborta toda la transacción.
    await client.transaction([
      `select pg_advisory_xact_lock(${LOCK_KEY})`,
      'create table if not exists schema_migrations (version text primary key, checksum text not null, applied_at timestamptz not null default now())',
      `insert into schema_migrations (version, checksum) values (${quote(migration.version)}, ${quote(migration.checksum)})`,
      ...splitStatements(migration.sql),
    ]);
    applied.push(migration.version);
    log(`aplicada   ${migration.version}`);
  }
  return { applied, pending: [] };
}

module.exports = { listMigrations, migrate, splitStatements, MIGRATIONS_DIR };
