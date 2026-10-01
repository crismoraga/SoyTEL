// Aplica scripts/db/schema.sql en la base de Neon.
// La URL sale de DATABASE_URL o de .env.production.local (npx vercel env pull --environment=production .env.production.local).
// Uso: npm run db:migrate
const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

const root = path.resolve(__dirname, '..');

function readEnvFile(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(full, 'utf8')
      .split(/\r?\n/)
      .map((line) => /^([A-Z0-9_]+)=(.*)$/.exec(line.trim()))
      .filter(Boolean)
      .map((match) => [match[1], match[2].replace(/^"|"$/g, '')]),
  );
}

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || readEnvFile('.env.production.local').DATABASE_URL_UNPOOLED || readEnvFile('.env.production.local').DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL (o .env.production.local).');
  process.exit(1);
}

// Divide el SQL en sentencias (el esquema no usa funciones con ";" internos).
const statements = fs
  .readFileSync(path.join(root, 'scripts', 'db', 'schema.sql'), 'utf8')
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

(async () => {
  const sql = neon(url);
  for (const statement of statements) {
    await sql.query(statement);
    console.log('✓', statement.split('\n')[0].slice(0, 80));
  }
  const [{ players }] = await sql.query('select count(*)::int as players from players');
  console.log(`Esquema listo. Jugadores registrados: ${players}`);
})().catch((error) => {
  console.error('Error al migrar:', error.message);
  process.exit(1);
});
