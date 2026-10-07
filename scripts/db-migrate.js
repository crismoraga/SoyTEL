// Aplica las migraciones de scripts/db/migrations a una base de Neon.
//
// El destino es siempre explícito: la URL sale de DATABASE_URL_UNPOOLED o DATABASE_URL del entorno de
// quien ejecuta el comando (nunca de un archivo .env leído por cuenta propia) y hay que nombrar el
// entorno. Nada se escribe sin haber mostrado antes a qué base se va a aplicar.
//
//   npm run db:migrate -- --target preview --dry-run          lista lo pendiente (solo lectura)
//   npm run db:migrate -- --target preview                    aplica en una base de vista previa
//   npm run db:migrate -- --target production --confirm <id>  producción: hay que escribir el id que muestra el dry-run
//
// La URL y sus credenciales nunca se imprimen.
const { migrate } = require('./db/migrator');

const TARGETS = ['local', 'preview', 'production'];

function parseArgs(argv) {
  const options = { target: null, dryRun: false, confirm: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--target') options.target = argv[(index += 1)] ?? null;
    else if (arg.startsWith('--target=')) options.target = arg.slice('--target='.length);
    else if (arg === '--confirm') options.confirm = argv[(index += 1)] ?? null;
    else if (arg.startsWith('--confirm=')) options.confirm = arg.slice('--confirm='.length);
    else throw new Error(`Opción desconocida: ${arg}`);
  }
  return options;
}

// Identidad de la base sin credenciales: el id del endpoint (primera etiqueta del host) y el nombre de la base.
function describeDatabase(url) {
  const parsed = new URL(url);
  const endpoint = parsed.hostname.split('.')[0].replace(/-pooler$/, '');
  return { endpoint, database: parsed.pathname.replace(/^\//, '') || '(sin nombre)', host: parsed.hostname.replace(/^[^.]+/, '…') };
}

// Qué falta para poder ejecutar (null si está todo). Se prueba sin conectarse a nada.
function planProblem(options, env) {
  if (!options.target) return `Falta --target (${TARGETS.join(', ')}). No hay destino por defecto.`;
  if (!TARGETS.includes(options.target)) return `--target debe ser uno de: ${TARGETS.join(', ')}.`;
  const url = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
  if (!url) return 'Falta DATABASE_URL_UNPOOLED (o DATABASE_URL) en el entorno. Este comando no lee archivos .env.';
  let identity;
  try {
    identity = describeDatabase(url);
  } catch {
    return 'DATABASE_URL no es una URL válida.';
  }
  if (options.target === 'production' && !options.dryRun && options.confirm !== identity.endpoint) {
    return `Producción requiere --confirm ${'<id del endpoint>'}: ejecuta primero con --dry-run, revisa el destino y repite escribiendo su id.`;
  }
  return null;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const problem = planProblem(options, process.env);
  if (problem) {
    console.error(problem);
    process.exit(1);
  }
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  const identity = describeDatabase(url);
  console.log(`Destino: ${options.target} · endpoint ${identity.endpoint} (${identity.host}) · base ${identity.database}${options.dryRun ? ' · solo lectura' : ''}`);

  const { neon } = require('@neondatabase/serverless');
  const sql = neon(url);
  const client = {
    query: (text, params = []) => sql.query(text, params),
    // Una sola transacción por migración: o entra completa o no entra.
    transaction: (statements) => sql.transaction(statements.map((text) => sql.query(text))),
  };
  const result = await migrate(client, { dryRun: options.dryRun, log: (line) => console.log(line) });
  if (options.dryRun) {
    console.log(result.pending.length ? `${result.pending.length} migración(es) pendiente(s). Nada se modificó.` : 'La base está al día. Nada se modificó.');
    return;
  }
  console.log(result.applied.length ? `Listo: ${result.applied.length} migración(es) aplicada(s).` : 'La base ya estaba al día.');
}

module.exports = { describeDatabase, parseArgs, planProblem };

if (require.main === module) {
  main().catch((error) => {
    // El mensaje del controlador puede citar la consulta, nunca la URL.
    console.error(`No se pudo migrar: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
}
