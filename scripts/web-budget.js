// Presupuesto de tamaño de la versión web.
//
// Quien entra por el QR del stand descarga la web con datos móviles: lo que pesa el primer arranque
// decide si alcanza a jugar. La compilación mide el JavaScript (comprimido, como lo entrega el
// servidor) y las fuentes, y falla si alguno pasa su tope: el tamaño no crece sin que alguien lo decida.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BUDGET = {
  // JavaScript de la app comprimido con gzip. Hoy ~0,95 MB; el tope deja margen para crecer poco.
  scriptGzipBytes: 1_100_000,
  // Las siete fuentes WOFF2 recortadas. Hoy ~160 kB.
  fontBytes: 400_000,
};

function* files(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* files(full);
    else yield full;
  }
}

function measureWeb(directory) {
  let scriptBytes = 0;
  let scriptGzipBytes = 0;
  let fontBytes = 0;
  let totalBytes = 0;
  const fonts = [];
  for (const file of files(directory)) {
    const size = fs.statSync(file).size;
    totalBytes += size;
    if (file.endsWith('.js')) {
      scriptBytes += size;
      scriptGzipBytes += zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length;
    } else if (/\.(ttf|otf|woff2?)$/i.test(file)) {
      fontBytes += size;
      fonts.push(path.basename(file));
    }
  }
  return { scriptBytes, scriptGzipBytes, fontBytes, totalBytes, fonts };
}

// Lista de excesos (vacía si todo cabe).
function budgetProblems(measured, budget = BUDGET) {
  const problems = [];
  const kb = (bytes) => `${Math.round(bytes / 1024)} kB`;
  if (measured.scriptGzipBytes > budget.scriptGzipBytes) problems.push(`JavaScript comprimido: ${kb(measured.scriptGzipBytes)} (tope ${kb(budget.scriptGzipBytes)})`);
  if (measured.fontBytes > budget.fontBytes) problems.push(`Fuentes: ${kb(measured.fontBytes)} (tope ${kb(budget.fontBytes)})`);
  // Una fuente completa en la web delata que se dejó de usar la versión recortada.
  const full = measured.fonts.filter((name) => /\.(ttf|otf)$/i.test(name));
  if (full.length) problems.push(`Hay fuentes completas en la web (${full.join(', ')}): deben ser las WOFF2 recortadas de assets/fonts-web.`);
  return problems;
}

module.exports = { BUDGET, budgetProblems, measureWeb };
