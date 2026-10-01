import { circle, ellipse, path, rect, star4Path, type Drawing, type Gradient, type Shape } from './shapes';

// Rutix: robot-antena de SoyTEL. Cabeza crema con pantalla azul noche (como el laptop del
// logo), orejas-puerto, antena que emite señal y barras de señal en el pecho que muestran su ánimo.
export type RutixExpression = 'neutral' | 'happy' | 'celebrate' | 'sleepy' | 'sleep' | 'sad' | 'alert' | 'think' | 'love';
export type RutixPose = 'idle' | 'wave' | 'celebrate' | 'think';

export const rutixExpressions: RutixExpression[] = ['neutral', 'happy', 'celebrate', 'love', 'think', 'alert', 'sleepy', 'sad', 'sleep'];

const CREAM = '#F4ECD7';
const LIMB = '#E3D3AE';
const BLUE = '#1E5B7F';
const SKY = '#6FB3D9';
const EYE = '#A7D4ED';
const NAVY = '#0B2D45';

export const rutixGradients: Gradient[] = [
  { id: 'rutix-head', kind: 'linear', x1: 0.2, y1: 0, x2: 0.8, y2: 1, stops: [{ offset: 0, color: '#FDF9EF' }, { offset: 1, color: '#E6D8B5' }] },
  { id: 'rutix-body', kind: 'linear', x1: 0.5, y1: 0, x2: 0.5, y2: 1, stops: [{ offset: 0, color: '#F8F0DD' }, { offset: 1, color: '#DECDA4' }] },
  { id: 'rutix-screen', kind: 'linear', x1: 0.3, y1: 0, x2: 0.7, y2: 1, stops: [{ offset: 0, color: '#18517A' }, { offset: 1, color: NAVY }] },
];

const strokePath = (d: string, color: string, width: number, extra: Partial<Shape> = {}): Shape =>
  ({ t: 'path', d, fill: 'none', stroke: color, sw: width, cap: 'round', join: 'round', ...extra }) as Shape;

function heartPath(cx: number, cy: number, s: number): string {
  return `M${cx} ${cy + s * 0.9}C${cx - s * 1.4} ${cy - s * 0.1} ${cx - s} ${cy - s * 1.2} ${cx} ${cy - s * 0.45}C${cx + s} ${cy - s * 1.2} ${cx + s * 1.4} ${cy - s * 0.1} ${cx} ${cy + s * 0.9}Z`;
}

function arms(pose: RutixPose): Shape[] {
  const left = pose === 'celebrate'
    ? { d: 'M69 142C50 141 34 133 28 117', hand: [26.5, 113] }
    : { d: 'M68 143C56 147 52 157 54 167', hand: [54.5, 168] };
  const right = pose === 'wave' || pose === 'celebrate'
    ? { d: 'M131 142C150 141 166 133 172 117', hand: [173.5, 113] }
    : pose === 'think'
      ? { d: 'M132 147C150 152 156 140 146 132', hand: [143, 131] }
      : { d: 'M132 143C144 147 148 157 146 167', hand: [145.5, 168] };
  return [
    strokePath(left.d, LIMB, 12),
    circle(left.hand[0], left.hand[1], 7.5, { fill: BLUE }),
    strokePath(right.d, LIMB, 12),
    circle(right.hand[0], right.hand[1], 7.5, { fill: BLUE }),
  ];
}

export function rutixBody(pose: RutixPose = 'idle', signal = 3): Shape[] {
  const bars = [6, 10, 14, 18].map((height, index) =>
    rect(86 + index * 8.5, 161 - height, 5.5, height, 1.6, {
      fill: index < signal ? SKY : BLUE,
      op: index < signal ? 1 : 0.55,
    }),
  );
  const behindHead = pose === 'think' ? [] : arms(pose);
  const inFront = pose === 'think' ? arms(pose) : [];
  return [
    rect(74, 170, 20, 11, 5.5, { fill: BLUE }),
    rect(106, 170, 20, 11, 5.5, { fill: BLUE }),
    ...behindHead,
    rect(66, 126, 68, 50, 22, { fill: 'url(#rutix-body)' }),
    rect(80, 138, 40, 27, 8, { fill: NAVY, op: 0.94 }),
    ...bars,
    strokePath('M100 50V27', BLUE, 6),
    circle(100, 22, 9.5, { fill: signal > 0 ? SKY : '#8CA3B4' }),
    circle(96.8, 18.8, 3, { fill: '#FFFFFF', op: 0.75 }),
    rect(34, 79, 14, 33, 7, { fill: BLUE }),
    rect(152, 79, 14, 33, 7, { fill: BLUE }),
    circle(41, 95.5, 2.6, { fill: SKY }),
    circle(159, 95.5, 2.6, { fill: SKY }),
    rect(42, 45, 116, 97, 38, { fill: 'url(#rutix-head)' }),
    strokePath('M63 60C73 52 89 49.5 103 50', '#FFFFFF', 5, { op: 0.55 }),
    rect(56, 61, 88, 65, 24, { fill: 'url(#rutix-screen)' }),
    strokePath('M69 72h15', '#FFFFFF', 4, { op: 0.13 }),
    ...inFront,
  ];
}

export function rutixFace(expression: RutixExpression = 'neutral', blink = false): Shape[] {
  const cheeks = [circle(69, 110, 6, { fill: SKY, op: 0.32 }), circle(131, 110, 6, { fill: SKY, op: 0.32 })];
  const openEyes = [
    ellipse(82, 92, 7.5, 9.5, { fill: EYE }),
    ellipse(118, 92, 7.5, 9.5, { fill: EYE }),
    circle(84.6, 88, 2.4, { fill: '#FFFFFF' }),
    circle(120.6, 88, 2.4, { fill: '#FFFFFF' }),
  ];
  const blinkEyes = [strokePath('M74 93h16', EYE, 5), strokePath('M110 93h16', EYE, 5)];
  const smile = strokePath('M90 108q10 9 20 0', SKY, 4.5);
  const grin = path('M87.5 105.5Q100 123 112.5 105.5Z', { fill: SKY });

  switch (expression) {
    case 'happy':
      return [...cheeks, strokePath('M73 96q9-12 18 0', EYE, 5.5), strokePath('M109 96q9-12 18 0', EYE, 5.5), grin];
    case 'celebrate':
      return [
        ...cheeks,
        path(star4Path(82, 92, 11.5, 0.22), { fill: CREAM }),
        path(star4Path(118, 92, 11.5, 0.22), { fill: CREAM }),
        grin,
      ];
    case 'love':
      return [
        ...cheeks,
        path(heartPath(82, 93, 8.5), { fill: '#F4B8C4' }),
        path(heartPath(118, 93, 8.5), { fill: '#F4B8C4' }),
        smile,
      ];
    case 'sleepy':
      return [
        ...cheeks,
        path('M74.5 90a7.5 6.5 0 0 0 15 0Z', { fill: EYE }),
        path('M110.5 90a7.5 6.5 0 0 0 15 0Z', { fill: EYE }),
        strokePath('M73 89.5h18', EYE, 3),
        strokePath('M109 89.5h18', EYE, 3),
        strokePath('M93 111h14', SKY, 4),
      ];
    case 'sleep':
      return [
        ...cheeks,
        strokePath('M74 92q8 7 16 0', EYE, 4.5),
        strokePath('M110 92q8 7 16 0', EYE, 4.5),
        ellipse(100, 111, 3.4, 2.8, { fill: SKY }),
      ];
    case 'sad':
      return [
        ...(blink ? blinkEyes : [
          ellipse(82, 94, 6.5, 8, { fill: EYE }),
          ellipse(118, 94, 6.5, 8, { fill: EYE }),
          circle(84, 91, 2, { fill: '#FFFFFF' }),
          circle(120, 91, 2, { fill: '#FFFFFF' }),
        ]),
        strokePath('M73 80.5l16-4', EYE, 3.5),
        strokePath('M111 76.5l16 4', EYE, 3.5),
        strokePath('M90 114q10-8 20 0', SKY, 4.5),
      ];
    case 'alert':
      return [
        ...(blink ? blinkEyes : [
          circle(82, 93, 9, { fill: EYE }),
          circle(118, 93, 9, { fill: EYE }),
          circle(84.5, 89.5, 2.6, { fill: '#FFFFFF' }),
          circle(120.5, 89.5, 2.6, { fill: '#FFFFFF' }),
        ]),
        strokePath('M72.5 77q8.5-6 17-1', EYE, 3.5),
        strokePath('M110.5 76q8.5-5 17 1', EYE, 3.5),
        ellipse(100, 113, 4.6, 5.6, { fill: SKY }),
      ];
    case 'think':
      return [
        ...cheeks,
        ...(blink ? [strokePath('M74 93h16', EYE, 5)] : [ellipse(82, 92, 7.5, 9.5, { fill: EYE }), circle(84.6, 88, 2.4, { fill: '#FFFFFF' })]),
        strokePath('M110 94q8-7 16 0', EYE, 5),
        strokePath('M73.5 77.5q8.5-5.5 17-1', EYE, 3.5),
        strokePath('M91 111q4.5-4 9 0t9 0', SKY, 4),
      ];
    case 'neutral':
    default:
      return [...cheeks, ...(blink ? blinkEyes : openEyes), smile];
  }
}

export function rutixSignalArcs(): Shape[] {
  return [
    strokePath('M87.7 13.4a15 15 0 0 0 0 17.2', SKY, 3.5),
    strokePath('M112.3 13.4a15 15 0 0 1 0 17.2', SKY, 3.5),
    strokePath('M80.3 8.2a24 24 0 0 0 0 27.6', SKY, 3.5, { op: 0.6 }),
    strokePath('M119.7 8.2a24 24 0 0 1 0 27.6', SKY, 3.5, { op: 0.6 }),
  ];
}

export function rutixExtras(expression: RutixExpression): Shape[] {
  switch (expression) {
    case 'sleep':
      return [strokePath('M140 44h11l-11 12h11', EYE, 3.4), strokePath('M158 25h7l-7 8h7', EYE, 2.6, { op: 0.8 })];
    case 'think':
      return [strokePath('M150 33.5c0-5 4-8 8.5-8s8 3 8 7.5c0 6-7 6.5-7 12.5', CREAM, 4), circle(159.5, 53, 2.9, { fill: CREAM })];
    case 'celebrate':
      return [
        path(star4Path(30, 42, 9.5), { fill: CREAM }),
        path(star4Path(172, 50, 7.5), { fill: SKY }),
        path(star4Path(22, 122, 5.5), { fill: SKY }),
        path(star4Path(178, 128, 6.5), { fill: CREAM }),
        circle(160, 20, 2.6, { fill: CREAM }),
        circle(40, 18, 2.2, { fill: SKY }),
      ];
    case 'love':
      return [path(heartPath(162, 38, 7), { fill: '#F4B8C4' }), path(heartPath(38, 48, 5.5), { fill: '#F4B8C4', op: 0.8 })];
    case 'alert':
      return [
        strokePath('M163 24v15', CREAM, 5),
        circle(163, 48, 3, { fill: CREAM }),
        path('M150 72s-5 7-5 10.5c0 3 2.2 5 5 5s5-2 5-5C155 79 150 72 150 72Z', { fill: EYE }),
      ];
    case 'happy':
      return [path(star4Path(166, 42, 6.5), { fill: CREAM, op: 0.9 }), path(star4Path(34, 50, 4.5), { fill: SKY })];
    default:
      return [];
  }
}

export interface RutixDrawingOptions {
  expression?: RutixExpression;
  pose?: RutixPose;
  signal?: number;
  blink?: boolean;
  shadow?: boolean;
}

export function rutixDrawing({ expression = 'neutral', pose = 'idle', signal = 3, blink = false, shadow = true }: RutixDrawingOptions = {}): Drawing {
  return {
    w: 200,
    h: 200,
    gradients: rutixGradients,
    shapes: [
      ...(shadow ? [ellipse(100, 186, 44, 7, { fill: '#000000', op: 0.18 })] : []),
      ...(signal > 0 ? rutixSignalArcs() : []),
      ...rutixBody(pose, signal),
      ...rutixFace(expression, blink),
      ...rutixExtras(expression),
    ],
  };
}

export function expressionForMood(mood: number): RutixExpression {
  if (mood >= 85) return 'happy';
  if (mood >= 60) return 'neutral';
  if (mood >= 35) return 'sleepy';
  return 'sad';
}

export function signalForMood(mood: number): number {
  if (mood >= 85) return 4;
  if (mood >= 60) return 3;
  if (mood >= 35) return 2;
  return mood > 10 ? 1 : 0;
}
