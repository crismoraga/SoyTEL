// Genera el kit de marca de SoyTEL: logos, piezas para redes sociales, impresos y fondos de
// presentación, compuestos con los mismos tokens, fuentes y gráficos de la app.
// Uso:
//   npm run brand:kit [-- <carpeta>]              →  dist/brand-kit/<grupo>/*.png (y su HTML fuente)
//   npm run brand:kit -- [<carpeta>] --html-only  →  solo el HTML fuente (sin imágenes)
// Las imágenes se rasterizan con Chrome (puppeteer-core, que viene con `npm ci`). Si falta Chrome o
// puppeteer, el modo normal FALLA: nunca anuncia imágenes que no generó. `kit.json` lista únicamente
// archivos que existen.
const fs = require('fs');
const path = require('path');
const { drawingToSvg, iconToSvg } = require('./export-design');
const { create: createQr } = require('qrcode');

const root = path.resolve(__dirname, '..');
const cliArgs = process.argv.slice(2);
const htmlOnly = cliArgs.includes('--html-only');
const outDir = path.resolve(cliArgs.find((arg) => !arg.startsWith('--')) || path.join(root, 'dist', 'brand-kit'));
const src = (file) => require(path.join(root, 'src', file));
const { palettes } = src('theme/colors');
const { icons } = src('graphics/icons');
const { rutixDrawing, rutixExpressions } = src('graphics/rutix');
const { runnerCharacterDrawing, runnerItemDrawing } = src('graphics/runners');
const { runnerCharacters } = src('features/runner/characters');
const { medallionDrawing } = src('graphics/medallions');
const { starField, networkMesh, signalRings, orbitRings } = src('graphics/patterns');

const c = palettes.light;
const GOLD = '#F2CE63';
const fileUrl = (file) => `file:///${file.replace(/\\/g, '/')}`;
const brand = (name) => fileUrl(path.join(root, 'assets', 'brand', name));
const font = (pkg, folder, file) => fileUrl(path.join(root, 'node_modules', '@expo-google-fonts', pkg, folder, `${file}.ttf`));

const fontCss = [
  ['Montserrat', 600, font('montserrat', '600SemiBold', 'Montserrat_600SemiBold')],
  ['Montserrat', 700, font('montserrat', '700Bold', 'Montserrat_700Bold')],
  ['Montserrat', 800, font('montserrat', '800ExtraBold', 'Montserrat_800ExtraBold')],
  ['Nunito Sans', 400, font('nunito-sans', '400Regular', 'NunitoSans_400Regular')],
  ['Nunito Sans', 700, font('nunito-sans', '700Bold', 'NunitoSans_700Bold')],
  ['Nunito Sans', 800, font('nunito-sans', '800ExtraBold', 'NunitoSans_800ExtraBold')],
]
  .map(([family, weight, url]) => `@font-face{font-family:"${family}";font-weight:${weight};src:url("${url}")}`)
  .join('\n');

const baseCss = `${fontCss}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%}
body{overflow:hidden;font-family:"Nunito Sans",sans-serif;color:${c.cream}}
.canvas{position:relative;width:100%;height:100%;overflow:hidden;background:linear-gradient(160deg,${c.primaryDeep} 0%,${c.primary} 46%,${c.primarySoft} 100%)}
.paper{background:${c.creamSoft};color:${c.primary}}
.pattern{position:absolute;left:0;top:0}
.layer{position:absolute}
.kicker{font-family:Montserrat;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:${c.accent}}
.h{font-family:Montserrat;font-weight:800;line-height:1.04;letter-spacing:-.025em;color:${c.cream}}
.h b{color:${c.accent}}
.paper .h{color:${c.primary}}.paper .h b{color:${c.secondary}}.paper .kicker{color:${c.secondary}}
.p{font-weight:400;line-height:1.4;color:${c.onDark}}
.paper .p{color:${c.primary}}
.pill{display:inline-flex;align-items:center;gap:.5em;background:${c.cream};color:${c.primary};font-family:Montserrat;font-weight:700;border-radius:999px;padding:.55em 1.15em;white-space:nowrap}
.pill.sky{background:${c.accent}}
.chip{display:flex;align-items:center;gap:.7em;background:rgba(18,61,92,.92);border:2px solid rgba(167,212,237,.22);border-radius:.9em;padding:.6em .9em;font-weight:700;color:${c.cream}}
.num{flex:none;display:flex;align-items:center;justify-content:center;width:1.9em;height:1.9em;border-radius:50%;background:${c.accent};color:${c.primary};font-family:Montserrat;font-weight:800}
.wm{font-family:Montserrat;font-weight:800;letter-spacing:-.03em;line-height:1.1;color:${c.cream}}
.wm i{font-style:normal;color:${c.accent}}
.wm.light{color:${c.primary}}.wm.light i{color:${c.secondary}}
.foot{display:flex;align-items:center;gap:.8em}
.foot img{border-radius:24%}
.foot small{display:block;font-weight:700;color:${c.accentSoft};letter-spacing:.02em}
.paper .foot small{color:${c.secondary}}
.qr{background:#fff;border-radius:8%;padding:6%;display:flex}
.row{display:flex;align-items:center}
.col{display:flex;flex-direction:column}
svg{display:block}`;

// ---------- gráficos ----------
const rutix = (options, size) => drawingToSvg(rutixDrawing(options), { width: size });
const runner = (id, size) => drawingToSvg(runnerCharacterDrawing(id), { width: size });
const item = (kind, size) => drawingToSvg(runnerItemDrawing(kind), { width: size });
const icon = (name, size, color) => iconToSvg(icons[name], { size, color, strokeWidth: 2.2 });
const medal = (options, size) => drawingToSvg(medallionDrawing(options), { width: size });

// Fondo de patrón a tamaño de lienzo. `unit` agranda el motivo (los patrones se dibujan en puntos).
function pattern(kind, width, height, { unit = 3, opacity = 1, seed = 5 } = {}) {
  const w = Math.round(width / unit);
  const h = Math.round(height / unit);
  const shapes =
    kind === 'red'
      ? networkMesh({ width: w, height: h, seed, nodes: Math.round((w * h) / 9000) + 10 })
      : kind === 'orbitas'
        ? orbitRings({ width: w, height: h })
        : starField({ width: w, height: h, seed, stars: Math.round((w * h) / 6500) + 8, dots: Math.round((w * h) / 3200) + 14 });
  return `<div class="pattern" style="opacity:${opacity}">${drawingToSvg({ w, h, shapes }, { width, height })}</div>`;
}

function rings(cx, cy, size, { count = 6, opacity = 0.9 } = {}) {
  const shapes = signalRings({ cx: 200, cy: 200, rings: count, gap: 30, start: 26 });
  return `<div class="layer" style="left:${cx - size / 2}px;top:${cy - size / 2}px;opacity:${opacity}">${drawingToSvg({ w: 400, h: 400, shapes }, { width: size, height: size })}</div>`;
}

function qr(text, size) {
  const code = createQr(text, { errorCorrectionLevel: 'M' });
  const count = code.modules.size;
  let d = '';
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) if (code.modules.get(row, column)) d += `M${column} ${row}h1v1h-1z`;
  }
  return `<div class="qr" style="width:${size}px;height:${size}px"><svg width="100%" height="100%" viewBox="0 0 ${count} ${count}" shape-rendering="crispEdges"><path d="${d}" fill="${c.primary}"/></svg></div>`;
}

const wordmark = (size, light = false) => `<span class="wm${light ? ' light' : ''}" style="font-size:${size}px">Soy<i>TEL</i></span>`;
const footer = (size, light = false) =>
  `<div class="foot" style="font-size:${size}px"><img src="${brand('logo-app.png')}" width="${size * 2.6}" height="${size * 2.6}">` +
  `<div>${wordmark(size * 1.5, light)}<small style="font-size:${size * 0.72}px">Ingeniería Civil Telemática · USM</small></div></div>`;
const cast = (size, ids = runnerCharacters.map((character) => character.id), gap = 0.12) =>
  `<div class="row" style="gap:${size * gap}px">${ids.map((id) => runner(id, size)).join('')}</div>`;

const WEB = 'soytel.vercel.app';
const ROUTE_URL = `https://${WEB}/ruta`;
const pieces = [];
const piece = (group, name, width, height, body, { transparent = false, note = '' } = {}) => pieces.push({ group, name, width, height, body, transparent, note });

// ---------- logos (fondo transparente) ----------
[
  ['oscuro', false],
  ['claro', true],
].forEach(([tone, light]) => {
  piece('logos', `soytel-wordmark-${tone}`, 1600, 480, `<div class="row" style="height:100%;justify-content:center">${wordmark(380, light)}</div>`, { transparent: true });
  piece(
    'logos',
    `soytel-lockup-horizontal-${tone}`,
    2000,
    600,
    `<div class="row" style="height:100%;justify-content:center;gap:64px"><img src="${brand('logo-app.png')}" width="440" height="440" style="border-radius:24%">
     <div class="col" style="gap:6px">${wordmark(290, light)}<span style="font-family:Montserrat;font-weight:600;font-size:58px;color:${light ? c.secondary : c.accentSoft}">Mismas redes, un mejor mañana.</span></div></div>`,
    { transparent: true },
  );
});
piece(
  'logos',
  'soytel-lockup-vertical-oscuro',
  1200,
  1300,
  `<div class="col" style="height:100%;align-items:center;justify-content:center;gap:40px"><img src="${brand('logo-app.png')}" width="540" height="540" style="border-radius:24%">
   ${wordmark(280)}<span style="font-family:Montserrat;font-weight:600;font-size:56px;color:${c.accentSoft}">Mismas redes, un mejor mañana.</span></div>`,
  { transparent: true },
);
piece(
  'logos',
  'rutix-sello',
  1024,
  1024,
  `<div class="row" style="height:100%;justify-content:center"><div style="position:relative;width:940px;height:940px;border-radius:50%;background:radial-gradient(circle at 50% 38%,${c.primarySoft},${c.primary} 68%);border:34px solid ${c.cream};overflow:hidden">
   <div class="layer" style="left:0;top:0;opacity:.8">${drawingToSvg({ w: 290, h: 290, shapes: starField({ width: 290, height: 290, seed: 9, stars: 9, dots: 16 }) }, { width: 872, height: 872 })}</div>
   <div class="layer" style="left:86px;top:92px">${rutix({ expression: 'happy', pose: 'wave', signal: 4, shadow: false }, 700)}</div></div></div>`,
  { transparent: true },
);

// ---------- redes sociales ----------
piece(
  'social',
  'post-cuadrado-1080',
  1080,
  1080,
  `<div class="canvas">${pattern('estrellas', 1080, 1080)}${rings(820, 760, 900, { opacity: 0.55 })}
   <div class="layer col" style="left:80px;top:84px;gap:26px;width:920px"><span class="kicker" style="font-size:26px">Ingeniería Civil Telemática · USM</span>
   <h1 class="h" style="font-size:118px">Mismas redes,<br>un <b>mejor mañana</b>.</h1>
   <p class="p" style="font-size:38px;width:600px">Descubre la carrera jugando: microjuegos, una carrera sin fin y la Ruta Telemática en vivo.</p>
   <span class="pill" style="font-size:34px;align-self:flex-start">${icon('gamepad', 38, c.primary)} Juega en ${WEB}</span></div>
   <div class="layer" style="right:30px;bottom:150px">${rutix({ expression: 'happy', pose: 'wave', signal: 4 }, 470)}</div>
   <div class="layer" style="left:80px;bottom:70px">${footer(30)}</div></div>`,
);
piece(
  'social',
  'post-runner-1080',
  1080,
  1080,
  `<div class="canvas">${pattern('estrellas', 1080, 1080, { seed: 12 })}
   <svg class="layer" style="left:0;top:0" width="1080" height="1080"><polygon points="440,470 640,470 1010,1080 70,1080" fill="${c.primaryDeep}" opacity=".9"/>
   <line x1="440" y1="470" x2="70" y2="1080" stroke="${c.accent}" stroke-width="6"/><line x1="640" y1="470" x2="1010" y2="1080" stroke="${c.accent}" stroke-width="6"/>
   <line x1="507" y1="470" x2="383" y2="1080" stroke="${c.accentSoft}" stroke-width="4" stroke-dasharray="20 24" opacity=".4"/><line x1="573" y1="470" x2="697" y2="1080" stroke="${c.accentSoft}" stroke-width="4" stroke-dasharray="20 24" opacity=".4"/></svg>
   <div class="layer col" style="left:80px;top:80px;gap:22px;width:920px"><span class="kicker" style="font-size:26px">Nuevo en SoyTEL</span>
   <h1 class="h" style="font-size:112px">TEL Runner</h1><p class="p" style="font-size:40px;width:780px">Corre por la <b style="color:${c.cream}">autopista de datos</b>, junta paquetes y desbloquea personajes telemáticos.</p></div>
   <div class="layer" style="left:520px;top:486px">${item('packet', 64)}</div><div class="layer" style="left:600px;top:548px">${item('virus', 92)}</div>
   <div class="layer" style="left:250px;top:700px">${item('packet', 124)}</div><div class="layer" style="left:716px;top:690px">${item('shield', 150)}</div>
   <div class="layer" style="left:396px;top:600px">${rutix({ expression: 'happy', pose: 'idle', signal: 4 }, 290)}</div>
   <div class="layer row" style="left:0;right:0;bottom:44px;justify-content:center">${cast(110, ['paqui', 'routa', 'fibri', 'satelin', 'dronix', 'nubi'], 0.3)}</div></div>`,
);
piece(
  'social',
  'historia-1080x1920',
  1080,
  1920,
  `<div class="canvas">${pattern('estrellas', 1080, 1920, { seed: 3 })}${rings(940, 300, 1100, { opacity: 0.5 })}
   <div class="layer col" style="left:84px;top:150px;gap:30px;width:912px"><span class="kicker" style="font-size:30px">Feria · Stand Telemática</span>
   <h1 class="h" style="font-size:136px">Juega la<br><b>Ruta Telemática</b></h1>
   <p class="p" style="font-size:44px">Recorre los laboratorios con tu grupo, juega en cada sala y sube al podio.</p></div>
   <div class="layer col" style="left:84px;top:840px;gap:20px;width:600px;font-size:36px">
   <div class="chip"><span class="num">1</span>Escanea el código</div><div class="chip"><span class="num">2</span>Juega en B215 y B213</div><div class="chip"><span class="num">3</span>Trivia final y podio</div></div>
   <div class="layer" style="right:40px;top:820px">${rutix({ expression: 'wink', pose: 'point', signal: 4 }, 360)}</div>
   <div class="layer col" style="left:0;right:0;top:1210px;align-items:center;gap:22px">${qr(ROUTE_URL, 400)}<span class="pill" style="font-size:36px">${WEB}/ruta</span></div>
   <div class="layer" style="left:84px;bottom:90px">${footer(34)}</div></div>`,
);
piece(
  'social',
  'banner-1600x900',
  1600,
  900,
  `<div class="canvas">${pattern('red', 1600, 900, { opacity: 0.8 })}${rings(1260, 470, 980, { opacity: 0.45 })}
   <div class="layer col" style="left:96px;top:120px;gap:26px;width:860px"><span class="kicker" style="font-size:26px">Ingeniería Civil Telemática · USM</span>
   <h1 class="h" style="font-size:118px">Aprende redes<br><b>jugando</b>.</h1>
   <p class="p" style="font-size:36px">22 microjuegos, TEL Runner, desafíos sin reloj y la Ruta Telemática en vivo, con Rutix como guía.</p></div>
   <div class="layer" style="left:520px;bottom:74px"><span class="pill" style="font-size:30px">${WEB}</span></div>
   <div class="layer" style="right:150px;top:200px">${rutix({ expression: 'celebrate', pose: 'celebrate', signal: 4 }, 500)}</div>
   <div class="layer" style="right:70px;bottom:60px">${cast(104, ['paqui', 'routa', 'fibri', 'satelin', 'dronix', 'nubi'], 0.04)}</div>
   <div class="layer" style="left:96px;bottom:60px">${footer(26)}</div></div>`,
);
piece(
  'social',
  'vista-previa-1200x630',
  1200,
  630,
  `<div class="canvas">${pattern('estrellas', 1200, 630)}${rings(980, 330, 760, { opacity: 0.5 })}
   <div class="layer col" style="left:70px;top:70px;gap:18px;width:700px">${wordmark(120)}
   <h1 class="h" style="font-size:62px">Descubre Telemática <b>jugando</b></h1>
   <p class="p" style="font-size:28px">Microjuegos, TEL Runner y la Ruta Telemática en vivo de Ingeniería Civil Telemática USM.</p></div>
   <div class="layer" style="right:60px;top:120px">${rutix({ expression: 'happy', pose: 'wave', signal: 4 }, 400)}</div>
   <div class="layer row" style="left:70px;bottom:50px;gap:16px"><img src="${brand('logo-app.png')}" width="64" height="64" style="border-radius:24%"><span class="pill" style="font-size:24px">${WEB}</span></div></div>`,
  { note: 'Imagen para enlaces compartidos (Open Graph).' },
);
piece(
  'social',
  'tienda-1024x500',
  1024,
  500,
  `<div class="canvas">${pattern('estrellas', 1024, 500, { seed: 21 })}${rings(820, 250, 640, { opacity: 0.5 })}
   <div class="layer col" style="left:56px;top:70px;gap:14px;width:560px">${wordmark(132)}<span style="font-family:Montserrat;font-weight:600;font-size:34px;color:${c.accentSoft}">Mismas redes, un mejor mañana.</span>
   <div class="row" style="gap:10px;margin-top:18px">${cast(74, ['paqui', 'routa', 'fibri', 'satelin'], 0.08)}</div></div>
   <div class="layer" style="right:70px;top:70px">${rutix({ expression: 'happy', pose: 'wave', signal: 4 }, 360)}</div></div>`,
  { note: 'Gráfico de funciones para la ficha de la tienda (1024×500).' },
);

// ---------- impresos ----------
piece(
  'impresos',
  'afiche-stand-a4',
  1240,
  1754,
  `<div class="canvas">${pattern('estrellas', 1240, 1754, { seed: 8 })}${rings(1060, 420, 1200, { opacity: 0.5 })}
   <div class="layer col" style="left:90px;top:110px;gap:26px;width:1060px"><span class="kicker" style="font-size:34px">Ruta Telemática · en vivo</span>
   <h1 class="h" style="font-size:220px">Escanea<br>y <b>juega</b></h1>
   <p class="p" style="font-size:46px;width:700px">Entra con tu grupo, recorre los laboratorios de Telemática y compite por el podio.</p></div>
   <div class="layer" style="right:70px;top:500px">${rutix({ expression: 'happy', pose: 'point', signal: 4 }, 420)}</div>
   <div class="layer row" style="left:90px;top:890px;gap:56px;align-items:flex-start">${qr(ROUTE_URL, 520)}
   <div class="col" style="gap:22px;font-size:40px;width:470px;margin-top:8px"><div class="chip"><span class="num">1</span>Abre la cámara</div><div class="chip"><span class="num">2</span>Escribe tu alias</div><div class="chip"><span class="num">3</span>Sigue a tu grupo</div>
   <span class="pill" style="font-size:34px;align-self:flex-start">${WEB}/ruta</span></div></div>
   <div class="layer" style="left:90px;bottom:226px"><span class="kicker" style="font-size:30px">Stand → B215 → B213 → Pasillo</span></div>
   <div class="layer" style="left:90px;bottom:90px">${footer(40)}</div></div>`,
  { note: 'Afiche A4 (150 dpi) para el stand, con el QR de la ruta.' },
);
piece(
  'impresos',
  'diploma-a4-horizontal',
  1754,
  1240,
  `<div class="canvas paper" style="background:${c.creamSoft}"><div class="layer" style="left:44px;top:44px;right:44px;bottom:44px;border:6px solid ${c.primary};border-radius:36px"></div>
   <div class="layer" style="left:62px;top:62px;right:62px;bottom:62px;border:2px solid ${c.accent};border-radius:24px"></div>
   <div class="layer col" style="left:150px;top:140px;gap:20px;width:1000px"><span class="kicker" style="font-size:30px">Diploma de participación</span>
   <h1 class="h" style="font-size:132px">Ruta <b>Telemática</b></h1><p class="p" style="font-size:38px;margin-top:10px">Se otorga a</p>
   <div style="height:96px;border-bottom:4px solid ${c.primary};width:980px"></div>
   <p class="p" style="font-size:36px;width:980px">por recorrer los laboratorios de Ingeniería Civil Telemática, completar los juegos de sus cinco pilares y restaurar el Templo de Telemática.</p></div>
   <div class="layer col" style="right:150px;top:150px;align-items:center;gap:8px">${medal({ glyph: 'route', tier: 'oro', ribbon: true }, 300)}</div>
   <div class="layer" style="right:170px;bottom:250px"><div style="width:270px;height:270px;border-radius:50%;background:${c.primary};display:flex;align-items:center;justify-content:center">${rutix({ expression: 'celebrate', pose: 'celebrate', signal: 4, shadow: false }, 250)}</div></div>
   <div class="layer row" style="left:150px;bottom:130px;gap:80px;align-items:flex-end">${footer(34, true)}
   <div class="col" style="gap:8px;width:330px"><div style="border-bottom:3px solid ${c.primary};height:60px"></div><span style="font-weight:700;font-size:24px;color:${c.secondary}">Equipo de Telemática USM</span></div>
   <div class="col" style="gap:8px;width:220px"><div style="border-bottom:3px solid ${c.primary};height:60px"></div><span style="font-weight:700;font-size:24px;color:${c.secondary}">Fecha</span></div></div></div>`,
  { note: 'Diploma A4 horizontal (150 dpi) con espacio para el nombre.' },
);
piece(
  'impresos',
  'credencial-equipo',
  638,
  1004,
  `<div class="canvas">${pattern('estrellas', 638, 1004, { seed: 14 })}
   <div class="layer" style="left:259px;top:38px;width:120px;height:26px;border-radius:13px;background:${c.primaryDeep};border:2px solid rgba(167,212,237,.4)"></div>
   <div class="layer col" style="left:0;right:0;top:110px;align-items:center;gap:14px"><div style="width:300px;height:300px;border-radius:50%;background:${c.primarySoft};border:12px solid ${c.cream};display:flex;align-items:center;justify-content:center">${rutix({ expression: 'happy', pose: 'thumbsUp', signal: 4, shadow: false }, 250)}</div>
   <span class="kicker" style="font-size:24px;margin-top:10px">Equipo del stand</span><h1 class="h" style="font-size:70px;text-align:center">Monitor TEL</h1>
   <div style="width:500px;height:110px;border-radius:22px;background:${c.cream}"></div>
   <p class="p" style="font-size:28px;text-align:center;width:500px">Pregúntame por la Ruta Telemática y por la carrera.</p></div>
   <div class="layer row" style="left:0;right:0;bottom:56px;justify-content:center">${footer(24)}</div></div>`,
  { note: 'Credencial 54×85 mm (300 dpi) para quienes atienden el stand; el recuadro crema es para el nombre.' },
);
const stickerLines = { happy: '¡Hola!', celebrate: '¡Señal completa!', love: '¡Me encanta!', wink: 'Te doy una pista', proud: '¡Bien ahí!', laugh: '¡Jajaja!', think: 'Mmm…', focus: 'Concentración', surprised: '¡Oh!', alert: '¡Queda poco!', worried: 'Casi…', sleepy: 'Con sueño', sad: 'Poca señal', sleep: 'Zzz', neutral: 'Conectado' };
const stickerPose = { happy: 'wave', celebrate: 'celebrate', wink: 'point', proud: 'thumbsUp', think: 'think', worried: 'shrug', laugh: 'celebrate' };
const sticker = (inner, label, size) =>
  `<div class="col" style="align-items:center;gap:10px"><div style="width:${size}px;height:${size}px;border-radius:50%;background:${c.primary};border:${size * 0.05}px solid #fff;box-shadow:0 6px 0 rgba(11,45,69,.18);display:flex;align-items:center;justify-content:center;overflow:hidden">${inner}</div>` +
  `<span style="font-family:Montserrat;font-weight:700;font-size:${size * 0.105}px;color:${c.primary}">${label}</span></div>`;
piece(
  'impresos',
  'stickers-rutix',
  1600,
  1700,
  `<div class="canvas paper" style="background:${c.surfaceAlt}"><div class="layer col" style="left:70px;top:60px;gap:6px"><span class="kicker" style="font-size:24px">Hoja de stickers</span><h1 class="h" style="font-size:64px">Rutix y sus <b>ánimos</b></h1></div>
   <div class="layer" style="left:70px;top:220px;right:70px;display:grid;grid-template-columns:repeat(4,1fr);gap:34px 20px">${rutixExpressions
     .slice(0, 12)
     .map((expression) => sticker(rutix({ expression, pose: stickerPose[expression] || 'idle', signal: 4, shadow: false }, 290), stickerLines[expression] || expression, 330))
     .join('')}</div><div class="layer" style="left:70px;bottom:50px">${footer(24, true)}</div></div>`,
  { note: 'Hoja de 12 stickers circulares (troquel de 5 cm aprox.).' },
);
piece(
  'impresos',
  'stickers-personajes',
  1600,
  1150,
  `<div class="canvas paper" style="background:${c.surfaceAlt}"><div class="layer col" style="left:70px;top:60px;gap:6px"><span class="kicker" style="font-size:24px">Hoja de stickers</span><h1 class="h" style="font-size:64px">Personajes <b>telemáticos</b></h1></div>
   <div class="layer" style="left:70px;top:230px;right:70px;display:grid;grid-template-columns:repeat(4,1fr);gap:30px 20px">${runnerCharacters.map((character) => sticker(runner(character.id, 250), `${character.name} · ${character.role}`, 320)).join('')}
   ${sticker(`<div class="row" style="gap:6px">${item('packet', 110)}${item('shield', 110)}</div>`, 'Paquete y cortafuegos', 320)}</div>
   <div class="layer" style="right:70px;top:70px">${footer(24, true)}</div></div>`,
  { note: 'Hoja de stickers de los personajes de TEL Runner.' },
);

// ---------- presentación ----------
piece(
  'presentacion',
  'portada-16x9',
  1920,
  1080,
  `<div class="canvas">${pattern('estrellas', 1920, 1080, { seed: 17 })}${rings(1500, 560, 1300, { opacity: 0.45 })}
   <div class="layer col" style="left:130px;top:230px;gap:30px;width:1050px"><span class="kicker" style="font-size:32px">Ingeniería Civil Telemática · USM</span>
   <h1 class="h" style="font-size:150px">Título de la<br><b>presentación</b></h1><p class="p" style="font-size:44px">Subtítulo, fecha o nombre de quien presenta.</p></div>
   <div class="layer" style="right:220px;top:260px">${rutix({ expression: 'happy', pose: 'wave', signal: 4 }, 520)}</div>
   <div class="layer" style="left:130px;bottom:90px">${footer(32)}</div></div>`,
  { note: 'Portada 16:9; reemplaza el título y el subtítulo.' },
);
piece(
  'presentacion',
  'fondo-oscuro-16x9',
  1920,
  1080,
  `<div class="canvas">${pattern('estrellas', 1920, 1080, { seed: 23, opacity: 0.7 })}${rings(1760, 150, 900, { opacity: 0.35 })}
   <div class="layer" style="left:110px;top:150px;width:140px;height:10px;border-radius:5px;background:${c.accent}"></div>
   <div class="layer row" style="right:90px;bottom:60px;gap:16px"><img src="${brand('logo-app.png')}" width="70" height="70" style="border-radius:24%">${wordmark(50)}</div></div>`,
  { note: 'Fondo oscuro 16:9 para láminas de contenido.' },
);
piece(
  'presentacion',
  'fondo-claro-16x9',
  1920,
  1080,
  `<div class="canvas paper" style="background:${c.paper}"><div class="layer" style="left:0;top:0;right:0;height:36px;background:${c.primary}"></div>
   <div class="layer" style="left:110px;top:150px;width:140px;height:10px;border-radius:5px;background:${c.secondary}"></div>
   <div class="layer" style="right:-120px;bottom:-140px;opacity:.5">${drawingToSvg({ w: 400, h: 400, shapes: signalRings({ cx: 200, cy: 200, rings: 6, gap: 30, start: 26 }).map((shape) => ({ ...shape, stroke: c.borderStrong })) }, { width: 760, height: 760 })}</div>
   <div class="layer row" style="right:90px;bottom:60px;gap:16px"><img src="${brand('logo-app.png')}" width="70" height="70" style="border-radius:24%">${wordmark(50, true)}</div></div>`,
  { note: 'Fondo claro 16:9 para láminas de contenido.' },
);

// ---------- salida ----------
const page = ({ width, height, body, transparent }) =>
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${baseCss}\nhtml,body{width:${width}px;height:${height}px;background:${transparent ? 'transparent' : c.primary}}</style></head><body>${body}</body></html>`;

function loadPuppeteer() {
  for (const candidate of ['puppeteer-core', process.env.PUPPETEER_CORE_PATH].filter(Boolean)) {
    try {
      const loaded = require(candidate);
      return loaded.default ?? loaded;
    } catch {
      // Se prueba la siguiente ubicación.
    }
  }
  return null;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function main() {
  const htmlDir = path.join(outDir, 'html');
  fs.mkdirSync(htmlDir, { recursive: true });
  pieces.forEach((item_) => {
    fs.mkdirSync(path.join(outDir, item_.group), { recursive: true });
    fs.writeFileSync(path.join(htmlDir, `${item_.name}.html`), page(item_));
  });
  const kitFile = path.join(outDir, 'kit.json');
  // El índice anterior ya no describe lo que hay: se vuelve a escribir al final, con lo que exista.
  fs.rmSync(kitFile, { force: true });

  if (htmlOnly) {
    fs.writeFileSync(kitFile, JSON.stringify(pieces.map(({ group, name, width, height, note }) => ({ group, file: `html/${name}.html`, format: 'html', width, height, note })), null, 2));
    console.log(`Kit de marca (solo HTML): ${pieces.length} piezas en ${htmlDir}. No se generaron imágenes.`);
    return;
  }

  const puppeteer = loadPuppeteer();
  const chrome = findChrome();
  if (!puppeteer || !chrome) {
    throw new Error(
      `No se pueden generar las imágenes del kit: falta ${!puppeteer ? 'puppeteer-core (ejecuta npm ci)' : 'Chrome (define CHROME_PATH)'}. El HTML fuente quedó en ${htmlDir}. Si solo quieres el HTML, usa: npm run brand:kit -- --html-only`,
    );
  }
  const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--allow-file-access-from-files'] });
  const tab = await browser.newPage();
  for (const item_ of pieces) {
    await tab.setViewport({ width: item_.width, height: item_.height, deviceScaleFactor: 1 });
    await tab.goto(fileUrl(path.join(htmlDir, `${item_.name}.html`)), { waitUntil: 'load' });
    await tab.evaluate(() => document.fonts.ready);
    await tab.screenshot({ path: path.join(outDir, item_.group, `${item_.name}.png`), omitBackground: item_.transparent });
    // La imagen de enlaces compartidos también sale en JPEG: es la que usa la web (public/og.jpg).
    if (item_.name.startsWith('vista-previa')) await tab.screenshot({ path: path.join(outDir, item_.group, `${item_.name}.jpg`), type: 'jpeg', quality: 88 });
  }
  await browser.close();
  const missing = pieces.filter((item_) => !fs.existsSync(path.join(outDir, item_.group, `${item_.name}.png`)));
  if (missing.length) throw new Error(`Faltan ${missing.length} imágenes del kit: ${missing.map((item_) => item_.name).join(', ')}`);
  fs.writeFileSync(kitFile, JSON.stringify(pieces.map(({ group, name, width, height, note }) => ({ group, file: `${name}.png`, format: 'png', width, height, note })), null, 2));
  console.log(`Kit de marca: ${pieces.length} piezas en ${outDir}`);
}

main().catch((error) => {
  console.error(`\n✖ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
