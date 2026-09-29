import { circle, ellipse, path, rect, star4Path, type Drawing, type Shape } from './shapes';

// Mapa nocturno del campus para "La señal perdida": cerros, mar, la ruta y un edificio por capítulo.
const CREAM = '#F4ECD7';
const NAVY = '#0B2D45';
const MID = '#1E5B7F';
const SKY = '#6FB3D9';
const SOFT = '#A7D4ED';

export const CAMPUS_MAP_ROUTE = 'M70 320C130 318 196 300 230 264c28-30-80-36-140-64-42-20 78-50 140-64 42-10-24-52-80-76';

function windows(x: number, y: number, count: number, lit: number[] = []): Shape[] {
  return Array.from({ length: count }, (_, index) =>
    rect(x + index * 11, y, 6, 9, 3, { fill: lit.includes(index) ? SKY : NAVY }),
  );
}

function tree(x: number, y: number, r: number): Shape[] {
  return [circle(x, y, r, { fill: '#0E3A57' }), circle(x + r * 0.6, y + 2, r * 0.7, { fill: '#0E3A57' })];
}

export function campusMapDrawing(): Drawing {
  const sky: Shape[] = [
    path(star4Path(40, 40, 6), { fill: CREAM, op: 0.9 }),
    path(star4Path(118, 28, 4), { fill: SOFT, op: 0.8 }),
    path(star4Path(206, 70, 3.5), { fill: CREAM, op: 0.7 }),
    path(star4Path(20, 118, 3), { fill: SOFT, op: 0.7 }),
    circle(84, 64, 1.6, { fill: CREAM, op: 0.7 }),
    circle(170, 22, 1.4, { fill: CREAM, op: 0.8 }),
    circle(300, 118, 1.5, { fill: SOFT, op: 0.7 }),
    circle(58, 96, 1.2, { fill: CREAM, op: 0.6 }),
  ];

  return {
    w: 320,
    h: 400,
    gradients: [
      {
        id: 'map-sky',
        kind: 'linear',
        x1: 0.5,
        y1: 0,
        x2: 0.5,
        y2: 1,
        stops: [
          { offset: 0, color: '#071F31' },
          { offset: 0.55, color: NAVY },
          { offset: 1, color: '#123D5C' },
        ],
      },
    ],
    shapes: [
      rect(0, 0, 320, 400, 0, { fill: 'url(#map-sky)' }),
      ...sky,
      circle(274, 44, 15, { fill: CREAM }),
      circle(280, 39, 4, { fill: SOFT, op: 0.45 }),
      circle(268, 50, 2.5, { fill: SOFT, op: 0.35 }),
      path('M0 170c50-30 100-20 150-42s100-10 170-32v304H0Z', { fill: '#123D5C' }),
      path('M0 250c60-28 120-14 180-38s90-20 140-30v218H0Z', { fill: '#174B6E' }),
      path('M0 318c70-18 150 0 220-18 42-10 72-8 100-14v114H0Z', { fill: MID }),
      path('M0 336c40-6 84 2 120 14 30 10 44 30 38 50H0Z', { fill: SKY, op: 0.5 }),
      path('M14 356q9-4 18 0t18 0', { fill: 'none', stroke: CREAM, sw: 1.6, cap: 'round', op: 0.6 }),
      path('M50 376q9-4 18 0t18 0', { fill: 'none', stroke: CREAM, sw: 1.6, cap: 'round', op: 0.6 }),

      // Capítulo 5 · Casa Central (castillo con torre)
      rect(178, 52, 70, 40, 2, { fill: CREAM }),
      ...[0, 1, 2, 3, 4, 5].map((index) => rect(180 + index * 11, 47, 6, 6, 1, { fill: CREAM })),
      ...windows(185, 62, 5, [1, 3]),
      ...windows(185, 77, 5, [2]),
      rect(232, 22, 20, 70, 2, { fill: CREAM }),
      path('M229 22h26l-13-18Z', { fill: MID }),
      circle(242, 36, 4.5, { fill: NAVY }),
      rect(238.5, 50, 7, 12, 3.5, { fill: SKY }),

      // Capítulo 4 · Taller de electrónica
      rect(152, 128, 58, 32, 2, { fill: CREAM }),
      rect(192, 112, 8, 16, 1, { fill: CREAM }),
      rect(166, 136, 14, 14, 2, { fill: NAVY }),
      rect(170, 140, 6, 6, 1, { fill: SKY }),
      ...windows(184, 138, 2, [0]),

      // Capítulo 3 · Sala de servidores
      rect(14, 186, 52, 36, 2, { fill: CREAM }),
      ...[0, 1, 2].map((row) => rect(22, 193 + row * 9, 36, 5, 1.5, { fill: NAVY })),
      ...[0, 1, 2].map((row) => circle(52, 195.5 + row * 9, 1.4, { fill: SKY })),

      // Capítulo 2 · Laboratorio de telecomunicaciones (con antena parabólica)
      rect(150, 252, 56, 34, 2, { fill: CREAM }),
      path('M176 252v-12', { stroke: CREAM, sw: 3, cap: 'round' }),
      ellipse(176, 236, 13, 6, { fill: SOFT, tf: 'rotate(-24 176 236)' }),
      circle(176, 236, 2.2, { fill: NAVY }),
      ...windows(158, 262, 4, [0, 2]),

      // Capítulo 1 · Biblioteca (frontis con columnas)
      path('M88 318h70l-35-18Z', { fill: CREAM }),
      rect(92, 318, 62, 30, 2, { fill: CREAM }),
      ...[0, 1, 2, 3, 4].map((index) => rect(99 + index * 11, 323, 5, 22, 1.5, { fill: NAVY, op: 0.85 })),
      rect(88, 348, 70, 5, 2, { fill: CREAM }),

      ...tree(20, 300, 9),
      ...tree(286, 250, 10),
      ...tree(128, 176, 7),
      ...tree(270, 120, 8),
      ...tree(296, 330, 11),

      path(CAMPUS_MAP_ROUTE, { fill: 'none', stroke: CREAM, sw: 3, dash: '2 9', cap: 'round', op: 0.75 }),
    ],
  };
}
