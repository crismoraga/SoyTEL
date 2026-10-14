// Lógica de "Viaje de la luz" (B213 · Telecomunicaciones): cómo la fibra guía la luz, cómo se empalma y
// cómo viajan los bits. Todo es puro y determinista: la pantalla solo dibuja lo que se calcula aquí y
// ningún puntaje depende de tiempos ni de animaciones.

import { mulberry32 } from '@/route/random';

export const DEG = Math.PI / 180;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ——— Etapa 1: la luz dentro de la fibra ———

export interface FiberKind {
  id: 'plastica' | 'multimodo' | 'monomodo';
  name: string;
  // Índices de refracción del núcleo y del revestimiento (el núcleo siempre es mayor).
  nCore: number;
  nClad: number;
  // Medidas del dibujo (unidades del lienzo): medio alto del núcleo y grosor del revestimiento.
  coreHalf: number;
  cladding: number;
}

// Tres fibras reales, cada una con un cono de aceptación más estrecho (~31°, 14° y 7°).
export const FIBER_KINDS: readonly FiberKind[] = [
  { id: 'plastica', name: 'Fibra plástica', nCore: 1.49, nClad: 1.4, coreHalf: 9, cladding: 5 },
  { id: 'multimodo', name: 'Fibra multimodo', nCore: 1.48, nClad: 1.46, coreHalf: 8, cladding: 10 },
  { id: 'monomodo', name: 'Fibra monomodo', nCore: 1.48, nClad: 1.475, coreHalf: 4, cladding: 14 },
];

export function numericalAperture(nCore: number, nClad: number): number {
  return Math.sqrt(Math.max(0, nCore * nCore - nClad * nClad));
}

// Ángulo máximo (medido en el aire) con que la luz puede entrar y quedar guiada: sen θ = apertura numérica.
export function acceptanceAngle(nCore: number, nClad: number): number {
  return Math.asin(Math.min(1, numericalAperture(nCore, nClad))) / DEG;
}

// Ángulo crítico en la frontera núcleo-revestimiento: desde ahí hacia arriba hay reflexión total interna.
export function criticalAngle(nCore: number, nClad: number): number {
  return Math.asin(Math.min(1, nClad / nCore)) / DEG;
}

export interface FiberOptics {
  nCore: number;
  nClad: number;
  coreHalf: number;
  cladding: number;
  // Largo del núcleo desde la cara de entrada hasta el receptor.
  length: number;
}

// ¿Esta inclinación del láser entra dentro del cono de aceptación? (positivo = láser sobre el eje).
export function isGuided(optics: Pick<FiberOptics, 'nCore' | 'nClad'>, elevationDeg: number): boolean {
  const angle = Math.abs(elevationDeg);
  return angle < 90 && Math.sin(angle * DEG) <= numericalAperture(optics.nCore, optics.nClad) + 1e-9;
}

export interface RayPoint {
  x: number;
  y: number;
}

export type RayOutcome = 'guided' | 'leaked' | 'missed';

export interface RayTrace {
  outcome: RayOutcome;
  // Recorrido dentro del núcleo: parte en la cara de entrada (0, 0) con el eje en y = 0 e y creciendo hacia abajo.
  points: RayPoint[];
  // Rebotes por reflexión total interna antes de llegar al receptor.
  bounces: number;
  // Si la luz se escapa: el tramo que atraviesa el revestimiento y sale (vacío si no).
  escape: RayPoint[];
  // Ángulo del rayo ya dentro del núcleo, en grados con signo.
  insideAngle: number;
}

// La física deja la luz que se escapa casi rasante al borde; se dibuja más inclinada para que se vea salir.
const MIN_ESCAPE_SLOPE = 0.45;
const ESCAPE_TAIL = 22;

// Traza el rayo que entra por el centro de la cara de la fibra. Es la misma regla que usa el juego para
// decidir si la luz llega: dentro del cono rebota (reflexión total interna), fuera atraviesa el revestimiento.
export function traceRay(optics: FiberOptics, elevationDeg: number): RayTrace {
  const { nCore, nClad, coreHalf: h, cladding: t, length } = optics;
  const origin = { x: 0, y: 0 };
  if (!Number.isFinite(elevationDeg) || Math.abs(elevationDeg) >= 90) {
    return { outcome: 'missed', points: [origin], bounces: 0, escape: [], insideAngle: 0 };
  }
  // Refracción al entrar (Snell, aire n = 1): sen α = n · sen θ.
  const inside = Math.asin(Math.sin(elevationDeg * DEG) / nCore);
  const slope = Math.tan(inside);
  const steep = Math.abs(slope);
  const insideAngle = inside / DEG;
  if (steep < 1e-9) return { outcome: 'guided', points: [origin, { x: length, y: 0 }], bounces: 0, escape: [], insideAngle };
  const firstWall = h / steep;
  if (firstWall >= length) {
    // Llega al receptor sin tocar la pared: no hay nada que reflejar ni que perder.
    return { outcome: 'guided', points: [origin, { x: length, y: slope * length }], bounces: 0, escape: [], insideAngle };
  }
  const direction = Math.sign(slope);
  const first = { x: firstWall, y: direction * h };
  const points = [origin, first];
  if (!isGuided(optics, elevationDeg)) {
    // Con un ángulo de incidencia menor que el crítico no hay reflexión total: la luz pasa al revestimiento.
    const incidence = Math.PI / 2 - Math.abs(inside);
    const refracted = Math.PI / 2 - Math.asin(Math.min(1, (nCore / nClad) * Math.sin(incidence)));
    const out = Math.max(Math.tan(refracted), MIN_ESCAPE_SLOPE);
    const escape = [first, { x: first.x + t / out, y: direction * (h + t) }, { x: first.x + (t + ESCAPE_TAIL) / out, y: direction * (h + t + ESCAPE_TAIL) }];
    return { outcome: 'leaked', points, bounces: 0, escape, insideAngle };
  }
  // Cada cruce del núcleo mide 2h / pendiente: la luz rebota de pared en pared hasta el receptor.
  const period = (2 * h) / steep;
  let wallX = firstWall;
  let wallY = direction * h;
  let bounces = 1;
  while (wallX + period < length && bounces < 500) {
    wallX += period;
    wallY = -wallY;
    points.push({ x: wallX, y: wallY });
    bounces += 1;
  }
  points.push({ x: length, y: wallY - Math.sign(wallY) * steep * (length - wallX) });
  return { outcome: 'guided', points, bounces, escape: [], insideAngle };
}

// Cuántas veces rebota la luz guiada (fórmula directa; coincide con `traceRay`).
export function reflectionCount(optics: FiberOptics, elevationDeg: number): number {
  if (!isGuided(optics, elevationDeg)) return 0;
  const steep = Math.abs(Math.tan(Math.asin(Math.sin(elevationDeg * DEG) / optics.nCore)));
  if (steep < 1e-9) return 0;
  const firstWall = optics.coreHalf / steep;
  if (firstWall >= optics.length) return 0;
  return Math.ceil((optics.length - firstWall) / ((2 * optics.coreHalf) / steep));
}

// ——— Lienzo de la etapa 1 (unidades de dibujo, ancho fijo y alto según el espacio disponible) ———

export const SCENE_W = 320;
export const ANGLE_MAX = 50;
export const ANGLE_STEP = 2;
// Tiempo que hay que mantener un buen ángulo para que la luz se confirme sola.
export const HOLD_MS = 600;

export interface SceneFit {
  H: number;
  scale: number;
  width: number;
  height: number;
}

// Ajusta un lienzo de 320 de ancho al espacio dado: el alto del dibujo sigue al del espacio (entre los topes)
// y la escala hace que todo quepa sin deformarse.
export function fitScene(size: { width: number; height: number }, minH: number, maxH: number): SceneFit {
  const width = Math.max(1, size.width);
  const height = Math.max(1, size.height);
  const H = clamp((SCENE_W * height) / width, minH, maxH);
  const scale = Math.min(width / SCENE_W, height / H);
  return { H, scale, width: SCENE_W * scale, height: H * scale };
}

export interface LightTarget {
  kind: FiberKind['id'];
  name: string;
  nCore: number;
  nClad: number;
  // Semiángulo del cono de aceptación (grados).
  cone: number;
  coreHalf: number;
  cladding: number;
  length: number;
  // Cuánto se corre la fibra del centro del lienzo (varía con la semilla).
  axisShift: number;
  // Inclinación inicial del láser: siempre fuera del cono y par, para llegar a 0° con pasos de 2°.
  startAngle: number;
}

export interface SceneLayout {
  height: number;
  faceX: number;
  axisY: number;
  orbit: number;
  length: number;
  receiverX: number;
}

// El láser gira alrededor del centro de la cara de la fibra (a distancia `orbit`) apuntando siempre hacia él.
export function sceneLayout(target: Pick<LightTarget, 'axisShift' | 'length'>, height: number): SceneLayout {
  const H = clamp(height, 150, 230);
  const axisY = H / 2 + target.axisShift;
  const room = Math.min(axisY, H - axisY) - 12;
  const orbit = clamp(room / Math.sin(ANGLE_MAX * DEG), 56, 92);
  const faceX = Math.round(orbit + 30);
  const length = Math.max(60, Math.min(target.length, SCENE_W - 34 - faceX));
  return { height: H, faceX, axisY, orbit, length, receiverX: faceX + length };
}

// Posición del láser para una inclinación dada (positivo = sobre el eje, apuntando hacia abajo).
export function laserPoint(layout: SceneLayout, elevationDeg: number): RayPoint {
  const rad = elevationDeg * DEG;
  return { x: layout.faceX - layout.orbit * Math.cos(rad), y: layout.axisY - layout.orbit * Math.sin(rad) };
}

// Inclinación del láser cuando el dedo lo arrastra hasta el punto (x, y) del lienzo.
export function elevationFromPoint(layout: SceneLayout, x: number, y: number): number {
  const dx = Math.max(1, layout.faceX - x);
  return clamp(Math.round(Math.atan2(layout.axisY - y, dx) / DEG), -ANGLE_MAX, ANGLE_MAX);
}

// ——— Etapa 2: empalme ———

export const SPLICE_CORE = 52;
export const SPLICE_CLAD = 5;
// Apertura numérica de la fibra multimodo de 50 µm.
export const SPLICE_NA = 0.2;
export const OFFSET_STEP = 2;
export const OFFSET_MAX = 26;
export const TILT_STEP = 1;
export const TILT_MAX = 8;
// Se puede fijar el empalme cuando pasa al menos el 90 % de la luz.
export const SPLICE_LOCK = 0.9;

// Fracción de dos círculos iguales (los núcleos vistos de frente) que se superpone cuando sus centros están
// separados `ratio` diámetros: 1 con los núcleos alineados, 0 cuando ya no se tocan.
export function lensOverlap(ratio: number): number {
  const x = clamp(Math.abs(ratio), 0, 1);
  if (x <= 1e-9) return 1;
  return (2 / Math.PI) * (Math.acos(x) - x * Math.sqrt(1 - x * x));
}

// Desalineación lateral: solo pasa la luz del área en que los dos núcleos se superponen.
export function lateralCoupling(offset: number, coreDiameter: number): number {
  return lensOverlap(offset / coreDiameter);
}

// Inclinación: los conos de aceptación de las dos fibras quedan desfasados en sen θ (aire, n = 1).
export function angularCoupling(tiltDeg: number, na: number): number {
  return lensOverlap(Math.sin(Math.abs(tiltDeg) * DEG) / (2 * na));
}

// Fracción de la luz que pasa por el empalme (0 a 1).
export function spliceCoupling(offset: number, tiltDeg: number, spec: Pick<SpliceTarget, 'coreDiameter' | 'na'>): number {
  return lateralCoupling(offset, spec.coreDiameter) * angularCoupling(tiltDeg, spec.na);
}

export type CouplingBand = 'low' | 'mid' | 'ok';

export function couplingBand(coupling: number): CouplingBand {
  if (coupling >= SPLICE_LOCK) return 'ok';
  return coupling >= 0.6 ? 'mid' : 'low';
}

export interface SpliceTarget {
  coreDiameter: number;
  cladding: number;
  na: number;
  // Desfase vertical inicial del extremo derecho (positivo = más abajo); par, para llegar a 0 con pasos de 2.
  startOffset: number;
  // Giro inicial del extremo derecho en grados (0 en el primer empalme).
  startTilt: number;
  tilts: boolean;
}

// ——— Etapa 3: mensaje en bits ———

// Cada letra viaja como 8 bits (ASCII): luz encendida = 1, apagada = 0.
export function charBits(char: string): number[] {
  return char
    .charCodeAt(0)
    .toString(2)
    .padStart(8, '0')
    .slice(-8)
    .split('')
    .map(Number);
}

export function toBits(text: string): number[] {
  return text.split('').flatMap(charBits);
}

export function decodeBits(bits: number[]): string {
  let out = '';
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    const code = parseInt(bits.slice(i, i + 8).join(''), 2);
    out += code >= 32 && code < 127 ? String.fromCharCode(code) : '·';
  }
  return out;
}

// "01010011" -> "0101 0011": los bits se leen mejor en grupos de cuatro.
export function groupBits(bits: number[]): string {
  return bits.map((bit, index) => (index > 0 && index % 4 === 0 ? ` ${bit}` : String(bit))).join('');
}

const WORDS = ['SOS', 'LUZ', 'TEL', 'USM', 'RED', 'BIT', 'WEB'];

// ——— Partida: objetivos de cada etapa según la semilla ———

export interface FiberPlan {
  light: LightTarget[];
  splices: SpliceTarget[];
  // Palabra de 3 letras: cada letra es un nivel de 8 bits.
  word: string;
}

export const LIGHT_COUNT = 3;
export const SPLICE_COUNT = 3;

export function buildPlan(seed: number): FiberPlan {
  const random = mulberry32(seed ^ 0xf1be);
  const side = random() < 0.5 ? -1 : 1;
  const light = FIBER_KINDS.map((kind, index): LightTarget => {
    const cone = acceptanceAngle(kind.nCore, kind.nClad);
    const spread = Math.min(ANGLE_MAX - 3, cone + 8 + random() * 14);
    return {
      kind: kind.id,
      name: kind.name,
      nCore: kind.nCore,
      nClad: kind.nClad,
      cone,
      coreHalf: Math.round((kind.coreHalf + random() - 0.5) * 2) / 2,
      cladding: kind.cladding,
      length: 160 + Math.round(random() * 20),
      axisShift: Math.round((random() - 0.5) * 12),
      startAngle: (index % 2 === 0 ? side : -side) * Math.min(Math.round(spread / 2) * 2, ANGLE_MAX - 2),
    };
  });
  const splices = [0, 1, 2].map((index): SpliceTarget => {
    const offsetSign = random() < 0.5 ? -1 : 1;
    const tiltSign = random() < 0.5 ? -1 : 1;
    const tilts = index > 0;
    return {
      coreDiameter: SPLICE_CORE,
      cladding: SPLICE_CLAD,
      na: SPLICE_NA,
      startOffset: offsetSign * (18 + 2 * Math.floor(random() * 4) + (index === 2 ? 2 : 0)),
      startTilt: tilts ? tiltSign * (3 + Math.floor(random() * 3) + (index === 2 ? 1 : 0)) : 0,
      tilts,
    };
  });
  return { light, splices, word: WORDS[Math.floor(random() * WORDS.length)] };
}

// ——— Puntaje (suma exacta 1000 con todo perfecto) ———

export const LIGHT_EACH = 110;
export const SPLICE_EACH = 110;
export const LIGHT_MAX = LIGHT_EACH * LIGHT_COUNT;
export const SPLICE_MAX = SPLICE_EACH * SPLICE_COUNT;
export const MESSAGE_MAX = 340;
export const TOTAL_MAX = LIGHT_MAX + SPLICE_MAX + MESSAGE_MAX;

// Cada envío de luz fuera del cono resta 20 puntos (mínimo 50 por objetivo).
export function lightPoints(wrongSends: number): number {
  return Math.max(50, LIGHT_EACH - 20 * Math.max(0, wrongSends));
}

// 60 puntos por fijar el empalme (desde 90 %) y hasta 50 más por afinar la alineación hasta 99 %.
export function splicePoints(coupling: number): number {
  if (coupling < SPLICE_LOCK - 1e-9) return 0;
  return 60 + Math.round(50 * clamp((coupling - SPLICE_LOCK) / 0.09, 0, 1));
}

// Puntos por los bits recibidos; cada error baja 6 % la calidad (no menos de 35 %).
export function messagePoints(bits: number, total: number, errors: number): number {
  if (total <= 0) return 0;
  const progress = clamp(bits / total, 0, 1);
  return Math.round(MESSAGE_MAX * progress * Math.max(0.35, 1 - 0.06 * Math.max(0, errors)));
}

export interface FiberProgress {
  // Envíos fallidos antes de lograr cada objetivo de luz (uno por objetivo logrado).
  lightWrong: number[];
  // Acoplamiento con que se fijó cada empalme.
  spliceCouplings: number[];
  messageBits: number;
  messageTotal: number;
  messageErrors: number;
}

export function emptyProgress(messageTotal: number): FiberProgress {
  return { lightWrong: [], spliceCouplings: [], messageBits: 0, messageTotal, messageErrors: 0 };
}

export interface FiberTotals {
  light: number;
  splice: number;
  message: number;
  total: number;
  accuracy: number;
}

export function fiberTotals(progress: FiberProgress): FiberTotals {
  const wrong = progress.lightWrong.slice(0, LIGHT_COUNT);
  const couplings = progress.spliceCouplings.slice(0, SPLICE_COUNT);
  const light = wrong.reduce((sum, count) => sum + lightPoints(count), 0);
  const splice = couplings.reduce((sum, coupling) => sum + splicePoints(coupling), 0);
  const message = messagePoints(progress.messageBits, progress.messageTotal, progress.messageErrors);
  const lightAccuracy = wrong.filter((count) => count === 0).length / LIGHT_COUNT;
  const spliceAccuracy = couplings.reduce((sum, coupling) => sum + clamp(coupling, 0, 1), 0) / SPLICE_COUNT;
  const messageAccuracy = progress.messageTotal > 0 ? clamp(progress.messageBits / (progress.messageTotal + progress.messageErrors), 0, 1) : 0;
  return {
    light,
    splice,
    message,
    total: Math.min(TOTAL_MAX, light + splice + message),
    accuracy: clamp((lightAccuracy + spliceAccuracy + messageAccuracy) / 3, 0, 1),
  };
}
