import { circle, ellipse, group, path, rect, star4Path, type Drawing, type Gradient, type Shape } from './shapes';

// Rutix: robot-antena de SoyTEL. Cabeza crema con pantalla azul noche (como el laptop del
// logo), orejas-puerto, antena que emite señal y barras de señal en el pecho que muestran su ánimo.
// Diseño v2 (Claude Design): más volumen (sombras, bisel de la pantalla, botas), 15 expresiones,
// 7 poses y accesorios que se desbloquean jugando.
export type RutixExpression =
  | 'neutral'
  | 'happy'
  | 'celebrate'
  | 'sleepy'
  | 'sleep'
  | 'sad'
  | 'alert'
  | 'think'
  | 'love'
  | 'wink'
  | 'surprised'
  | 'proud'
  | 'worried'
  | 'laugh'
  | 'focus';
export type RutixPose = 'idle' | 'wave' | 'celebrate' | 'think' | 'point' | 'thumbsUp' | 'shrug';
export type RutixAccessory = 'none' | 'cap' | 'headphones' | 'graduation' | 'crown' | 'glasses' | 'scarf' | 'helmet' | 'cape';

export const rutixExpressions: RutixExpression[] = [
  'neutral',
  'happy',
  'celebrate',
  'love',
  'wink',
  'proud',
  'laugh',
  'think',
  'focus',
  'surprised',
  'alert',
  'worried',
  'sleepy',
  'sad',
  'sleep',
];
export const rutixPoses: RutixPose[] = ['idle', 'wave', 'celebrate', 'think', 'point', 'thumbsUp', 'shrug'];
export const rutixAccessories: RutixAccessory[] = ['none', 'cap', 'headphones', 'graduation', 'crown', 'glasses', 'scarf', 'helmet', 'cape'];

const CREAM = '#F4ECD7';
const LIMB = '#E3D3AE';
const LIMB_SHADE = '#CDBB8E';
const BLUE = '#1E5B7F';
const BLUE_DEEP = '#164866';
const SKY = '#6FB3D9';
const EYE = '#A7D4ED';
const NAVY = '#0B2D45';
const GOLD = '#F2CE63';
const GOLD_DEEP = '#C9971F';
const PINK = '#F4B8C4';

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

interface Arm {
  d: string;
  hand: [number, number];
  // Dedo o pulgar extendido (apuntar, pulgar arriba).
  finger?: string;
}

const LEFT_DOWN: Arm = { d: 'M68 143C56 147 52 157 54 167', hand: [54.5, 168] };
const RIGHT_DOWN: Arm = { d: 'M132 143C144 147 148 157 146 167', hand: [145.5, 168] };
const LEFT_UP: Arm = { d: 'M69 142C50 141 34 133 28 117', hand: [26.5, 113] };
const RIGHT_UP: Arm = { d: 'M131 142C150 141 166 133 172 117', hand: [173.5, 113] };

function armsFor(pose: RutixPose): { left: Arm; right: Arm } {
  switch (pose) {
    case 'wave':
      return { left: LEFT_DOWN, right: RIGHT_UP };
    case 'celebrate':
      return { left: LEFT_UP, right: RIGHT_UP };
    case 'think':
      return { left: LEFT_DOWN, right: { d: 'M132 147C150 152 156 140 146 132', hand: [143, 131] } };
    case 'point':
      // Brazo derecho extendido hacia arriba, con el índice señalando (pistas y explicaciones).
      return { left: { d: 'M68 143C54 146 51 156 60 161', hand: [61.5, 162] }, right: { d: 'M131 143C148 140 160 130 166 118', hand: [167.5, 114.5], finger: 'M170 109l7-12' } };
    case 'thumbsUp':
      return { left: LEFT_DOWN, right: { d: 'M132 146C149 151 158 143 157 131', hand: [157, 127], finger: 'M157 123v-11' } };
    case 'shrug':
      return { left: { d: 'M69 143C55 142 46 147 38 140', hand: [35, 136] }, right: { d: 'M131 143C145 142 154 147 162 140', hand: [165, 136] } };
    case 'idle':
    default:
      return { left: LEFT_DOWN, right: RIGHT_DOWN };
  }
}

function armShapes(arm: Arm): Shape[] {
  return [
    strokePath(arm.d, LIMB_SHADE, 13.5, { op: 0.55 }),
    strokePath(arm.d, LIMB, 11.5),
    ...(arm.finger ? [strokePath(arm.finger, BLUE, 6)] : []),
    circle(arm.hand[0], arm.hand[1], 7.8, { fill: BLUE }),
    circle(arm.hand[0] - 2.2, arm.hand[1] - 2.4, 2.2, { fill: SKY, op: 0.55 }),
  ];
}

function arms(pose: RutixPose): Shape[] {
  const { left, right } = armsFor(pose);
  return [...armShapes(left), ...armShapes(right)];
}

// Poses en que la mano derecha pasa por delante del cuerpo.
const FRONT_POSES: RutixPose[] = ['think', 'thumbsUp'];

export function rutixBody(pose: RutixPose = 'idle', signal = 3): Shape[] {
  const bars = [6, 10, 14, 18].map((height, index) =>
    rect(86 + index * 8.5, 161 - height, 5.5, height, 1.6, {
      fill: index < signal ? SKY : BLUE,
      op: index < signal ? 1 : 0.55,
    }),
  );
  const front = FRONT_POSES.includes(pose);
  return [
    // Botas.
    rect(72, 169, 23, 13, 6.5, { fill: BLUE }),
    rect(105, 169, 23, 13, 6.5, { fill: BLUE }),
    strokePath('M77.5 173h9', SKY, 2.4, { op: 0.55 }),
    strokePath('M110.5 173h9', SKY, 2.4, { op: 0.55 }),
    ...(front ? [] : arms(pose)),
    // Torso con panel de señal.
    rect(66, 126, 68, 50, 22, { fill: 'url(#rutix-body)' }),
    path('M68 160C76 178 124 178 132 160C131 171 122 176 100 176C78 176 69 171 68 160Z', { fill: LIMB_SHADE, op: 0.5 }),
    rect(80, 138, 40, 27, 8, { fill: NAVY, op: 0.96 }),
    rect(80, 138, 40, 27, 8, { fill: 'none', stroke: SKY, sw: 1.4, op: 0.35 }),
    ...bars,
    circle(73, 152, 2, { fill: LIMB_SHADE }),
    circle(127, 152, 2, { fill: LIMB_SHADE }),
    // Antena.
    strokePath('M100 50V27', BLUE, 6),
    rect(92, 42, 16, 8, 4, { fill: BLUE_DEEP }),
    circle(100, 22, 9.5, { fill: signal > 0 ? SKY : '#8CA3B4' }),
    circle(96.8, 18.8, 3, { fill: '#FFFFFF', op: 0.75 }),
    // Orejas-puerto.
    rect(34, 79, 14, 33, 7, { fill: BLUE }),
    rect(152, 79, 14, 33, 7, { fill: BLUE }),
    circle(41, 95.5, 3.6, { fill: BLUE_DEEP }),
    circle(159, 95.5, 3.6, { fill: BLUE_DEEP }),
    circle(41, 95.5, 2.2, { fill: SKY }),
    circle(159, 95.5, 2.2, { fill: SKY }),
    // Cabeza con sombra inferior y brillo superior.
    rect(42, 45, 116, 97, 38, { fill: 'url(#rutix-head)' }),
    path('M46 112C58 141 142 141 154 112C152 133 134 142 100 142C66 142 48 133 46 112Z', { fill: LIMB_SHADE, op: 0.42 }),
    strokePath('M63 60C73 52 89 49.5 103 50', '#FFFFFF', 5, { op: 0.6 }),
    // Pantalla con bisel y reflejo.
    rect(56, 61, 88, 65, 24, { fill: 'url(#rutix-screen)' }),
    rect(56, 61, 88, 65, 24, { fill: 'none', stroke: '#2C6F9C', sw: 2, op: 0.85 }),
    strokePath('M69 72h15', '#FFFFFF', 4, { op: 0.16 }),
    strokePath('M129 70l-7 11', '#FFFFFF', 3, { op: 0.09 }),
    ...(front ? arms(pose) : []),
  ];
}

const openEye = (cx: number, cy = 92, rx = 7.5, ry = 9.5): Shape[] => [
  ellipse(cx, cy, rx, ry, { fill: EYE }),
  circle(cx + 2.6, cy - 4, 2.4, { fill: '#FFFFFF' }),
];
const arcEye = (cx: number, y = 96): Shape => strokePath(`M${cx - 9} ${y}q9-12 18 0`, EYE, 5.5);

// `gaze` corre la cara un poco hacia un lado (-1 izquierda, 1 derecha): así Rutix mira alrededor.
export function rutixFace(expression: RutixExpression = 'neutral', blink = false, gaze = 0): Shape[] {
  const shapes = faceShapes(expression, blink);
  return gaze === 0 ? shapes : [group(shapes, { tf: `translate(${gaze * 3.2} 0)` })];
}

function faceShapes(expression: RutixExpression, blink: boolean): Shape[] {
  const cheeks = [circle(69, 110, 6, { fill: SKY, op: 0.32 }), circle(131, 110, 6, { fill: SKY, op: 0.32 })];
  const openEyes = [...openEye(82), ...openEye(118)];
  const blinkEyes = [strokePath('M74 93h16', EYE, 5), strokePath('M110 93h16', EYE, 5)];
  const smile = strokePath('M90 108q10 9 20 0', SKY, 4.5);
  const grin = path('M87.5 105.5Q100 123 112.5 105.5Z', { fill: SKY });

  switch (expression) {
    case 'happy':
      return [...cheeks, arcEye(82), arcEye(118), grin];
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
        path(heartPath(82, 93, 8.5), { fill: PINK }),
        path(heartPath(118, 93, 8.5), { fill: PINK }),
        smile,
      ];
    case 'wink':
      return [...cheeks, ...(blink ? [strokePath('M74 93h16', EYE, 5)] : openEye(82)), arcEye(118, 97), strokePath('M89 107q11 11 22 0', SKY, 4.5), path(star4Path(137, 80, 4.5), { fill: CREAM })];
    case 'proud':
      return [
        circle(69, 110, 6.5, { fill: PINK, op: 0.45 }),
        circle(131, 110, 6.5, { fill: PINK, op: 0.45 }),
        arcEye(82),
        arcEye(118),
        strokePath('M88 108q8 6 15 2q5-3 9-6', SKY, 4.5),
      ];
    case 'laugh':
      return [
        ...cheeks,
        strokePath('M75 86l12 7l-12 7', EYE, 5),
        strokePath('M125 86l-12 7l12 7', EYE, 5),
        path('M86 104Q100 127 114 104Z', { fill: SKY }),
        path('M93 113.5Q100 120 107 113.5Q100 111 93 113.5Z', { fill: PINK }),
      ];
    case 'focus':
      return [
        ...(blink
          ? blinkEyes
          : [
              path('M74.5 96a7.5 7.5 0 0 1 15 0v2h-15Z', { fill: EYE }),
              path('M110.5 96a7.5 7.5 0 0 1 15 0v2h-15Z', { fill: EYE }),
              circle(84.5, 93.5, 2, { fill: '#FFFFFF' }),
              circle(120.5, 93.5, 2, { fill: '#FFFFFF' }),
            ]),
        strokePath('M73 81l17 4', EYE, 3.6),
        strokePath('M127 81l-17 4', EYE, 3.6),
        strokePath('M91 110q9 4 18-1', SKY, 4.5),
      ];
    case 'surprised':
      return [
        ...cheeks,
        circle(82, 93, 10, { fill: EYE }),
        circle(118, 93, 10, { fill: EYE }),
        circle(82, 93, 4.2, { fill: NAVY, op: 0.55 }),
        circle(118, 93, 4.2, { fill: NAVY, op: 0.55 }),
        circle(85.4, 89.2, 2.6, { fill: '#FFFFFF' }),
        circle(121.4, 89.2, 2.6, { fill: '#FFFFFF' }),
        strokePath('M73 75.5q9-6 18-1', EYE, 3.4),
        strokePath('M109 74.5q9-5 18 1', EYE, 3.4),
        ellipse(100, 113.5, 5.2, 6.2, { fill: SKY }),
      ];
    case 'worried':
      return [
        ...(blink ? blinkEyes : [...openEye(82, 94, 6.5, 8), ...openEye(118, 94, 6.5, 8)]),
        strokePath('M73 81.5l16-5', EYE, 3.5),
        strokePath('M111 76.5l16 5', EYE, 3.5),
        strokePath('M89 112q5.5-5 11 0t11 0', SKY, 4),
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
        ...(blink ? blinkEyes : [...openEye(82, 94, 6.5, 8), ...openEye(118, 94, 6.5, 8)]),
        strokePath('M73 80.5l16-4', EYE, 3.5),
        strokePath('M111 76.5l16 4', EYE, 3.5),
        strokePath('M90 114q10-8 20 0', SKY, 4.5),
      ];
    case 'alert':
      return [
        ...(blink
          ? blinkEyes
          : [
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
        ...(blink ? [strokePath('M74 93h16', EYE, 5)] : openEye(82)),
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
      return [path(heartPath(162, 38, 7), { fill: PINK }), path(heartPath(38, 48, 5.5), { fill: PINK, op: 0.8 })];
    case 'alert':
      return [
        strokePath('M163 24v15', CREAM, 5),
        circle(163, 48, 3, { fill: CREAM }),
        path('M150 72s-5 7-5 10.5c0 3 2.2 5 5 5s5-2 5-5C155 79 150 72 150 72Z', { fill: EYE }),
      ];
    case 'surprised':
      return [strokePath('M158 22v13', CREAM, 4.5), circle(158, 43, 2.7, { fill: CREAM }), strokePath('M171 26v10', SKY, 3.6), circle(171, 43, 2.2, { fill: SKY })];
    case 'worried':
      return [path('M152 68s-5.5 7.5-5.5 11.5c0 3.2 2.4 5.5 5.5 5.5s5.5-2.3 5.5-5.5C157.500 75.5 152 68 152 68Z', { fill: EYE })];
    case 'proud':
      return [path(star4Path(164, 44, 8), { fill: GOLD }), path(star4Path(36, 56, 5), { fill: CREAM, op: 0.9 }), circle(174, 62, 2.2, { fill: GOLD })];
    case 'laugh':
      return [strokePath('M28 78l9 5', CREAM, 3.4), strokePath('M24 94h10', CREAM, 3.4), strokePath('M172 78l-9 5', CREAM, 3.4), strokePath('M176 94h-10', CREAM, 3.4)];
    case 'focus':
      return [strokePath('M158 30l10-8', SKY, 3.4), strokePath('M163 41h12', SKY, 3.4), strokePath('M158 52l10 8', SKY, 3.4)];
    case 'happy':
      return [path(star4Path(166, 42, 6.5), { fill: CREAM, op: 0.9 }), path(star4Path(34, 50, 4.5), { fill: SKY })];
    case 'wink':
      return [path(star4Path(166, 46, 6), { fill: CREAM, op: 0.9 })];
    default:
      return [];
  }
}

// Accesorios (se dibujan sobre la cabeza; la antena queda visible).
export function rutixAccessory(accessory: RutixAccessory = 'none'): Shape[] {
  switch (accessory) {
    case 'cap':
      return [
        path('M50 63C50 33 150 33 150 63Z', { fill: SKY }),
        path('M50 63C50 33 150 33 150 63Z', { fill: 'none', stroke: BLUE, sw: 2, op: 0.5 }),
        path('M132 58C152 56 172 60 178 70C160 67 146 66 134 66Z', { fill: BLUE }),
        strokePath('M54 62h92', BLUE, 3.4, { op: 0.75 }),
        path(star4Path(100, 50, 6.5), { fill: CREAM }),
        strokePath('M100 40V27', BLUE, 6),
        circle(100, 22, 9.5, { fill: SKY }),
        circle(96.8, 18.8, 3, { fill: '#FFFFFF', op: 0.75 }),
      ];
    case 'headphones':
      return [
        strokePath('M38 90C38 26 162 26 162 90', NAVY, 8),
        strokePath('M44 86C46 38 154 38 156 86', SKY, 2.4, { op: 0.6 }),
        rect(26, 74, 24, 44, 11, { fill: NAVY }),
        rect(150, 74, 24, 44, 11, { fill: NAVY }),
        rect(30, 82, 9, 28, 4.5, { fill: SKY }),
        rect(161, 82, 9, 28, 4.5, { fill: SKY }),
        strokePath('M100 44V27', BLUE, 6),
        circle(100, 22, 9.5, { fill: SKY }),
        circle(96.8, 18.8, 3, { fill: '#FFFFFF', op: 0.75 }),
      ];
    case 'graduation':
      return [
        path('M66 46h68v14H66Z', { fill: BLUE_DEEP }),
        path('M100 22L158 42L100 60L42 42Z', { fill: NAVY }),
        path('M100 22L158 42L100 60L42 42Z', { fill: 'none', stroke: SKY, sw: 1.6, op: 0.45 }),
        circle(100, 41, 4.2, { fill: GOLD }),
        strokePath('M100 41L146 46V66', GOLD, 2.8),
        path('M141.500 66h9l-1.500 13h-6Z', { fill: GOLD }),
      ];
    case 'crown':
      return [
        path('M64 54L58 22L80 38L100 14L120 38L142 22L136 54Z', { fill: GOLD }),
        path('M64 54L58 22L80 38L100 14L120 38L142 22L136 54Z', { fill: 'none', stroke: GOLD_DEEP, sw: 2.2, join: 'round' }),
        rect(62, 48, 76, 10, 4, { fill: GOLD_DEEP }),
        circle(100, 53, 3.4, { fill: '#C73E3E' }),
        circle(80, 53, 2.6, { fill: SKY }),
        circle(120, 53, 2.6, { fill: SKY }),
        circle(100, 14, 4, { fill: CREAM }),
        circle(58, 22, 3.2, { fill: CREAM }),
        circle(142, 22, 3.2, { fill: CREAM }),
      ];
    case 'scarf':
      return [
        path('M58 128C78 140 122 140 142 128L143 138C122 151 78 151 57 138Z', { fill: SKY }),
        strokePath('M61 134C80 145 120 145 139 134', BLUE, 2.4, { op: 0.55 }),
        rect(59, 139, 15, 30, 6, { fill: SKY }),
        strokePath('M61 150h11M61 158h11', BLUE, 2.4, { op: 0.55 }),
        strokePath('M62 169v5M66.5 169v5M71 169v5', SKY, 2.6),
      ];
    case 'helmet':
      return [
        path('M48 64C48 26 152 26 152 64Z', { fill: GOLD }),
        path('M48 64C48 26 152 26 152 64Z', { fill: 'none', stroke: GOLD_DEEP, sw: 2, op: 0.7 }),
        strokePath('M76 40C70 46 67 52 66 58M124 40C130 46 133 52 134 58', GOLD_DEEP, 3, { op: 0.5 }),
        rect(40, 58, 120, 11, 5.5, { fill: GOLD_DEEP }),
        rect(90, 43, 20, 12, 3, { fill: CREAM }),
        strokePath('M95 49h10', BLUE, 2.4),
        strokePath('M100 35V25', BLUE, 6),
        circle(100, 20, 9, { fill: SKY }),
        circle(97, 17, 2.8, { fill: '#FFFFFF', op: 0.75 }),
      ];
    case 'cape':
      return [strokePath('M72 130C86 139 114 139 128 130', GOLD, 4.5), path(star4Path(100, 136, 6.5), { fill: GOLD })];
    case 'none':
    default:
      return [];
  }
}

// Parte del accesorio que va detrás del cuerpo (la capa).
export function rutixAccessoryBack(accessory: RutixAccessory = 'none'): Shape[] {
  if (accessory !== 'cape') return [];
  return [
    path('M70 130C40 146 30 172 40 192L100 181L160 192C170 172 160 146 130 130Z', { fill: BLUE_DEEP }),
    path('M70 130C40 146 30 172 40 192L53 189.500C46 172 54 150 78 136Z', { fill: SKY, op: 0.45 }),
    path('M130 130C160 146 170 172 160 192L147 189.500C154 172 146 150 122 136Z', { fill: SKY, op: 0.45 }),
  ];
}

// Parte del accesorio que va delante de la cara (los lentes).
export function rutixAccessoryFront(accessory: RutixAccessory = 'none'): Shape[] {
  if (accessory !== 'glasses') return [];
  return [
    rect(66, 79, 31, 27, 10, { fill: EYE, fop: 0.16, stroke: GOLD, sw: 3.2 }),
    rect(103, 79, 31, 27, 10, { fill: EYE, fop: 0.16, stroke: GOLD, sw: 3.2 }),
    strokePath('M97 90q3-3 6 0', GOLD, 3),
    strokePath('M66 88l-8-3M134 88l8-3', GOLD, 3),
  ];
}

// Accesorios altos: tapan las ondas de la antena.
export const TALL_ACCESSORIES: RutixAccessory[] = ['graduation', 'crown', 'helmet'];

export interface RutixDrawingOptions {
  expression?: RutixExpression;
  pose?: RutixPose;
  signal?: number;
  blink?: boolean;
  shadow?: boolean;
  accessory?: RutixAccessory;
}

export function rutixDrawing({ expression = 'neutral', pose = 'idle', signal = 3, blink = false, shadow = true, accessory = 'none' }: RutixDrawingOptions = {}): Drawing {
  // Los accesorios altos tapan las ondas de la antena.
  const arcs = signal > 0 && !TALL_ACCESSORIES.includes(accessory);
  return {
    w: 200,
    h: 200,
    gradients: rutixGradients,
    shapes: [
      ...(shadow ? [ellipse(100, 187, 46, 7, { fill: '#000000', op: 0.18 })] : []),
      ...(arcs ? rutixSignalArcs() : []),
      ...rutixAccessoryBack(accessory),
      ...rutixBody(pose, signal),
      ...rutixAccessory(accessory),
      ...rutixFace(expression, blink),
      ...rutixAccessoryFront(accessory),
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

// Cómo se desbloquea cada accesorio.
export interface RutixAccessoryInfo {
  id: RutixAccessory;
  label: string;
  hint: string;
  level?: number;
  achievement?: string;
}

export const rutixWardrobe: RutixAccessoryInfo[] = [
  { id: 'none', label: 'Clásico', hint: 'El Rutix de siempre.' },
  { id: 'cap', label: 'Jockey TEL', hint: 'Llega al nivel 2.', level: 2 },
  { id: 'headphones', label: 'Audífonos', hint: 'Completa tres ráfagas.', achievement: 'burst-starter' },
  { id: 'graduation', label: 'Birrete', hint: 'Domina las seis áreas de la carrera.', achievement: 'career-explorer' },
  { id: 'crown', label: 'Corona', hint: 'Llega al nivel 8 o gana una ruta en vivo.', level: 8, achievement: 'route-champion' },
  { id: 'glasses', label: 'Lentes', hint: 'Resuelve tres niveles del desafío Binario.', achievement: 'binary-brain' },
  { id: 'scarf', label: 'Bufanda', hint: 'Corre 200 metros en TEL Runner.', achievement: 'runner-rookie' },
  { id: 'helmet', label: 'Casco', hint: 'Juega los seis juegos de la ruta.', achievement: 'station-explorer' },
  { id: 'cape', label: 'Capa', hint: 'Corre 1.000 metros en TEL Runner o llega al nivel 6.', level: 6, achievement: 'runner-courier' },
];

export function isAccessoryUnlocked(info: RutixAccessoryInfo, progress: { level: number; achievements: string[] }): boolean {
  if (info.level === undefined && !info.achievement) return true;
  const byLevel = info.level !== undefined && progress.level >= info.level;
  const byAchievement = Boolean(info.achievement && progress.achievements.includes(info.achievement));
  return byLevel || byAchievement;
}
