import { arcPath, circle, ellipse, group, path, rect, star4Path, type Drawing, type Paint, type Shape } from './shapes';

// Equipos de red y dispositivos (router, switch, firewall…) como ilustraciones planas de la marca:
// cuerpo crema con contorno azul noche, pantallas y paneles azul noche, luces celestes y un toque
// de color propio por equipo. Todo en una grilla de 96×96 que se lee bien entre 40 y 96 px, sobre
// fondos oscuros (el contorno se funde con el fondo) y aceptable sobre fondos claros.
export type DeviceKind =
  | 'router'
  | 'switch'
  | 'firewall'
  | 'dns'
  | 'accessPoint'
  | 'server'
  | 'pc'
  | 'laptop'
  | 'phone'
  | 'internet'
  | 'printer'
  | 'camera'
  | 'fiber'
  | 'antenna'
  | 'cable';

export const deviceKinds: DeviceKind[] = [
  'router',
  'switch',
  'firewall',
  'dns',
  'accessPoint',
  'server',
  'pc',
  'laptop',
  'phone',
  'internet',
  'printer',
  'camera',
  'fiber',
  'antenna',
  'cable',
];

export const deviceLabels: Record<DeviceKind, string> = {
  router: 'Router',
  switch: 'Switch',
  firewall: 'Firewall',
  dns: 'Servidor DNS',
  accessPoint: 'Access point',
  server: 'Servidor',
  pc: 'Computador',
  laptop: 'Notebook',
  phone: 'Teléfono',
  internet: 'Internet',
  printer: 'Impresora',
  camera: 'Cámara',
  fiber: 'Fibra óptica',
  antenna: 'Antena',
  cable: 'Cable de red',
};

export const DEVICE_SIZE = 96;

const CREAM = '#F4ECD7';
const NAVY = '#0B2D45';

// ---------- color ----------
type Rgb = [number, number, number];

function parseHex(color: string): Rgb | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return null;
  const hex = match[1].length === 3 ? match[1].split('').map((c) => c + c).join('') : match[1];
  return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) as Rgb;
}

const toHex = (rgb: number[]): string =>
  `#${rgb.map((value) => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0')).join('')}`;

function rgbToHsl([red, green, blue]: Rgb): [number, number, number] {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const sector = Math.floor(h / 60) % 6;
  const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][sector];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

// Cambia la luminosidad de un color (delta entre -1 y 1) conservando el matiz.
function tone(hex: string, delta: number): string {
  const rgb = parseHex(hex) ?? parseHex(CREAM)!;
  const [h, s, l] = rgbToHsl(rgb);
  return toHex(hslToRgb(h, s, Math.max(0, Math.min(1, l + delta))));
}

function isLight([red, green, blue]: Rgb): boolean {
  const lin = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(red) + 0.7152 * lin(green) + 0.0722 * lin(blue) > 0.4;
}

export interface DevicePalette {
  // Cuerpo del equipo y sus sombras.
  body: string;
  shade: string;
  deep: string;
  light: string;
  // Contorno, trazos y paneles (pantallas, filas de puertos).
  outline: string;
  mark: string;
  panel: string;
  // Colores fijos de las luces y los acentos.
  sky: string;
  skySoft: string;
  skyDeep: string;
  gold: string;
  green: string;
  red: string;
  orange: string;
  violet: string;
}

// `color` es el color del cuerpo (crema por defecto, para fondos azul noche). Un cuerpo oscuro
// (por ejemplo el azul noche sobre un fondo claro) invierte los detalles: marcas crema y paneles más oscuros.
export function devicePalette(color: string = CREAM): DevicePalette {
  const rgb = parseHex(color) ?? (parseHex(CREAM) as Rgb);
  const body = toHex(rgb);
  const light = isLight(rgb);
  return {
    body,
    shade: tone(body, light ? -0.1 : -0.06),
    deep: tone(body, light ? -0.2 : -0.12),
    light: tone(body, light ? 0.06 : 0.14),
    outline: light ? NAVY : tone(body, -0.14),
    mark: light ? NAVY : CREAM,
    panel: light ? '#0E3654' : tone(body, -0.16),
    sky: '#6FB3D9',
    skySoft: '#A7D4ED',
    skyDeep: '#1E5B7F',
    gold: '#F2CE63',
    green: '#5FD3A2',
    red: '#FF6B5E',
    orange: '#E58A5A',
    violet: '#9B8AE6',
  };
}

// ---------- piezas comunes ----------
const f = (value: number) => Number(value.toFixed(2));

const line = (d: string, color: string, sw: number, extra: Paint = {}): Shape =>
  path(d, { fill: 'none', stroke: color, sw, cap: 'round', join: 'round', ...extra });
const dot = (cx: number, cy: number, r: number, color: string, extra: Paint = {}): Shape => circle(cx, cy, r, { fill: color, ...extra });
const shadow = (cx: number, cy: number, rx: number): Shape => ellipse(cx, cy, rx, 3.2, { fill: '#000000', op: 0.18 });
const spark = (cx: number, cy: number, r: number, color: string, op = 1): Shape => path(star4Path(cx, cy, r), { fill: color, op });

// Trazo grueso con contorno (cables, antenas, brazos).
function outlined(d: string, width: number, fill: string, p: DevicePalette): Shape[] {
  return [line(d, p.outline, width + 4.8), line(d, fill, width)];
}

// Banda inferior con las esquinas de abajo redondeadas (sombra del cuerpo).
function bottomBand(x: number, y0: number, w: number, y1: number, r: number): string {
  const rr = Math.max(0, Math.min(r, y1 - y0, w / 2));
  return `M${f(x)} ${f(y0)}H${f(x + w)}V${f(y1 - rr)}A${f(rr)} ${f(rr)} 0 0 1 ${f(x + w - rr)} ${f(y1)}H${f(x + rr)}A${f(rr)} ${f(rr)} 0 0 1 ${f(x)} ${f(y1 - rr)}Z`;
}

// Carcasa: relleno, sombra inferior, brillo superior y contorno.
function casing(x: number, y: number, w: number, h: number, r: number, p: DevicePalette, fill: string = p.body): Shape[] {
  const shade = fill === p.body ? p.shade : tone(fill, -0.1);
  return [
    rect(x, y, w, h, r, { fill }),
    path(bottomBand(x + 1.2, y + h * 0.62, w - 2.4, y + h - 1.2, r - 1.2), { fill: shade }),
    h >= 14 ? line(`M${f(x + r)} ${f(y + 3.6)}H${f(x + w - r)}`, p.light, 2, { op: 0.8 }) : rect(0, 0, 0, 0, 0, { fill: 'none' }),
    rect(x, y, w, h, r, { fill: 'none', stroke: p.outline, sw: 2.4 }),
  ];
}

// Señal Wi-Fi: punto y arcos hacia arriba.
function waves(cx: number, cy: number, radii: number[], color: string, sw: number, start = 228, end = 312): Shape[] {
  return radii.map((r, index) => line(arcPath(cx, cy, r, start, end), color, sw, { op: 1 - index * 0.2 }));
}

// ---------- equipos ----------
function router(p: DevicePalette): Shape[] {
  const antenna = (x1: number, y1: number, x2: number, y2: number): Shape[] => [
    ...outlined(`M${x1} ${y1}L${x2} ${y2}`, 7, p.body, p),
    line(`M${f(x2 + (x1 - x2) * 0.2)} ${f(y2 + (y1 - y2) * 0.2)}L${x2} ${y2}`, p.sky, 6),
  ];
  return [
    shadow(48, 89, 38),
    ...antenna(27, 58, 17, 17),
    ...antenna(69, 58, 79, 17),
    ...casing(8, 52, 80, 32, 10, p),
    dot(22, 68, 2.6, p.sky),
    dot(31, 68, 2.6, p.green),
    dot(40, 68, 2.6, p.gold),
    rect(52, 60, 28, 16, 5, { fill: p.panel }),
    ...[0, 1, 2, 3].map((index) => rect(54.4 + index * 6.5, 64.6, 4.2, 6.8, 1.2, { fill: p.skySoft })),
    dot(48, 46, 3, p.sky),
    ...waves(48, 46, [9, 17, 25], p.sky, 3.4),
  ];
}

function networkSwitch(p: DevicePalette): Shape[] {
  const ports = [0, 1, 2, 3, 4, 5, 6, 7];
  const cable = (x: number, color: string, endX: number): Shape[] => [
    ...outlined(`M${x} 55V68C${x} 79 ${f((x + endX) / 2)} 82 ${endX} 91`, 4.4, color, p),
    rect(x - 3.4, 49.5, 6.8, 9, 1.6, { fill: p.light, stroke: p.outline, sw: 1.8 }),
  ];
  return [
    shadow(48, 90, 42),
    rect(14, 69, 12, 5, 2, { fill: p.outline }),
    rect(70, 69, 12, 5, 2, { fill: p.outline }),
    ...casing(6, 32, 84, 38, 8, p),
    rect(11, 37, 74, 26, 4, { fill: p.panel }),
    ...ports.map((index) => dot(18 + index * 8.4, 42.2, 1.4, index % 3 === 1 ? p.gold : p.green)),
    ...ports.map((index) => rect(15.2 + index * 8.4, 46.5, 5.6, 8.6, 1.4, { fill: p.skySoft })),
    line('M15 59h22', p.skyDeep, 2, { op: 0.9 }),
    line('M44 59h8', p.skyDeep, 2, { op: 0.9 }),
    ...cable(34.8, p.sky, 24),
    ...cable(60, p.gold, 72),
  ];
}

function firewall(p: DevicePalette): Shape[] {
  const wall = p.orange;
  const mortar = '#B8623A';
  return [
    shadow(48, 89, 41),
    rect(8, 46, 80, 40, 5, { fill: wall }),
    path(bottomBand(9.2, 72, 77.6, 84.8, 4), { fill: tone(wall, -0.08) }),
    line('M8 59.3H88', mortar, 2.4),
    line('M8 72.6H88', mortar, 2.4),
    line('M30 46V59.3M58 46V59.3', mortar, 2.4),
    line('M16 59.3V72.6M44 59.3V72.6M72 59.3V72.6', mortar, 2.4),
    line('M30 72.6V86M58 72.6V86', mortar, 2.4),
    line('M13 50H83', tone(wall, 0.16), 2, { op: 0.8 }),
    rect(8, 46, 80, 40, 5, { fill: 'none', stroke: p.outline, sw: 2.4 }),
    // Llama: roja por fuera, dorada por dentro y un núcleo claro.
    path('M48 49C36 49 29 41 30 32C30.6 26 34 22.5 36.5 17C38.5 21 41 23 43.5 23.5C42.5 16 45 9 51 4C53 13 59 19 62 28C65 37 59 49 48 49Z', { fill: '#F26B4F' }),
    path('M48 49C41 49 38 43 39.5 37C40.5 39 42.5 39.5 44 38C44 34 46 31 49 27C53 32 57 37 56.5 42C56 46.5 52.5 49 48 49Z', { fill: p.gold }),
    path('M48 49C44.5 49 43 46 44.2 43C45.5 44 47 43.5 47.5 42C50 44 52.5 46 51.5 47.5C50.8 48.5 49.5 49 48 49Z', { fill: '#FFF3D0' }),
    spark(74, 22, 5, p.gold),
    spark(21, 30, 4, p.gold, 0.9),
    dot(80, 36, 1.8, p.gold, { op: 0.9 }),
  ];
}

function dns(p: DevicePalette): Shape[] {
  const unit = (y: number, led: string): Shape[] => [
    ...casing(8, y, 54, 23, 6, p),
    rect(13, y + 4.5, 44, 14, 3, { fill: p.panel }),
    dot(19.5, y + 11.5, 2.4, led),
    line(`M28 ${y + 9.2}h22`, p.skySoft, 2.2),
    line(`M28 ${y + 14}h14`, p.skySoft, 2.2, { op: 0.7 }),
  ];
  return [
    shadow(44, 90, 38),
    ...unit(62, p.green),
    ...unit(36, p.gold),
    // Globo con continentes: el nombre se traduce a una dirección.
    circle(66, 32, 22, { fill: p.sky, stroke: p.outline, sw: 2.4 }),
    path('M52 24c3-5 10-6 13-2 2 3-1 5-4 6-3 1-2 5-5 5-3 0-6-4-4-9z', { fill: CREAM }),
    path('M70 30c5-3 11 0 12 5 1 5-4 8-8 8-4 0-5-4-6-6-1-3-1-5 2-7z', { fill: CREAM }),
    path('M58 44c3-1 7 1 6 5-1 3-5 4-7 2-2-2-2-6 1-7z', { fill: CREAM }),
    ellipse(66, 32, 9, 22, { fill: 'none', stroke: p.skyDeep, sw: 1.6, op: 0.55 }),
    line('M44.5 32h43', p.skyDeep, 1.6, { op: 0.55 }),
    line('M52 18a19 19 0 0 1 9-6', '#FFFFFF', 3, { op: 0.55 }),
    spark(84, 10, 4, p.skySoft),
  ];
}

function accessPoint(p: DevicePalette): Shape[] {
  return [
    shadow(48, 88, 36),
    // Disco de techo: lateral, tapa y anillo con su luz central.
    path('M14 62V71A34 12 0 0 0 82 71V62Z', { fill: p.shade, stroke: p.outline, sw: 2.4, join: 'round' }),
    ellipse(48, 62, 34, 12, { fill: p.body, stroke: p.outline, sw: 2.4 }),
    ellipse(48, 62, 22, 7.5, { fill: p.deep }),
    circle(48, 62, 6.4, { fill: p.sky, op: 0.35 }),
    circle(48, 62, 3.4, { fill: p.sky }),
    circle(47, 60.8, 1.1, { fill: '#FFFFFF', op: 0.9 }),
    dot(70, 63, 1.8, p.green),
    ...waves(48, 52, [14, 25, 36], p.sky, 4),
  ];
}

function server(p: DevicePalette): Shape[] {
  const leds = [p.green, p.sky, p.gold];
  const unit = (index: number): Shape[] => {
    const y = 8 + index * 26.5;
    return [
      ...casing(16, y, 64, 23, 6, p),
      rect(21, y + 4.5, 54, 14, 3, { fill: p.panel }),
      dot(28, y + 11.5, 2.4, leds[index]),
      line(`M38 ${y + 9.2}h26`, p.skySoft, 2.2),
      line(`M38 ${y + 14}h16`, p.skySoft, 2.2, { op: 0.7 }),
      dot(69, y + 11.5, 2.6, p.sky, { op: 0.85 }),
    ];
  };
  return [
    shadow(48, 91, 32),
    rect(23, 84, 10, 5, 2, { fill: p.outline }),
    rect(63, 84, 10, 5, 2, { fill: p.outline }),
    ...[0, 1, 2].flatMap(unit),
  ];
}

function pc(p: DevicePalette): Shape[] {
  return [
    shadow(48, 91, 42),
    // Torre.
    ...casing(74, 24, 17, 58, 5, p),
    rect(77.5, 30, 10, 3, 1.5, { fill: p.panel }),
    rect(77.5, 36, 10, 3, 1.5, { fill: p.panel }),
    dot(82.5, 71, 3, p.green),
    circle(82.5, 76.5, 2.4, { fill: p.deep }),
    // Pie y monitor.
    rect(30, 60, 14, 12, 0, { fill: p.shade, stroke: p.outline, sw: 2.4 }),
    rect(20, 70, 34, 6, 3, { fill: p.body, stroke: p.outline, sw: 2.4 }),
    ...casing(5, 8, 66, 54, 7, p),
    rect(10, 13, 56, 40, 3, { fill: p.panel }),
    line('M16 20h18', p.sky, 3),
    line('M16 27h30', p.skySoft, 2.4, { op: 0.9 }),
    line('M16 33h22', p.skySoft, 2.4, { op: 0.6 }),
    rect(44, 33, 16, 14, 3, { fill: p.sky }),
    spark(52, 40, 4, '#FFFFFF', 0.9),
    // Teclado.
    ...casing(6, 80, 56, 9, 4, p),
    line('M12 84.6h44', p.outline, 2.4, { dash: '3.2 2.6', op: 0.55 }),
  ];
}

function laptop(p: DevicePalette): Shape[] {
  return [
    shadow(48, 88, 42),
    ...casing(15, 10, 66, 50, 7, p),
    rect(20, 15, 56, 40, 3, { fill: p.panel }),
    dot(48, 48, 2.8, p.sky),
    ...waves(48, 48, [9, 16, 23], p.skySoft, 3.2),
    spark(28, 24, 3.4, p.skySoft, 0.9),
    path('M7 63H89L84 76A5 5 0 0 1 79.3 79.3H16.7A5 5 0 0 1 12 76Z', { fill: p.body, stroke: p.outline, sw: 2.4, join: 'round' }),
    path('M9.5 71H86.5L84 76A5 5 0 0 1 79.3 79.3H16.7A5 5 0 0 1 12 76Z', { fill: p.shade }),
    path('M7 63H89L84 76A5 5 0 0 1 79.3 79.3H16.7A5 5 0 0 1 12 76Z', { fill: 'none', stroke: p.outline, sw: 2.4, join: 'round' }),
    rect(37, 63, 22, 4.4, 2.2, { fill: p.deep, stroke: p.outline, sw: 1.6 }),
  ];
}

function phone(p: DevicePalette): Shape[] {
  return [
    shadow(48, 91, 24),
    ...casing(29, 6, 38, 84, 10, p),
    rect(34, 14, 28, 62, 4, { fill: p.panel }),
    rect(41, 9.2, 14, 2.6, 1.3, { fill: p.outline }),
    rect(40, 81.4, 16, 2.8, 1.4, { fill: p.outline }),
    ...waves(48, 31, [5, 10, 15], p.sky, 3, 225, 315),
    dot(48, 31, 2, p.sky),
    rect(38, 42, 20, 10, 4, { fill: p.sky }),
    rect(38, 56, 20, 10, 4, { fill: p.skySoft }),
    line('M42 47h8', p.skyDeep, 2.4),
    line('M46 61h8', p.skyDeep, 2.4),
  ];
}

function internet(p: DevicePalette): Shape[] {
  const ring = (d: string): Shape[] => [line(d, p.outline, 6.6), line(d, p.body, 3.4)];
  const orbit = 'M3 48A45 15 0 0 1 93 48A45 15 0 0 1 3 48Z';
  const front = 'M3 48A45 15 0 0 0 93 48';
  return [
    shadow(48, 91, 30),
    group([...ring(orbit), dot(77, 36.5, 3.6, p.sky, { stroke: p.outline, sw: 1.8 })], { tf: 'rotate(-24 48 48)' }),
    circle(48, 48, 28, { fill: p.sky, stroke: p.outline, sw: 2.4 }),
    path('M27 41c2-9 13-13 20-8 4 3-1 8-6 9-4 1-4 6-8 7-4 1-8-2-6-8z', { fill: CREAM }),
    path('M55 45c6-5 16-1 18 6 2 8-5 13-11 13-6 0-8-5-10-9-2-4-1-8 3-10z', { fill: CREAM }),
    path('M33 62c4-3 10-1 10 4 0 4-5 7-9 5-3-2-4-7-1-9z', { fill: CREAM }),
    ellipse(48, 48, 11, 28, { fill: 'none', stroke: p.skyDeep, sw: 1.8, op: 0.5 }),
    line('M21 48H75', p.skyDeep, 1.8, { op: 0.5 }),
    line('M29 32a24 24 0 0 1 12-9', '#FFFFFF', 3.2, { op: 0.55 }),
    group([...ring(front), dot(85, 57, 4, p.gold, { stroke: p.outline, sw: 1.8 }), dot(11, 56, 3.6, p.green, { stroke: p.outline, sw: 1.8 })], { tf: 'rotate(-24 48 48)' }),
    spark(82, 16, 4.4, p.skySoft),
    spark(14, 20, 3.4, p.skySoft, 0.85),
  ];
}

function printer(p: DevicePalette): Shape[] {
  return [
    shadow(48, 91, 40),
    // Hoja que entra (atrás) y hoja que sale (adelante).
    rect(27, 8, 42, 36, 2.5, { fill: p.light, stroke: p.outline, sw: 2.4 }),
    line('M33 17h30', p.skyDeep, 2.2, { op: 0.6 }),
    line('M33 23h22', p.skyDeep, 2.2, { op: 0.6 }),
    line('M33 29h26', p.skyDeep, 2.2, { op: 0.6 }),
    rect(24, 62, 48, 28, 2.5, { fill: p.light, stroke: p.outline, sw: 2.4 }),
    line('M30 78h36', p.skyDeep, 2.2, { op: 0.6 }),
    line('M30 84h22', p.skyDeep, 2.2, { op: 0.6 }),
    ...casing(7, 36, 82, 36, 9, p),
    rect(16, 43, 64, 6, 3, { fill: p.panel }),
    rect(61, 54, 20, 11, 3, { fill: p.panel }),
    dot(67, 59.5, 2.1, p.green),
    dot(74, 59.5, 2.1, p.sky),
    circle(20, 59.5, 3.2, { fill: p.deep, stroke: p.outline, sw: 1.6 }),
    circle(30, 59.5, 3.2, { fill: p.deep, stroke: p.outline, sw: 1.6 }),
  ];
}

function camera(p: DevicePalette): Shape[] {
  return [
    shadow(48, 91, 34),
    rect(6, 22, 11, 54, 3, { fill: p.shade, stroke: p.outline, sw: 2.4 }),
    dot(11.5, 31, 1.6, p.outline),
    dot(11.5, 67, 1.6, p.outline),
    ...outlined('M17 49H36', 9, p.body, p),
    group(
      [
        rect(27, 27, 54, 9, 4.5, { fill: p.shade, stroke: p.outline, sw: 2.4 }),
        ...casing(24, 33, 58, 28, 11, p),
        dot(33, 47, 2.6, p.red),
        ellipse(82, 47, 7, 14, { fill: p.panel, stroke: p.outline, sw: 2.4 }),
        ellipse(82.6, 47, 3.8, 8.6, { fill: p.skyDeep }),
        circle(81.6, 43, 1.8, { fill: '#FFFFFF', op: 0.85 }),
      ],
      { tf: 'rotate(8 56 47)' },
    ),
    spark(80, 20, 3.6, p.skySoft, 0.9),
  ];
}

function fiber(p: DevicePalette): Shape[] {
  const strands: [string, string, number, number][] = [
    ['M48 54C46 40 24 38 17 21', p.sky, 17, 21],
    ['M48 54C47 42 36 31 33 13', p.orange, 33, 13],
    ['M48 54C48 40 48 24 48 8', p.green, 48, 8],
    ['M48 54C49 42 60 31 63 13', p.gold, 63, 13],
    ['M48 54C50 40 72 38 79 21', p.violet, 79, 21],
  ];
  return [
    shadow(48, 91, 22),
    ...strands.map(([d, color]) => line(d, color, 3.4)),
    ...strands.flatMap(([, color, x, y]) => [circle(x, y, 7, { fill: color, op: 0.28 }), circle(x, y, 3.6, { fill: color }), circle(x - 0.8, y - 0.8, 1.3, { fill: '#FFFFFF', op: 0.9 })]),
    // Conector: ferrule, cuello y cubierta amarilla del cable.
    rect(43, 50, 10, 9, 2, { fill: p.deep, stroke: p.outline, sw: 2 }),
    ...casing(32, 56, 32, 11, 4, p),
    ...casing(37, 65, 22, 26, 7, p, p.gold),
    line('M42 72v14', tone(p.gold, -0.18), 2, { op: 0.8 }),
    spark(30, 34, 3.4, '#FFFFFF', 0.8),
  ];
}

function antenna(p: DevicePalette): Shape[] {
  return [
    shadow(48, 91, 30),
    // Torre de celosía: triángulo con arriostres.
    path('M48 28L72 88H24Z', { fill: p.body, stroke: p.outline, sw: 2.4, join: 'round' }),
    path('M24 88H72L64 68H32Z', { fill: p.shade }),
    path('M48 28L72 88H24Z', { fill: 'none', stroke: p.outline, sw: 2.4, join: 'round' }),
    line('M40.6 49H55.4', p.mark, 2.4),
    line('M33.6 66H62.4', p.mark, 2.4),
    line('M40.6 49L62.4 66M55.4 49L33.6 66', p.mark, 2.4),
    line('M33.6 66L66.8 83M62.4 66L29.2 83', p.mark, 2.4, { op: 0.0 }),
    line('M29 78H67', p.mark, 2.4),
    ...outlined('M48 28V16', 3.6, p.body, p),
    circle(48, 13, 5.2, { fill: p.gold, stroke: p.outline, sw: 2 }),
    ...[14, 25].flatMap((r, index) => [
      line(arcPath(48, 13, r, 140, 220), p.sky, 3.6, { op: 1 - index * 0.3 }),
      line(arcPath(48, 13, r, -40, 40), p.sky, 3.6, { op: 1 - index * 0.3 }),
    ]),
  ];
}

function cable(p: DevicePalette): Shape[] {
  const wire = 'M8 90C6 66 36 78 40 58C43 44 54 44 61 39';
  const contacts = [-7, -5, -3, -1, 1, 3, 5, 7].map((x) => line(`M${x} -29V-20`, p.gold, 1.5));
  return [
    shadow(44, 92, 34),
    ...outlined(wire, 8.5, p.sky, p),
    line('M8 90C6 66 36 78 40 58C43 44 54 44 61 39', p.skySoft, 2, { op: 0.55, tf: 'translate(-1.6 -1.6)' }),
    // Conector RJ45 girado hacia arriba a la derecha.
    group(
      [
        rect(-8, -6, 16, 14, 4, { fill: p.sky, stroke: p.outline, sw: 2.4 }),
        rect(-10, -30, 20, 26, 3, { fill: p.light, stroke: p.outline, sw: 2.4 }),
        ...contacts,
        rect(-5, -34, 10, 6, 1.6, { fill: p.light, stroke: p.outline, sw: 2 }),
        line('M-6 -14H6', p.skyDeep, 2, { op: 0.5 }),
      ],
      { tf: 'translate(64 38) rotate(40)' },
    ),
    spark(20, 30, 4, p.skySoft, 0.9),
  ];
}

const builders: Record<DeviceKind, (palette: DevicePalette) => Shape[]> = {
  router,
  switch: networkSwitch,
  firewall,
  dns,
  accessPoint,
  server,
  pc,
  laptop,
  phone,
  internet,
  printer,
  camera,
  fiber,
  antenna,
  cable,
};

export function deviceDrawing(kind: DeviceKind, color?: string): Drawing {
  return { w: DEVICE_SIZE, h: DEVICE_SIZE, shapes: builders[kind](devicePalette(color)) };
}
