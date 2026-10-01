// Genera el sistema de diseño de SoyTEL para Claude Design (artifact tipo "Design System")
// a partir de las fuentes reales de la app: tokens de src/theme, gráficos de src/graphics y fuentes TTF.
// Uso:
//   node scripts/build-design-system.js <carpeta>              → escribe <carpeta>/project/** y <carpeta>/uploads/**
//   node scripts/build-design-system.js <carpeta> --index ids.json  → además escribe project/design-system.json
const fs = require('fs');
const path = require('path');
const { drawingToSvg, iconToSvg } = require('./export-design');

const root = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'dist', 'design-system'));
const indexArg = process.argv.indexOf('--index');
const idsFile = indexArg > 0 ? path.resolve(process.argv[indexArg + 1]) : null;

const src = (file) => require(path.join(root, 'src', file));
const { colors, tierColors } = src('theme/colors');
const { typography } = src('theme/typography');
const { spacing, radius } = src('theme/spacing');
const { shadows, motion } = src('theme/effects');
const { icons } = src('graphics/icons');
const { medallionDrawing, medallionGlyphs } = src('graphics/medallions');
const { rutixDrawing, rutixExpressions } = src('graphics/rutix');
const { illustrationDrawing, illustrationNames } = src('graphics/illustrations');
const { patternPreviews } = src('graphics/patterns');
const { campusMapDrawing } = src('graphics/campusMap');
const { templeDrawing } = src('graphics/temple');
const { pillars, answerStyles, routeStops } = src('route/content');
const avatars = src('data/avatars').avatarCatalog.filter((item) => item.icon !== 'rutix');
const { create: createQr } = require('qrcode');

const project = path.join(outDir, 'project');
const uploads = path.join(outDir, 'uploads');

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

// ---------- contraste WCAG ----------
function luminance(hex) {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((l1 + 0.05) / (l2 + 0.05)).toFixed(1);
}
const on = (fg, bg) => `${contrast(colors[fg], colors[bg])}:1 sobre \`${bg}\``;

// ---------- tokens.json ----------
const colorUsage = {
  primary: `Azul noche de la marca: cabeceras, botón principal, tarjetas oscuras y fondo de pantallas inmersivas (juegos, historia). Texto \`cream\` encima (${on('cream', 'primary')}).`,
  primarySoft: 'Superficie elevada sobre `primary`: tarjetas oscuras, botones de ícono en cabeceras, opciones de quiz en tono oscuro. Degradado de pantalla oscura `primary` → `primarySoft`.',
  primaryDeep: 'Fondo más profundo para degradados de bienvenida y la terminal del microjuego de ping.',
  primaryInput: 'Relleno de campos de texto sobre fondo oscuro (onboarding).',
  secondary: `Azul secundario: barras de progreso, íconos activos, bordes de selección y texto de enlaces sobre fondos claros (${on('secondary', 'paper')}).`,
  accent: `Celeste de acento: arco de las medallas, ondas de señal, barras de tiempo, botón «Siguiente». Como texto solo sobre \`primary\` (${on('accent', 'primary')}).`,
  accentSoft: `Celeste claro: textos secundarios sobre \`primary\` (${on('accentSoft', 'primary')}) y botón secundario.`,
  highlight: 'Tinte celeste para píldora de pestaña activa, chips y fondos de íconos en tarjetas claras.',
  cream: `Crema de la marca: texto principal sobre azul (${on('cream', 'primary')}), botón CTA en pantallas oscuras, anillo de medallas y cuerpo de Rutix.`,
  creamSoft: 'Crema muy clara para zonas de lectura sobre crema.',
  creamShade: 'Sombra del crema (extremidades de Rutix, cara lateral de paquetes 3D).',
  slate: 'Azul grisáceo de apoyo: estados deshabilitados, placeholders sobre fondo oscuro, alternativas atenuadas.',
  paper: 'Fondo de las pantallas claras (pestañas, perfil, prácticas).',
  surface: 'Tarjetas y listas sobre `paper`, siempre con borde `border`.',
  surfaceAlt: 'Fondo secundario: pistas de barras de progreso, botón sutil, bloques internos de tarjetas.',
  border: 'Bordes de tarjetas, filas y separadores sobre fondos claros.',
  borderStrong: 'Borde de elementos no leídos o destacados (avisos sin leer, línea pendiente de la ruta).',
  ink: `Texto principal sobre \`paper\` y \`surface\` (${on('ink', 'paper')}). Igual que \`primary\`.`,
  muted: `Texto secundario y metadatos sobre \`paper\` y \`surface\` (${on('muted', 'paper')}).`,
  onDark: `Texto de cuerpo sobre \`primary\` (${on('onDark', 'primary')}).`,
  success: 'Estado correcto: insignias de opción correcta, íconos de verificación. Siempre con ícono o palabra, nunca solo color.',
  successSoft: 'Fondo de paneles de acierto y etiquetas «Completada».',
  successInk: `Texto sobre \`successSoft\` (${on('successInk', 'successSoft')}).`,
  warning: 'Advertencia y monedas del concurso. No usar para texto sobre fondos claros.',
  warningSoft: 'Fondo de etiquetas de advertencia o de Rutix.',
  warningInk: `Texto sobre \`warningSoft\` y \`cream\` (${on('warningInk', 'cream')}).`,
  danger: 'Error, vida perdida, punto de aviso sin leer y acciones destructivas (con ícono).',
  dangerSoft: 'Fondo de paneles de error.',
  dangerInk: `Texto sobre \`dangerSoft\` (${on('dangerInk', 'dangerSoft')}).`,
  info: 'Información neutra (reservado; la app prefiere `secondary`).',
  white: 'Blanco puro: texto sobre `danger` y `success`, brillos de Rutix.',
  black: 'Solo para sombras (proyección de Rutix).',
  overlay: 'Velo azul sobre imágenes para dar legibilidad al texto.',
};

const colorTokens = Object.entries(colors).map(([name, value]) => ({
  name,
  value: String(value).replace(/\s+/g, ' '),
  usage: colorUsage[name] ?? '',
}));
Object.entries(tierColors).forEach(([tier, info]) => {
  colorTokens.push({
    name: `tier-${tier}`,
    value: info.ring[1],
    usage: `Anillo de medallas de rareza ${info.label.toLowerCase()} (degradado ${info.ring.join(' → ')}).`,
  });
});
pillars.forEach((pillar) => {
  colorTokens.push({
    name: `pilar-${pillar.id}`,
    value: pillar.color,
    usage: `Pilar ${pillar.pillar} de la ruta (proyecto «${pillar.project}»): columna del templo, borde de su tarjeta en B213 y acentos de su juego. Texto oscuro ${pillar.ink}.`,
  });
});
answerStyles.forEach((style, index) => {
  colorTokens.push({
    name: `respuesta-${index + 1}`,
    value: style.color,
    usage: `Alternativa ${index + 1} de la trivia en vivo (${style.label.toLowerCase()}): color y forma juntos, para que se distingan sin depender del color.`,
  });
});

const roleFamily = { display: 'display', displayBold: 'display', displaySemi: 'display', body: 'body', bodySemi: 'body', bodyBold: 'body', bodyHeavy: 'body' };
const roleWeight = { display: 800, displayBold: 700, displaySemi: 600, body: 400, bodySemi: 600, bodyBold: 700, bodyHeavy: 800 };
const styleUsage = {
  display: 'Cifras grandes de resultado (puntaje final) y el logotipo SoyTEL.',
  hero: 'Título de pantallas inmersivas (intro de Ráfaga, concurso, rondas).',
  title: 'Título de cabecera y de secciones principales.',
  heading: 'Encabezados de sección («Explora», «Áreas de la carrera») y preguntas.',
  subtitle: 'Títulos de tarjetas, filas y alternativas destacadas.',
  body: 'Texto corrido y explicaciones.',
  bodyStrong: 'Texto de alternativas y énfasis dentro de párrafos.',
  label: 'Etiquetas de formularios, chips y metadatos importantes.',
  caption: 'Descripciones cortas bajo títulos y metadatos.',
  small: 'Etiquetas en mayúsculas pequeñas, contadores y leyendas.',
  overline: 'Kicker en mayúsculas espaciadas sobre los títulos de cabecera.',
  button: 'Texto de botones.',
  number: 'Números de estadísticas.',
};
const displayStyles = [];
const bodyStyles = [];
Object.entries(typography).forEach(([name, token]) => {
  const style = {
    name,
    fontSize: `${token.fontSize}px`,
    lineHeight: `${token.lineHeight}px`,
    fontWeight: roleWeight[token.role],
    usage: styleUsage[name],
  };
  if (token.letterSpacing) style.letterSpacing = `${token.letterSpacing}px`;
  (roleFamily[token.role] === 'display' ? displayStyles : bodyStyles).push(style);
});

const fontFiles = [
  ['Montserrat', '600', 'montserrat', '600SemiBold', 'Montserrat_600SemiBold'],
  ['Montserrat', '700', 'montserrat', '700Bold', 'Montserrat_700Bold'],
  ['Montserrat', '800', 'montserrat', '800ExtraBold', 'Montserrat_800ExtraBold'],
  ['Nunito Sans', '400', 'nunito-sans', '400Regular', 'NunitoSans_400Regular'],
  ['Nunito Sans', '600', 'nunito-sans', '600SemiBold', 'NunitoSans_600SemiBold'],
  ['Nunito Sans', '700', 'nunito-sans', '700Bold', 'NunitoSans_700Bold'],
  ['Nunito Sans', '800', 'nunito-sans', '800ExtraBold', 'NunitoSans_800ExtraBold'],
];
const fonts = fontFiles.map(([family, weight, pkg, folder, file]) => {
  const from = path.join(root, 'node_modules', '@expo-google-fonts', pkg, folder, `${file}.ttf`);
  write(path.join(project, 'fonts', `${file}.ttf`), fs.readFileSync(from));
  return { family, file: `fonts/${file}.ttf`, weight, style: 'normal' };
});

const spacingUsage = {
  xxs: 'Separación mínima entre ícono y texto.',
  xs: 'Separación dentro de grupos (chips, filas de etiquetas).',
  sm: 'Separación entre elementos de una tarjeta.',
  md: 'Margen lateral de las pantallas y separación entre tarjetas.',
  gutter: 'Relleno horizontal de cabeceras.',
  lg: 'Relleno de botones y separación entre bloques grandes.',
  xl: 'Relleno inferior de pantallas y grandes respiros.',
  xxl: 'Espacios de portada.',
};
const radiusUsage = {
  xs: 'Barras de skeleton y elementos pequeños.',
  sm: 'Botones pequeños, campos de texto, íconos de fila.',
  md: 'Botones, opciones de quiz y cuadros de código.',
  lg: 'Tarjetas.',
  xl: 'Tarjeta de pregunta del concurso, mapa del campus.',
  xxl: 'Borde inferior de la cabecera de Inicio y hojas modales.',
  pill: 'Etiquetas, chips, barras de progreso y píldoras.',
};

const tokens = {
  name: 'SoyTEL',
  version: 1,
  meta: {
    source: 'code',
    repo: 'crismoraga/SoyTEL',
    paths: { tokens: ['src/theme/colors.ts', 'src/theme/typography.ts', 'src/theme/spacing.ts', 'src/theme/effects.ts'], assets: ['src/graphics', 'assets/brand'] },
    synced: new Date().toISOString().slice(0, 10),
  },
  color: {
    themes: [{ id: 'light', name: 'App' }],
    tokens: colorTokens,
  },
  type: {
    fonts,
    families: {
      display: '"Montserrat", system-ui, sans-serif',
      body: '"Nunito Sans", system-ui, sans-serif',
      mono: 'Menlo, ui-monospace, "SF Mono", monospace',
    },
    groups: [
      { name: 'Display', family: 'display', note: 'Montserrat 600–800 para títulos, botones y cifras.', styles: displayStyles },
      { name: 'Texto', family: 'body', note: 'Nunito Sans 400–800 para lectura, etiquetas y metadatos.', styles: bodyStyles },
      { name: 'Terminal', family: 'mono', styles: [{ name: 'terminal', fontSize: '12px', lineHeight: '17px', fontWeight: 400, usage: 'Salida de comandos en el microjuego «¿Ping o no ping?» y contraseñas.' }] },
    ],
  },
  spacing: {
    tokens: Object.entries(spacing).map(([name, value]) => ({ name: `space-${name}`, value: `${value}px`, usage: spacingUsage[name] })),
  },
  radius: {
    tokens: Object.entries(radius).map(([name, value]) => ({ name: `radius-${name}`, value: `${value}px`, usage: radiusUsage[name] })),
  },
  shadow: {
    tokens: Object.entries(shadows)
      .filter(([name]) => name !== 'none')
      .map(([name, style]) => ({
        name: `shadow-${name}`,
        value: style.boxShadow,
        usage: {
          soft: 'Tarjetas de carrusel y paneles discretos.',
          card: 'Tarjeta flotante de misión en Inicio y tarjetas elevadas.',
          lifted: 'Avisos flotantes (toasts).',
          logo: 'Logo de la pantalla de bienvenida.',
          glow: 'Resplandor celeste de elementos activos.',
        }[name],
      })),
  },
  duration: {
    note: 'Duraciones de animación (Reanimated). Todo movimiento decorativo se apaga con «Reducir animaciones».',
    tokens: Object.entries(motion.duration).map(([name, value]) => ({ name: `duration-${name}`, value: `${value}ms`, usage: {
      instant: 'Respuesta táctil inmediata.',
      fast: 'Presión de botones y cambios de estado.',
      base: 'Transiciones de contenido.',
      slow: 'Entradas de tarjetas y textos.',
      slower: 'Revelaciones y celebraciones.',
      ambient: 'Movimiento ambiental (flotar de Rutix, titilar de estrellas).',
    }[name] })),
  },
};
write(path.join(project, 'tokens.json'), `${JSON.stringify(tokens, null, 2)}\n`);

// ---------- activos (se suben al almacén del artifact) ----------
const assetFiles = {};
function addAsset(group, name, content) {
  write(path.join(uploads, group, name), content);
  (assetFiles[group] = assetFiles[group] || []).push(name);
}
Object.entries(icons).forEach(([name, shapes]) => addAsset('Iconos', `${name}.svg`, iconToSvg(shapes, { size: 24, color: colors.primary }).replace(/currentColor/g, colors.primary)));
Object.keys(medallionGlyphs).forEach((glyph) => addAsset('Medallas', `${glyph}.svg`, drawingToSvg(medallionDrawing({ glyph }), { width: 240 })));
['bronce', 'plata', 'oro', 'platino'].forEach((tier) => addAsset('Medallas', `rareza-${tier}.svg`, drawingToSvg(medallionDrawing({ glyph: 'star', tier, ribbon: true }), { width: 240, height: 292 })));
addAsset('Medallas', 'estado-progreso.svg', drawingToSvg(medallionDrawing({ glyph: 'trophy', state: 'progress', progress: 0.6 }), { width: 240 }));
addAsset('Medallas', 'estado-bloqueado.svg', drawingToSvg(medallionDrawing({ glyph: 'trophy', state: 'locked' }), { width: 240 }));
const rutixPoses = { celebrate: 'celebrate', happy: 'wave', think: 'think' };
const rutixSignal = { sad: 1, sleepy: 2, sleep: 1, celebrate: 4, happy: 4, love: 4 };
rutixExpressions.forEach((expression) => addAsset('Rutix', `rutix-${expression}.svg`, drawingToSvg(rutixDrawing({ expression, pose: rutixPoses[expression] || 'idle', signal: rutixSignal[expression] ?? 3 }), { width: 400 })));
illustrationNames.forEach((name) => {
  addAsset('Ilustraciones', `${name}.svg`, drawingToSvg(illustrationDrawing(name), { width: 480, height: 400 }));
  addAsset('Ilustraciones', `${name}-oscuro.svg`, drawingToSvg(illustrationDrawing(name, 'dark'), { width: 480, height: 400 }));
});
addAsset('Ilustraciones', 'mapa-campus.svg', drawingToSvg(campusMapDrawing(), { width: 640, height: 800 }));
// Ruta Telemática: templo de los pilares, avatares y formas de la trivia.
const temple = (litCount) => drawingToSvg(templeDrawing(pillars.map((pillar, index) => ({ color: pillar.color, lit: index < litCount }))), { width: 640, height: 392 });
addAsset('Ruta', 'templo-apagado.svg', temple(0));
addAsset('Ruta', 'templo-parcial.svg', temple(3));
addAsset('Ruta', 'templo-encendido.svg', temple(5));
const avatarSvg = (index, size = 96) => {
  const info = avatars[index];
  const inner = iconToSvg(icons[info.icon], { size: 50, color: colors.primary }).replace(/currentColor/g, colors.primary).replace('<svg ', '<svg x="23" y="23" ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 96 96"><circle cx="48" cy="48" r="45" fill="${info.color}" stroke="${colors.cream}" stroke-width="4"/>${inner}</svg>`;
};
avatars.forEach((info, index) => addAsset('Ruta', `avatar-${index + 1}-${info.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}.svg`, avatarSvg(index)));
const shapeSvg = (index) => {
  const style = answerStyles[index];
  const glyph = {
    triangle: '<path d="M48 22 74 68H22z" fill="#fff"/>',
    diamond: '<path d="M48 20 76 48 48 76 20 48z" fill="#fff"/>',
    circle: '<circle cx="48" cy="48" r="24" fill="#fff"/>',
    square: '<rect x="26" y="26" width="44" height="44" rx="6" fill="#fff"/>',
  }[style.shape];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="22" fill="${style.color}"/>${glyph}</svg>`;
};
answerStyles.forEach((style, index) => addAsset('Ruta', `respuesta-${index + 1}-${style.shape}.svg`, shapeSvg(index)));
Object.entries(patternPreviews()).forEach(([name, drawing]) => addAsset('Patrones', `${name}.svg`, drawingToSvg(drawing, { width: 720, height: 480 })));
[
  ['logo-app.png', 'logo-app.png'],
  ['badge.png', 'badge.png'],
  ['splash-bg.jpg', 'fondo-bienvenida.jpg'],
  ['onboarding-hero.jpg', 'arte-onboarding.jpg'],
  ['banner.jpg', 'banner.jpg'],
  ['spot-labs.jpg', 'spot-laboratorios.jpg'],
  ['spot-events.jpg', 'spot-eventos.jpg'],
  ['spot-career.jpg', 'spot-carrera.jpg'],
].forEach(([from, name]) => addAsset('Marca', name, fs.readFileSync(path.join(root, 'assets', 'brand', from))));

const groupReadmes = {
  Marca: '# Marca\n\nArte rasterizado de la identidad Telemática USM, extraído de las hojas de marca y del export de Claude Design.\n\n- `logo-app.png` — logo en formato ícono de app (cuadrado redondeado). Úsalo con esquinas de 24% y sombra `shadow-logo` sobre `primary`.\n- `badge.png` — insignia circular recortada (fondo transparente); es la imagen del splash nativo.\n- `fondo-bienvenida.jpg` — fondo de la pantalla de bienvenida, siempre con velo azul encima.\n- `arte-onboarding.jpg` — ilustración de la primera lámina del onboarding.\n- `banner.jpg` — pieza horizontal para comunicación.\n- `spot-*.jpg` — ilustraciones puntuales con fondo blanco para tarjetas de carrusel (recorte `cover`).\n',
  Iconos: '# Íconos\n\nGrilla de 24×24, trazo 2, extremos y uniones redondeadas (estilo de las pantallas de Claude Design). En la app se dibujan con `TelIcon` y `currentColor`; estos SVG exportados usan tinta `primary` (#0B2D45) porque `<img>` no hereda color. Tamaños: 16–18 en etiquetas, 20–24 en filas y botones, 26–34 en tarjetas de juego. `heartSolid` y `starSolid` son las únicas variantes rellenas.\n',
  Medallas: '# Medallas\n\nMedallones de la marca: anillo crema, disco azul noche, arco celeste, estrellas de cuatro puntas y un glifo sólido crema. `medallionDrawing({ glyph, tier, state, progress, ribbon })` genera todas las variantes: rareza por anillo (`bronce`, `plata`, `oro`, `platino`, o `crema` por defecto) y estado (`unlocked`, `progress` con arco parcial, `locked` en gris con candado). Úsalas para logros, áreas de la carrera, estaciones y accesos del Inicio. Tamaños: 44–64 en listas, 76 en grillas, 88–132 en detalle.\n',
  Rutix: '# Rutix\n\nMascota de SoyTEL: robot-antena con pantalla por cara y barras de señal en el pecho que muestran su ánimo (0–4). Expresiones: `neutral`, `happy`, `celebrate`, `love`, `think`, `alert`, `sleepy`, `sad`, `sleep`; poses: `idle`, `wave`, `celebrate`, `think`. En la app flota, parpadea y su antena pulsa (componente `Rutix`). Úsalo como guía y reacción emocional, nunca como decoración repetida en una misma pantalla.\n',
  Ilustraciones: '# Ilustraciones\n\nIlustraciones planas en el estilo de «Ilustraciones rápidas» de la marca, generadas desde una paleta: versión clara (fondo `highlight`) para pantallas claras y `-oscuro` para pantallas azules. `connect`, `burst`, `campus`, `globe`, `trophy`, `inbox` (estado vacío de avisos), `quiz`, `route`, `offline` (error), `career`. `mapa-campus.svg` es el mapa del modo historia.\n',
  Ruta: '# Ruta Telemática\n\nGráficos del modo en vivo (stand → B215 → B213 → pasillo). `templo-*`: el Templo de Telemática de Didactic-Tel; cada columna toma el color de su pilar cuando el participante completa el juego del proyecto (Datos, Software, Redes, Telecomunicaciones, Hardware) y con los cinco se enciende el frontón. `avatar-*`: los 8 avatares que elige cada participante (círculo de color con anillo crema e ícono en tinta primaria). `respuesta-*`: color y forma de las cuatro alternativas de la trivia final, estilo Kahoot (triángulo, rombo, círculo, cuadrado), para que se distingan también sin color.\n',
  Patrones: '# Patrones\n\nFondos decorativos de las pantallas oscuras (`BrandBackdrop`): `estrellas` (por defecto), `red` (nodos conectados), `senal` (ondas desde una esquina) y `orbitas` (anillos crema como la bienvenida). Siempre detrás del contenido, sin competir con el texto; una capa de estrellas titila si el movimiento está activado.\n',
};
Object.entries(groupReadmes).forEach(([group, text]) => write(path.join(project, 'assets', group, 'README.md'), text));
write(path.join(outDir, 'uploads.json'), JSON.stringify(assetFiles, null, 2));

// ---------- CSS compartido de las vistas previas ----------
const bundleCss = `/* Estilos de las vistas previas: recrean los componentes React Native de SoyTEL con los tokens. */
body{font-family:var(--font-body);color:var(--ink)}
.tel-stage{display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:16px;background:var(--paper);font-family:var(--font-body);color:var(--ink)}
.tel-stage.dark{background:linear-gradient(180deg,var(--primary),var(--primarySoft))}
.tel-col{display:flex;flex-direction:column;gap:12px}
.tel-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.tel-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:52px;padding:0 24px;border-radius:var(--radius-md);font-family:var(--font-display);font-weight:700;font-size:16px;border:0}
.tel-btn svg{width:20px;height:20px}
.tel-btn.sm{min-height:40px;padding:0 16px;border-radius:var(--radius-sm);font-size:14px;font-family:var(--font-body)}
.tel-btn.primary{background:var(--primary);color:var(--cream)}
.tel-btn.accent{background:var(--accent);color:var(--primary)}
.tel-btn.cream{background:var(--cream);color:var(--primary)}
.tel-btn.secondary{background:var(--accentSoft);color:var(--primary)}
.tel-btn.subtle{background:var(--surfaceAlt);color:var(--secondary)}
.tel-btn.outline{background:transparent;color:var(--primary);border:1.5px solid var(--primary)}
.tel-btn.outlineLight{background:rgba(11,45,69,.55);color:var(--cream);border:1.5px solid rgba(167,212,237,.55)}
.tel-btn.danger{background:var(--danger);color:var(--white)}
.tel-btn.dangerOutline{background:transparent;color:var(--danger);border:1.5px solid var(--danger)}
.tel-btn.disabled{background:var(--border);color:var(--muted)}
.tel-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px;display:flex;flex-direction:column;gap:12px}
.tel-card.navy{background:var(--primary);border:0;color:var(--cream)}
.tel-card.dark{background:var(--primarySoft);border:0;color:var(--cream)}
.tel-card.cream{background:var(--cream);border:0}
.tel-card.accent{background:var(--highlight);border:0}
.tel-card.elevated{box-shadow:var(--shadow-card)}
.tel-overline{font-family:var(--font-display);font-weight:700;font-size:12px;line-height:16px;letter-spacing:2.4px;text-transform:uppercase;color:var(--accent)}
.tel-title{font-family:var(--font-display);font-weight:800;font-size:26px;line-height:32px;color:var(--cream);margin:0}
.tel-subtitle{font-family:var(--font-display);font-weight:700;font-size:17px;line-height:23px;margin:0}
.tel-caption{font-size:13px;line-height:18px;font-weight:600;color:var(--muted);margin:0}
.tel-small{font-size:12px;line-height:16px;font-weight:800}
.tel-header{background:var(--primary);padding:18px 20px 22px;display:flex;flex-direction:column;gap:6px;position:relative;overflow:hidden}
.tel-header.rounded{border-radius:0 0 var(--radius-xxl) var(--radius-xxl)}
.tel-iconbtn{width:44px;height:44px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;position:relative}
.tel-iconbtn.dark{background:var(--primarySoft);color:var(--cream)}
.tel-iconbtn.light{background:var(--surfaceAlt);color:var(--primary)}
.tel-iconbtn .badge{position:absolute;top:5px;right:5px;min-width:17px;height:17px;border-radius:999px;background:var(--cream);color:var(--primary);font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 4px}
.tel-chip{height:36px;padding:0 14px;border-radius:18px;display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;border:1.5px solid var(--border);background:var(--surface);color:var(--secondary)}
.tel-chip.active{background:var(--primary);border-color:var(--primary);color:var(--cream)}
.tel-chip.dark{background:transparent;border-color:var(--secondary);color:var(--onDark)}
.tel-chip.dark.active{background:var(--cream);border-color:var(--cream);color:var(--primary)}
.tel-tag{height:24px;padding:0 10px;border-radius:999px;display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;letter-spacing:.4px}
.tel-tag.navy{background:var(--primary);color:var(--cream)}.tel-tag.cream{background:var(--cream);color:var(--primary)}
.tel-tag.success{background:var(--successSoft);color:var(--successInk)}.tel-tag.neutral{background:var(--surfaceAlt);color:var(--muted)}
.tel-tag.sky{background:var(--highlight);color:var(--secondary)}.tel-tag.warning{background:var(--warningSoft);color:var(--warningInk)}
.tel-tag.glass{background:rgba(167,212,237,.16);color:var(--accentSoft)}
.tel-tag .live{width:7px;height:7px;border-radius:4px;background:var(--accent)}
.tel-option{display:flex;align-items:center;gap:14px;min-height:58px;padding:10px 14px;border-radius:var(--radius-md);border:1.5px solid var(--border);background:var(--surface);font-weight:700;font-size:16px;color:var(--primary)}
.tel-option .letter{width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:800;font-size:14px;background:var(--surfaceAlt);color:var(--secondary)}
.tel-option.selected{border:2px solid var(--secondary);background:var(--surfaceAlt)}.tel-option.selected .letter{background:var(--secondary);color:#fff}
.tel-option.correct{border:2px solid var(--success);background:#F1F9F5}.tel-option.correct .letter{background:var(--success);color:#fff}
.tel-option.wrong{border:2px solid var(--danger);background:#FDF3F3}.tel-option.wrong .letter{background:var(--danger);color:#fff}
.tel-panel{border-radius:18px;border:1px solid #B7DCC8;background:var(--successSoft);padding:16px;display:flex;flex-direction:column;gap:10px}
.tel-panel.error{border-color:#EFC4C4;background:var(--dangerSoft)}
.tel-panel .head{display:flex;align-items:center;gap:10px;font-family:var(--font-display);font-weight:700;font-size:17px;color:var(--successInk)}
.tel-panel.error .head{color:var(--dangerInk)}
.tel-panel .dot{width:32px;height:32px;border-radius:16px;display:flex;align-items:center;justify-content:center;background:var(--success);color:#fff}
.tel-panel.error .dot{background:var(--danger)}
.tel-bar{height:8px;border-radius:999px;background:var(--surfaceAlt);overflow:hidden}.tel-bar>span{display:block;height:100%;border-radius:999px;background:var(--secondary)}
.tel-seg{display:flex;gap:6px}.tel-seg>span{flex:1;height:8px;border-radius:999px;background:var(--secondary)}.tel-seg>span.done{background:var(--accent)}.tel-seg>span.now{background:var(--cream)}
.tel-skel{background:#E4EDF5;border-radius:8px;position:relative;overflow:hidden}
.tel-skel::after{content:"";position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent);animation:tel-shimmer 1.25s ease-in-out infinite}
.tel-skel.dark{background:rgba(167,212,237,.12)}.tel-skel.dark::after{background:linear-gradient(90deg,transparent,rgba(167,212,237,.22),transparent)}
@keyframes tel-shimmer{to{transform:translateX(100%)}}
@keyframes tel-spin{to{transform:rotate(360deg)}}
@keyframes tel-wave{0%,100%{opacity:.2}30%{opacity:1}}
@keyframes tel-bounce{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-6px);opacity:1}}
@keyframes tel-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes tel-pulse{0%{transform:scale(.55);opacity:0}15%{opacity:.55}100%{transform:scale(1);opacity:0}}
@media (prefers-reduced-motion: reduce){.tel-skel::after,.tel-anim,.tel-anim *{animation:none!important}}
.tel-tabbar{display:flex;background:var(--surface);border-top:1px solid var(--border);padding:8px 6px 14px;width:390px}
.tel-tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:700;color:var(--muted)}
.tel-tab .pill{width:54px;height:30px;border-radius:15px;display:flex;align-items:center;justify-content:center;position:relative}
.tel-tab.active{color:var(--primary);font-weight:800}.tel-tab.active .pill{background:var(--highlight)}
.tel-tab .unread{position:absolute;top:1px;right:10px;width:10px;height:10px;border-radius:5px;background:var(--danger);border:2px solid var(--surface)}
.tel-toast{display:flex;align-items:center;gap:12px;padding:12px;border-radius:var(--radius-lg);background:var(--primary);border:1px solid rgba(167,212,237,.25);box-shadow:var(--shadow-lifted);width:358px}
.tel-row-item{display:flex;align-items:center;gap:14px;padding:14px;border-radius:18px;background:var(--surface);border:1px solid var(--border)}
.tel-row-item .ico{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:var(--highlight);color:var(--secondary)}
.tel-stat{flex:1;min-width:76px;border-radius:var(--radius-md);padding:12px;display:flex;flex-direction:column;gap:4px;background:var(--surface);border:1px solid var(--border)}
.tel-stat .ico{width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:var(--highlight);color:var(--secondary)}
.tel-num{font-family:var(--font-display);font-weight:800;font-size:19px;line-height:25px}
`;
write(path.join(project, 'components', 'bundle.css'), bundleCss);

// ---------- vistas previas ----------
const svgIcon = (name, size = 20, color = 'currentColor', strokeWidth = 2) =>
  iconToSvg(icons[name], { size, color, strokeWidth }).replace(`style="color:${color}"`, color === 'currentColor' ? '' : `style="color:${color}"`);
const medal = (options, size) => drawingToSvg(medallionDrawing(options), { width: size, height: options.ribbon ? Math.round((size * 146) / 120) : size });
const rutix = (options, size) => drawingToSvg(rutixDrawing(options), { width: size });
const illustration = (name, width, tone = 'light') => drawingToSvg(illustrationDrawing(name, tone), { width, height: Math.round((width * 200) / 240) });

function preview(name, { group, height, subtitle }, body, extraStyle = '') {
  const marker = `<!-- @dsCard group="${group}" height=${height}${subtitle ? ` subtitle="${subtitle}"` : ''} -->`;
  const html = `${marker}
<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>${name} — vista previa</title>${extraStyle ? `<style>${extraStyle}</style>` : ''}</head>
<body style="margin:0">
${body}
</body>
</html>
`;
  write(path.join(project, 'components', name, 'preview.html'), html);
}
function readme(name, text) {
  write(path.join(project, 'components', name, 'README.md'), `# ${name}\n\n${text.trim()}\n`);
}

// Button
preview('Button', { group: 'Acciones', height: 300, subtitle: 'Variantes, tamaños, íconos y estados' }, `<div class="tel-stage tel-col" style="align-items:flex-start">
<div class="tel-row"><span class="tel-btn primary">Continuar ${svgIcon('arrowRight')}</span><span class="tel-btn accent">Siguiente ${svgIcon('arrowRight')}</span><span class="tel-btn secondary">Guardar</span><span class="tel-btn subtle">${svgIcon('target')} Practicar redes</span></div>
<div class="tel-row"><span class="tel-btn outline">${svgIcon('refresh')} Intentar de nuevo</span><span class="tel-btn dangerOutline">${svgIcon('trash')} Borrar datos locales</span><span class="tel-btn disabled">Responder</span><span class="tel-btn sm secondary">Guardar</span></div>
</div>
<div class="tel-stage dark tel-row"><span class="tel-btn cream">Comenzar ${svgIcon('arrowRight')}</span><span class="tel-btn outlineLight">${svgIcon('qr')} Unirme con un código</span></div>`);
readme('Button', `
Botón de acción con texto en Montserrat 700. Úsalo para la acción principal de cada pantalla; una sola acción principal por vista.

- \`primary\` (azul noche, texto \`cream\`): acción principal en pantallas claras («Continuar», «Responder»).
- \`cream\`: acción principal sobre fondos \`primary\` («Comenzar», «¡Empezar!»).
- \`accent\`: avanzar en secuencias (onboarding «Siguiente»).
- \`secondary\` / \`subtle\`: acciones de apoyo dentro de tarjetas.
- \`outline\` / \`outlineLight\`: alternativas y reintentos; \`outlineLight\` sobre fondos oscuros.
- \`dangerOutline\`: acciones destructivas, siempre con ícono y confirmación.
- Estado deshabilitado: fondo \`border\`, texto \`muted\`. Cargando: tres puntos animados (\`DotsLoader\`), nunca un spinner del sistema.

Props (\`TelButton\`): \`label\`, \`variant\`, \`size\` (\`sm\` 40, \`md\` 52, \`lg\` 56 px de alto), \`icon\`, \`iconRight\`, \`loading\`, \`fullWidth\`, \`haptic\`. Encoge a 96% al presionar y vibra levemente.
`);

// IconButton
preview('IconButton', { group: 'Acciones', height: 96 }, `<div class="tel-stage dark tel-row"><span class="tel-iconbtn dark">${svgIcon('chevronLeft', 22)}</span><span class="tel-iconbtn dark">${svgIcon('bell', 22)}<span class="badge">3</span></span><span class="tel-iconbtn dark">${svgIcon('share', 22)}</span></div>`);
readme('IconButton', `
Botón cuadrado redondeado de 44×44 con un ícono (volver, avisos, compartir, perfil). \`tone\`: \`dark\` (sobre cabeceras), \`light\`, \`glass\`, \`cream\`. \`badge\` muestra un contador crema (máximo «9+») y se anuncia en el nombre accesible. Requiere \`accessibilityLabel\`.
`);

// Card
preview('Card', { group: 'Contenedores', height: 250 }, `<div class="tel-stage tel-row" style="align-items:stretch">
<div class="tel-card elevated" style="width:250px"><span class="tel-small" style="color:var(--secondary);letter-spacing:1.4px">SIGUIENTE CAPÍTULO</span><p class="tel-subtitle">3 · El intruso en la red</p><p class="tel-caption">Sala de servidores · La señal perdida</p><div class="tel-bar"><span style="width:40%"></span></div></div>
<div class="tel-card navy" style="width:220px"><span class="tel-tag glass">${svgIcon('lightbulb', 13)} DATO DEL DÍA</span><p class="tel-subtitle" style="color:var(--cream)">DNS traduce nombres como usm.cl a direcciones IP.</p></div>
<div class="tel-card cream" style="width:200px"><span class="tel-small">ACTIVIDAD EN GRUPO</span><p style="margin:0">Preséntense: cada integrante dice qué app usa más.</p></div>
</div>`);
readme('Card', `
Contenedor de radio \`radius-lg\` (20) y relleno 18. Tonos: \`surface\` (blanco con borde \`border\`, por defecto), \`navy\`, \`dark\`, \`cream\`, \`accent\`, \`success\`, \`danger\`. \`elevated\` agrega \`shadow-card\` (tarjeta flotante de misión). Con \`onPress\` se vuelve presionable (encoge a 98%). No anides tarjetas con borde dentro de otras con borde.
`);

// AppHeader
preview('AppHeader', { group: 'Navegación', height: 220 }, `<div style="width:390px">
<div class="tel-header rounded"><div class="tel-row" style="justify-content:space-between"><span class="tel-iconbtn dark">${svgIcon('chevronLeft', 22)}</span></div>
<span class="tel-overline">Sistema de logros</span><h2 class="tel-title">Mis logros</h2><span style="color:var(--accentSoft);font-weight:700;font-size:14px">Cada logro te acerca a un mejor futuro.</span></div></div>`);
readme('AppHeader', `
Cabecera azul noche de las pantallas (kicker en \`overline\` celeste, título \`title\` crema, subtítulo \`accentSoft\`). Ocupa el área segura superior. Opciones: \`onBack\` (botón volver), \`right\` (acción), \`art\` (medalla o imagen a la derecha), \`rounded\` (borde inferior \`radius-xxl\`, en Inicio), \`overlap\` (espacio para una tarjeta flotante que se monta encima), \`transparent\` (sobre pantallas oscuras con fondo de estrellas). Sin acciones, muestra el ornamento de la marca (arco punteado y estrella) arriba a la derecha.
`);

// TabBar
const tabs = [['home', 'Inicio', true], ['gamepad', 'Jugar'], ['school', 'Carrera'], ['trophy', 'Logros'], ['bell', 'Avisos', false, true]];
preview('TabBar', { group: 'Navegación', height: 90 }, `<div class="tel-tabbar">${tabs.map(([icon, label, active, unread]) => `<div class="tel-tab${active ? ' active' : ''}"><span class="pill">${svgIcon(icon, 22)}${unread ? '<span class="unread"></span>' : ''}</span>${label}</div>`).join('')}</div>`);
readme('TabBar', `
Barra inferior de cinco pestañas: Inicio, Jugar, Carrera, Logros y Avisos. La pestaña activa pone el ícono en una píldora \`highlight\` y el texto en \`primary\` 800; las demás en \`muted\`. Avisos muestra un punto \`danger\` con borde blanco cuando hay no leídos. Juegos, historia, recorrido, Rutix y perfil abren encima como pantallas completas.
`);

// Chip & Tag
preview('Chip', { group: 'Selección', height: 150 }, `<div class="tel-stage tel-row"><span class="tel-chip active">Todos · 14</span><span class="tel-chip">Obtenidos · 4</span><span class="tel-chip">En progreso · 8</span></div>
<div class="tel-stage dark tel-row"><span class="tel-chip dark active">Todas</span><span class="tel-chip dark">Logros</span><span class="tel-chip dark">Rutix</span></div>`);
readme('Chip', `
Filtro en fila desplazable (\`ChipGroup\`). Una opción activa a la vez; puede mostrar conteo («Obtenidos · 4»). \`tone\`: \`light\` (activo \`primary\`) o \`dark\` sobre cabeceras (activo \`cream\`). Se anuncian como pestañas.
`);
preview('Tag', { group: 'Selección', height: 110 }, `<div class="tel-stage tel-row"><span class="tel-tag navy"><span class="live"></span>EN VIVO</span><span class="tel-tag cream">¿SABÍAS QUE?</span><span class="tel-tag success">Completada</span><span class="tel-tag neutral">Pendiente</span><span class="tel-tag sky">${svgIcon('clock', 13)} 8–12 min</span><span class="tel-tag warning">${svgIcon('heart', 13)} 1 min al día</span></div>
<div class="tel-stage dark tel-row"><span class="tel-tag glass">${svgIcon('star', 13)} Nivel 4 · Técnico en práctica</span><span class="tel-tag glass">${svgIcon('flame', 13)} Racha 3 días</span></div>`);
readme('Tag', `
Etiqueta de estado o metadato (24 px, texto 11 en 800). Tonos: \`navy\`, \`cream\`, \`success\`, \`neutral\`, \`sky\`, \`warning\`, \`danger\`, \`glass\` (sobre fondos azules). \`live\` agrega un punto celeste. El tono siempre significa algo: \`success\` completado, \`neutral\` pendiente, \`navy\` actual.
`);

// OptionButton + FeedbackPanel
preview('OptionButton', { group: 'Quiz', height: 330 }, `<div class="tel-stage tel-col" style="width:360px;align-items:stretch">
<div class="tel-option"><span class="letter">A</span>123456</div>
<div class="tel-option selected"><span class="letter">B</span>Telematica2026</div>
<div class="tel-option correct"><span class="letter">${svgIcon('check', 16, '#fff', 3)}</span>maleta-nube-4-faro</div>
<div class="tel-option wrong"><span class="letter">${svgIcon('close', 16, '#fff', 3)}</span>qwerty</div></div>`);
readme('OptionButton', `
Alternativa A/B/C/D de quiz, como en «Reto de estación». Estados: \`idle\`, \`selected\` (borde \`secondary\`), \`correct\` (verde con ✓), \`wrong\` (rojo con ✕), \`dimmed\` (resto tras responder) y \`hidden\` (tachada por el comodín 50:50). \`tone="dark"\` para el concurso y la historia. Siempre se confirma con un botón «Responder» antes de revelar.
`);
preview('FeedbackPanel', { group: 'Quiz', height: 280 }, `<div class="tel-stage tel-col" style="width:360px;align-items:stretch">
<div class="tel-panel"><div class="head"><span class="dot">${svgIcon('check', 18, '#fff', 3)}</span>¡Correcto! +50 pts</div><span style="font-size:14px;line-height:21px;color:#1F4535">Una frase larga con palabras al azar tiene muchas más combinaciones posibles.</span></div>
<div class="tel-panel error"><div class="head"><span class="dot">${svgIcon('close', 18, '#fff', 3)}</span>Casi… inténtalo otra vez</div><span style="font-size:14px;line-height:21px;color:#5C2626">Pista: largo y al azar le gana a corto y predecible.</span></div></div>`);
readme('FeedbackPanel', `
Tarjeta de retroalimentación tras responder: \`success\`, \`error\` o \`info\`, con ícono en círculo, título en Montserrat y una explicación de una o dos frases. Es la microlección: toda respuesta la muestra. Se anuncia a lectores de pantalla y la vista se desplaza hasta ella.
`);

// Medallion
preview('Medallion', { group: 'Gráficos', height: 150, subtitle: 'Crema, rarezas, progreso y bloqueo' }, `<div class="tel-stage tel-row">${medal({ glyph: 'cap' }, 84)}${medal({ glyph: 'shield', tier: 'bronce' }, 84)}${medal({ glyph: 'bolt', tier: 'plata' }, 84)}${medal({ glyph: 'trophy', tier: 'oro' }, 84)}${medal({ glyph: 'heart', tier: 'platino' }, 84)}${medal({ glyph: 'rocket', tier: 'oro', state: 'progress', progress: 0.6 }, 84)}${medal({ glyph: 'crown', tier: 'platino', state: 'locked' }, 84)}${medal({ glyph: 'flame', tier: 'plata', ribbon: true }, 84)}</div>`);
readme('Medallion', `
Medalla SVG de la marca para logros, áreas, estaciones y accesos. Props: \`glyph\` (35 glifos: \`cap\`, \`shield\`, \`network\`, \`antenna\`, \`code\`, \`chip\`, \`bulb\`, \`trophy\`, \`robot\`…), \`tier\` (\`crema\` por defecto, \`bronce\`, \`plata\`, \`oro\`, \`platino\`; la rareza también suma estrellas abajo), \`state\` (\`unlocked\`, \`progress\` con arco celeste parcial según \`progress\`, \`locked\` gris con candado), \`size\` y \`ribbon\` (cintas, solo en detalle y celebraciones). No uses medallas bloqueadas como decoración.
`);

// Rutix
const rutixRow = [['neutral', 'idle', 3], ['happy', 'wave', 4], ['celebrate', 'celebrate', 4], ['think', 'think', 3], ['alert', 'idle', 3], ['sad', 'idle', 1]];
preview('Rutix', { group: 'Gráficos', height: 190, subtitle: 'Expresiones y poses' }, `<div class="tel-stage dark tel-row tel-anim">${rutixRow.map(([expression, pose, signal]) => `<div style="animation:tel-float 3s ease-in-out infinite">${rutix({ expression, pose, signal }, 130)}</div>`).join('')}</div>`);
readme('Rutix', `
Mascota animada (flota, parpadea, la antena pulsa). Props: \`expression\` (\`neutral\`, \`happy\`, \`celebrate\`, \`love\`, \`think\`, \`alert\`, \`sleepy\`, \`sad\`, \`sleep\`), \`pose\` (\`idle\`, \`wave\`, \`celebrate\`, \`think\`), \`signal\` (0–4 barras en el pecho = ánimo), \`size\`, \`reactKey\` (al cambiar, rebota). La expresión sale del ánimo con \`expressionForMood\`: ≥85 \`happy\`, ≥60 \`neutral\`, ≥35 \`sleepy\`, menos \`sad\`. Habla en primera persona, en frases cortas y cálidas, dentro de una burbuja crema. Máximo un Rutix por pantalla.
`);

// Icon
const iconSample = ['home', 'gamepad', 'school', 'trophy', 'bell', 'wifi', 'network', 'router', 'server', 'antenna', 'shieldCheck', 'lock', 'code', 'cpu', 'wave', 'fiber', 'packet', 'terminal', 'bolt', 'flame', 'heart', 'star', 'sparkle', 'robot', 'route', 'pin', 'qr', 'timer', 'target', 'globe'];
preview('Icon', { group: 'Gráficos', height: 150, subtitle: `${Object.keys(icons).length} íconos · grilla 24 · trazo 2` }, `<div class="tel-stage tel-row" style="color:var(--primary);gap:18px">${iconSample.map((name) => `<span title="${name}">${svgIcon(name, 26)}</span>`).join('')}</div>`);
readme('Icon', `
\`TelIcon\`: ${Object.keys(icons).length} íconos propios en grilla 24×24 con trazo 2 y extremos redondeados, dibujados con \`currentColor\`. Props: \`name\`, \`size\`, \`color\`, \`strokeWidth\`, \`accessibilityLabel\` (solo cuando el ícono va solo, sin texto). Usa íconos de la familia de red (\`router\`, \`server\`, \`antenna\`, \`fiber\`, \`packet\`) para contenido técnico y los de interfaz (\`home\`, \`bell\`, \`chevronLeft\`) para navegación.
`);

// Illustration
preview('Illustration', { group: 'Gráficos', height: 210 }, `<div class="tel-stage tel-row">${['connect', 'burst', 'campus', 'trophy', 'inbox'].map((name) => illustration(name, 170)).join('')}</div>`);
readme('Illustration', `
Ilustraciones planas de 240×200 generadas desde una paleta: \`tone="light"\` sobre \`paper\` y \`tone="dark"\` sobre \`primary\`. Uso: onboarding (\`burst\`), estados vacíos (\`inbox\`, \`trophy\`), error (\`offline\`), tarjetas de modos (\`quiz\`, \`campus\`, \`route\`) y carrera (\`career\`). Una ilustración por pantalla, acompañada de título y una frase.
`);

// Backdrop
preview('BrandBackdrop', { group: 'Gráficos', height: 170 }, `<div class="tel-stage tel-row" style="background:var(--paper)">${Object.values(patternPreviews()).map((drawing) => drawingToSvg(drawing, { width: 220, height: 147 })).join('')}</div>`);
readme('BrandBackdrop', `
Fondo decorativo de las pantallas oscuras: \`stars\` (por defecto), \`network\`, \`signal\`, \`orbits\` o \`none\` (durante los microjuegos, para no distraer). Se dibuja a pantalla completa detrás del contenido y una capa de estrellas titila si hay movimiento. Mantén el texto sobre zonas tranquilas.
`);

// Loaders
preview('Loaders', { group: 'Carga', height: 120, subtitle: 'SignalSpinner · OrbitSpinner · DotsLoader' }, `<div class="tel-stage dark tel-row tel-anim" style="gap:40px">
<svg width="56" height="56" viewBox="0 0 48 48"><circle cx="24" cy="34" r="3.6" fill="var(--accent)"/><path d="M19.05 29.05 A7 7 0 0 1 28.95 29.05" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" fill="none" style="animation:tel-wave 1.3s linear infinite"/><path d="M14.1 24.1 A14 14 0 0 1 33.9 24.1" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" fill="none" style="animation:tel-wave 1.3s linear .23s infinite"/><path d="M9.15 19.15 A21 21 0 0 1 38.85 19.15" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" fill="none" style="animation:tel-wave 1.3s linear .46s infinite"/></svg>
<svg width="56" height="56" viewBox="0 0 56 56"><circle cx="28" cy="28" r="20" stroke="var(--accent)" stroke-opacity=".25" stroke-width="3" fill="none"/><g style="transform-origin:28px 28px;animation:tel-spin 1.5s linear infinite"><path d="M28 8 A20 20 0 0 1 47.7 31.5" stroke="var(--accent)" stroke-width="3.5" stroke-linecap="round" fill="none"/><circle cx="48" cy="28" r="4.5" fill="var(--accent)"/><circle cx="18" cy="45.3" r="3.2" fill="var(--cream)"/></g></svg>
<div style="display:flex;gap:6px">${[0, 1, 2].map((index) => `<span style="width:8px;height:8px;border-radius:8px;background:var(--cream);animation:tel-bounce .9s ${index * 0.14}s infinite"></span>`).join('')}</div></div>`);
readme('Loaders', `
Indicadores de carga de la marca. \`SignalSpinner\`: ondas Wi-Fi que se encienden en secuencia (cargas de más de 1 s). \`OrbitSpinner\`: nodos que orbitan un anillo (pantalla de bienvenida, «Conectando…»). \`DotsLoader\`: tres puntos que rebotan, dentro de botones con \`loading\`. Todos se anuncian como barra de progreso y se detienen con movimiento reducido. Para listas y tarjetas usa \`Skeleton\`, no un spinner.
`);

// Skeleton
preview('Skeleton', { group: 'Carga', height: 200 }, `<div class="tel-stage tel-row" style="align-items:flex-start">
<div class="tel-card" style="width:240px"><div class="tel-row"><div class="tel-skel" style="width:52px;height:52px;border-radius:26px"></div><div class="tel-col" style="flex:1;gap:8px"><div class="tel-skel" style="height:14px;width:55%"></div><div class="tel-skel" style="height:12px;width:80%"></div></div></div><div class="tel-skel" style="height:10px;border-radius:999px"></div></div>
<div style="background:var(--primary);padding:16px;border-radius:20px;width:200px" class="tel-col"><div class="tel-skel dark" style="height:26px;width:70%"></div><div class="tel-skel dark" style="height:20px;width:55%"></div></div></div>`);
readme('Skeleton', `
Bloques de carga con brillo que recorre la forma (\`Skeleton\`, \`SkeletonText\`, \`SkeletonCircle\`, \`SkeletonCard\`, \`SkeletonGrid\`). Reproducen la forma final del contenido (misma altura, mismo radio) mientras se leen los datos locales. \`tone="dark"\` sobre cabeceras. Se ocultan a lectores de pantalla.
`);

// Progress
preview('Progress', { group: 'Carga', height: 150 }, `<div class="tel-stage tel-row" style="gap:28px"><div class="tel-col" style="width:220px"><div class="tel-bar"><span style="width:62%"></span></div><div class="tel-seg" style="background:var(--primary);padding:10px;border-radius:12px"><span class="done"></span><span class="done"></span><span class="now"></span><span></span><span></span></div></div>
<svg width="72" height="72"><circle cx="36" cy="36" r="31.5" stroke="var(--secondary)" stroke-width="7" fill="none"/><circle cx="36" cy="36" r="31.5" stroke="var(--primary)" stroke-width="7" fill="none" stroke-linecap="round" stroke-dasharray="${(2 * Math.PI * 31.5 * 0.36).toFixed(1)} 400" transform="rotate(-90 36 36)"/><text x="36" y="41" text-anchor="middle" font-family="Montserrat, sans-serif" font-weight="800" font-size="15" fill="var(--primary)">5/14</text></svg></div>`);
readme('Progress', `
\`ProgressBar\` (XP al siguiente nivel, logros en curso), \`SegmentedProgress\` (estaciones de la ruta y preguntas de práctica: completadas \`accent\`, actual \`cream\`, pendientes \`secondary\`) y \`ProgressRing\` (logros obtenidos, ánimo de Rutix, nivel del perfil) con contenido centrado. Animan hacia su valor en \`duration-slower\`.
`);

// Toast
preview('Toast', { group: 'Retroalimentación', height: 120 }, `<div class="tel-stage" style="background:var(--paper)"><div class="tel-toast">${medal({ glyph: 'rocket', tier: 'oro' }, 52)}<div class="tel-col" style="gap:2px"><span class="tel-small" style="color:var(--accent);letter-spacing:1.2px;font-size:11px">LOGRO ORO DESBLOQUEADO</span><span class="tel-subtitle" style="color:var(--cream)">Enlace ascendente</span><span class="tel-caption" style="color:var(--accentSoft)">Alcanza el nivel 5 de experiencia.</span></div></div></div>`);
readme('Toast', `
Aviso flotante desde arriba al desbloquear un logro o subir de nivel (\`ToastHost\`, escucha los eventos de la app). Muestra la medalla, el kicker con la rareza, el título y la descripción; dura 3,6 s, se cierra al tocar y se anuncia como alerta. Cada aviso también queda en la pestaña Avisos.
`);

// Celebration
const confetti = Array.from({ length: 22 }, (_, index) => {
  const angle = (index / 22) * Math.PI * 2;
  const distance = 50 + (index % 4) * 18;
  const x = 180 + Math.cos(angle) * distance;
  const y = 90 + Math.sin(angle) * distance * 0.7;
  const palette = [colors.cream, colors.accent, colors.accentSoft, '#F2CE63'];
  return index % 3 === 0
    ? `<path d="${require(path.join(root, 'src', 'graphics', 'shapes')).star4Path(x, y, 7)}" fill="${palette[index % 4]}"/>`
    : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${3 + (index % 3)}" fill="${palette[index % 4]}"/>`;
}).join('');
preview('Celebration', { group: 'Retroalimentación', height: 200 }, `<div class="tel-stage dark"><svg width="360" height="180" viewBox="0 0 360 180">${confetti}</svg></div>`);
readme('Celebration', `
Explosión de confeti con estrellas de cuatro puntas y puntos en colores de marca (\`Celebration\`, \`burstKey\` la dispara). Úsala al completar un capítulo, ganar la ráfaga con más de la mitad de aciertos, terminar la ruta o desbloquear un logro desde Rutix. No bloquea toques y se omite con movimiento reducido.
`);

// EmptyState + ListRow + StatTile
preview('EmptyState', { group: 'Contenedores', height: 390 }, `<div class="tel-stage tel-col" style="width:360px;text-align:center">${illustration('inbox', 180)}<p class="tel-subtitle">Nada por aquí todavía</p><p class="tel-caption" style="font-size:16px;font-weight:400;line-height:24px">Te avisaremos cuando ganes medallas, subas de nivel o Rutix te necesite.</p><span class="tel-btn primary">Ir a jugar</span></div>`);
readme('EmptyState', `
Estado vacío: ilustración, título corto, una frase que explica qué aparecerá aquí y cómo lograrlo, y una acción opcional. Nunca una pantalla en blanco.
`);
preview('ListRow', { group: 'Contenedores', height: 250 }, `<div class="tel-stage tel-col" style="width:360px;align-items:stretch"><div class="tel-row-item"><span class="ico">${svgIcon('bolt', 20)}</span><div class="tel-col" style="gap:2px;flex:1"><span class="tel-small" style="color:var(--secondary);font-size:11px;letter-spacing:.8px">HACE 30 MIN</span><span class="tel-subtitle" style="font-size:15px">Ráfaga TEL</span><span class="tel-caption">1.180 pts · 83% de precisión</span></div></div><div class="tel-row" style="gap:8px">${[['sparkle', '820', 'XP total'], ['flame', '3', 'Racha'], ['gamepad', '6', 'Partidas'], ['trophy', '4/14', 'Logros']].map(([icon, value, label]) => `<div class="tel-stat"><span class="ico">${svgIcon(icon, 18)}</span><span class="tel-num">${value}</span><span class="tel-small" style="color:var(--muted)">${label}</span></div>`).join('')}</div></div>`);
readme('ListRow', `
Fila de lista con ícono en cuadro \`highlight\` (historial, enlaces, avisos) y \`StatTile\` para cifras del perfil. Metadato en mayúsculas \`secondary\`, título \`subtitle\` a 15 px y descripción \`caption\`. Con \`onPress\` agrega un chevron.
`);

// ---------- Ruta Telemática ----------
const qrPath = (() => {
  const qr = createQr('https://soytel.vercel.app/ruta?codigo=LYJ667', { errorCorrectionLevel: 'M' });
  let d = '';
  for (let row = 0; row < qr.modules.size; row += 1) {
    for (let column = 0; column < qr.modules.size; column += 1) if (qr.modules.get(row, column)) d += `M${column + 2} ${row + 2}h1v1h-1z`;
  }
  return { d, size: qr.modules.size + 4 };
})();
const avatarCircle = (index, size) => avatarSvg(index, size);
const routeCss = `.rt-panel{background:var(--primary);border-radius:var(--radius-lg);padding:18px;display:flex;flex-direction:column;gap:10px;align-items:center;width:300px;color:var(--cream)}
.rt-code{font-family:var(--font-display);font-weight:800;font-size:52px;letter-spacing:6px;line-height:58px;color:var(--cream)}
.rt-qr{background:#fff;padding:10px;border-radius:18px}
.rt-steps{display:flex;width:360px;padding:14px 8px;background:var(--primary);border-radius:18px}
.rt-step{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;position:relative;font-size:11px;font-weight:800;color:var(--slate)}
.rt-step .dot{width:32px;height:32px;border-radius:16px;background:var(--primarySoft);display:flex;align-items:center;justify-content:center;border:2px solid var(--primarySoft);z-index:1}
.rt-step.done .dot{background:var(--accent);border-color:var(--accent);color:var(--primary)}.rt-step.done{color:var(--accentSoft)}
.rt-step.now .dot{background:var(--cream);border-color:var(--accent);color:var(--primary)}.rt-step.now{color:var(--cream)}
.rt-step::before{content:"";position:absolute;top:15px;right:50%;width:100%;height:3px;background:var(--primarySoft)}.rt-step:first-child::before{display:none}
.rt-step.done::before,.rt-step.now::before{background:var(--accent)}
.rt-opt{display:flex;align-items:center;gap:12px;min-height:58px;padding:0 16px;border-radius:var(--radius-lg);color:#fff;font-weight:700;font-size:16px;width:320px}
.rt-bars{display:flex;flex-direction:column;gap:8px;width:320px}
.rt-bar{display:flex;align-items:center;gap:10px;padding:8px;border-radius:14px;background:var(--primarySoft);color:var(--cream);font-weight:700;font-size:14px}
.rt-bar .track{height:6px;border-radius:3px;background:var(--primary);flex:1;overflow:hidden}.rt-bar .track span{display:block;height:100%}
.rt-pod{display:flex;align-items:flex-end;gap:10px;width:340px}
.rt-pod .col{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;color:var(--cream);font-weight:700;font-size:13px}
.rt-pod .blk{align-self:stretch;border-radius:16px 16px 0 0;display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:800;font-size:26px;color:var(--primary)}
.rt-hud{display:flex;flex-direction:column;gap:8px;width:340px}
.rt-hud .row{display:flex;align-items:center;gap:10px}
.rt-pill{display:inline-flex;align-items:center;gap:4px;height:32px;padding:0 10px;border-radius:999px;background:var(--primarySoft);color:var(--cream);font-weight:700;font-size:14px}
.rt-banner{width:300px;border-radius:24px;border:1px solid rgba(167,212,237,.25);background:rgba(7,31,49,.94);padding:22px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}
.rt-chip{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:14px;background:var(--primarySoft);color:var(--cream);font-weight:700;font-size:14px;width:300px}`;
const stepIcon = (name) => svgIcon(name, 16);
preview('RouteProgress', { group: 'Ruta', height: 110, subtitle: 'Stand → B215 → B213 → pasillo' }, `<div class="tel-stage" style="background:var(--paper)"><div class="rt-steps"><div class="rt-step done"><span class="dot">${stepIcon('check')}</span>Stand</div><div class="rt-step now"><span class="dot">${stepIcon('router')}</span>Sala B215</div><div class="rt-step"><span class="dot">${stepIcon('temple')}</span>Sala B213</div><div class="rt-step"><span class="dot">${stepIcon('podium')}</span>Pasillo</div></div></div>`, routeCss);
readme('RouteProgress', `
Mapa lineal de la ruta en la cabecera de cada pantalla en vivo: ${routeStops.map((stop) => stop.place).join(' → ')}. Parada completada en \`accent\` con ✓, parada actual en \`cream\` con borde celeste, pendientes en \`primarySoft\`. Úsalo sobre fondos \`primary\`.
`);
preview('RouteCode', { group: 'Ruta', height: 450, subtitle: 'Código y QR del stand' }, `<div class="tel-stage dark"><div class="rt-panel"><div class="tel-row" style="justify-content:space-between;width:100%"><span class="tel-tag success">${svgIcon('wifi', 13)} En línea</span><span class="tel-tag glass">${svgIcon('users', 13)} 3</span></div><span class="tel-overline">Código de la ruta</span><span class="rt-code">LYJ667</span><span class="rt-qr"><svg width="190" height="190" viewBox="0 0 ${qrPath.size} ${qrPath.size}"><rect width="${qrPath.size}" height="${qrPath.size}" fill="#fff"/><path d="${qrPath.d}" fill="#0B2D45"/></svg></span><span style="color:var(--accentSoft);font-weight:700;font-size:14px">Escanea o entra a soytel.vercel.app/ruta</span></div></div>`, routeCss);
readme('RouteCode', `
Panel del modo stand: estado de la conexión (\`En línea\` / \`Conectando…\`), número de participantes, código de 6 caracteres en Montserrat 800 (sin 0, 1, I ni O) y QR con el enlace directo (incluye la huella de la llave del stand). Va en la pantalla grande del stand; en pantallas anchas ocupa la columna izquierda y el control de la ruta la derecha.
`);
preview('CheckinCard', { group: 'Ruta', height: 460, subtitle: 'Confirmar llegada a la sala' }, `<div class="tel-stage dark tel-col" style="align-items:center"><span style="width:88px;height:88px;border-radius:44px;background:var(--cream);display:flex;align-items:center;justify-content:center;color:var(--primary)">${svgIcon('router', 44)}</span><span class="tel-overline">Próxima parada · Sala B215</span><h2 class="tel-title" style="text-align:center">Vayan a la sala B215</h2><span class="tel-btn cream" style="width:300px">${svgIcon('door')} Estoy en la sala B215</span>${['Cami', 'Nico', 'Sofi'].map((name, index) => `<div class="rt-chip">${avatarCircle(index + 1, 36)}<span style="flex:1">${name}</span>${index < 2 ? svgIcon('checkCircle', 20, '#2E7D5B') : svgIcon('clock', 20, '#8CA3B4')}</div>`).join('')}</div>`, routeCss);
readme('CheckinCard', `
Paso de llegada a cada sala: ícono de la parada en círculo crema, instrucción («Vayan a la sala B215»), botón crema grande «Estoy en la sala…» y la lista del grupo con ✓ verde (llegó) o reloj (en camino). La fase avanza sola cuando todo el grupo conectado confirmó; el stand puede adelantarla.
`);
preview('Temple', { group: 'Ruta', height: 250, subtitle: 'Los cinco pilares de Didactic-Tel' }, `<div class="tel-stage dark tel-row" style="gap:24px">${[3, 5].map((litCount) => `<div class="tel-col" style="align-items:center;gap:6px">${drawingToSvg(templeDrawing(pillars.map((pillar, index) => ({ color: pillar.color, lit: index < litCount }))), { width: 300, height: 184 })}<div style="display:flex;width:300px">${pillars.map((pillar, index) => `<span style="flex:1;text-align:center;font-size:11px;font-weight:800;color:${index < litCount ? 'var(--cream)' : 'var(--slate)'}">${pillar.pillar === 'Telecomunicaciones' ? 'Teleco' : pillar.pillar}</span>`).join('')}</div></div>`).join('')}</div>`, routeCss);
readme('Temple', `
Templo de Telemática en la sala B213. Cada columna es un pilar y se enciende con su color al completar el juego de su proyecto: ${pillars.map((pillar) => `${pillar.pillar} (${pillar.color})`).join(', ')}. Con los cinco, el frontón se vuelve dorado y aparecen rayos: «¡Templo restaurado!». Siempre con las etiquetas debajo, para no depender solo del color.
`);
preview('PlayerAvatar', { group: 'Ruta', height: 110, subtitle: '8 avatares' }, `<div class="tel-stage tel-row" style="background:var(--paper)">${avatars.map((_, index) => avatarCircle(index, 52)).join('')}</div>`, routeCss);
readme('PlayerAvatar', `
Avatar del participante: círculo de color con anillo crema e ícono en \`primary\` (${avatars.map((item) => item.label).join(', ')}). Sin conexión se atenúa al 45% con un punto gris. Se elige al unirse y acompaña al alias en listas, ranking y podio.
`);
preview('QuizAnswer', { group: 'Ruta', height: 310, subtitle: 'Trivia en vivo, pregunta y resultado' }, `<div class="tel-stage dark tel-row" style="align-items:flex-start;gap:24px"><div class="tel-col">${answerStyles.map((style, index) => `<div class="rt-opt" style="background:${style.color}">${shapeSvg(index).replace('width="96" height="96"', 'width="26" height="26"')}${['Jitter', 'Firewall', 'Bluetooth', 'Píxel'][index]}</div>`).join('')}</div><div class="rt-bars">${answerStyles.map((style, index) => `<div class="rt-bar" style="opacity:${index === 0 ? 1 : 0.6}">${shapeSvg(index).replace('width="96" height="96"', 'width="24" height="24"')}<span style="width:90px">${['Jitter', 'Firewall', 'Bluetooth', 'Píxel'][index]}</span><span class="track"><span style="width:${[80, 30, 20, 0][index]}%;background:${style.color}"></span></span>${[4, 1, 1, 0][index]}</div>`).join('')}</div></div>`, routeCss);
readme('QuizAnswer', `
Alternativas de la trivia final, estilo Kahoot: cuatro botones grandes con color y forma (${answerStyles.map((style) => style.label.toLowerCase()).join(', ')}). Al responder, las demás se atenúan. En el resultado, barras con cuántos eligieron cada una, la correcta con ✓ y la explicación. Puntaje: 500 por acertar + hasta 300 por rapidez + 200/120/60 a los tres primeros en acertar.
`);
preview('Podium', { group: 'Ruta', height: 300, subtitle: 'Top 3 y felicitación final' }, `<div class="tel-stage dark"><div class="rt-pod">${[[1, 'Nico', '8.420', 92, tierColors.plata.ring[1]], [0, 'Cami', '9.130', 124, tierColors.oro.ring[1]], [2, 'Sofi', '7.610', 72, tierColors.bronce.ring[1]]].map(([place, name, points, height, color], index) => `<div class="col">${place === 0 ? svgIcon('crown', 28, tierColors.oro.ring[1]) : '<span style="height:28px"></span>'}${avatarCircle(index + 2, place === 0 ? 60 : 50)}<span>${name}</span><span style="color:var(--accentSoft);font-size:12px">${points} pts</span><span class="blk" style="height:${height}px;background:${color}">${place + 1}º</span></div>`).join('')}</div></div>`, routeCss);
readme('Podium', `
Podio del cierre (2º · 1º · 3º) con los colores de rareza plata, oro y bronce, corona sobre el primer lugar, avatar, alias y puntaje, más confeti. Debajo va el ranking completo con el participante destacado con borde celeste. En la pantalla del stand se muestra a mayor escala.
`);
preview('StationHud', { group: 'Juegos', height: 290, subtitle: 'Barra de juego y presentación de etapa' }, `<div class="tel-stage dark tel-row" style="align-items:flex-start;gap:28px"><div class="rt-hud"><div class="row"><div style="flex:1"><div class="tel-small" style="color:var(--accentSoft);letter-spacing:1.2px">ETAPA 2 DE 3</div><div class="tel-subtitle" style="color:var(--cream)">Enruta los paquetes</div></div><div style="text-align:center;color:var(--cream)"><div class="tel-num">358</div><div class="tel-small" style="color:var(--accentSoft)">pts</div></div><span class="rt-pill">${svgIcon('timer', 16)} 44s</span></div><div class="tel-bar" style="background:var(--primarySoft);height:5px"><span style="width:90%;background:var(--accent)"></span></div></div><div class="rt-banner"><span style="width:84px;height:84px;border-radius:42px;background:var(--accent);display:flex;align-items:center;justify-content:center;color:var(--primary)">${svgIcon('send', 40)}</span><span class="tel-overline">Etapa 2</span><span class="tel-title" style="font-size:24px">Enruta los paquetes</span><span style="color:var(--accentSoft);font-size:15px;line-height:22px">Ahora tú eres el router: envía cada paquete por la interfaz correcta.</span></div></div>`, routeCss);
readme('StationHud', `
Estructura común de los seis juegos de la ruta: \`StationHud\` (etapa, título, puntaje y reloj que se vuelve rojo en los últimos 5 s), \`StageBanner\` (presenta cada etapa, se cierra solo o al tocar) y \`StationSummary\` (puntaje final, desglose por etapa y lo aprendido). Cada juego dura 1–2 minutos, suma hasta 1.000 puntos y usa el color de su pilar como acento.
`);

// Cover
const cover = `<!-- @dsCard height=288 -->
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>SoyTEL</title>
<style>
  html, body { margin:0; height:100%; }
  body { background:var(--paper); color:var(--ink); font-family:var(--font-body); overflow:hidden; }
  .cover { position:relative; height:288px; overflow:hidden; }
  .art { position:absolute; top:0; left:480px; width:480px; height:288px; overflow:hidden; }
  .art svg { display:block; width:480px; height:288px; }
  .navy { fill:var(--primary); } .blue { fill:var(--secondary); } .sky { fill:var(--accent); } .cream { fill:var(--cream); } .tint { fill:var(--highlight); }
  .blk { rx:var(--radius-lg); }
  .arc { fill:none; stroke-width:8; stroke-linecap:round; }
  .arc.sky { stroke:var(--accent); } .arc.cream { stroke:var(--cream); }
  .dot { fill:var(--cream); }
  .words { position:absolute; left:var(--space-lg); bottom:var(--space-lg); max-width:440px; }
  .name { margin:0; font-family:var(--font-display); font-weight:800; font-size:112px; line-height:.92; letter-spacing:-3px; color:var(--primary); }
  .name span { color:var(--secondary); }
  .tag { margin:var(--space-xs) 0 0 4px; font-size:14px; line-height:20px; color:var(--muted); }
</style>
</head>
<body>
<div class="cover">
<div class="art" aria-hidden="true">
<svg viewBox="0 0 480 288" width="480" height="288">
<!--
  blocks      primary 208×304 bled off top and bottom (el azul noche que la marca usa en cabeceras) · secondary 120×176 · cream 128×120 bled off the right edge (el crema del anillo de las medallas) · accent 88×72 · highlight 128×72 — ≈45% de 960×288
  arrangement one tall navy slab with satellites stepping right, gutters space-md
  pattern     signal arcs from the slab's lower-left corner, from the brand's "Patrón de señal" and the light-blue arc of every medallion: four quarter-arcs at a space-lg pitch in accent, the last one in cream, plus three cream dots on the outer arc like the dotted orbit of the brand sheets
  scales      sides in space-xs multiples; gutters space-md; arc pitch space-lg; corners radius-lg; arc stroke space-xs
-->
<rect class="navy blk" x="16" y="-16" width="208" height="320" rx="20"/>
<rect class="blue blk" x="240" y="96" width="120" height="176" rx="20"/>
<rect class="cream blk" x="376" y="16" width="128" height="120" rx="20"/>
<rect class="sky blk" x="376" y="152" width="88" height="72" rx="20"/>
<rect class="tint blk" x="240" y="16" width="120" height="64" rx="20"/>
<path class="arc sky" d="M48 216 A40 40 0 0 1 88 256"/>
<path class="arc sky" d="M48 192 A64 64 0 0 1 112 256"/>
<path class="arc sky" d="M48 168 A88 88 0 0 1 136 256"/>
<path class="arc cream" d="M48 144 A112 112 0 0 1 160 256"/>
<circle class="dot" cx="116" cy="138" r="6"/>
<circle class="dot" cx="144" cy="160" r="4"/>
<circle class="dot" cx="166" cy="188" r="4"/>
</svg>
</div>
<div class="words">
<h1 class="name">Soy<span>TEL</span></h1>
<p class="tag">Mismas redes, un mejor mañana.</p>
</div>
</div>
</body>
</html>
`;
write(path.join(project, 'components', 'Cover', 'preview.html'), cover);

// README del sistema
write(path.join(project, 'README.md'), fs.readFileSync(path.join(__dirname, 'design-system-readme.md'), 'utf8'));

// ---------- índice ----------
if (idsFile) {
  const ids = JSON.parse(fs.readFileSync(idsFile, 'utf8'));
  const tiles = { Marca: 'l', Iconos: 'xs', Medallas: 's', Rutix: 'm', Ilustraciones: 'm', Ruta: 'm', Patrones: 'l' };
  const types = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg' };
  const assetGroups = {};
  Object.keys(tiles).filter((group) => assetFiles[group]).forEach((group) => {
    const names = assetFiles[group];
    const files = {};
    names.forEach((name) => {
      const id = ids[`${group}/${name}`];
      if (!id) throw new Error(`Falta el id de ${group}/${name}`);
      files[name] = { name, blob: id, size: fs.statSync(path.join(uploads, group, name)).size, type: types[name.split('.').pop()] };
    });
    assetGroups[group] = { name: group, tile: tiles[group], order: names, files };
  });
  const now = new Date().toISOString();
  const previous = fs.existsSync(path.join(project, 'design-system.json')) ? JSON.parse(fs.readFileSync(path.join(project, 'design-system.json'), 'utf8')) : null;
  const index = {
    v: 3,
    layout: 'files',
    createdOnFiles: previous?.createdOnFiles ?? { v: 1, at: now },
    title: 'SoyTEL',
    namespace: 'SoyTEL',
    libraries: [],
    sections: previous?.sections ?? {},
    groups: Object.keys(assetGroups),
    assetGroups,
    blobs: previous?.blobs ?? {},
    docs: previous?.docs ?? { sections: [] },
    lastChange: { by: 'Cristóbal Moraga', at: now, via: 'Claude Code', note: `Ruta Telemática en vivo: templo de pilares, avatares, trivia, podio y ${Object.keys(icons).length} íconos. Generado desde el código de la app.` },
  };
  write(path.join(project, 'design-system.json'), `${JSON.stringify(index, null, 2)}\n`);
}

const count = Object.values(assetFiles).reduce((total, names) => total + names.length, 0);
console.log(`Sistema escrito en ${outDir} · ${count} activos para subir`);
