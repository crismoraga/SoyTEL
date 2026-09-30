// Exporta los gráficos declarativos de src/graphics a archivos SVG y a una hoja de contacto HTML.
// Uso: node scripts/export-design.js [carpetaSalida]
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'dist', 'design'));

// Carga de módulos .ts puros (sin React Native) transpilándolos al vuelo.
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolve(request, parent, ...rest) {
  if (request.startsWith('@/')) {
    request = path.join(root, 'src', request.slice(2));
  } else if (request === 'react-native') {
    request = path.join(__dirname, 'rn-stub.js');
  }
  return originalResolve.call(this, request, parent, ...rest);
};
require.extensions['.ts'] = function loadTs(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(outputText, filename);
};

function attrs(shape) {
  const map = {
    fill: shape.fill,
    stroke: shape.stroke,
    'stroke-width': shape.sw,
    opacity: shape.op,
    'fill-opacity': shape.fop,
    'stroke-opacity': shape.sop,
    'stroke-linecap': shape.cap,
    'stroke-linejoin': shape.join,
    'stroke-dasharray': shape.dash,
    transform: shape.tf,
  };
  return Object.entries(map)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ` ${key}="${value}"`)
    .join('');
}

function shapeToSvg(shape) {
  switch (shape.t) {
    case 'path':
      return `<path d="${shape.d}"${attrs(shape)}/>`;
    case 'circle':
      return `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}"${attrs(shape)}/>`;
    case 'ellipse':
      return `<ellipse cx="${shape.cx}" cy="${shape.cy}" rx="${shape.rx}" ry="${shape.ry}"${attrs(shape)}/>`;
    case 'rect':
      return `<rect x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}" rx="${shape.rx || 0}"${attrs(shape)}/>`;
    case 'line':
      return `<line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}"${attrs(shape)}/>`;
    case 'g':
      return `<g${attrs(shape)}>${shape.children.map(shapeToSvg).join('')}</g>`;
    default:
      throw new Error(`Forma desconocida: ${shape.t}`);
  }
}

function gradientsToSvg(gradients = []) {
  if (!gradients.length) return '';
  const body = gradients
    .map((gradient) => {
      const stops = gradient.stops
        .map((stop) => `<stop offset="${stop.offset}" stop-color="${stop.color}" stop-opacity="${stop.opacity ?? 1}"/>`)
        .join('');
      return gradient.kind === 'linear'
        ? `<linearGradient id="${gradient.id}" x1="${gradient.x1}" y1="${gradient.y1}" x2="${gradient.x2}" y2="${gradient.y2}">${stops}</linearGradient>`
        : `<radialGradient id="${gradient.id}" cx="${gradient.cx}" cy="${gradient.cy}" r="${gradient.r}">${stops}</radialGradient>`;
    })
    .join('');
  return `<defs>${body}</defs>`;
}

function drawingToSvg(drawing, { width, height, color } = {}) {
  const size = width ? ` width="${width}" height="${height || width}"` : '';
  const style = color ? ` style="color:${color}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${drawing.w} ${drawing.h}"${size}${style}>${gradientsToSvg(drawing.gradients)}${drawing.shapes.map(shapeToSvg).join('')}</svg>`;
}

function iconToSvg(shapes, { size = 24, color = '#0B2D45', strokeWidth = 2 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" style="color:${color}"><g fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${shapes.map(shapeToSvg).join('')}</g></svg>`;
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function optionalRequire(file) {
  const full = path.join(root, 'src', 'graphics', file);
  return fs.existsSync(`${full}.ts`) ? require(full) : null;
}

function main() {
  const { icons } = require(path.join(root, 'src', 'graphics', 'icons'));
  const medallions = optionalRequire('medallions');
  const telix = optionalRequire('telix');
  const illustrations = optionalRequire('illustrations');
  const patterns = optionalRequire('patterns');

  const sections = [];

  const iconCells = Object.entries(icons).map(([name, shapes]) => {
    const svg = iconToSvg(shapes, { size: 24, color: '#0B2D45' });
    write(path.join(outDir, 'icons', `${name}.svg`), svg);
    return `<figure class="cell"><div class="icon">${iconToSvg(shapes, { size: 36 })}</div><figcaption>${name}</figcaption></figure>`;
  });
  sections.push(`<h2>Íconos (${iconCells.length})</h2><div class="grid">${iconCells.join('')}</div>`);

  if (medallions) {
    const cells = [];
    for (const glyph of Object.keys(medallions.medallionGlyphs)) {
      const drawing = medallions.medallionDrawing({ glyph, tier: 'crema', state: 'unlocked' });
      const svg = drawingToSvg(drawing, { width: 240 });
      write(path.join(outDir, 'medallions', `${glyph}.svg`), svg);
      cells.push(`<figure class="cell med">${drawingToSvg(drawing, { width: 96 })}<figcaption>${glyph}</figcaption></figure>`);
    }
    const variants = ['bronce', 'plata', 'oro', 'platino']
      .map((tier) => medallions.medallionDrawing({ glyph: 'trophy', tier, state: 'unlocked' }))
      .concat([
        medallions.medallionDrawing({ glyph: 'trophy', tier: 'oro', state: 'progress', progress: 0.6 }),
        medallions.medallionDrawing({ glyph: 'trophy', tier: 'oro', state: 'locked' }),
      ])
      .map((drawing, index) => {
        const names = ['bronce', 'plata', 'oro', 'platino', 'en-progreso', 'bloqueado'];
        write(path.join(outDir, 'medallions', `tier-${names[index]}.svg`), drawingToSvg(drawing, { width: 240 }));
        return `<figure class="cell med">${drawingToSvg(drawing, { width: 96 })}<figcaption>${names[index]}</figcaption></figure>`;
      });
    sections.push(`<h2>Medallas (${cells.length})</h2><div class="grid">${cells.join('')}</div><h2>Rarezas y estados</h2><div class="grid">${variants.join('')}</div>`);
  }

  if (telix) {
    const cells = telix.telixExpressions.map((expression) => {
      const poses = { celebrate: 'celebrate', happy: 'wave', think: 'think' };
      const signals = { sad: 1, sleepy: 2, sleep: 1, celebrate: 4, happy: 4, love: 4 };
      const drawing = telix.telixDrawing({ expression, pose: poses[expression] || 'idle', signal: signals[expression] ?? 3 });
      write(path.join(outDir, 'telix', `telix-${expression}.svg`), drawingToSvg(drawing, { width: 400 }));
      return `<figure class="cell telix">${drawingToSvg(drawing, { width: 150 })}<figcaption>${expression}</figcaption></figure>`;
    });
    sections.push(`<h2>Telix</h2><div class="grid dark">${cells.join('')}</div>`);
  }

  if (illustrations) {
    const cells = Object.entries(illustrations.illustrations).map(([name, drawing]) => {
      write(path.join(outDir, 'illustrations', `${name}.svg`), drawingToSvg(drawing, { width: drawing.w * 2, height: drawing.h * 2 }));
      return `<figure class="cell illu">${drawingToSvg(drawing, { width: 220, height: Math.round((220 * drawing.h) / drawing.w) })}<figcaption>${name}</figcaption></figure>`;
    });
    sections.push(`<h2>Ilustraciones</h2><div class="grid">${cells.join('')}</div>`);
  }

  if (patterns) {
    const cells = Object.entries(patterns.patternPreviews()).map(([name, drawing]) => {
      write(path.join(outDir, 'patterns', `${name}.svg`), drawingToSvg(drawing, { width: drawing.w, height: drawing.h }));
      return `<figure class="cell pattern">${drawingToSvg(drawing, { width: 220, height: Math.round((220 * drawing.h) / drawing.w) })}<figcaption>${name}</figcaption></figure>`;
    });
    sections.push(`<h2>Patrones</h2><div class="grid">${cells.join('')}</div>`);
  }

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>SoyTEL gráficos</title>
<style>
body{margin:0;padding:24px;font:13px/1.4 system-ui,sans-serif;background:#F8FBFF;color:#0B2D45}
h2{font-size:15px;margin:24px 0 10px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px}
.grid.dark{background:#0B2D45;padding:12px;border-radius:16px}
.cell{margin:0;padding:10px 6px;background:#fff;border:1px solid #D6E2EC;border-radius:12px;display:flex;flex-direction:column;align-items:center;gap:6px}
.dark .cell{background:#123D5C;border-color:#1E5B7F;color:#F4ECD7}
.cell.illu,.cell.pattern{grid-column:span 2}
.cell.telix{grid-column:span 2}
figcaption{font-size:11px;color:#5E6F7E;text-align:center}
.dark figcaption{color:#A7D4ED}
</style></head><body>${sections.join('')}</body></html>`;
  write(path.join(outDir, 'contact-sheet.html'), html);
  console.log(`Exportado en ${outDir}`);
}

module.exports = { shapeToSvg, drawingToSvg, iconToSvg, gradientsToSvg };

if (require.main === module) {
  main();
}
