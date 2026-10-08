// Compila la versión web de producción (dist/web) y completa el HTML con metadatos, PWA y estilos táctiles.
// Uso: npm run build:web
//
// Antes de entregar la carpeta comprueba: que la configuración pública no lleve credenciales sin
// decidirlo, que la política de seguridad calce con los brokers, que las fuentes web estén al día, que
// el tamaño quepa en su presupuesto y que ningún secreto del servidor haya quedado dentro.
//
// Variables:
//   SOYTEL_WEB_OUT  carpeta de salida (por defecto dist/web)
//   SOYTEL_E2E=1    compilación para las pruebas E2E locales: no exige que vercel.json tenga la política
//                   de esos brokers (el servidor de pruebas aplica la suya con scripts/csp.js)
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { buildCsp, readVercelCsp } = require('./csp');
const { describePublicConfig, findLeakedSecrets, publicConfigProblem } = require('./public-config');
const { budgetProblems, measureWeb } = require('./web-budget');

const root = path.resolve(__dirname, '..');
const outName = process.env.SOYTEL_WEB_OUT || 'dist/web';
const out = path.resolve(root, outName);

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// Las fuentes WOFF2 de assets/fonts-web deben corresponder a las TTF instaladas (si el paquete de
// fuentes cambia, hay que regenerarlas con scripts/build-web-fonts.py).
function webFontsProblem() {
  const manifestFile = path.join(root, 'assets', 'fonts-web', 'manifest.json');
  if (!fs.existsSync(manifestFile)) return 'Faltan las fuentes web (assets/fonts-web). Ejecuta: python scripts/build-web-fonts.py';
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  for (const [name, info] of Object.entries(manifest.fonts)) {
    const source = path.join(root, 'node_modules', info.source);
    const built = path.join(root, 'assets', 'fonts-web', `${name}.woff2`);
    if (!fs.existsSync(built) || sha256(built) !== info.sha256) return `La fuente web ${name} no corresponde a lo anotado. Ejecuta: python scripts/build-web-fonts.py`;
    if (!fs.existsSync(source) || sha256(source) !== info.sourceSha256) return `La fuente original de ${name} cambió. Ejecuta: python scripts/build-web-fonts.py`;
  }
  return null;
}

const configProblem = publicConfigProblem();
if (configProblem) fail(configProblem);

// La política de seguridad publicada debe permitir exactamente los brokers de esta compilación.
if (process.env.SOYTEL_E2E !== '1' && readVercelCsp() !== buildCsp()) {
  fail('La política de seguridad de vercel.json no coincide con los brokers configurados. Ejecuta "npm run csp:write" con las mismas variables EXPO_PUBLIC_* y vuelve a compilar.');
}

const fontsProblem = webFontsProblem();
if (fontsProblem) fail(fontsProblem);

fs.rmSync(out, { recursive: true, force: true });
// La CLI de Expo se ejecuta con Node directamente: sin intérprete de comandos de por medio.
execFileSync(process.execPath, [path.join(root, 'node_modules', 'expo', 'bin', 'cli'), 'export', '--platform', 'web', '--output-dir', outName, '--clear'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, CI: '1', NODE_ENV: 'production' },
});

const indexFile = path.join(out, 'index.html');
let html = fs.readFileSync(indexFile, 'utf8');

const title = 'SoyTEL · Ruta Telemática USM';
const description = 'Juega la Ruta Telemática en vivo: únete con el código del stand y compite en las salas B215, B213 y la trivia final.';
const head = `
    <meta name="description" content="${description}" />
    <meta name="application-name" content="SoyTEL" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="SoyTEL" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="format-detection" content="telephone=no" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="/og.jpg" />
    <meta property="og:locale" content="es_CL" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <style id="soytel-web">
      html, body { background: #0B2D45; overscroll-behavior: none; }
      body { -webkit-tap-highlight-color: transparent; touch-action: manipulation; -webkit-text-size-adjust: 100%; }
      #root { min-height: 100dvh; }
    </style>
`;

// Cada reemplazo debe ocurrir exactamente una vez: si Expo cambia su plantilla, la compilación falla
// en vez de publicar una página sin sus metadatos.
function replaceOnce(pattern, replacement, what) {
  const matches = html.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`));
  if (!matches || matches.length !== 1) fail(`La plantilla HTML cambió: se esperaba una sola coincidencia para ${what} y hay ${matches ? matches.length : 0}.`);
  html = html.replace(pattern, replacement);
}

replaceOnce(/<html\b[^>]*>/, '<html lang="es">', 'la etiqueta <html>');
replaceOnce(/<title>[^<]*<\/title>/, `<title>${title}</title>`, 'el <title>');
replaceOnce(/<meta\s+name="viewport"[^>]*>/, '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />', 'el viewport');
replaceOnce(/<\/head>/, `${head}</head>`, 'el cierre de <head>');

fs.writeFileSync(indexFile, html);

// Lo que la página y el manifiesto referencian tiene que existir en la salida.
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public', 'manifest.webmanifest'), 'utf8'));
const referenced = new Set(['manifest.webmanifest', 'apple-touch-icon.png', 'og.jpg']);
(manifest.icons ?? []).forEach((icon) => referenced.add(String(icon.src).replace(/^\//, '')));
(manifest.shortcuts ?? []).forEach((shortcut) => (shortcut.icons ?? []).forEach((icon) => referenced.add(String(icon.src).replace(/^\//, ''))));
const missing = [...referenced].filter((file) => !fs.existsSync(path.join(out, file)));
if (missing.length) fail(`Faltan archivos públicos en ${outName}: ${missing.join(', ')}`);

const final = fs.readFileSync(indexFile, 'utf8');
if (!final.includes(`<title>${title}</title>`) || !final.includes('<html lang="es">') || (final.match(/rel="manifest"/g) ?? []).length !== 1) {
  fail('El HTML final no tiene el título, el idioma o el manifiesto esperados.');
}

// Tamaño: el JavaScript comprimido y las fuentes tienen tope.
const measured = measureWeb(out);
const excess = budgetProblems(measured);
if (excess.length) fail(`La web pasó su presupuesto de tamaño:\n  ${excess.join('\n  ')}`);

// Ningún secreto del servidor dentro de lo que se publica (se informa el nombre, nunca el valor).
const leaks = findLeakedSecrets(out);
if (leaks.length) fail(`Hay secretos del servidor dentro de la web: ${leaks.map((leak) => `${leak.secret} en ${leak.file}`).join('; ')}. No se publica.`);

// De dónde salió esta compilación (sin credenciales): queda junto a la web.
function git(args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
fs.writeFileSync(
  path.join(out, 'build.json'),
  `${JSON.stringify(
    {
      version: pkg.version,
      commit: git(['rev-parse', 'HEAD']),
      dirty: (git(['status', '--porcelain']) ?? '').length > 0,
      node: process.version,
      expo: pkg.dependencies.expo,
      builtAt: new Date().toISOString(),
      publicConfig: describePublicConfig(),
      size: { scriptBytes: measured.scriptBytes, scriptGzipBytes: measured.scriptGzipBytes, fontBytes: measured.fontBytes, totalBytes: measured.totalBytes },
    },
    null,
    2,
  )}\n`,
);

const kb = (bytes) => `${Math.round(bytes / 1024)} kB`;
console.log(`Web de producción lista en ${outName} · JavaScript ${kb(measured.scriptGzipBytes)} comprimido (${kb(measured.scriptBytes)}) · fuentes ${kb(measured.fontBytes)} · total ${kb(measured.totalBytes)}`);
