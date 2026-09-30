// Compila la versión web de producción (dist/web) y completa el HTML con metadatos, PWA y estilos táctiles.
// Uso: npm run build:web
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist', 'web');

fs.rmSync(out, { recursive: true, force: true });
execSync('npx expo export --platform web --output-dir dist/web', {
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

html = html
  .replace('<html lang="en">', '<html lang="es">')
  .replace('<title>SoyTEL</title>', `<title>${title}</title>`)
  .replace('content="width=device-width, initial-scale=1, shrink-to-fit=no"', 'content="width=device-width, initial-scale=1, viewport-fit=cover"')
  .replace('</head>', `${head}</head>`);

fs.writeFileSync(indexFile, html);

const required = ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
const missing = required.filter((file) => !fs.existsSync(path.join(out, file)));
if (missing.length) {
  console.error(`Faltan archivos públicos en dist/web: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('Web de producción lista en dist/web');
