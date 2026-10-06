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
const { colors, palettes, tierColors } = src('theme/colors');
const { typography } = src('theme/typography');
const { spacing, radius } = src('theme/spacing');
const { shadows, motion } = src('theme/effects');
const { icons } = src('graphics/icons');
const { medallionDrawing, medallionGlyphs } = src('graphics/medallions');
const { rutixDrawing, rutixExpressions, rutixPoses, rutixWardrobe } = src('graphics/rutix');
const { coachLooks, coachLines } = src('data/coachLines');
const net = src('features/puzzles/netwalk');
const { mulberry32 } = src('route/random');
const { runnerCharacterDrawing, runnerItemDrawing, runnerItemKinds } = src('graphics/runners');
const { runnerCharacters } = src('features/runner/characters');
const { tutorials } = src('features/tutorial/tutorials');
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
const pair = (theme, fg, bg) => contrast(palettes[theme][fg], palettes[theme][bg]);
const on = (fg, bg) => `${pair('light', fg, bg)}:1 sobre \`${bg}\``;
// Contraste en los dos temas, para los colores que cambian con el tema.
const onBoth = (fg, bg) => `${pair('light', fg, bg)}:1 en claro y ${pair('dark', fg, bg)}:1 en oscuro sobre \`${bg}\``;
// Pares de texto que usa la app: todos deben pasar 4.5:1 en ambos temas.
[
  ['ink', 'paper'],
  ['ink', 'surface'],
  ['ink', 'highlight'],
  ['inkSoft', 'paper'],
  ['inkSoft', 'surface'],
  ['inkAccent', 'surface'],
  ['inkAccent', 'surfaceAlt'],
  ['inkAccent', 'highlight'],
  ['actionInk', 'action'],
  ['successInk', 'successSoft'],
  ['warningInk', 'warningSoft'],
  ['dangerInk', 'dangerSoft'],
  ['cream', 'primary'],
  ['accentSoft', 'primary'],
].forEach(([fg, bg]) => {
  Object.keys(palettes).forEach((theme) => {
    if (Number(pair(theme, fg, bg)) < 4.5) console.warn(`Contraste bajo (${theme}): ${fg} sobre ${bg} = ${pair(theme, fg, bg)}:1`);
  });
});

// ---------- tokens.json ----------
const colorUsage = {
  primary: `Azul noche de la marca: cabeceras, tarjetas oscuras y fondo de pantallas inmersivas (juegos, historia), igual en ambos temas. Texto \`cream\` encima (${on('cream', 'primary')}). Como texto, solo sobre rellenos claros de marca (\`cream\`, \`accent\`, color de pilar); sobre superficies del tema se escribe con \`ink\`.`,
  primarySoft: 'Superficie elevada sobre `primary`: tarjetas oscuras, botones de ícono en cabeceras, opciones de quiz en tono oscuro. Degradado de pantalla oscura `primary` → `primarySoft`.',
  primaryDeep: 'Fondo más profundo para degradados de bienvenida, el tablero de «Conecta la red» y la terminal del microjuego de ping.',
  primaryInput: 'Relleno de campos de texto sobre fondo oscuro (onboarding).',
  secondary: `Azul secundario: segmentos pendientes, insignia de la alternativa elegida e íconos sobre rellenos claros de marca (${on('secondary', 'cream')}). Sobre superficies del tema usa \`inkAccent\`: en oscuro \`secondary\` no contrasta.`,
  accent: `Celeste de acento: arco de las medallas, ondas de señal, barras de tiempo, cables con señal, botón «Siguiente». Como texto solo sobre \`primary\` (${on('accent', 'primary')}).`,
  accentSoft: `Celeste claro: textos secundarios sobre \`primary\` (${on('accentSoft', 'primary')}) y botón secundario.`,
  highlight: 'Tinte celeste (azul petróleo en oscuro) para chips, casillas escritas del código de la ruta y fondos de íconos en tarjetas.',
  cream: `Crema de la marca: texto principal sobre azul (${on('cream', 'primary')}), botón CTA en pantallas oscuras, anillo de medallas, cuerpo de Rutix y su burbuja de diálogo.`,
  creamSoft: 'Crema muy clara para zonas de lectura sobre crema.',
  creamShade: 'Sombra del crema (extremidades de Rutix, cara lateral de paquetes 3D).',
  slate: 'Azul grisáceo de apoyo: estados deshabilitados, placeholders sobre fondo oscuro, alternativas atenuadas.',
  muted: `Gris azulado fijo para metadatos sobre rellenos blancos que no cambian con el tema (${on('muted', 'white')}). Sobre superficies del tema usa \`inkSoft\`.`,
  paper: 'Fondo de las pantallas (pestañas, perfil, prácticas): casi blanco en claro, azul casi negro en oscuro.',
  surface: 'Tarjetas, listas y barra de pestañas sobre `paper`, siempre con borde `border`.',
  surfaceAlt: 'Fondo secundario: pistas de barras de progreso, botón sutil, bloques internos de tarjetas.',
  border: 'Bordes de tarjetas, filas y separadores sobre superficies del tema.',
  borderStrong: 'Borde de elementos no leídos o destacados (avisos sin leer, línea pendiente de la ruta).',
  ink: `Texto principal sobre \`paper\` y \`surface\` (${onBoth('ink', 'paper')}). Cambia con el tema: nunca escribas con \`primary\` sobre una superficie.`,
  inkSoft: `Texto secundario y metadatos sobre superficies del tema (${onBoth('inkSoft', 'surface')}).`,
  inkAccent: `Texto y trazos de acento sobre superficies del tema: enlaces, kickers, íconos y barras de progreso (${onBoth('inkAccent', 'surface')}).`,
  onDark: `Texto de cuerpo sobre \`primary\` (${on('onDark', 'primary')}).`,
  success: 'Estado correcto: insignias de opción correcta, íconos de verificación. Siempre con ícono o palabra, nunca solo color.',
  successSoft: 'Fondo de paneles de acierto y etiquetas «Completada».',
  successInk: `Texto sobre \`successSoft\` (${onBoth('successInk', 'successSoft')}).`,
  warning: 'Advertencia y monedas del concurso. No usar para texto sobre fondos claros.',
  warningSoft: 'Fondo de etiquetas de advertencia o de Rutix.',
  warningInk: `Texto sobre \`warningSoft\` (${onBoth('warningInk', 'warningSoft')}).`,
  danger: 'Error, vida perdida, punto de aviso sin leer y acciones destructivas (con ícono).',
  dangerSoft: 'Fondo de paneles de error.',
  dangerInk: `Texto sobre \`dangerSoft\` (${onBoth('dangerInk', 'dangerSoft')}).`,
  action: 'Relleno de la acción principal sobre superficies del tema: botón primario, pestaña activa y chip seleccionado. Azul noche en claro, celeste en oscuro.',
  actionInk: `Texto e íconos sobre \`action\` (${onBoth('actionInk', 'action')}).`,
  info: 'Información neutra (reservado; la app prefiere `inkAccent`).',
  white: 'Blanco puro: texto sobre `danger` y `success`, brillos de Rutix.',
  black: 'Solo para sombras (proyección de Rutix).',
  overlay: 'Velo sobre imágenes y detrás de hojas modales para dar legibilidad al texto.',
};

// Los colores de marca valen lo mismo en los dos temas; los de superficie llevan un valor por tema.
const flat = (value) => String(value).replace(/\s+/g, ' ');
const colorTokens = Object.keys(palettes.light).map((name) => ({
  name,
  value: palettes.light[name] === palettes.dark[name] ? flat(palettes.light[name]) : { light: flat(palettes.light[name]), dark: flat(palettes.dark[name]) },
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
    themes: [{ id: 'light', name: 'Claro' }, { id: 'dark', name: 'Oscuro' }],
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
// Rutix v2: una lámina por expresión (con la pose y la señal que mejor la acompañan), por pose y por accesorio.
const rutixLooks = {
  neutral: ['idle', 3],
  happy: ['wave', 4],
  celebrate: ['celebrate', 4],
  love: ['idle', 4],
  wink: ['point', 3],
  proud: ['thumbsUp', 4],
  laugh: ['idle', 4],
  think: ['think', 3],
  focus: ['idle', 3],
  surprised: ['idle', 3],
  alert: ['idle', 3],
  worried: ['shrug', 2],
  sleepy: ['idle', 2],
  sad: ['idle', 1],
  sleep: ['idle', 1],
};
const rutixLook = (expression) => {
  const [pose, signal] = rutixLooks[expression] || ['idle', 3];
  return { expression, pose, signal };
};
const poseExpression = { idle: 'neutral', think: 'think', shrug: 'worried', celebrate: 'celebrate', point: 'wink', thumbsUp: 'proud' };
const poseLook = (pose) => ({ expression: poseExpression[pose] || 'happy', pose, signal: 3 });
const accessoryLook = (accessory) => ({ expression: 'happy', pose: 'idle', signal: 4, accessory });
const rutixOutfits = rutixWardrobe.filter((item) => item.id !== 'none');
rutixExpressions.forEach((expression) => addAsset('Rutix', `rutix-${expression}.svg`, drawingToSvg(rutixDrawing(rutixLook(expression)), { width: 400 })));
rutixPoses.forEach((pose) => addAsset('Rutix', `pose-${pose.toLowerCase()}.svg`, drawingToSvg(rutixDrawing(poseLook(pose)), { width: 400 })));
rutixOutfits.forEach((item) => addAsset('Rutix', `accesorio-${item.id}.svg`, drawingToSvg(rutixDrawing(accessoryLook(item.id)), { width: 400 })));
// TEL Runner: personajes telemáticos y objetos de la pista.
runnerCharacters.forEach((character) => addAsset('Runner', `personaje-${character.id}.svg`, drawingToSvg(runnerCharacterDrawing(character.id), { width: 320 })));
runnerItemKinds.forEach((kind) => addAsset('Runner', `objeto-${kind}.svg`, drawingToSvg(runnerItemDrawing(kind), { width: 160 })));
// Kit de marca (npm run brand:kit): logos, piezas para redes, impresos y fondos de presentación.
const kitDir = path.join(root, 'dist', 'brand-kit');
const kitGroups = { logos: 'Logos', social: 'Social', impresos: 'Impresos', presentacion: 'Presentacion' };
const kitUses = {
  'soytel-wordmark-oscuro': 'Logotipo para fondos azul noche.',
  'soytel-wordmark-claro': 'Logotipo para fondos claros.',
  'soytel-lockup-horizontal-oscuro': 'Versión principal para fondos azul noche.',
  'soytel-lockup-horizontal-claro': 'Versión principal para fondos claros.',
  'soytel-lockup-vertical-oscuro': 'Formatos cuadrados o altos.',
  'rutix-sello': 'Avatar de redes sociales y sello de cierre.',
  'post-cuadrado-1080': 'Publicación cuadrada de presentación.',
  'post-runner-1080': 'Publicación cuadrada de TEL Runner.',
  'historia-1080x1920': 'Historia vertical con el QR de la ruta.',
  'banner-1600x900': 'Banner 16:9 para pantallas, sitios y video.',
};
const kitPieces = fs.existsSync(path.join(kitDir, 'kit.json')) ? JSON.parse(fs.readFileSync(path.join(kitDir, 'kit.json'), 'utf8')).filter((item) => fs.existsSync(path.join(kitDir, item.group, item.file))) : [];
kitPieces.forEach((item) => addAsset(kitGroups[item.group], item.file, fs.readFileSync(path.join(kitDir, item.group, item.file))));
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
avatars.forEach((info, index) => addAsset('Ruta', `avatar-${index + 1}-${info.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')}.svg`, avatarSvg(index)));
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
  Rutix: '# Rutix\n\nMascota de SoyTEL (diseño v2): robot-antena con pantalla por cara, orejas-puerto, botas y barras de señal en el pecho que muestran su ánimo (0–4).\n\n- `rutix-<expresión>.svg` — las 15 expresiones (`neutral`, `happy`, `celebrate`, `love`, `wink`, `proud`, `laugh`, `think`, `focus`, `surprised`, `alert`, `worried`, `sleepy`, `sad`, `sleep`), cada una con la pose y la señal que mejor la acompañan.\n- `pose-<pose>.svg` — las 7 poses: `idle`, `wave`, `celebrate`, `think`, `point`, `thumbsup` y `shrug`.\n- `accesorio-<id>.svg` — el guardarropa que se desbloquea jugando: `cap` (jockey TEL, nivel 2), `headphones` (audífonos, tres ráfagas), `graduation` (birrete, las seis áreas de la carrera), `crown` (corona, nivel 8 o ganar una ruta en vivo), `glasses` (lentes, tres niveles de Binario), `scarf` (bufanda, 200 metros en TEL Runner), `helmet` (casco, los seis juegos de la ruta) y `cape` (capa, 1.000 metros en TEL Runner o nivel 6).\n\nSus colores son fijos en los dos temas (cuerpo `cream`, pantalla `primary`, ojos `accentSoft`): ponlo sobre fondos azul noche o dentro de un círculo `primary`. En la app flota, parpadea y su antena pulsa (componente `Rutix`); en los juegos habla desde una burbuja (`CoachBubble`). Úsalo como guía y reacción emocional, nunca como decoración repetida: máximo un Rutix por pantalla.\n',
  Ilustraciones: '# Ilustraciones\n\nIlustraciones planas en el estilo de «Ilustraciones rápidas» de la marca, generadas desde una paleta: versión clara (fondo `highlight`) para pantallas claras y `-oscuro` para pantallas azules. `connect`, `burst`, `campus`, `globe`, `trophy`, `inbox` (estado vacío de avisos), `quiz`, `route`, `offline` (error), `career`. `mapa-campus.svg` es el mapa del modo historia.\n',
  Ruta: '# Ruta Telemática\n\nGráficos del modo en vivo (stand → B215 → B213 → pasillo). `templo-*`: el Templo de Telemática de Didactic-Tel; cada columna toma el color de su pilar cuando el participante completa el juego del proyecto (Datos, Software, Redes, Telecomunicaciones, Hardware) y con los cinco se enciende el frontón. `avatar-*`: los 8 avatares que elige cada participante (círculo de color con anillo crema e ícono en tinta primaria). `respuesta-*`: color y forma de las cuatro alternativas de la trivia final, estilo Kahoot (triángulo, rombo, círculo, cuadrado), para que se distingan también sin color.\n',
  Runner: '# TEL Runner\n\nGráficos de la carrera sin fin.\n\n- `personaje-<id>.svg` — los siete personajes telemáticos: `rutix` (robot-antena, inicial), `paqui` (paquete de datos), `routa` (router), `fibri` (fibra óptica), `satelin` (satélite), `dronix` (dron) y `nubi` (la nube). Se desbloquean con paquetes de datos y cada uno trae una ventaja ligada a lo que hace en una red real.\n- `objeto-<tipo>.svg` — lo que aparece en la pista: `packet` (paquete de datos, suma), `shield` (cortafuegos, protege de un golpe), `fiber` (rayo de fibra, duplica los paquetes), `virus` (obstáculo alto: se esquiva) y `cable` (obstáculo bajo: se salta).\n\nColores fijos en los dos temas: todo va sobre la pista azul noche. Los obstáculos son los únicos elementos en rojo o naranja y además tienen forma propia (púas, chispas), para que no dependan solo del color.\n',
  Logos: '# Logos\n\nEl logotipo SoyTEL y sus combinaciones con el emblema de Telemática USM, en PNG con fondo transparente. `oscuro` es para fondos azul noche y `claro` para fondos claros. `rutix-sello` es el avatar de Rutix para redes sociales. Reglas de uso (zona de respeto, tamaños mínimos y lo que no se hace) en la sección «Logo y marca» del libro.\n',
  Social: '# Redes sociales\n\nPiezas listas para publicar: publicaciones cuadradas (1080×1080), historia vertical (1080×1920) con el QR de la ruta, banner 16:9, imagen para enlaces compartidos (1200×630) y gráfico de la tienda (1024×500). El texto es parte de la imagen: para cambiarlo, edita el HTML fuente que genera `npm run brand:kit`.\n',
  Impresos: '# Impresos\n\nPiezas para el stand y los eventos, a 150 dpi salvo que se indique: afiche A4 con el QR de la ruta, diploma A4 horizontal con espacio para el nombre, credencial de 54×85 mm (300 dpi) para quienes atienden el stand y dos hojas de stickers para troquelar.\n',
  Presentacion: '# Presentación\n\nFondos 16:9 (1920×1080) para láminas: una portada con título de ejemplo y dos fondos de contenido, oscuro y claro, con el logotipo abajo a la derecha y una línea de acento donde parte el título.\n',
  Patrones: '# Patrones\n\nFondos decorativos de las pantallas oscuras (`BrandBackdrop`): `estrellas` (por defecto), `red` (nodos conectados), `senal` (ondas desde una esquina) y `orbitas` (anillos crema como la bienvenida). Siempre detrás del contenido, sin competir con el texto; una capa de estrellas titila si el movimiento está activado.\n',
};
Object.entries(groupReadmes)
  .filter(([group]) => assetFiles[group])
  .forEach(([group, text]) => write(path.join(project, 'assets', group, 'README.md'), text));
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
.tel-btn.primary{background:var(--action);color:var(--actionInk)}
.tel-btn.accent{background:var(--accent);color:var(--primary)}
.tel-btn.cream{background:var(--cream);color:var(--primary)}
.tel-btn.secondary{background:var(--accentSoft);color:var(--primary)}
.tel-btn.subtle{background:var(--surfaceAlt);color:var(--inkAccent)}
.tel-btn.outline{background:transparent;color:var(--ink);border:1.5px solid var(--ink)}
.tel-btn.outlineLight{background:rgba(11,45,69,.55);color:var(--cream);border:1.5px solid rgba(167,212,237,.55)}
.tel-btn.danger{background:var(--danger);color:var(--white)}
.tel-btn.dangerOutline{background:transparent;color:var(--danger);border:1.5px solid var(--danger)}
.tel-btn.disabled{background:var(--border);color:var(--inkSoft)}
.tel-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px;display:flex;flex-direction:column;gap:12px}
.tel-card.navy{background:var(--primary);border:0;color:var(--cream)}
.tel-card.dark{background:var(--primarySoft);border:0;color:var(--cream)}
.tel-card.cream{background:var(--cream);border:0}
.tel-card.accent{background:var(--highlight);border:0}
.tel-card.elevated{box-shadow:var(--shadow-card)}
.tel-overline{font-family:var(--font-display);font-weight:700;font-size:12px;line-height:16px;letter-spacing:2.4px;text-transform:uppercase;color:var(--accent)}
.tel-title{font-family:var(--font-display);font-weight:800;font-size:26px;line-height:32px;color:var(--cream);margin:0}
.tel-subtitle{font-family:var(--font-display);font-weight:700;font-size:17px;line-height:23px;margin:0}
.tel-caption{font-size:13px;line-height:18px;font-weight:600;color:var(--inkSoft);margin:0}
.tel-small{font-size:12px;line-height:16px;font-weight:800}
.tel-header{background:var(--primary);padding:18px 20px 22px;display:flex;flex-direction:column;gap:6px;position:relative;overflow:hidden}
.tel-header.rounded{border-radius:0 0 var(--radius-xxl) var(--radius-xxl)}
.tel-iconbtn{width:44px;height:44px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;position:relative}
.tel-iconbtn.dark{background:var(--primarySoft);color:var(--cream)}
.tel-iconbtn.light{background:var(--surfaceAlt);color:var(--ink)}
.tel-iconbtn .badge{position:absolute;top:5px;right:5px;min-width:17px;height:17px;border-radius:999px;background:var(--cream);color:var(--primary);font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 4px}
.tel-chip{height:36px;padding:0 14px;border-radius:18px;display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;border:1.5px solid var(--border);background:var(--surface);color:var(--inkAccent)}
.tel-chip.active{background:var(--action);border-color:var(--action);color:var(--actionInk)}
.tel-chip.dark{background:transparent;border-color:var(--secondary);color:var(--onDark)}
.tel-chip.dark.active{background:var(--cream);border-color:var(--cream);color:var(--primary)}
.tel-tag{height:24px;padding:0 10px;border-radius:999px;display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;letter-spacing:.4px}
.tel-tag.navy{background:var(--primary);color:var(--cream)}.tel-tag.cream{background:var(--cream);color:var(--primary)}
.tel-tag.success{background:var(--successSoft);color:var(--successInk)}.tel-tag.neutral{background:var(--surfaceAlt);color:var(--inkSoft)}
.tel-tag.sky{background:var(--highlight);color:var(--inkAccent)}.tel-tag.warning{background:var(--warningSoft);color:var(--warningInk)}
.tel-tag.glass{background:rgba(167,212,237,.16);color:var(--accentSoft)}
.tel-tag .live{width:7px;height:7px;border-radius:4px;background:var(--accent)}
.tel-option{display:flex;align-items:center;gap:14px;min-height:58px;padding:10px 14px;border-radius:var(--radius-md);border:1.5px solid var(--border);background:var(--surface);font-weight:700;font-size:16px;color:var(--ink)}
.tel-option .letter{width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:800;font-size:14px;background:var(--surfaceAlt);color:var(--inkAccent)}
.tel-option.selected{border:2px solid var(--inkAccent);background:var(--surfaceAlt)}.tel-option.selected .letter{background:var(--secondary);color:#fff}
.tel-option.correct{border:2px solid var(--success);background:var(--successSoft)}.tel-option.correct .letter{background:var(--success);color:#fff}
.tel-option.wrong{border:2px solid var(--danger);background:var(--dangerSoft)}.tel-option.wrong .letter{background:var(--danger);color:#fff}
.tel-panel{border-radius:18px;border:1px solid var(--success);background:var(--successSoft);padding:16px;display:flex;flex-direction:column;gap:10px}
.tel-panel.error{border-color:var(--danger);background:var(--dangerSoft)}
.tel-panel .head{display:flex;align-items:center;gap:10px;font-family:var(--font-display);font-weight:700;font-size:17px;color:var(--successInk)}
.tel-panel.error .head{color:var(--dangerInk)}
.tel-panel .dot{width:32px;height:32px;border-radius:16px;display:flex;align-items:center;justify-content:center;background:var(--success);color:#fff}
.tel-panel.error .dot{background:var(--danger)}
.tel-bar{height:8px;border-radius:999px;background:var(--surfaceAlt);overflow:hidden}.tel-bar>span{display:block;height:100%;border-radius:999px;background:var(--inkAccent)}
.tel-seg{display:flex;gap:6px}.tel-seg>span{flex:1;height:8px;border-radius:999px;background:var(--secondary)}.tel-seg>span.done{background:var(--accent)}.tel-seg>span.now{background:var(--cream)}
.tel-skel{background:#E4EDF5;border-radius:8px;position:relative;overflow:hidden}
.tel-skel::after{content:"";position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent);animation:tel-shimmer 1.25s ease-in-out infinite}
.tel-skel.dark,[data-theme="dark"] .tel-skel{background:rgba(167,212,237,.12)}.tel-skel.dark::after,[data-theme="dark"] .tel-skel::after{background:linear-gradient(90deg,transparent,rgba(167,212,237,.22),transparent)}
@keyframes tel-shimmer{to{transform:translateX(100%)}}
@keyframes tel-spin{to{transform:rotate(360deg)}}
@keyframes tel-wave{0%,100%{opacity:.2}30%{opacity:1}}
@keyframes tel-bounce{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-6px);opacity:1}}
@keyframes tel-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes tel-pulse{0%{transform:scale(.55);opacity:0}15%{opacity:.55}100%{transform:scale(1);opacity:0}}
@media (prefers-reduced-motion: reduce){.tel-skel::after,.tel-anim,.tel-anim *{animation:none!important}}
.tel-tabbar{display:flex;box-sizing:border-box;background:var(--surface);border-top:1px solid var(--border);padding:6px 6px 10px;width:390px}
.tel-tab{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:54px;margin:0 4px;border-radius:16px;font-size:11px;line-height:16px;font-weight:800;color:var(--inkSoft)}
.tel-tab .pill{display:flex;position:relative}
.tel-tab.active{background:var(--action);color:var(--actionInk)}
.tel-tab .unread{position:absolute;top:-3px;right:-6px;width:10px;height:10px;border-radius:5px;background:var(--danger);border:2px solid var(--surface)}
.tel-toast{display:flex;align-items:center;gap:12px;padding:12px;border-radius:var(--radius-lg);background:var(--primary);border:1px solid rgba(167,212,237,.25);box-shadow:var(--shadow-lifted);width:358px}
.tel-row-item{display:flex;align-items:center;gap:14px;padding:14px;border-radius:18px;background:var(--surface);border:1px solid var(--border)}
.tel-row-item .ico{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:var(--highlight);color:var(--inkAccent)}
.tel-stat{flex:1;min-width:76px;border-radius:var(--radius-md);padding:12px;display:flex;flex-direction:column;gap:4px;background:var(--surface);border:1px solid var(--border)}
.tel-stat .ico{width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:var(--highlight);color:var(--inkAccent)}
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

- \`primary\` (relleno \`action\`, texto \`actionInk\`: azul noche con crema en claro, celeste con azul noche en oscuro): acción principal sobre superficies del tema («Continuar», «Responder»).
- \`cream\`: acción principal sobre fondos \`primary\` («Comenzar», «¡Empezar!»).
- \`accent\`: avanzar en secuencias (onboarding «Siguiente»).
- \`secondary\` / \`subtle\`: acciones de apoyo dentro de tarjetas.
- \`outline\` / \`outlineLight\`: alternativas y reintentos; \`outlineLight\` sobre fondos oscuros.
- \`dangerOutline\`: acciones destructivas, siempre con ícono y confirmación.
- \`ghost\` / \`ghostLight\`: enlaces de texto; \`ghostLight\` sobre fondos azul noche.
- Estado deshabilitado: fondo \`border\`, texto \`inkSoft\`. Cargando: tres puntos animados (\`DotsLoader\`), nunca un spinner del sistema.

Props (\`TelButton\`): \`label\`, \`variant\`, \`size\` (\`sm\` 40, \`md\` 52, \`lg\` 56 px de alto), \`icon\`, \`iconRight\`, \`loading\`, \`fullWidth\`, \`haptic\`. Encoge a 96% al presionar y vibra levemente.
`);

// IconButton
preview('IconButton', { group: 'Acciones', height: 96 }, `<div class="tel-stage dark tel-row"><span class="tel-iconbtn dark">${svgIcon('chevronLeft', 22)}</span><span class="tel-iconbtn dark">${svgIcon('bell', 22)}<span class="badge">3</span></span><span class="tel-iconbtn dark">${svgIcon('share', 22)}</span></div>`);
readme('IconButton', `
Botón cuadrado redondeado de 44×44 con un ícono (volver, avisos, compartir, perfil). \`tone\`: \`dark\` (sobre cabeceras), \`light\`, \`glass\`, \`cream\`. \`badge\` muestra un contador crema (máximo «9+») y se anuncia en el nombre accesible. Requiere \`accessibilityLabel\`.
`);

// Card
preview('Card', { group: 'Contenedores', height: 250 }, `<div class="tel-stage tel-row" style="align-items:stretch">
<div class="tel-card elevated" style="width:250px"><span class="tel-small" style="color:var(--inkAccent);letter-spacing:1.4px">SIGUIENTE CAPÍTULO</span><p class="tel-subtitle">3 · El intruso en la red</p><p class="tel-caption">Sala de servidores · La señal perdida</p><div class="tel-bar"><span style="width:40%"></span></div></div>
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
const tabBar = (style = '') => `<div class="tel-tabbar"${style ? ` style="${style}"` : ''}>${tabs.map(([icon, label, active, unread]) => `<div class="tel-tab${active ? ' active' : ''}"><span class="pill">${svgIcon(icon, 22, 'currentColor', active ? 2.3 : 2)}${unread ? '<span class="unread"></span>' : ''}</span>${label}</div>`).join('')}</div>`;
preview('TabBar', { group: 'Navegación', height: 90 }, tabBar());
readme('TabBar', `
Barra inferior de cinco pestañas: Inicio, Jugar, Carrera, Logros y Avisos. La pestaña activa se marca completa: fondo \`action\` con ícono y texto \`actionInk\` (azul noche con crema en claro, celeste con azul noche en oscuro); las demás van en \`inkSoft\`. La marca sigue al dedo, porque las secciones también se cambian deslizando hacia los lados. Avisos muestra un punto \`danger\` cuando hay no leídos. Juegos, historia, ruta, Rutix y perfil abren encima como pantallas completas.
`);

// Chip & Tag
preview('Chip', { group: 'Selección', height: 150 }, `<div class="tel-stage tel-row"><span class="tel-chip active">Todos · 14</span><span class="tel-chip">Obtenidos · 4</span><span class="tel-chip">En progreso · 8</span></div>
<div class="tel-stage dark tel-row"><span class="tel-chip dark active">Todas</span><span class="tel-chip dark">Logros</span><span class="tel-chip dark">Rutix</span></div>`);
readme('Chip', `
Filtro en fila desplazable (\`ChipGroup\`). Una opción activa a la vez; puede mostrar conteo («Obtenidos · 4»). \`tone\`: \`light\` (activo \`action\` con texto \`actionInk\`) o \`dark\` sobre cabeceras (activo \`cream\`). Se anuncian como pestañas.
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
Alternativa A/B/C/D de quiz, como en «Reto de estación». Estados: \`idle\`, \`selected\` (borde \`inkAccent\`), \`correct\` (verde con ✓), \`wrong\` (rojo con ✕), \`dimmed\` (resto tras responder) y \`hidden\` (tachada por el comodín 50:50). \`tone="dark"\` para el concurso y la historia. Siempre se confirma con un botón «Responder» antes de revelar.
`);
preview('FeedbackPanel', { group: 'Quiz', height: 280 }, `<div class="tel-stage tel-col" style="width:360px;align-items:stretch">
<div class="tel-panel"><div class="head"><span class="dot">${svgIcon('check', 18, '#fff', 3)}</span>¡Correcto! +50 pts</div><span style="font-size:14px;line-height:21px;color:var(--successInk)">Una frase larga con palabras al azar tiene muchas más combinaciones posibles.</span></div>
<div class="tel-panel error"><div class="head"><span class="dot">${svgIcon('close', 18, '#fff', 3)}</span>Casi… inténtalo otra vez</div><span style="font-size:14px;line-height:21px;color:var(--dangerInk)">Pista: largo y al azar le gana a corto y predecible.</span></div></div>`);
readme('FeedbackPanel', `
Tarjeta de retroalimentación tras responder: \`success\`, \`error\` o \`info\`, con ícono en círculo, título en Montserrat y una explicación de una o dos frases. Es la microlección: toda respuesta la muestra. Se anuncia a lectores de pantalla y la vista se desplaza hasta ella.
`);

// Medallion
preview('Medallion', { group: 'Gráficos', height: 150, subtitle: 'Crema, rarezas, progreso y bloqueo' }, `<div class="tel-stage tel-row">${medal({ glyph: 'cap' }, 84)}${medal({ glyph: 'shield', tier: 'bronce' }, 84)}${medal({ glyph: 'bolt', tier: 'plata' }, 84)}${medal({ glyph: 'trophy', tier: 'oro' }, 84)}${medal({ glyph: 'heart', tier: 'platino' }, 84)}${medal({ glyph: 'rocket', tier: 'oro', state: 'progress', progress: 0.6 }, 84)}${medal({ glyph: 'crown', tier: 'platino', state: 'locked' }, 84)}${medal({ glyph: 'flame', tier: 'plata', ribbon: true }, 84)}</div>`);
readme('Medallion', `
Medalla SVG de la marca para logros, áreas, estaciones y accesos. Props: \`glyph\` (35 glifos: \`cap\`, \`shield\`, \`network\`, \`antenna\`, \`code\`, \`chip\`, \`bulb\`, \`trophy\`, \`robot\`…), \`tier\` (\`crema\` por defecto, \`bronce\`, \`plata\`, \`oro\`, \`platino\`; la rareza también suma estrellas abajo), \`state\` (\`unlocked\`, \`progress\` con arco celeste parcial según \`progress\`, \`locked\` gris con candado), \`size\` y \`ribbon\` (cintas, solo en detalle y celebraciones). No uses medallas bloqueadas como decoración.
`);

// Rutix
const rutixCss = `.rx-sheet{display:flex;flex-direction:column;gap:10px;width:620px;padding:16px;background:linear-gradient(180deg,var(--primary),var(--primarySoft))}
.rx-title{font-family:var(--font-display);font-weight:700;font-size:12px;line-height:16px;letter-spacing:2.4px;text-transform:uppercase;color:var(--accent)}
.rx-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px 4px}
.rx-cell{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;line-height:14px;font-weight:800;color:var(--accentSoft);text-align:center}
.rx-cell small{font-size:10px;font-weight:700;color:var(--slate)}`;
const rutixCell = (options, label, size, note = '') => `<div class="rx-cell">${rutix(options, size)}<span>${label}</span>${note ? `<small>${note}</small>` : ''}</div>`;
preview('Rutix', { group: 'Gráficos', height: 560, subtitle: `${rutixExpressions.length} expresiones · ${rutixPoses.length} poses` }, `<div class="rx-sheet tel-anim">
<span class="rx-title">Expresiones</span>
<div class="rx-grid">${rutixExpressions.map((expression) => rutixCell(rutixLook(expression), expression, 88)).join('')}</div>
<span class="rx-title">Poses</span>
<div class="rx-grid" style="grid-template-columns:repeat(${rutixPoses.length},1fr)">${rutixPoses.map((pose) => rutixCell(poseLook(pose), pose, 74)).join('')}</div>
</div>`, rutixCss);
readme('Rutix', `
Mascota animada de SoyTEL (diseño v2): flota, parpadea y la antena pulsa. Props: \`expression\` (${rutixExpressions.map((name) => `\`${name}\``).join(', ')}), \`pose\` (${rutixPoses.map((name) => `\`${name}\``).join(', ')}), \`signal\` (0–4 barras en el pecho = ánimo), \`accessory\` (por defecto, el que eligió la persona en su guardarropa), \`size\` y \`reactKey\` (al cambiar, rebota). La expresión sale del ánimo con \`expressionForMood\`: ≥85 \`happy\`, ≥60 \`neutral\`, ≥35 \`sleepy\`, menos \`sad\`. Sus colores son fijos en los dos temas (cuerpo \`cream\`, pantalla \`primary\`, ojos \`accentSoft\`), por eso vive sobre fondos azul noche o dentro de un círculo \`primary\`. Habla en primera persona, en frases cortas y cálidas, dentro de una burbuja (\`CoachBubble\`). Máximo un Rutix por pantalla.
`);

// Guardarropa de Rutix
preview('RutixWardrobe', { group: 'Gráficos', height: 400, subtitle: 'Accesorios que se desbloquean jugando' }, `<div class="rx-sheet">
<span class="rx-title">Guardarropa</span>
<div class="rx-grid">${rutixWardrobe.map((item) => rutixCell(accessoryLook(item.id), item.label, 104, item.hint)).join('')}</div>
</div>`, rutixCss);
readme('RutixWardrobe', `
Accesorios de Rutix (pantalla de Rutix → «Guardarropa»). Cada uno se gana jugando y queda puesto en toda la app: ${rutixWardrobe.map((item) => `\`${item.id}\` «${item.label}» (${item.hint.replace(/\.$/, '').toLowerCase()})`).join(', ')}. Los bloqueados se muestran atenuados con candado y la condición para desbloquearlos; nunca se venden ni dependen del azar. El accesorio va en la capa \`outfit\`, sobre la cabeza y sin tapar la pantalla ni la antena.
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
Bloques de carga con brillo que recorre la forma (\`Skeleton\`, \`SkeletonText\`, \`SkeletonCircle\`, \`SkeletonCard\`, \`SkeletonGrid\`). Reproducen la forma final del contenido (misma altura, mismo radio) mientras se leen los datos locales. \`tone="dark"\` sobre cabeceras; en el tema oscuro todos usan el tinte celeste translúcido. Se ocultan a lectores de pantalla.
`);

// Progress
preview('Progress', { group: 'Carga', height: 150 }, `<div class="tel-stage tel-row" style="gap:28px"><div class="tel-col" style="width:220px"><div class="tel-bar"><span style="width:62%"></span></div><div class="tel-seg" style="background:var(--primary);padding:10px;border-radius:12px"><span class="done"></span><span class="done"></span><span class="now"></span><span></span><span></span></div></div>
<svg width="72" height="72"><circle cx="36" cy="36" r="31.5" stroke="var(--surfaceAlt)" stroke-width="7" fill="none"/><circle cx="36" cy="36" r="31.5" stroke="var(--inkAccent)" stroke-width="7" fill="none" stroke-linecap="round" stroke-dasharray="${(2 * Math.PI * 31.5 * 0.36).toFixed(1)} 400" transform="rotate(-90 36 36)"/><text x="36" y="41" text-anchor="middle" font-family="Montserrat, sans-serif" font-weight="800" font-size="15" fill="var(--ink)">5/14</text></svg></div>`);
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
preview('ListRow', { group: 'Contenedores', height: 250 }, `<div class="tel-stage tel-col" style="width:360px;align-items:stretch"><div class="tel-row-item"><span class="ico">${svgIcon('bolt', 20)}</span><div class="tel-col" style="gap:2px;flex:1"><span class="tel-small" style="color:var(--inkAccent);font-size:11px;letter-spacing:.8px">HACE 30 MIN</span><span class="tel-subtitle" style="font-size:15px">Ráfaga TEL</span><span class="tel-caption">1.180 pts · 83% de precisión</span></div></div><div class="tel-row" style="gap:8px">${[['sparkle', '820', 'XP total'], ['flame', '3', 'Racha'], ['gamepad', '6', 'Partidas'], ['trophy', '4/14', 'Logros']].map(([icon, value, label]) => `<div class="tel-stat"><span class="ico">${svgIcon(icon, 18)}</span><span class="tel-num">${value}</span><span class="tel-small" style="color:var(--inkSoft)">${label}</span></div>`).join('')}</div></div>`);
readme('ListRow', `
Fila de lista con ícono en cuadro \`highlight\` (historial, enlaces, avisos) y \`StatTile\` para cifras del perfil. Metadato en mayúsculas \`inkAccent\`, título \`subtitle\` a 15 px y descripción \`caption\`. Con \`onPress\` agrega un chevron.
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
.rt-chip{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:14px;background:var(--primarySoft);color:var(--cream);font-weight:700;font-size:14px;width:300px}
.rt-boxes{display:flex;gap:8px}
.rt-box{flex:1;height:60px;box-sizing:border-box;border-radius:var(--radius-sm);border:1.5px solid var(--border);background:var(--paper);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:800;font-size:26px;color:var(--ink)}
.rt-box.filled{background:var(--highlight)}
.rt-box.active{border:2px solid var(--inkAccent)}`;
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
Estructura común de los seis juegos de la ruta: \`StationHud\` (etapa, título, puntaje y reloj que se vuelve rojo en los últimos 5 s), \`StageBanner\` (Rutix presenta cada etapa y espera a que toques «Continuar»: el reloj no corre mientras lees) y \`StationSummary\` (puntaje final, desglose por etapa y lo aprendido). Cada juego suma hasta 1.000 puntos y usa el color de su pilar como acento. Todos los tiempos se multiplican por el ritmo elegido (sin apuro ×2,5 por defecto, tranquilo ×1,7, normal ×1,35 o rápido ×1); en la ruta en vivo el ritmo lo fija el stand.
`);

preview('CodeBoxes', { group: 'Ruta', height: 150, subtitle: 'Ingreso del código de la ruta' }, `<div class="tel-stage tel-col" style="width:360px;align-items:stretch"><div class="rt-boxes">${'LYJ6'.split('').map((character) => `<span class="rt-box filled">${character}</span>`).join('')}<span class="rt-box active"></span><span class="rt-box"></span></div><span class="tel-caption">Toca cualquier casilla para escribir. El código no usa 0, 1, I ni O.</span></div>`, routeCss);
readme('CodeBoxes', `
Seis casillas para escribir el código de la ruta. Un solo campo de texto invisible cubre todas las casillas: tocar cualquiera abre el teclado, y se puede pegar el código completo. Casilla vacía \`paper\` con borde \`border\`, casilla escrita \`highlight\`, casilla actual con borde \`inkAccent\` de 2 px; letras en \`title\` con tinta \`ink\`. Convierte a mayúsculas y descarta los caracteres que el código no usa (0, 1, I, O). Al completar los seis se intenta entrar sin pedir otro toque.
`);

// ---------- Juegos: Rutix en la partida y desafíos sin reloj ----------
const coachCss = `.cb-row{display:flex;align-items:center;gap:8px;width:340px}
.cb-bubble{flex:1;position:relative;border-radius:var(--radius-md);padding:8px 12px;font-size:13px;line-height:18px;font-weight:600}
.cb-bubble::before{content:"";position:absolute;left:-4px;top:50%;width:10px;height:10px;margin-top:-5px;border-radius:2px;transform:rotate(45deg);background:inherit}
.cb-bubble b{display:block;font-size:11px;line-height:15px;letter-spacing:.6px;font-weight:800;opacity:.75}`;
const coachTones = { info: ['var(--cream)', 'var(--primary)'], good: ['#DDF3E6', '#16513A'], bad: ['#FBE2E2', '#842626'] };
const coach = (mood, tone, text, title = '') => {
  const [bg, fg] = coachTones[tone];
  return `<div class="cb-row">${rutix({ ...coachLooks[mood], signal: 3 }, 56)}<div class="cb-bubble" style="background:${bg};color:${fg}">${title ? `<b>${title}</b>` : ''}${text}</div></div>`;
};
preview('CoachBubble', { group: 'Juegos', height: 330, subtitle: 'Rutix acompaña, da pistas y reacciona' }, `<div class="tel-stage dark tel-col">${coach('intro', 'info', coachLines.intro[1])}${coach('tip', 'info', 'Cada bit encendido suma su valor: 8, 4, 2, 1.', 'PISTA DE RUTIX')}${coach('good', 'good', coachLines.good[2])}${coach('bad', 'bad', coachLines.bad[0])}</div>`, coachCss);
readme('CoachBubble', `
Rutix hablando: la mascota junto a una burbuja de diálogo. Es la voz de las pistas, las presentaciones de etapa y las reacciones dentro de los juegos. \`mood\` elige expresión y pose (\`intro\` saluda, \`tip\` apunta, \`good\` pulgar arriba, \`great\` y \`win\` celebran, \`bad\` se encoge de hombros, \`hurry\` alerta, \`lose\` triste, \`idle\` neutral) y \`tone\` el color de la burbuja: \`info\` (\`cream\` con texto \`primary\`), \`good\` (verde claro) y \`bad\` (rosado). \`title\` agrega un kicker («PISTA DE RUTIX») y \`side="right"\` pone a Rutix a la derecha. Frases de una línea, cálidas y en primera persona; ante un error anima a seguir, nunca reta. Sus colores son fijos: va siempre sobre fondos azul noche. Se apaga con el ajuste «Rutix en los juegos»; entonces las pistas se muestran como texto.
`);

preview('PauseSheet', { group: 'Juegos', height: 330, subtitle: 'Pausa y confirmación de salida' }, `<div class="tel-stage dark" style="align-items:flex-end;padding:0"><div style="width:360px;border-radius:28px 28px 0 0;background:var(--primary);border:1px solid rgba(167,212,237,.2);border-bottom:0;padding:10px 20px 22px;display:flex;flex-direction:column;gap:12px"><span style="align-self:center;width:44px;height:5px;border-radius:3px;background:var(--secondary)"></span><div class="tel-row" style="flex-wrap:nowrap">${rutix({ expression: 'think', pose: 'think', signal: 3 }, 84)}<div class="tel-col" style="gap:2px"><span class="tel-overline">En pausa</span><span class="tel-subtitle" style="color:var(--cream);font-size:19px;line-height:25px">¿Salir de la ráfaga?</span></div></div><span style="color:var(--onDark);font-size:16px;line-height:24px">El reloj está detenido. Si sales ahora, esta partida no suma puntos.</span><span class="tel-btn cream">${svgIcon('play')} Seguir jugando</span><span class="tel-btn outlineLight">${svgIcon('door')} Salir</span></div></div>`);
readme('PauseSheet', `
Hoja de pausa de los juegos con reloj. Se abre con el botón de pausa de la barra superior o con el botón «atrás» de Android, para que nadie pierda una partida por un toque accidental. En la Ráfaga detiene el reloj y tapa el tablero (la pausa no regala tiempo para pensar); en la práctica de los juegos de la ruta solo confirma la salida. Rutix aparece pensativo, el título pregunta («¿Salir de la ráfaga?»), una frase explica la consecuencia y hay dos acciones: \`cream\` «Seguir jugando» (también al cerrar la hoja) y \`outlineLight\` «Salir». Los desafíos sin reloj no la necesitan.
`);

const netBoard = (() => {
  const puzzle = net.createNetPuzzle(2, mulberry32(11));
  // A medio resolver: algunas piezas siguen giradas, así se ve qué cables ya llevan señal.
  const turns = puzzle.turns.map((value, index) => (index % 4 === 3 ? value : value + net.turnsToSolve(puzzle.solved[index], value)));
  const masks = net.currentMasks(puzzle, turns);
  const lit = net.poweredCells(puzzle.size, puzzle.server, masks);
  const terminals = puzzle.solved.map((mask, index) => index !== puzzle.server && net.portCount(mask) === 1);
  const cell = 72;
  const side = cell * puzzle.size;
  const dim = '#4A6A82';
  const ports = [[net.NORTH, 0, -1], [net.EAST, 1, 0], [net.SOUTH, 0, 1], [net.WEST, -1, 0]];
  let body = `<rect width="${side}" height="${side}" rx="20" fill="${colors.primaryDeep}"/>`;
  for (let line = 1; line < puzzle.size; line += 1) body += `<path d="M${line * cell} 0V${side}M0 ${line * cell}H${side}" stroke="${colors.accentSoft}" stroke-opacity=".12"/>`;
  masks.forEach((mask, index) => {
    const cx = (index % puzzle.size) * cell + cell / 2;
    const cy = Math.floor(index / puzzle.size) * cell + cell / 2;
    const color = lit[index] ? colors.accent : dim;
    ports.forEach(([bit, dx, dy]) => {
      if (mask & bit) body += `<path d="M${cx} ${cy}L${cx + (dx * cell) / 2} ${cy + (dy * cell) / 2}" stroke="${color}" stroke-width="9" stroke-linecap="round"/>`;
    });
    const server = index === puzzle.server;
    if (!server && !terminals[index]) {
      body += `<circle cx="${cx}" cy="${cy}" r="4.5" fill="${color}"/>`;
      return;
    }
    const fill = server ? colors.cream : lit[index] ? colors.accent : colors.primarySoft;
    const ring = server ? colors.accent : lit[index] ? colors.cream : dim;
    const ink = server || lit[index] ? colors.primary : colors.slate;
    const glyph = iconToSvg(icons[server ? 'server' : 'laptop'], { size: 22, color: ink, strokeWidth: 2.2 }).replace('<svg ', `<svg x="${cx - 11}" y="${cy - 11}" `);
    body += `<circle cx="${cx}" cy="${cy}" r="21" fill="${fill}" stroke="${ring}" stroke-width="2"/>${glyph}`;
  });
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="0 0 ${side} ${side}">${body}</svg>`,
    online: terminals.filter((isTerminal, index) => isTerminal && lit[index]).length,
    total: terminals.filter(Boolean).length,
  };
})();
preview('PuzzleBoard', { group: 'Juegos', height: 440, subtitle: 'Conecta la red, desafío sin reloj' }, `<div class="tel-stage dark tel-col" style="align-items:center;width:330px"><div class="tel-row"><span class="rt-pill">${svgIcon('laptop', 16, colors.accent)} ${netBoard.online}/${netBoard.total} equipos</span><span class="rt-pill">${svgIcon('refresh', 16, colors.accent)} 7 giros</span></div>${netBoard.svg}<div class="tel-row" style="width:100%;flex-wrap:nowrap"><span class="tel-btn sm outlineLight" style="flex:1">${svgIcon('lightbulb')} Pista</span><span class="tel-btn sm outlineLight" style="flex:1">${svgIcon('refresh')} Reiniciar</span></div></div>`, routeCss);
readme('PuzzleBoard', `
Tablero de «Conecta la red», uno de los cuatro desafíos sin reloj (con «Parejas TEL», «Binario» y «Mensaje cifrado»). Cada casilla es una pieza de cable que gira 90° al tocarla. El servidor (círculo \`cream\` con borde \`accent\`) emite la señal: los cables y equipos que la reciben se encienden en \`accent\` y el resto queda en gris azulado sobre \`primaryDeep\`. Arriba van las píldoras de equipos en línea y giros; abajo, «Pista» (Rutix acomoda una pieza) y «Reiniciar». Tableros de 3×3 a 6×6 según el nivel, sin reloj ni vidas: el puntaje premia resolver con pocos giros. El estado no depende solo del color: el equipo conectado cambia de relleno y el lector de pantalla anuncia «con señal» o «sin señal».
`);

// ---------- Temas ----------
const themeCss = `.th-wrap{display:flex;gap:16px;padding:16px;background:var(--surfaceAlt);align-items:flex-start}
.th-phone{width:300px;border-radius:24px;overflow:hidden;background:var(--paper);color:var(--ink);border:1px solid var(--border);display:flex;flex-direction:column;font-family:var(--font-body)}
.th-body{padding:14px;display:flex;flex-direction:column;gap:10px}`;
const themePhone = (theme, label) => `<div class="th-phone" data-theme="${theme}">
<div class="tel-header" style="padding:14px 16px 16px"><span class="tel-overline">${label}</span><h2 class="tel-title" style="font-size:22px;line-height:28px">Hola, Cami</h2></div>
<div class="th-body"><div class="tel-card"><span class="tel-small" style="color:var(--inkAccent);letter-spacing:1.2px">DESAFÍO DE HOY</span><p class="tel-subtitle">5 microjuegos · bono +250</p><p class="tel-caption">Cada ronda parte cuando tú tocas.</p><div class="tel-bar"><span style="width:40%"></span></div><span class="tel-btn primary sm">Jugar ${svgIcon('arrowRight')}</span></div>
<div class="tel-row" style="gap:8px"><span class="tel-chip active">Sin apuro</span><span class="tel-chip">Tranquilo</span><span class="tel-chip">Normal</span></div>
<div class="tel-row" style="gap:8px"><span class="tel-tag success">Completada</span><span class="tel-tag sky">${svgIcon('clock', 13)} 8–12 min</span><span class="tel-tag warning">Racha 3 días</span></div></div>
${tabBar('width:auto')}</div>`;
preview('Themes', { group: 'Fundamentos', height: 520, subtitle: 'Tema claro y tema oscuro' }, `<div class="th-wrap">${themePhone('light', 'Tema claro')}${themePhone('dark', 'Tema oscuro')}</div>`, themeCss);
readme('Themes', `
Los dos temas de la app, lado a lado. Solo cambian los colores de superficie (\`paper\`, \`surface\`, \`surfaceAlt\`, \`border\`, \`highlight\`), el texto que va sobre ellos (\`ink\`, \`inkSoft\`, \`inkAccent\`), los estados suaves y la acción principal (\`action\` con \`actionInk\`: azul noche con texto crema en claro, celeste con texto azul noche en oscuro). Los colores de marca no cambian: las cabeceras y las pantallas de juego son azul noche en ambos temas. Regla: sobre una superficie del tema se escribe con \`ink\`, \`inkSoft\` o \`inkAccent\`; sobre un relleno de marca (\`cream\`, \`accent\`, color de pilar) con \`primary\` o \`secondary\`. El tema se elige en Ajustes («Sistema», «Claro», «Oscuro») y por defecto sigue al del sistema. Los chips de la muestra son el ajuste «Ritmo de los juegos»: sin apuro (por defecto), tranquilo, normal y rápido.
`);

// ---------- TEL Runner, tutoriales y guía de inicio ----------
const runnerSvg = (id, size) => drawingToSvg(runnerCharacterDrawing(id), { width: size });
const itemSvg = (kind, size) => drawingToSvg(runnerItemDrawing(kind), { width: size });
const runnerCss = `.rn-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;width:620px}
.rn-cell{display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 6px;border-radius:var(--radius-md);background:var(--primarySoft);border:1px solid rgba(167,212,237,.2);color:var(--cream);font-weight:800;font-size:13px;line-height:17px;text-align:center}
.rn-cell small{font-size:11px;line-height:15px;font-weight:700;color:var(--accentSoft)}
.rn-cell.on{background:var(--cream);border-color:var(--cream);color:var(--primary)}.rn-cell.on small{color:var(--secondary)}
.rn-hud{display:flex;align-items:center;justify-content:space-between;width:330px}
.rn-ctrl{display:flex;gap:8px;width:330px}
.rn-ctrl span{flex:1;min-height:56px;border-radius:var(--radius-md);background:var(--accent);color:var(--primary);display:flex;align-items:center;justify-content:center;gap:6px;font-family:var(--font-display);font-weight:700;font-size:16px}
.rn-ctrl span.wide{flex:1.5;background:var(--cream)}
.rn-items{display:flex;gap:18px;align-items:flex-end}
.rn-items div{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;font-weight:800;color:var(--accentSoft);width:74px;text-align:center}`;
preview('RunnerCharacters', { group: 'Juegos', height: 370, subtitle: 'Personajes telemáticos de TEL Runner' }, `<div class="tel-stage dark"><div class="rn-grid">${runnerCharacters.map((character, index) => `<div class="rn-cell${index === 0 ? ' on' : ''}">${runnerSvg(character.id, 78)}<span>${character.name}</span><small>${character.role}</small><small>${index === 0 ? 'En uso' : `${character.cost} paquetes`}</small></div>`).join('')}</div></div>`, runnerCss);
readme('RunnerCharacters', `
Personajes de TEL Runner. Cada uno es un equipo o concepto real de las redes y se desbloquea con paquetes de datos recogidos corriendo; nunca con dinero ni al azar. Todos comparten rasgos: ojos azul noche con brillo, sonrisa corta, mejillas suaves y una sombra elíptica debajo. Cada ficha muestra el dibujo, el nombre, qué es en una red de verdad, un dato para aprender y su ventaja en la carrera: ${runnerCharacters.map((character) => `**${character.name}** (${character.role.toLowerCase()}, ${character.cost === 0 ? 'inicial' : `${character.cost} paquetes`}): ${character.perk.replace(/\.$/, '').toLowerCase()}`).join('; ')}. El elegido va en una celda \`cream\`; los bloqueados se muestran atenuados con su precio. Sus colores son fijos: van sobre fondos azul noche.
`);

const trackScene = (() => {
  const width = 330;
  const height = 420;
  const cx = width / 2;
  const horizon = 24;
  const playerY = 330;
  const lane = 88;
  const depth = playerY - horizon;
  const at = (laneIndex, ahead) => {
    const eased = (1 - ahead / 24) ** 2;
    return { x: cx + (laneIndex - 1) * lane * (0.3 + 0.7 * eased), y: horizon + depth * eased, scale: 0.3 + 0.7 * eased };
  };
  const topHalf = 1.5 * lane * 0.3;
  const bottomHalf = 1.5 * lane * (0.3 + 0.7 * ((height - horizon) / depth));
  const nest = (svg, x, y, size) => svg.replace('<svg ', `<svg x="${(x - size / 2).toFixed(1)}" y="${(y - size * 0.92).toFixed(1)}" `).replace(/width="[^"]*" height="[^"]*"/, `width="${size.toFixed(1)}" height="${size.toFixed(1)}"`);
  let body = `<polygon points="${cx - topHalf},${horizon} ${cx + topHalf},${horizon} ${cx + bottomHalf},${height} ${cx - bottomHalf},${height}" fill="${colors.primaryDeep}"/>`;
  [-1, 1].forEach((side) => {
    body += `<line x1="${cx + side * topHalf}" y1="${horizon}" x2="${cx + side * bottomHalf}" y2="${height}" stroke="${colors.accent}" stroke-width="3" stroke-opacity=".8"/>`;
    body += `<line x1="${cx + (side * topHalf) / 3}" y1="${horizon}" x2="${cx + (side * bottomHalf) / 3}" y2="${height}" stroke="${colors.accentSoft}" stroke-width="2" stroke-opacity=".3" stroke-dasharray="10 12"/>`;
  });
  [['packet', 1, 20], ['packet', 1, 16], ['virus', 0, 14], ['packet', 1, 12], ['packet', 2, 8.5], ['cable', 0, 5.5], ['shield', 2, 4]].forEach(([kind, laneIndex, ahead]) => {
    const point = at(laneIndex, ahead);
    body += nest(itemSvg(kind, 100), point.x, point.y, 56 * point.scale);
  });
  const player = at(1, 0);
  body += `<ellipse cx="${player.x}" cy="${player.y - 3}" rx="30" ry="7" fill="#000" opacity=".3"/>${nest(runnerSvg('rutix', 100), player.x, player.y, 88)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
})();
const heartSvg = iconToSvg(icons.heartSolid, { size: 20, color: '#F4B8C4' });
preview('RunnerTrack', { group: 'Juegos', height: 600, subtitle: 'TEL Runner: pista, objetos y controles' }, `<div class="tel-stage dark tel-row" style="align-items:flex-start;gap:28px"><div class="tel-col" style="gap:8px"><div class="rn-hud"><span style="display:flex;gap:3px">${heartSvg}${heartSvg}${heartSvg}</span><span class="rt-pill">${svgIcon('route', 16, colors.accent)} 148 m</span><span class="rt-pill">${svgIcon('packet', 16, colors.accent)} 23</span><span class="tel-iconbtn dark" style="width:40px;height:40px">${svgIcon('pause', 20)}</span></div>${trackScene}<div class="rn-ctrl"><span>${svgIcon('chevronLeft', 28, 'currentColor', 2.6)}</span><span class="wide">${svgIcon('chevronUp', 28, 'currentColor', 2.6)} Saltar</span><span>${svgIcon('chevronRight', 28, 'currentColor', 2.6)}</span></div></div><div class="tel-col" style="gap:14px;width:300px"><span class="tel-overline">Objetos de la pista</span><div class="rn-items">${[['packet', 'Paquete de datos'], ['shield', 'Cortafuegos'], ['fiber', 'Rayo de fibra']].map(([kind, label]) => `<div>${itemSvg(kind, 60)}${label}</div>`).join('')}</div><div class="rn-items">${[['virus', 'Virus: se esquiva'], ['cable', 'Cable: se salta']].map(([kind, label]) => `<div>${itemSvg(kind, 60)}${label}</div>`).join('')}</div></div></div>`, `${routeCss}\n${runnerCss}`);
readme('RunnerTrack', `
Pantalla de juego de TEL Runner, la carrera sin fin por la «autopista de datos». Tres pistas en perspectiva (trapecio \`primaryDeep\` con bordes \`accent\` y divisiones punteadas) por las que se acercan los objetos; el personaje corre abajo. Arriba: vidas, metros, paquetes (la píldora se vuelve dorada con «×2» durante el rayo de fibra) y pausa. Abajo, tres botones grandes: izquierda y derecha en \`accent\`, «Saltar» en \`cream\`; también se juega deslizando el dedo o con las flechas del teclado. Objetos buenos: paquete de datos (suma), cortafuegos (protege de un golpe) y rayo de fibra (duplica los paquetes). Obstáculos: el virus es alto y solo se esquiva; el cable suelto es bajo y se puede saltar. Reglas de juego limpio: los virus nunca tapan las tres pistas, tras un obstáculo vienen filas libres y el rastro de paquetes siempre lleva a una pista segura. La velocidad sigue el ritmo elegido en Ajustes.
`);

const tutorialSample = tutorials.runner;
preview('TutorialSheet', { group: 'Juegos', height: 420, subtitle: 'Cómo se juega, paso a paso' }, `<div class="tel-stage dark" style="align-items:flex-end;padding:0"><div style="width:380px;border-radius:28px 28px 0 0;background:var(--primary);border:1px solid rgba(167,212,237,.2);border-bottom:0;padding:10px 20px 20px;display:flex;flex-direction:column;gap:12px"><span style="align-self:center;width:44px;height:5px;border-radius:3px;background:var(--secondary)"></span><div class="tel-row" style="flex-wrap:nowrap">${rutix({ expression: 'wink', pose: 'point', signal: 3 }, 76)}<div class="tel-col" style="gap:2px"><span class="tel-overline">Paso 2 de ${tutorialSample.steps.length}</span><span class="tel-subtitle" style="color:var(--cream);font-size:19px;line-height:25px">${tutorialSample.title}</span></div></div><div style="display:flex;gap:12px;align-items:flex-start;padding:16px;border-radius:var(--radius-lg);background:var(--cream);color:var(--primary);min-height:110px"><span style="flex:none;width:56px;height:56px;border-radius:28px;background:var(--accent);display:flex;align-items:center;justify-content:center">${svgIcon(tutorialSample.steps[1].icon, 30)}</span><div class="tel-col" style="gap:2px"><span class="tel-subtitle">${tutorialSample.steps[1].title}</span><span style="font-size:16px;line-height:24px">${tutorialSample.steps[1].text}</span></div></div><div style="display:flex;justify-content:center;gap:6px">${tutorialSample.steps.map((step, index) => `<span style="width:${index === 1 ? 24 : 8}px;height:8px;border-radius:4px;background:${index === 1 ? 'var(--cream)' : index < 1 ? 'var(--accent)' : 'var(--secondary)'}"></span>`).join('')}</div><div class="tel-row" style="flex-wrap:nowrap"><span class="tel-iconbtn dark" style="width:52px;height:52px">${svgIcon('chevronLeft', 24)}</span><span class="tel-btn accent" style="flex:1">Siguiente ${svgIcon('arrowRight')}</span></div><span style="text-align:center;color:var(--accentSoft);font-weight:700;font-size:14px">Saltar explicación</span></div></div>`);
readme('TutorialSheet', `
Tutorial «Cómo se juega». Se abre solo la primera vez que se entra a cada juego y después queda a un toque en el botón de ayuda (\`HelpButton\`, ícono \`help\`) de la cabecera. Una idea por paso: Rutix apuntando, «Paso N de M», una tarjeta \`cream\` con ícono en círculo \`accent\`, título y una o dos frases de menos de 140 caracteres; puntos de avance y botones «Siguiente» / «¡Entendido, a jugar!». Siempre se puede saltar. Hay tutoriales para: ${Object.values(tutorials).map((tutorial) => tutorial.title.replace(/^Cómo (se juega|funcionan?) (la |los |el )?/, '')).join(', ')}. Además, cada microjuego muestra antes de la ronda sus «pasos» numerados y, después, lo que se aprendió («Lo que aprendiste» / «Para la próxima»).
`);

preview('GuideCard', { group: 'Contenedores', height: 260, subtitle: 'Guía de inicio en la pantalla principal' }, `<div class="tel-stage"><div class="tel-card" style="width:360px"><div class="tel-row" style="flex-wrap:nowrap"><span style="flex:none;width:64px;height:64px;border-radius:32px;background:var(--primary);display:flex;align-items:center;justify-content:center">${rutix({ expression: 'wink', pose: 'point', signal: 3, shadow: false }, 54)}</span><div class="tel-col" style="gap:2px"><span class="tel-small" style="color:var(--inkAccent);letter-spacing:1.4px">GUÍA DE INICIO · 2 DE 6</span><p class="tel-subtitle">Corre en TEL Runner</p><p class="tel-caption">Junta paquetes de datos, esquiva virus y desbloquea personajes.</p></div></div><div style="display:flex;gap:8px">${[['check', 'done'], ['rocket', 'now'], ['network', ''], ['router', ''], ['robot', ''], ['check', 'done']].map(([icon, state]) => `<span style="flex:1;height:30px;border-radius:15px;display:flex;align-items:center;justify-content:center;background:${state === 'done' ? 'var(--success)' : state === 'now' ? 'var(--action)' : 'var(--surfaceAlt)'};color:${state === 'done' ? '#fff' : state === 'now' ? 'var(--actionInk)' : 'var(--inkSoft)'}">${svgIcon(icon, 14, 'currentColor', state === 'done' ? 3 : 2)}</span>`).join('')}</div><span class="tel-btn primary sm">Vamos ${svgIcon('arrowRight')}</span></div></div>`);
readme('GuideCard', `
Guía de inicio de la pantalla principal: los primeros seis pasos recomendados para quien abre SoyTEL por primera vez (una Ráfaga, TEL Runner, un desafío sin reloj, un juego de la ruta, Rutix y un área de la carrera). Rutix, dentro de un círculo \`primary\`, señala el siguiente paso con su título y una frase; debajo, una fila de píldoras muestra el avance: \`success\` con ✓ los pasos listos, \`action\` el actual y \`surfaceAlt\` los pendientes. El botón «Vamos» lleva directo al paso. Cada paso se marca solo al cumplirse y la tarjeta desaparece cuando están todos.
`);

// ---------- Libro de marca: secciones además del README ----------
const kitRows = kitPieces
  .map((item) => `| \`${kitGroups[item.group]}/${item.file}\` | ${item.width}×${item.height} | ${item.note || kitUses[item.file.replace(/\.png$/, '')] || ''} |`)
  .join('\n');
write(
  path.join(project, '10-logo-y-marca.md'),
  `# Logo y marca

SoyTEL usa dos elementos: el **emblema de Telemática USM** (la insignia con el notebook, que es de la carrera) y el **logotipo SoyTEL** («Soy» + «TEL» en Montserrat 800). Todas las versiones están en el grupo de activos Logos.

## Versiones

- \`soytel-lockup-horizontal-*\`: emblema + logotipo + lema. Es la versión principal para cabeceras, afiches y presentaciones.
- \`soytel-lockup-vertical-oscuro\`: para formatos cuadrados o altos (portadas, perfiles).
- \`soytel-wordmark-*\`: solo el logotipo, cuando el emblema ya aparece cerca o el espacio es muy angosto.
- \`rutix-sello\`: Rutix dentro de un círculo azul noche con anillo crema. Úsalo como avatar de redes sociales o sello de cierre; no reemplaza al emblema.
- Cada versión viene en \`oscuro\` (para fondos azul noche: «Soy» en \`cream\`, «TEL» en \`accent\`) y \`claro\` (para fondos claros: «Soy» en \`primary\`, «TEL» en \`secondary\`).

## Reglas

- El emblema nunca se redibuja, recolorea ni recorta: se usa el archivo tal cual, con esquinas redondeadas al 24 % cuando va como ícono de app.
- Zona de respeto: deja libre alrededor al menos la mitad del alto del emblema.
- Tamaño mínimo: 24 px de alto para el emblema solo y 120 px de ancho para el lockup horizontal.
- Fondos permitidos: \`primary\`, \`primaryDeep\`, el degradado azul noche, \`paper\`, \`cream\` y blanco. Sobre fotos, pon antes un velo \`overlay\`.
- El lema es «Mismas redes, un mejor mañana.», en Montserrat 600, siempre con punto final.
- No lo deformes, no le pongas sombra ni contorno, no cambies la tipografía y no escribas «SOYTEL» ni «Soy Tel»: es **SoyTEL**.
`,
);
write(
  path.join(project, '20-rutix-y-personajes.md'),
  `# Rutix y los personajes

## Rutix

Rutix es el robot-antena de SoyTEL: curioso, paciente y de buen humor. Explica antes de preguntar, celebra los aciertos y, cuando algo sale mal, anima a intentarlo otra vez.

- **Cómo habla**: en primera persona, frases de una línea, sin tecnicismos sin explicar. «Te doy una pista…», «¡Buena conexión!», «Casi. ¡Probemos de nuevo!». Nunca reta ni apura.
- **Qué expresión usar**: \`happy\` y \`wave\` para saludar; \`wink\` + \`point\` para pistas y tutoriales; \`proud\` + \`thumbsUp\` para aciertos; \`celebrate\` para logros; \`worried\` + \`shrug\` para errores; \`think\` para preguntas y pausas; \`alert\` cuando queda poco tiempo. \`sad\`, \`sleepy\` y \`sleep\` solo para su propia señal baja, nunca para culpar a quien juega.
- **Dónde va**: sus colores son fijos (cuerpo \`cream\`, pantalla \`primary\`), así que siempre sobre azul noche o dentro de un círculo \`primary\`. Máximo un Rutix por pantalla o pieza.
- **Guardarropa**: ${rutixWardrobe.filter((item) => item.id !== 'none').map((item) => item.label.toLowerCase()).join(', ')}. Los accesorios se ganan jugando; en piezas de comunicación usa el Rutix clásico, salvo que la pieza hable de ese logro.
- **Qué no hacer**: no lo gires ni lo recolorees, no le cambies las proporciones, no lo uses como patrón repetido y no le pongas texto en la pantalla (ahí va su cara).

## Personajes de TEL Runner

Son equipos e ideas reales de las redes; cada uno enseña algo: ${runnerCharacters.map((character) => `**${character.name}** (${character.role.toLowerCase()})`).join(', ')}. Comparten con Rutix los ojos azul noche con brillo, la sonrisa corta y la sombra elíptica. Úsalos juntos, en fila, para hablar de TEL Runner o de «todo lo que conecta una red»; por separado, siempre con su nombre y lo que son.

## Stickers

Las hojas \`stickers-rutix\` y \`stickers-personajes\` (grupo Impresos) están listas para imprimir y troquelar en círculos de unos 5 cm. Cada sticker lleva una frase corta de Rutix.
`,
);
write(
  path.join(project, '30-piezas-y-plantillas.md'),
  `# Piezas y plantillas

Piezas listas para usar, compuestas con los mismos tokens, fuentes y gráficos de la app. Se generan con \`npm run brand:kit\` (el HTML fuente de cada una queda junto a los PNG, por si hay que cambiar un texto).

| Archivo | Tamaño (px) | Para qué |
| --- | --- | --- |
${kitRows}

## Cómo componer una pieza nueva

- **Fondo**: degradado \`primaryDeep\` → \`primary\` → \`primarySoft\` con el patrón de estrellas y, si hay un punto de atención, las ondas de señal detrás.
- **Texto**: un kicker en mayúsculas espaciadas (\`accent\`), un titular en Montserrat 800 con una sola idea resaltada en \`accent\`, y como máximo dos líneas de apoyo en Nunito Sans.
- **Acción**: una sola, en una píldora \`cream\` (la dirección web o «Escanea y juega»).
- **Cierre**: emblema + logotipo + «Ingeniería Civil Telemática · USM» abajo a la izquierda.
- **QR**: siempre sobre una tarjeta blanca con esquinas redondeadas y la dirección escrita debajo, para quien no pueda escanear.
- En las piezas claras (diploma, stickers) el fondo es \`creamSoft\` o \`surfaceAlt\` y el texto \`primary\`.
`,
);

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
  const tiles = { Logos: 'l', Marca: 'l', Iconos: 'xs', Medallas: 's', Rutix: 'm', Runner: 'm', Ilustraciones: 'm', Ruta: 'm', Patrones: 'l', Social: 'l', Impresos: 'l', Presentacion: 'l' };
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
    lastChange: { by: 'Cristóbal Moraga', at: now, via: 'Claude Code', note: `SoyTEL 3.0: tema oscuro, Rutix v2 (${rutixExpressions.length} expresiones, ${rutixPoses.length} poses y guardarropa), TEL Runner con ${runnerCharacters.length} personajes, tutoriales paso a paso y kit de marca (${kitPieces.length} piezas: logos, redes sociales, impresos y presentación). Generado desde el código de la app.` },
  };
  write(path.join(project, 'design-system.json'), `${JSON.stringify(index, null, 2)}\n`);
}

const count = Object.values(assetFiles).reduce((total, names) => total + names.length, 0);
console.log(`Sistema escrito en ${outDir} · ${count} activos para subir`);
