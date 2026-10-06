import { rutixDrawing } from './rutix';
import { arcPath, circle, ellipse, line, path, rect, star4Path, type Drawing, type Shape } from './shapes';

// Personajes y objetos de TEL Runner. Colores fijos (viven sobre la pista azul noche en ambos temas).
const NAVY = '#0B2D45';
const BLUE = '#1E5B7F';
const SKY = '#6FB3D9';
const SKY_SOFT = '#A7D4ED';
const CREAM = '#F4ECD7';
const GOLD = '#F2CE63';
const WHITE = '#FFFFFF';

const eyes = (cx: number, cy: number, gap = 9, r = 3.4): Shape[] => [
  ellipse(cx - gap, cy, r, r * 1.25, { fill: NAVY }),
  ellipse(cx + gap, cy, r, r * 1.25, { fill: NAVY }),
  circle(cx - gap + 1.1, cy - 1.5, 1.1, { fill: WHITE }),
  circle(cx + gap + 1.1, cy - 1.5, 1.1, { fill: WHITE }),
];
const smile = (cx: number, cy: number, w = 6): Shape => path(`M${cx - w} ${cy}Q${cx} ${cy + w * 0.95} ${cx + w} ${cy}`, { fill: 'none', stroke: NAVY, sw: 2.2, cap: 'round' });
const cheeks = (cx: number, cy: number, gap: number, color: string): Shape[] => [circle(cx - gap, cy, 3, { fill: color, op: 0.55 }), circle(cx + gap, cy, 3, { fill: color, op: 0.55 })];
const shadow = (rx = 22): Shape => ellipse(50, 94, rx, 4, { fill: '#000000', op: 0.22 });
const stroke = (d: string, color: string, width: number): Shape => path(d, { fill: 'none', stroke: color, sw: width, cap: 'round', join: 'round' });

function paqui(): Shape[] {
  return [
    shadow(),
    rect(34, 78, 9, 14, 4.5, { fill: '#B98E22' }),
    rect(57, 78, 9, 14, 4.5, { fill: '#B98E22' }),
    circle(17, 56, 5.5, { fill: '#D9AE3C' }),
    circle(83, 56, 5.5, { fill: '#D9AE3C' }),
    rect(20, 24, 60, 58, 11, { fill: GOLD }),
    path('M20 40V35a11 11 0 0 1 11-11h38a11 11 0 0 1 11 11v5z', { fill: '#FBE9A8' }),
    rect(44, 24, 12, 16, 0, { fill: '#D9AE3C' }),
    stroke('M28 46h6M66 46h6', '#B98E22', 2),
    ...eyes(50, 56),
    ...cheeks(50, 62, 15, '#F29C6B'),
    smile(50, 64),
  ];
}

function routa(): Shape[] {
  return [
    shadow(26),
    stroke('M30 36 24 12', BLUE, 4),
    stroke('M70 36 76 12', BLUE, 4),
    circle(24, 11, 5, { fill: SKY }),
    circle(76, 11, 5, { fill: SKY }),
    stroke(arcPath(50, 30, 7, 215, 325), SKY_SOFT, 2.6),
    stroke(arcPath(50, 30, 13, 220, 320), SKY, 2.6),
    rect(29, 72, 10, 16, 5, { fill: BLUE }),
    rect(61, 72, 10, 16, 5, { fill: BLUE }),
    rect(12, 34, 76, 42, 15, { fill: '#7BC8A4' }),
    path('M12 52V49a15 15 0 0 1 15-15h46a15 15 0 0 1 15 15v3z', { fill: '#A9E0C4' }),
    ...eyes(50, 52, 10),
    ...cheeks(50, 58, 17, '#F4B8C4'),
    smile(50, 59),
    circle(26, 68, 2.4, { fill: GOLD }),
    circle(34, 68, 2.4, { fill: CREAM }),
    circle(74, 68, 2.4, { fill: SKY_SOFT }),
  ];
}

function fibri(): Shape[] {
  return [
    shadow(16),
    stroke('M35 60C27 72 31 82 24 92', '#F29C6B', 4.5),
    stroke('M46 66C42 78 48 84 43 94', GOLD, 4.5),
    stroke('M57 66C60 78 54 84 60 94', '#FFD98A', 4.5),
    stroke('M66 60C73 70 68 80 76 88', '#F29C6B', 4.5),
    circle(50, 42, 31, { fill: '#F29C6B', op: 0.28 }),
    circle(50, 42, 24, { fill: '#FFD98A' }),
    circle(42, 33, 8, { fill: '#FFF3D0', op: 0.9 }),
    ...eyes(50, 43),
    ...cheeks(50, 49, 14, '#F29C6B'),
    smile(50, 50),
    path(star4Path(84, 20, 7), { fill: '#FFF3D0' }),
    path(star4Path(15, 28, 4.5), { fill: GOLD }),
    path(star4Path(86, 62, 3.5), { fill: GOLD }),
  ];
}

function satelin(): Shape[] {
  const panel = (x: number): Shape[] => [
    rect(x, 38, 26, 24, 3, { fill: '#5B4BB0' }),
    stroke(`M${x + 9} 38v24M${x + 17.5} 38v24M${x} 50h26`, '#A98BE0', 1.4),
  ];
  return [
    shadow(16),
    path('M43 72 50 90 57 72Z', { fill: GOLD }),
    path('M46.5 72 50 82 53.5 72Z', { fill: '#FFF3D0' }),
    ...panel(3),
    ...panel(71),
    rect(28, 46, 8, 7, 0, { fill: '#C9B8F0' }),
    rect(64, 46, 8, 7, 0, { fill: '#C9B8F0' }),
    stroke('M50 22V11', '#C9B8F0', 3),
    circle(50, 9, 4, { fill: SKY }),
    path('M37 27Q50 12 63 27Z', { fill: CREAM }),
    rect(32, 26, 36, 48, 13, { fill: '#A98BE0' }),
    path('M32 44V39a13 13 0 0 1 13-13h10a13 13 0 0 1 13 13v5z', { fill: '#C9B8F0' }),
    ...eyes(50, 48, 8),
    ...cheeks(50, 54, 13, '#F4B8C4'),
    smile(50, 56, 5),
    circle(50, 66, 2.4, { fill: GOLD }),
  ];
}

function dronix(): Shape[] {
  return [
    shadow(20),
    stroke('M33 42 15 28', '#B85C86', 5),
    stroke('M67 42 85 28', '#B85C86', 5),
    ellipse(15, 24, 14, 3.6, { fill: CREAM, op: 0.92 }),
    ellipse(85, 24, 14, 3.6, { fill: CREAM, op: 0.92 }),
    circle(15, 25, 3.2, { fill: NAVY }),
    circle(85, 25, 3.2, { fill: NAVY }),
    stroke('M36 68 31 84M64 68 69 84M24 84h14M62 84h14', '#B85C86', 3.4),
    ellipse(50, 50, 27, 21, { fill: '#EE8FB3' }),
    ellipse(50, 57, 18, 10, { fill: '#F7C0D6' }),
    ...eyes(50, 45, 9),
    smile(50, 53, 5),
    circle(50, 67, 6, { fill: NAVY }),
    circle(50, 67, 2.6, { fill: SKY }),
  ];
}

function nubi(): Shape[] {
  return [
    shadow(20),
    rect(34, 76, 6, 11, 3, { fill: SKY }),
    rect(48, 80, 6, 11, 3, { fill: SKY_SOFT }),
    rect(62, 76, 6, 11, 3, { fill: SKY }),
    circle(31, 54, 17, { fill: SKY_SOFT }),
    circle(52, 42, 22, { fill: SKY_SOFT }),
    circle(72, 55, 15, { fill: SKY_SOFT }),
    rect(22, 54, 60, 18, 9, { fill: SKY_SOFT }),
    circle(31, 51, 15, { fill: '#EAF6FD' }),
    circle(52, 40, 20, { fill: '#EAF6FD' }),
    circle(71, 52, 13, { fill: '#EAF6FD' }),
    rect(24, 50, 56, 17, 8.5, { fill: '#EAF6FD' }),
    ...eyes(52, 51, 9),
    ...cheeks(52, 57, 15, '#F4B8C4'),
    smile(52, 58, 5.5),
  ];
}

const characterShapes: Record<string, () => Shape[]> = { paqui, routa, fibri, satelin, dronix, nubi };

export function runnerCharacterDrawing(id: string): Drawing {
  const build = characterShapes[id];
  if (!build) return rutixDrawing({ expression: 'happy', pose: 'idle', signal: 4 });
  return { w: 100, h: 100, shapes: build() };
}

function virus(): Shape[] {
  const spikes: Shape[] = [];
  for (let index = 0; index < 8; index += 1) {
    const angle = (index * Math.PI) / 4;
    const x = 30 + Math.cos(angle) * 23;
    const y = 30 + Math.sin(angle) * 23;
    spikes.push(line(30 + Math.cos(angle) * 14, 30 + Math.sin(angle) * 14, x, y, { stroke: '#B93A36', sw: 4, cap: 'round' }));
    spikes.push(circle(x, y, 3.2, { fill: '#E9706B' }));
  }
  return [
    ...spikes,
    circle(30, 30, 16, { fill: '#D9534F' }),
    circle(25, 24, 5, { fill: '#E9706B', op: 0.8 }),
    ellipse(24, 30, 3.6, 4.2, { fill: WHITE }),
    ellipse(36, 30, 3.6, 4.2, { fill: WHITE }),
    circle(24.6, 31, 1.9, { fill: NAVY }),
    circle(35.4, 31, 1.9, { fill: NAVY }),
    stroke('M19 23 27 26M41 23 33 26', NAVY, 2.4),
    stroke('M24 39 27 37 30 39 33 37 36 39', NAVY, 2),
  ];
}

const itemShapes: Record<string, () => Shape[]> = {
  packet: () => [
    path('M30 7 52 18 30 29 8 18Z', { fill: '#DCEEFA' }),
    path('M8 18 30 29V54L8 43Z', { fill: SKY }),
    path('M52 18 30 29V54L52 43Z', { fill: '#3E86B5' }),
    stroke('M19 15.5 41 26.5', CREAM, 2.2),
    path(star4Path(19, 38, 4), { fill: CREAM }),
  ],
  virus,
  cable: () => [
    stroke('M5 44C13 22 22 24 30 40 38 56 48 32 55 42', '#8A4514', 9.5),
    stroke('M5 44C13 22 22 24 30 40 38 56 48 32 55 42', '#E8833A', 6),
    path(star4Path(30, 17, 7.5), { fill: GOLD }),
    path(star4Path(45, 21, 4), { fill: '#FFF3D0' }),
    path(star4Path(16, 20, 3.5), { fill: '#FFF3D0' }),
  ],
  shield: () => [
    path('M30 5 51 13V30C51 42 42 51.5 30 56 18 51.5 9 42 9 30V13Z', { fill: SKY, stroke: CREAM, sw: 3, join: 'round' }),
    path('M30 11 45 17V30C45 39 39 46 30 49.5Z', { fill: '#8FC6E8' }),
    stroke('M21 30l6.5 6.5L40 23', NAVY, 4.4),
  ],
  fiber: () => [
    circle(30, 30, 25, { fill: GOLD, op: 0.22 }),
    path('M35 4 14 33H27L23 56 46 25H33Z', { fill: GOLD, stroke: '#FFF3D0', sw: 2.2, join: 'round' }),
  ],
};

export const runnerItemKinds = Object.keys(itemShapes);

export function runnerItemDrawing(kind: string): Drawing {
  return { w: 60, h: 60, shapes: (itemShapes[kind] ?? itemShapes.packet)() };
}
