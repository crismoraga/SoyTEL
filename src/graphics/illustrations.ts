import { arcPath, circle, ellipse, group, line, path, rect, star4Path, star5Path, type Drawing, type Shape } from './shapes';

// Ilustraciones "spot" en el estilo de la hoja "Ilustraciones rápidas": formas planas,
// fondo en mancha suave, estrellas de cuatro puntas. Se generan desde una paleta para
// poder usarlas sobre fondos claros u oscuros.
export interface IllustrationPalette {
  bg: string;
  deep: string;
  mid: string;
  accent: string;
  soft: string;
  cream: string;
  screen: string;
}

export const illustrationPalettes: Record<'light' | 'dark', IllustrationPalette> = {
  light: { bg: '#DCEBF6', deep: '#0B2D45', mid: '#1E5B7F', accent: '#6FB3D9', soft: '#A7D4ED', cream: '#F4ECD7', screen: '#123D5C' },
  dark: { bg: '#123D5C', deep: '#071F31', mid: '#1E5B7F', accent: '#6FB3D9', soft: '#A7D4ED', cream: '#F4ECD7', screen: '#0B2D45' },
};

const W = 240;
const H = 200;

const blob = (color: string): Shape =>
  path('M38 152C16 122 22 70 60 49c30-16 57-5 85-13 36-10 69 16 71 56 2 37-12 68-46 78-38 11-106 16-132-18Z', { fill: color });

const sparkle = (x: number, y: number, r: number, color: string, op = 1): Shape => path(star4Path(x, y, r), { fill: color, op });

function packetShape(x: number, y: number, s: number, p: IllustrationPalette): Shape[] {
  const h = s / 2;
  return [
    path(`M${x} ${y - h}L${x + s} ${y}L${x} ${y + h}L${x - s} ${y}Z`, { fill: p.cream }),
    path(`M${x - s} ${y}L${x} ${y + h}V${y + h + s}L${x - s} ${y + s}Z`, { fill: p.soft }),
    path(`M${x + s} ${y}L${x} ${y + h}V${y + h + s}L${x + s} ${y + s}Z`, { fill: p.accent }),
  ];
}

function pinShape(x: number, y: number, s: number, fill: string, hole: string): Shape[] {
  return [
    path(`M${x} ${y}c-${s * 0.9} -${s * 1.1} -${s * 1.6} -${s * 1.9} -${s * 1.6} -${s * 2.8}a${s * 1.6} ${s * 1.6} 0 0 1 ${s * 3.2} 0c0 ${s * 0.9} -${s * 0.7} ${s * 1.7} -${s * 1.6} ${s * 2.8}Z`, { fill }),
    circle(x, y - s * 2.8, s * 0.62, { fill: hole }),
  ];
}

function connect(p: IllustrationPalette): Shape[] {
  const keys: Shape[] = [];
  for (let index = 0; index < 10; index += 1) {
    keys.push(rect(69 + index * 10.4, 136, 7, 3.6, 1, { fill: p.deep, op: 0.3 }));
    if (index < 9) keys.push(rect(74 + index * 10.4, 142.5, 7, 3.6, 1, { fill: p.deep, op: 0.3 }));
  }
  return [
    blob(p.bg),
    sparkle(40, 42, 8, p.deep),
    sparkle(206, 58, 6, p.mid),
    sparkle(198, 150, 5, p.accent),
    sparkle(30, 148, 4, p.deep, 0.8),
    circle(58, 26, 2.4, { fill: p.accent }),
    circle(186, 30, 2, { fill: p.deep }),
    ellipse(120, 160, 72, 6, { fill: p.deep, op: 0.14 }),
    rect(62, 50, 116, 82, 10, { fill: p.deep }),
    rect(70, 58, 100, 66, 5, { fill: p.screen }),
    rect(80, 68, 40, 5, 2.5, { fill: p.cream }),
    rect(80, 78, 28, 5, 2.5, { fill: p.cream, op: 0.8 }),
    rect(80, 88, 36, 5, 2.5, { fill: p.cream, op: 0.55 }),
    path('M140 79v-6a8 8 0 0 1 16 0v6', { fill: 'none', stroke: p.cream, sw: 4, cap: 'round' }),
    rect(136, 78, 24, 19, 4, { fill: p.cream }),
    circle(148, 86, 2.6, { fill: p.deep }),
    rect(146.8, 86, 2.4, 6, 1.2, { fill: p.deep }),
    circle(92, 104, 3, { fill: p.cream }),
    path('M92 106 86.5 119h11Z', { fill: p.cream }),
    path('M85.5 98.5a9 9 0 0 0 0 12', { fill: 'none', stroke: p.accent, sw: 2.5, cap: 'round' }),
    path('M98.5 98.5a9 9 0 0 1 0 12', { fill: 'none', stroke: p.accent, sw: 2.5, cap: 'round' }),
    path('M80.5 94a15 15 0 0 0 0 21', { fill: 'none', stroke: p.accent, sw: 2.5, cap: 'round', op: 0.7 }),
    path('M103.5 94a15 15 0 0 1 0 21', { fill: 'none', stroke: p.accent, sw: 2.5, cap: 'round', op: 0.7 }),
    rect(134, 110, 5, 10, 1.2, { fill: p.accent }),
    rect(142, 105, 5, 15, 1.2, { fill: p.accent }),
    rect(150, 99, 5, 21, 1.2, { fill: p.accent }),
    rect(158, 93, 5, 27, 1.2, { fill: p.soft }),
    path('M50 132h140l-10 18H60Z', { fill: p.cream }),
    ...keys,
    rect(108, 147, 24, 2.6, 1.3, { fill: p.mid, op: 0.45 }),
  ];
}

function burst(p: IllustrationPalette): Shape[] {
  return [
    blob(p.bg),
    sparkle(36, 40, 7, p.deep),
    sparkle(214, 96, 5, p.accent),
    sparkle(58, 170, 4, p.mid),
    path('M36 92h26', { stroke: p.accent, sw: 3.5, cap: 'round', op: 0.8 }),
    path('M28 102h24', { stroke: p.accent, sw: 3.5, cap: 'round', op: 0.55 }),
    path('M182 152h26', { stroke: p.accent, sw: 3.5, cap: 'round', op: 0.8 }),
    path('M190 162h20', { stroke: p.accent, sw: 3.5, cap: 'round', op: 0.55 }),
    ellipse(120, 176, 46, 5, { fill: p.deep, op: 0.14 }),
    rect(86, 32, 68, 138, 14, { fill: p.deep }),
    rect(92, 44, 56, 114, 8, { fill: p.mid }),
    rect(110, 37, 20, 3, 1.5, { fill: p.accent, op: 0.6 }),
    path('M127 56 104 101h15l-6 41 26-50h-16Z', { fill: p.cream }),
    ...packetShape(52, 62, 12, p),
    ...packetShape(66, 128, 9, p),
    ...packetShape(194, 118, 10, p),
    circle(176, 56, 21, { fill: p.cream, stroke: p.deep, sw: 4 }),
    path(arcPath(176, 56, 14, -90, 140), { fill: 'none', stroke: p.accent, sw: 4, cap: 'round' }),
    path('M176 56V45', { stroke: p.deep, sw: 3, cap: 'round' }),
    path('M176 56l7 4', { stroke: p.deep, sw: 3, cap: 'round' }),
    rect(172, 30, 8, 5, 1.5, { fill: p.deep }),
  ];
}

function campus(p: IllustrationPalette): Shape[] {
  const windows: Shape[] = [];
  for (let index = 0; index < 5; index += 1) {
    const lit = index === 1 || index === 3;
    windows.push(rect(80 + index * 12, 114, 6, 11, 3, { fill: lit ? p.accent : p.deep }));
    windows.push(rect(80 + index * 12, 131, 6, 9, 3, { fill: index === 2 ? p.soft : p.deep }));
  }
  const crenels: Shape[] = [];
  for (let index = 0; index < 7; index += 1) crenels.push(rect(72 + index * 10, 99, 6, 6, 1, { fill: p.cream }));
  return [
    rect(20, 24, 200, 160, 24, { fill: 'url(#illu-night)' }),
    circle(184, 52, 12, { fill: p.cream, op: 0.95 }),
    circle(188.5, 48.5, 3, { fill: p.soft, op: 0.5 }),
    sparkle(58, 60, 6, p.cream),
    sparkle(146, 42, 4, p.cream, 0.8),
    sparkle(206, 90, 3.5, p.soft),
    circle(96, 52, 1.6, { fill: p.cream }),
    circle(120, 66, 1.3, { fill: p.soft }),
    circle(76, 80, 1.3, { fill: p.cream, op: 0.7 }),
    path('M20 150c40-30 90-38 130-26 30 9 50 6 70-2v40H20Z', { fill: p.mid }),
    rect(70, 104, 76, 44, 2, { fill: p.cream }),
    ...crenels,
    ...windows,
    rect(58, 92, 16, 56, 2, { fill: p.cream }),
    path('M56 92h20l-10-13Z', { fill: p.mid }),
    rect(63, 104, 6, 12, 3, { fill: p.deep }),
    rect(140, 64, 24, 84, 2, { fill: p.cream }),
    path('M137 64h30l-15-21Z', { fill: p.mid }),
    circle(152, 78, 5.5, { fill: p.deep }),
    path('M152 78v-3.5M152 78l2.6 1.6', { stroke: p.cream, sw: 1.4, cap: 'round' }),
    rect(148.5, 92, 7, 13, 3.5, { fill: p.accent }),
    rect(148.5, 114, 7, 12, 3.5, { fill: p.deep }),
    circle(52, 144, 10, { fill: p.deep }),
    circle(64, 148, 7, { fill: p.deep }),
    circle(176, 144, 11, { fill: p.deep }),
    circle(190, 148, 7, { fill: p.deep }),
    path('M20 156h200v4a24 24 0 0 1-24 24H44a24 24 0 0 1-24-24Z', { fill: p.accent, op: 0.85 }),
    path('M50 168q9-4 18 0t18 0', { fill: 'none', stroke: p.cream, sw: 1.8, cap: 'round', op: 0.8 }),
    path('M132 172q9-4 18 0t18 0', { fill: 'none', stroke: p.cream, sw: 1.8, cap: 'round', op: 0.8 }),
  ];
}

function globe(p: IllustrationPalette): Shape[] {
  return [
    blob(p.bg),
    sparkle(40, 50, 7, p.deep),
    sparkle(208, 44, 5, p.accent),
    sparkle(214, 150, 4, p.deep),
    circle(118, 98, 56, { fill: p.mid }),
    path('M90 70c8-10 26-8 30 2 4 10-8 18-18 16-8-2-16-8-12-18Z', { fill: p.accent, op: 0.85 }),
    path('M128 104c10-6 28 0 30 12 2 12-10 22-20 16-8-4-16-20-10-28Z', { fill: p.accent, op: 0.85 }),
    path('M82 108c6-4 16 2 14 12-2 8-12 10-16 2-2-6-2-12 2-14Z', { fill: p.accent, op: 0.85 }),
    ellipse(118, 98, 24, 56, { fill: 'none', stroke: p.soft, sw: 1.5, op: 0.5 }),
    line(62, 98, 174, 98, { stroke: p.soft, sw: 1.5, op: 0.5 }),
    ellipse(118, 98, 90, 26, { fill: 'none', stroke: p.cream, sw: 2.5, tf: 'rotate(-14 118 98)' }),
    path('M70 66q48-50 100-2', { fill: 'none', stroke: p.cream, sw: 2, dash: '3 5', cap: 'round' }),
    circle(70, 66, 5, { fill: p.cream }),
    circle(170, 64, 5, { fill: p.cream }),
    circle(38, 116, 4.5, { fill: p.cream }),
    circle(200, 78, 4.5, { fill: p.cream }),
    circle(118, 42, 4, { fill: p.accent }),
    rect(184, 122, 16, 44, 1.5, { fill: p.deep }),
    path('M182 122h20l-10-15Z', { fill: p.deep }),
    rect(189, 132, 6, 9, 3, { fill: p.accent }),
    ellipse(118, 172, 60, 5, { fill: p.deep, op: 0.14 }),
  ];
}

function trophy(p: IllustrationPalette): Shape[] {
  return [
    blob(p.bg),
    sparkle(52, 60, 8, p.deep),
    sparkle(192, 70, 6, p.accent),
    sparkle(200, 142, 4, p.deep),
    sparkle(40, 140, 5, p.accent),
    path('M120 26v12', { stroke: p.accent, sw: 3.5, cap: 'round' }),
    path('M84 38l8 9', { stroke: p.accent, sw: 3.5, cap: 'round' }),
    path('M156 38l-8 9', { stroke: p.accent, sw: 3.5, cap: 'round' }),
    rect(84, 150, 72, 18, 4, { fill: p.mid }),
    rect(94, 136, 52, 16, 4, { fill: p.deep }),
    path('M92 56h56v26c0 20-12 34-28 34S92 102 92 82Z', { fill: p.cream }),
    path('M92 64H78v10c0 12 8 20 18 21', { fill: 'none', stroke: p.cream, sw: 7, cap: 'round' }),
    path('M148 64h14v10c0 12-8 20-18 21', { fill: 'none', stroke: p.cream, sw: 7, cap: 'round' }),
    rect(112, 114, 16, 14, 2, { fill: p.cream }),
    rect(100, 126, 40, 10, 3, { fill: p.cream }),
    path(star5Path(120, 82, 13, 5.6), { fill: p.accent }),
    rect(64, 104, 6, 10, 1.5, { fill: p.accent, tf: 'rotate(24 67 109)' }),
    rect(172, 96, 6, 10, 1.5, { fill: p.deep, tf: 'rotate(-30 175 101)' }),
    circle(178, 118, 3, { fill: p.accent }),
    circle(58, 88, 2.5, { fill: p.deep }),
  ];
}

function inbox(p: IllustrationPalette): Shape[] {
  return [
    blob(p.bg),
    sparkle(46, 56, 7, p.deep),
    sparkle(196, 132, 5, p.accent),
    sparkle(52, 148, 4, p.accent),
    ellipse(120, 168, 52, 5, { fill: p.deep, op: 0.14 }),
    circle(120, 60, 6, { fill: p.cream }),
    path('M90 128s8-8 8-34c0-18 10-30 22-30s22 12 22 30c0 26 8 34 8 34Z', { fill: p.cream }),
    path('M104 80c2-6 7-10 12-11', { fill: 'none', stroke: '#FFFFFF', sw: 4, cap: 'round', op: 0.7 }),
    rect(84, 126, 72, 10, 5, { fill: p.deep }),
    circle(120, 146, 9, { fill: p.mid }),
    path('M160 58h13l-13 15h13', { fill: 'none', stroke: p.mid, sw: 4, cap: 'round', join: 'round' }),
    path('M180 36h9l-9 10h9', { fill: 'none', stroke: p.mid, sw: 3, cap: 'round', join: 'round', op: 0.8 }),
  ];
}

function quiz(p: IllustrationPalette): Shape[] {
  return [
    blob(p.bg),
    path('M96 0 64 176h112L144 0Z', { fill: p.soft, op: 0.35 }),
    sparkle(40, 50, 7, p.deep),
    sparkle(206, 60, 6, p.accent),
    ellipse(120, 172, 86, 12, { fill: p.mid, op: 0.8 }),
    rect(92, 112, 56, 58, 8, { fill: p.deep }),
    rect(102, 124, 36, 22, 4, { fill: p.accent }),
    path('M115 131.5c0-2.5 2-4 4.8-4 3 0 4.8 1.7 4.8 3.8 0 3.2-4 3.5-4 6.4', { fill: 'none', stroke: p.cream, sw: 2.6, cap: 'round' }),
    circle(120.6, 142, 1.6, { fill: p.cream }),
    circle(120, 62, 34, { fill: p.cream, stroke: p.deep, sw: 5 }),
    path('M109 54c0-8 6-12 11.5-12 7 0 11 5 11 10.5 0 8-10 9-10 17', { fill: 'none', stroke: p.deep, sw: 7, cap: 'round' }),
    circle(121.5, 80, 4.2, { fill: p.deep }),
    circle(58, 120, 9, { fill: '#D4A017' }),
    circle(58, 120, 5.5, { fill: '#F2CE63' }),
    circle(184, 108, 8, { fill: '#D4A017' }),
    circle(184, 108, 5, { fill: '#F2CE63' }),
    circle(172, 142, 6, { fill: '#D4A017' }),
    circle(172, 142, 3.6, { fill: '#F2CE63' }),
  ];
}

function route(p: IllustrationPalette): Shape[] {
  const road = 'M30 172c40 0 30-40 70-42s30-32 60-38 38-26 50-48';
  return [
    blob(p.bg),
    sparkle(52, 50, 7, p.deep),
    sparkle(150, 40, 4, p.accent),
    sparkle(206, 150, 5, p.deep),
    path(road, { fill: 'none', stroke: p.deep, sw: 18, cap: 'round' }),
    path(road, { fill: 'none', stroke: p.cream, sw: 2.6, cap: 'round', dash: '7 8' }),
    ...pinShape(66, 154, 8, p.accent, p.deep),
    ...pinShape(132, 110, 11, p.cream, p.deep),
    ...pinShape(190, 70, 8, p.mid, p.cream),
    path('M211 42V14', { stroke: p.deep, sw: 3, cap: 'round' }),
    path('M211 14h20l-6 7 6 7h-20Z', { fill: p.accent }),
  ];
}

function offline(p: IllustrationPalette): Shape[] {
  return [
    blob(p.bg),
    sparkle(48, 52, 6, p.deep),
    sparkle(200, 150, 5, p.accent),
    path('M8 104h40', { stroke: p.deep, sw: 8, cap: 'round' }),
    rect(46, 90, 46, 28, 7, { fill: p.mid }),
    rect(92, 96, 14, 5, 2, { fill: p.deep }),
    rect(92, 107, 14, 5, 2, { fill: p.deep }),
    rect(146, 86, 48, 36, 8, { fill: p.deep }),
    rect(153, 96, 10, 5, 2, { fill: p.cream }),
    rect(153, 107, 10, 5, 2, { fill: p.cream }),
    path('M194 104h40', { stroke: p.deep, sw: 8, cap: 'round' }),
    sparkle(126, 102, 11, p.accent),
    path('M124 76v8', { stroke: p.accent, sw: 3, cap: 'round' }),
    path('M124 120v8', { stroke: p.accent, sw: 3, cap: 'round' }),
    ellipse(120, 160, 70, 5, { fill: p.deep, op: 0.14 }),
  ];
}

function career(p: IllustrationPalette): Shape[] {
  return [
    blob(p.bg),
    sparkle(44, 44, 7, p.deep),
    sparkle(206, 104, 5, p.accent),
    path('M50 176c30-6 50-30 90-38s50-24 70-44', { fill: 'none', stroke: p.deep, sw: 14, cap: 'round' }),
    path('M50 176c30-6 50-30 90-38s50-24 70-44', { fill: 'none', stroke: p.cream, sw: 2, cap: 'round', dash: '6 8' }),
    rect(150, 96, 12, 34, 2, { fill: p.accent }),
    rect(168, 80, 12, 50, 2, { fill: p.accent }),
    rect(186, 62, 12, 68, 2, { fill: p.soft }),
    line(64, 60, 100, 40, { stroke: p.cream, sw: 2.5 }),
    line(100, 40, 132, 58, { stroke: p.cream, sw: 2.5 }),
    line(64, 60, 76, 94, { stroke: p.cream, sw: 2.5 }),
    circle(64, 60, 5, { fill: p.cream }),
    circle(100, 40, 5, { fill: p.cream }),
    circle(132, 58, 5, { fill: p.cream }),
    circle(76, 94, 5, { fill: p.accent }),
    path('M86 104 120 88l34 16-34 16Z', { fill: p.cream }),
    path('M98 110v14c0 5 10 9 22 9s22-4 22-9v-14l-22 10Z', { fill: p.cream }),
    path('M150 106v16', { stroke: p.cream, sw: 3, cap: 'round' }),
    path('M48 128v-4a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4', { fill: 'none', stroke: p.deep, sw: 3 }),
    rect(38, 128, 34, 24, 4, { fill: p.deep }),
    path('M38 138h34', { stroke: p.mid, sw: 2.5 }),
    rect(52, 135.5, 6, 5, 1.2, { fill: p.accent }),
  ];
}

export type IllustrationName = 'connect' | 'burst' | 'campus' | 'globe' | 'trophy' | 'inbox' | 'quiz' | 'route' | 'offline' | 'career';

const builders: Record<IllustrationName, (palette: IllustrationPalette) => Shape[]> = {
  connect,
  burst,
  campus,
  globe,
  trophy,
  inbox,
  quiz,
  route,
  offline,
  career,
};

export function illustrationDrawing(name: IllustrationName, tone: 'light' | 'dark' = 'light'): Drawing {
  const palette = illustrationPalettes[tone];
  return {
    w: W,
    h: H,
    gradients: [
      {
        id: 'illu-night',
        kind: 'linear',
        x1: 0.5,
        y1: 0,
        x2: 0.5,
        y2: 1,
        stops: [
          { offset: 0, color: '#1E5B7F' },
          { offset: 1, color: '#0B2D45' },
        ],
      },
    ],
    shapes: [group(builders[name](palette))],
  };
}

export const illustrationNames = Object.keys(builders) as IllustrationName[];

export const illustrations: Record<IllustrationName, Drawing> = illustrationNames.reduce(
  (all, name) => ({ ...all, [name]: illustrationDrawing(name) }),
  {} as Record<IllustrationName, Drawing>,
);
