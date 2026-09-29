import { tierColors, type Tier } from '@/theme/colors';
import { arcPath, circle, ellipse, group, path, polar, rect, star4Path, star5Path, type Drawing, type Gradient, type Shape } from './shapes';

// Medallas estilo "Avatares y destacados" de la marca: anillo crema, disco azul noche,
// arco celeste, estrellas de cuatro puntas y un glifo sólido. Glifos en grilla 48×48.
const C = '#F4ECD7';
const N = '#0E3654';
const S = '#6FB3D9';
const SHADE = '#E3D3AE';

const stroke = (d: string, color: string, width: number): Shape =>
  path(d, { fill: 'none', stroke: color, sw: width, cap: 'round', join: 'round' });

export const medallionGlyphs = {
  cap: [
    path('M24 9 45 18.5 24 28 3 18.5Z', { fill: C }),
    path('M11.5 23.2V31c0 3.6 5.6 6.5 12.5 6.5S36.5 34.6 36.5 31v-7.8L24 28.9Z', { fill: C }),
    stroke('M41 19.8V29', C, 2.2),
    circle(41, 30.6, 2.3, { fill: C }),
  ],
  lock: [
    stroke('M16 22v-5.5a8 8 0 0 1 16 0V22', C, 4.5),
    rect(11, 21, 26, 20, 5, { fill: C }),
    circle(24, 29.5, 3, { fill: N }),
    rect(22.6, 30, 2.8, 6, 1.4, { fill: N }),
  ],
  shield: [
    path('M24 4.5 39.5 10.5v12c0 10-7 17.3-15.5 21-8.5-3.7-15.5-11-15.5-21v-12Z', { fill: C }),
    stroke('M20 23v-3a4 4 0 0 1 8 0v3', N, 2.6),
    rect(17.5, 22.5, 13, 10.5, 2.5, { fill: N }),
    circle(24, 27.4, 1.6, { fill: C }),
  ],
  route: [
    path('M24 4c-6.6 0-11.5 4.9-11.5 11.3C12.5 23.2 24 32.5 24 32.5s11.5-9.3 11.5-17.2C35.5 8.9 30.6 4 24 4Z', { fill: C }),
    circle(24, 15, 4.6, { fill: N }),
    stroke('M6 43c6-5.5 16-2.5 24-5 5.5-1.8 6.5-5 1-5.8', C, 2.8),
  ],
  bulb: [
    path('M24 6.5c-7.1 0-12.5 5.4-12.5 12.1 0 4.6 2.3 7.5 4.8 10 1.3 1.3 2.1 2.8 2.1 4.7h11.2c0-1.9.8-3.4 2.1-4.7 2.5-2.5 4.8-5.4 4.8-10 0-6.7-5.4-12.1-12.5-12.1Z', { fill: C }),
    rect(18.4, 35.2, 11.2, 3, 1.5, { fill: C }),
    rect(19.8, 39.6, 8.4, 3, 1.5, { fill: C }),
    stroke('M20.5 22.5 24 26.5l3.5-4', N, 2.2),
    stroke('M24 26.5V31', N, 2.2),
    stroke('M9.2 5.6 11 7.4', C, 2.2),
    stroke('M38.8 5.6 37 7.4', C, 2.2),
    stroke('M4.6 17.8h2.6', C, 2.2),
    stroke('M40.8 17.8h2.6', C, 2.2),
  ],
  users: [
    circle(24, 14.5, 6.2, { fill: C }),
    path('M12.5 38c0-7.7 5.1-12.8 11.5-12.8S35.5 30.3 35.5 38Z', { fill: C }),
    circle(11, 18.5, 4.6, { fill: C }),
    path('M2.5 36.5c0-5.7 3.6-9.2 8.5-9.2 1.7 0 3.2.4 4.5 1.2-2.7 2.4-4.3 5.1-4.7 8Z', { fill: C }),
    circle(37, 18.5, 4.6, { fill: C }),
    path('M45.5 36.5c0-5.7-3.6-9.2-8.5-9.2-1.7 0-3.2.4-4.5 1.2 2.7 2.4 4.3 5.1 4.7 8Z', { fill: C }),
  ],
  calendar: [
    rect(6.5, 9, 35, 32, 5, { fill: C }),
    rect(10.5, 18.5, 27, 18.5, 2, { fill: N }),
    rect(13.5, 5, 4.5, 9, 2.25, { fill: C }),
    rect(30, 5, 4.5, 9, 2.25, { fill: C }),
    ...[13, 19, 25, 31].flatMap((x, column) =>
      [21.5, 26.5, 31.5].map((y, row) => rect(x, y, 4.2, 3.2, 0.8, { fill: column === 2 && row === 1 ? S : C })),
    ),
  ],
  megaphone: [
    path('M8.5 19.5 31 8.5v31L8.5 28.5Z', { fill: C }),
    rect(4.5, 18.5, 6.5, 11, 2.2, { fill: C }),
    path('M12.5 29 15 39c.3 1.2 1.3 2 2.5 2h2l-2-10.5Z', { fill: C }),
    stroke('M36 18a8 8 0 0 1 0 12', C, 2.6),
    stroke('M40 13.5a14 14 0 0 1 0 21', C, 2.6),
  ],
  flask: [
    path('M18 4.5h12v4h-1.7v10.3l10.5 17.8c1.8 3.1-.4 6.9-4 6.9H13.2c-3.6 0-5.8-3.8-4-6.9l10.5-17.8V8.5H18Z', { fill: C }),
    path('M13.4 31.5h21.2l2.7 4.6c.8 1.4-.2 3.2-1.8 3.2h-23c-1.6 0-2.6-1.8-1.8-3.2Z', { fill: S }),
    circle(20, 35.5, 1.6, { fill: C }),
    circle(27, 34, 1.2, { fill: C }),
    circle(24, 26.5, 1.3, { fill: S }),
  ],
  code: [stroke('M15.5 14 6.5 24l9 10', C, 4), stroke('M32.5 14l9 10-9 10', C, 4), stroke('M27.5 10l-7 28', C, 4)],
  antenna: [
    circle(24, 15.5, 3.8, { fill: C }),
    path('M24 19.5 15.5 43.5h4.7l1.4-4.5h4.8l1.4 4.5h4.7Z', { fill: C }),
    path('M24 26.5 21.6 34h4.8Z', { fill: N }),
    stroke('M17.5 9.5a8.5 8.5 0 0 0 0 12', C, 2.8),
    stroke('M30.5 9.5a8.5 8.5 0 0 1 0 12', C, 2.8),
    stroke('M12.5 5a15 15 0 0 0 0 21', C, 2.8),
    stroke('M35.5 5a15 15 0 0 1 0 21', C, 2.8),
  ],
  database: [
    path('M10 11v25.5c0 3 6.3 5.5 14 5.5s14-2.5 14-5.5V11Z', { fill: C }),
    ellipse(24, 11, 14, 5.2, { fill: C, stroke: N, sw: 2 }),
    stroke('M10 20c0 3 6.3 5.5 14 5.5S38 23 38 20', N, 2.2),
    stroke('M10 28.5c0 3 6.3 5.5 14 5.5s14-2.5 14-5.5', N, 2.2),
    circle(32, 22.8, 1.4, { fill: S }),
    circle(32, 31.3, 1.4, { fill: S }),
  ],
  laptop: [
    rect(8.5, 8, 31, 22, 3.5, { fill: C }),
    rect(12, 11.5, 24, 15, 1.8, { fill: N }),
    stroke('M18.8 18.3a7.5 7.5 0 0 1 10.4 0', C, 1.8),
    stroke('M21.4 21.2a3.8 3.8 0 0 1 5.2 0', C, 1.8),
    circle(24, 23.7, 1.2, { fill: C }),
    path('M3.5 33h41l-2.7 5.2c-.4.8-1.2 1.3-2.1 1.3H8.3c-.9 0-1.7-.5-2.1-1.3Z', { fill: C }),
    rect(19.5, 33, 9, 2.2, 1.1, { fill: N }),
  ],
  trophy: [
    path('M13.5 6.5h21V17c0 6.4-4.7 11.5-10.5 11.5S13.5 23.4 13.5 17Z', { fill: C }),
    stroke('M13.5 10H9v3c0 4.2 2.6 7 6 7.3', C, 3),
    stroke('M34.5 10H39v3c0 4.2-2.6 7-6 7.3', C, 3),
    rect(21.5, 27.5, 5, 7, 1, { fill: C }),
    rect(14.5, 34, 19, 6.5, 2.2, { fill: C }),
    path(star5Path(24, 16.6, 5.4, 2.4), { fill: N }),
  ],
  star: [path(star5Path(24, 25.5, 18, 7.8), { fill: C })],
  heart: [
    path('M24 41S6 30.5 6 18.3C6 12.1 10.6 7.5 16.3 7.5c3.3 0 6.2 1.6 7.7 4.3 1.5-2.7 4.4-4.3 7.7-4.3C37.4 7.5 42 12.1 42 18.3 42 30.5 24 41 24 41Z', { fill: C }),
    stroke('M12 22.5h6l2.6-5 3.8 10 2.6-5H36', N, 2.4),
  ],
  flame: [
    path('M24 44c8.5 0 14.5-6.2 14.5-14.2 0-9.3-7.7-14-9.3-24.3-4.8 2.9-7.9 7.7-8.2 12.9-1.7-1.1-2.9-2.8-3.3-4.9-4.8 4.4-8.2 9.5-8.2 16.3C9.5 37.8 15.5 44 24 44Z', { fill: C }),
    path('M24 43.5c-3.6 0-6.2-2.7-6.2-6.2 0-4.1 3.3-6.2 6.2-10.1 2.9 3.9 6.2 6 6.2 10.1 0 3.5-2.6 6.2-6.2 6.2Z', { fill: S }),
  ],
  bolt: [path('M27 3.5 9.5 26.5h13L20 44.5l18.5-24h-13Z', { fill: C })],
  steps: [
    path('M15.5 5.5c3.7 0 5.5 3.8 5.5 8.7 0 4.8-1.8 8.6-4.8 8.6s-5.2-3.2-5.2-8.4c0-5.1 1.4-8.9 4.5-8.9Z', { fill: C }),
    path('M12.3 25.2h7.5v2.6c0 2.2-1.7 3.8-3.8 3.8s-3.7-1.6-3.7-3.8Z', { fill: C }),
    path('M32.5 15.5c3.7 0 5.5 3.8 5.5 8.7 0 4.8-1.8 8.6-4.8 8.6s-5.2-3.2-5.2-8.4c0-5.1 1.4-8.9 4.5-8.9Z', { fill: C }),
    path('M29.3 35.2h7.5v2.6c0 2.2-1.7 3.8-3.8 3.8s-3.7-1.6-3.7-3.8Z', { fill: C }),
  ],
  gamepad: [
    path('M14 13h20c6 0 10.5 5 10 11l-1 8.5c-.4 3.7-4.8 5.4-7.5 2.9l-5-4.6h-13l-5 4.6c-2.7 2.5-7.1.8-7.5-2.9L4 24c-.5-6 4-11 10-11Z', { fill: C }),
    rect(11.6, 19.5, 3.2, 10, 1.2, { fill: N }),
    rect(8.2, 22.9, 10, 3.2, 1.2, { fill: N }),
    circle(32.5, 21.5, 2.3, { fill: N }),
    circle(36.8, 25.8, 2.3, { fill: S }),
  ],
  rocket: [
    path('M24 3c7 5.5 10 13.5 10 22v8H14v-8c0-8.5 3-16.5 10-22Z', { fill: C }),
    circle(24, 18, 4.2, { fill: N }),
    circle(24, 18, 2, { fill: S }),
    path('M14 24.5 7.5 32v7l6.5-3.5Z', { fill: C }),
    path('M34 24.5l6.5 7.5v7L34 35.5Z', { fill: C }),
    path('M18.5 35h11c0 5-5.5 10-5.5 10s-5.5-5-5.5-10Z', { fill: S }),
  ],
  globe: [
    circle(24, 24, 18, { fill: C }),
    ellipse(24, 24, 7.5, 18, { fill: 'none', stroke: N, sw: 2 }),
    stroke('M6 24h36', N, 2),
    stroke('M9.5 14.5h29', N, 2),
    stroke('M9.5 33.5h29', N, 2),
    stroke('M13.5 18 33.5 29', S, 2),
    circle(13.5, 18, 2.6, { fill: S }),
    circle(33.5, 29, 2.6, { fill: S }),
  ],
  target: [
    circle(24, 25, 18, { fill: C }),
    circle(24, 25, 12.5, { fill: N }),
    circle(24, 25, 7.5, { fill: C }),
    circle(24, 25, 3, { fill: N }),
    stroke('M24 25 38.5 10.5', S, 3),
    stroke('M35.8 6.6h4.8v4.8', S, 2.6),
  ],
  question: [
    path('M9 7h30c2.8 0 5 2.2 5 5v17c0 2.8-2.2 5-5 5H22l-9 7.5V34H9c-2.8 0-5-2.2-5-5V12c0-2.8 2.2-5 5-5Z', { fill: C }),
    stroke('M19.5 15.5c0-3 2-4.7 4.5-4.7 2.8 0 4.6 1.8 4.6 4.2 0 3.6-4.6 3.8-4.6 8', N, 3.4),
    circle(24, 28.4, 2, { fill: N }),
  ],
  network: [
    stroke('M12 34 24 13', C, 3),
    stroke('M24 13l12 18', C, 3),
    stroke('M12 34l24-3', C, 3),
    stroke('M24 13v13', C, 3),
    circle(24, 12, 5.5, { fill: C }),
    circle(11, 34, 5.5, { fill: C }),
    circle(37, 31, 5.5, { fill: C }),
    circle(24, 26, 3.8, { fill: S }),
  ],
  chip: [
    ...[17, 22.5, 28].flatMap((offset) => [
      rect(offset, 5, 3, 7, 1.5, { fill: C }),
      rect(offset, 36, 3, 7, 1.5, { fill: C }),
      rect(5, offset, 7, 3, 1.5, { fill: C }),
      rect(36, offset, 7, 3, 1.5, { fill: C }),
    ]),
    rect(11.5, 11.5, 25, 25, 5, { fill: C }),
    rect(18, 18, 12, 12, 2.5, { fill: N }),
    circle(24, 24, 2.3, { fill: S }),
  ],
  wave: [
    stroke('M4 18c4.5-8 8.5-8 13 0s8.5 8 13 0 8.5-8 14 0', C, 3.4),
    path('M4 30c4.5-8 8.5-8 13 0s8.5 8 13 0 8.5-8 14 0', { fill: 'none', stroke: C, sw: 3.4, cap: 'round', op: 0.55 }),
  ],
  robot: [
    rect(8.5, 13, 31, 24, 9, { fill: C }),
    rect(13, 17.5, 22, 15, 5.5, { fill: N }),
    ellipse(19.5, 24.5, 2.2, 2.8, { fill: S }),
    ellipse(28.5, 24.5, 2.2, 2.8, { fill: S }),
    stroke('M21 28.5q3 2.3 6 0', S, 1.6),
    stroke('M24 13V7.5', C, 2.6),
    circle(24, 6, 2.8, { fill: S }),
    rect(5, 20, 4, 10, 2, { fill: C }),
    rect(39, 20, 4, 10, 2, { fill: C }),
    rect(15, 38.5, 18, 6, 3, { fill: C }),
  ],
  book: [
    path('M24 12c-4.5-3.2-10.5-4-18-3.5v28c7.5-.5 13.5.5 18 3.5Z', { fill: C }),
    path('M24 12c4.5-3.2 10.5-4 18-3.5v28c-7.5-.5-13.5.5-18 3.5Z', { fill: SHADE }),
    stroke('M24 12v28', N, 1.8),
    path('M10 15c3.5 0 7 .6 10 1.8', { fill: 'none', stroke: N, sw: 1.6, cap: 'round', op: 0.55 }),
    path('M10 21c3.5 0 7 .6 10 1.8', { fill: 'none', stroke: N, sw: 1.6, cap: 'round', op: 0.55 }),
    path('M10 27c3.5 0 7 .6 10 1.8', { fill: 'none', stroke: N, sw: 1.6, cap: 'round', op: 0.55 }),
    path('M33 8.2V17l2.5-1.8L38 17V8.3', { fill: S }),
  ],
  crown: [
    path('M6 15l8.5 8L24 9.5 33.5 23 42 15l-3.5 21h-29Z', { fill: C }),
    rect(9.5, 38.5, 29, 4.5, 2, { fill: C }),
    circle(24, 28, 2.8, { fill: S }),
    circle(16, 29.5, 1.8, { fill: N }),
    circle(32, 29.5, 1.8, { fill: N }),
    circle(6, 14.5, 2.6, { fill: C }),
    circle(24, 9, 2.6, { fill: C }),
    circle(42, 14.5, 2.6, { fill: C }),
  ],
  coinHand: [
    circle(26, 13, 8.8, { fill: C }),
    stroke('M28.6 10.4c-.6-1.2-1.6-1.8-2.8-1.8-1.5 0-2.6.8-2.6 2 0 2.8 5.6 1.7 5.6 4.7 0 1.2-1.2 2.1-2.8 2.1-1.3 0-2.4-.6-3-1.7', N, 1.9),
    stroke('M26 6.8v1.8', N, 1.9),
    stroke('M26 17.4v1.8', N, 1.9),
    rect(3.5, 30, 6, 13, 1.5, { fill: C }),
    path('M9.5 31.5l7-3c1.5-.6 3.1-.6 4.6-.1l7.4 2.6c1.7.6 2.1 2.8.8 4-.8.7-1.9.9-2.9.5l-5.9-2 5.8 2.8c1.5.7 3.2.8 4.7.2l9.2-3.9c1.6-.7 3.4.2 3.8 1.9.3 1.2-.3 2.5-1.4 3.1l-12.8 6.3c-1.9.9-4 1-6 .4L9.5 40Z', { fill: C }),
  ],
  signal: [
    rect(7, 30, 6, 11, 2, { fill: C }),
    rect(16, 23, 6, 18, 2, { fill: C }),
    rect(25, 15, 6, 26, 2, { fill: C }),
    rect(34, 7, 6, 34, 2, { fill: S }),
  ],
  packet: [
    path('M24 5 41 14 24 23 7 14Z', { fill: '#FBF6E9' }),
    path('M7 14l17 9v20L7 34Z', { fill: SHADE }),
    path('M41 14 24 23v20l17-9Z', { fill: C }),
    stroke('M15.5 9.5l17 9', S, 2.4),
  ],
  sparkle: [path(star4Path(24, 24, 20, 0.2), { fill: C }), path(star4Path(38, 10, 5, 0.2), { fill: S })],
  wifi: [
    stroke('M5 18a27 27 0 0 1 38 0', C, 4),
    stroke('M11 25.5a18.5 18.5 0 0 1 26 0', C, 4),
    stroke('M17.3 32.5a9.5 9.5 0 0 1 13.4 0', C, 4),
    circle(24, 39, 3.3, { fill: S }),
  ],
} satisfies Record<string, Shape[]>;

export type MedallionGlyph = keyof typeof medallionGlyphs;

export type MedallionTier = Tier | 'crema';

export type MedallionState = 'unlocked' | 'progress' | 'locked';

export interface MedallionOptions {
  glyph: MedallionGlyph;
  tier?: MedallionTier;
  state?: MedallionState;
  progress?: number;
  ribbon?: boolean;
}

const creamRing: [string, string, string] = ['#FBF4E2', '#EBDDB9', '#C9B78C'];
const lockedRing: [string, string, string] = ['#E6ECF1', '#B9C5CF', '#8594A1'];

const ARC_START = 150;
const ARC_SPAN = 240;

export function medallionDrawing({ glyph, tier = 'crema', state = 'unlocked', progress = 0, ribbon = false }: MedallionOptions): Drawing {
  const locked = state === 'locked';
  const ringColors = locked ? lockedRing : tier === 'crema' ? creamRing : tierColors[tier].ring;
  const suffix = `${locked ? 'locked' : tier}`;
  const ringId = `med-ring-${suffix}`;
  const diskId = `med-disk-${locked ? 'locked' : 'on'}`;
  const gradients: Gradient[] = [
    {
      id: ringId,
      kind: 'linear',
      x1: 0.15,
      y1: 0,
      x2: 0.85,
      y2: 1,
      stops: [
        { offset: 0, color: ringColors[0] },
        { offset: 0.55, color: ringColors[1] },
        { offset: 1, color: ringColors[2] },
      ],
    },
    {
      id: diskId,
      kind: 'radial',
      cx: 0.5,
      cy: 0.38,
      r: 0.62,
      stops: locked
        ? [
            { offset: 0, color: '#556878' },
            { offset: 1, color: '#2C3A45' },
          ]
        : [
            { offset: 0, color: '#1A4E75' },
            { offset: 0.6, color: '#0E3654' },
            { offset: 1, color: '#082338' },
          ],
    },
  ];

  const shapes: Shape[] = [];
  const offsetY = 0;

  if (ribbon) {
    const ribbonColor = locked ? '#8594A1' : '#1E5B7F';
    shapes.push(
      path('M40 92 30 138l13-7 8 12 9-44Z', { fill: ribbonColor }),
      path('M80 92l10 46-13-7-8 12-9-44Z', { fill: locked ? '#6F7F8C' : '#0B2D45' }),
    );
  }

  shapes.push(
    circle(60, 60 + offsetY, 59, { fill: `url(#${ringId})` }),
    circle(60, 60, 55.5, { fill: 'none', stroke: '#FFFFFF', sw: 1.2, op: locked ? 0.25 : 0.45 }),
    circle(60, 60, 51.5, { fill: '#000000', op: 0.18 }),
    circle(60, 60, 50.5, { fill: `url(#${diskId})` }),
    circle(60, 60, 44.5, { fill: 'none', stroke: locked ? '#6F8090' : '#1E5B7F', sw: 1, op: 0.7 }),
  );

  const arcColor = locked ? '#8FA0AE' : S;
  if (state === 'progress') {
    const clamped = Math.max(0, Math.min(1, progress));
    shapes.push(path(arcPath(60, 60, 44.5, ARC_START, ARC_START + ARC_SPAN), { fill: 'none', stroke: '#1E5B7F', sw: 3.2, cap: 'round' }));
    if (clamped > 0.01) {
      shapes.push(path(arcPath(60, 60, 44.5, ARC_START, ARC_START + ARC_SPAN * clamped), { fill: 'none', stroke: S, sw: 3.2, cap: 'round' }));
    }
  } else {
    shapes.push(path(arcPath(60, 60, 44.5, ARC_START, ARC_START + ARC_SPAN), { fill: 'none', stroke: arcColor, sw: 3, cap: 'round', op: locked ? 0.45 : 0.95 }));
  }
  const [sx, sy] = polar(60, 60, 44.5, ARC_START);
  const [ex, ey] = polar(60, 60, 44.5, ARC_START + ARC_SPAN);
  shapes.push(circle(sx, sy, 2, { fill: arcColor, op: locked ? 0.5 : 1 }), circle(ex, ey, 2, { fill: arcColor, op: locked ? 0.5 : 1 }));

  const sparkleOpacity = locked ? 0.3 : 0.95;
  shapes.push(
    path(star4Path(21.5, 61, 5.2), { fill: C, op: sparkleOpacity }),
    path(star4Path(98.5, 61, 5.2), { fill: C, op: sparkleOpacity }),
    path(star4Path(32.5, 35.5, 2.8), { fill: C, op: sparkleOpacity * 0.85 }),
    path(star4Path(88, 34, 2.3), { fill: C, op: sparkleOpacity * 0.85 }),
    circle(36, 86, 1.3, { fill: C, op: sparkleOpacity * 0.7 }),
    circle(84, 86, 1.3, { fill: C, op: sparkleOpacity * 0.7 }),
  );

  const stars = tier === 'plata' ? 2 : tier === 'oro' || tier === 'platino' ? 3 : 1;
  const starColor = locked ? '#B9C5CF' : tier === 'crema' ? C : ringColors[0];
  const positions = stars === 1 ? [60] : stars === 2 ? [54, 66] : [50, 60, 70];
  positions.forEach((x, index) => {
    const lift = stars === 3 && index === 1 ? -2 : 0;
    shapes.push(path(star5Path(x, 100 + lift, stars === 1 ? 5.5 : 4.4), { fill: starColor, op: locked ? 0.5 : 1 }));
  });

  if (tier === 'platino' && !locked) {
    shapes.push(
      path('M36 97c-5-2-8-7-8.5-12.5 3.5 1.5 6.5 4.5 8.5 8', { fill: 'none', stroke: ringColors[0], sw: 2, cap: 'round' }),
      path('M84 97c5-2 8-7 8.5-12.5-3.5 1.5-6.5 4.5-8.5 8', { fill: 'none', stroke: ringColors[0], sw: 2, cap: 'round' }),
    );
  }

  const glyphOpacity = locked ? 0.4 : state === 'progress' ? 0.88 : 1;
  shapes.push(group(medallionGlyphs[glyph], { tf: 'translate(32.4 30.2) scale(1.15)', op: glyphOpacity }));

  if (locked) {
    shapes.push(
      circle(94, 94, 14, { fill: '#5E6F7E', stroke: '#FFFFFF', sw: 3 }),
      rect(88.2, 93, 11.6, 9, 2.2, { fill: '#FFFFFF' }),
      path('M90.6 93v-2.6a3.4 3.4 0 0 1 6.8 0V93', { fill: 'none', stroke: '#FFFFFF', sw: 2.2, cap: 'round' }),
    );
  }

  return { w: 120, h: ribbon ? 146 : 120, gradients, shapes };
}
