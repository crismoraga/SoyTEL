// Sirve una compilación web (por defecto dist/web) en 127.0.0.1 con las mismas cabeceras de seguridad
// que producción: las de vercel.json, con la política de contenido que corresponde a los brokers de la
// compilación (scripts/csp.js). Lo usa el E2E web y sirve para revisar la web antes de publicar.
//
// Uso: node scripts/serve-web.js [carpeta] [puerto]
const fs = require('fs');
const http = require('http');
const path = require('path');
const { buildCsp } = require('./csp');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

function securityHeaders() {
  const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'vercel.json'), 'utf8'));
  const general = (config.headers ?? []).find((rule) => rule.source === '/(.*)');
  const headers = Object.fromEntries((general?.headers ?? []).map((item) => [item.key, item.value]));
  headers['Content-Security-Policy'] = buildCsp();
  return headers;
}

function createServer(directory) {
  const base = path.resolve(directory);
  const headers = securityHeaders();
  return http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = path.join(base, pathname);
    // Nada fuera de la carpeta servida.
    if (!file.startsWith(base)) {
      response.writeHead(403, headers).end();
      return;
    }
    if (pathname.startsWith('/api/')) {
      response.writeHead(503, { ...headers, 'Content-Type': 'application/json' }).end('{"error":"api_no_disponible_en_local"}');
      return;
    }
    // Aplicación de una sola página: toda ruta que no es un archivo abre index.html.
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(base, 'index.html');
    fs.readFile(file, (error, data) => {
      if (error) {
        response.writeHead(404, headers).end();
        return;
      }
      response.writeHead(200, { ...headers, 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }).end(data);
    });
  });
}

module.exports = { createServer };

if (require.main === module) {
  const directory = process.argv[2] ?? 'dist/web';
  const port = Number(process.argv[3] ?? 8321);
  createServer(directory).listen(port, '127.0.0.1', () => {
    console.log(`Sirviendo ${directory} en http://127.0.0.1:${port}`);
    console.log(`CSP: ${buildCsp()}`);
  });
}
