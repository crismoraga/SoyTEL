// Política de seguridad de contenido (CSP) de la versión web.
//
// La web solo puede conectarse a su propio origen y a los brokers de la ruta, por nombre: no se permite
// "cualquier wss:". La lista sale de la misma configuración que usa la app al compilar
// (EXPO_PUBLIC_MQTT_URLS o src/realtime/brokers.json), así que no pueden quedar desalineadas.
//
// Uso:
//   node scripts/csp.js --print   muestra la política para el entorno actual
//   node scripts/csp.js --check   falla si vercel.json no tiene exactamente esa política
//   node scripts/csp.js --write   la escribe en vercel.json
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const vercelFile = path.join(root, 'vercel.json');
const defaultBrokers = require('../src/realtime/brokers.json');

function list(value) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function origin(url) {
  const parsed = new URL(url);
  if (!['ws:', 'wss:', 'http:', 'https:'].includes(parsed.protocol)) throw new Error(`Esquema no permitido en ${url}`);
  return `${parsed.protocol}//${parsed.host}`;
}

function buildCsp(env = process.env) {
  const configured = list(env.EXPO_PUBLIC_MQTT_URLS);
  const connect = new Set(["'self'"]);
  (configured.length > 0 ? configured : defaultBrokers).forEach((url) => connect.add(origin(url)));
  // Una API en otro origen (por defecto la web usa la de su mismo sitio).
  if (env.EXPO_PUBLIC_API_URL) connect.add(origin(env.EXPO_PUBLIC_API_URL));
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${[...connect].join(' ')}`,
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

function cspHeader(config) {
  for (const rule of config.headers ?? []) {
    const header = (rule.headers ?? []).find((item) => item.key === 'Content-Security-Policy');
    if (header) return header;
  }
  return null;
}

function readVercelCsp() {
  const header = cspHeader(JSON.parse(fs.readFileSync(vercelFile, 'utf8')));
  return header ? header.value : null;
}

function main() {
  const mode = process.argv[2];
  const expected = buildCsp();
  if (mode === '--print') {
    console.log(expected);
    return;
  }
  if (mode === '--write') {
    const config = JSON.parse(fs.readFileSync(vercelFile, 'utf8'));
    const header = cspHeader(config);
    if (!header) throw new Error('vercel.json no tiene la cabecera Content-Security-Policy');
    header.value = expected;
    fs.writeFileSync(vercelFile, `${JSON.stringify(config, null, 2)}\n`);
    console.log('Política escrita en vercel.json');
    return;
  }
  if (mode === '--check') {
    const current = readVercelCsp();
    if (current !== expected) {
      console.error('La política de vercel.json no coincide con los brokers de esta compilación.');
      console.error(`  vercel.json: ${current}`);
      console.error(`  esperada:    ${expected}`);
      console.error('Ejecuta "npm run csp:write" (con las mismas variables EXPO_PUBLIC_*) y vuelve a compilar.');
      process.exit(1);
    }
    if (/connect-src[^;]*\swss?:(\s|;|$)/.test(expected)) {
      console.error('La política no puede permitir conexiones a cualquier servidor (wss: sin host).');
      process.exit(1);
    }
    console.log('Política de seguridad coherente con los brokers configurados.');
    return;
  }
  console.error('Uso: node scripts/csp.js --print | --check | --write');
  process.exit(1);
}

module.exports = { buildCsp, readVercelCsp };

if (require.main === module) main();
