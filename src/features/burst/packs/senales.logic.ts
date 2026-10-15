// Reglas puras del paquete de microjuegos · Señales (sin UI) para poder probarlas: generadores de
// rondas (siempre con una sola respuesta correcta y opciones bien distintas), la geometría de los
// dibujos y los puntajes. Los dibujos se calculan en el espacio del propio tablero (px) para que
// el trazo coincida con lo que se mide.
import { shuffle, type Point, type Random } from '../logic';
import type { TileState } from '../parts';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

export const MAX_LEVEL = 7;

// Nivel de dificultad entero entre 0 (primera ronda) y 7.
export function levelOf(level: number): number {
  return Number.isFinite(level) ? Math.max(0, Math.min(MAX_LEVEL, Math.floor(level))) : 0;
}

// Va de `from` (nivel 0) a `to` (nivel 7).
export function ramp(level: number, from: number, to: number): number {
  return from + ((to - from) * levelOf(level)) / MAX_LEVEL;
}

function between(random: Random, min: number, max: number): number {
  return min + random() * (max - min);
}

function intBetween(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

export const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

// Un color por fila: ayuda a ubicarse (la letra y el trazo comparten color).
export const ROW_COLORS = ['#6FD3FF', '#7BDFB5', '#FFD166', '#FF8FB1'] as const;

// Puntos extra por acertar: suben un poco con la ronda (de 20 a 48; el tope del anfitrión es 60).
export function answerBonus(level: number): number {
  return 20 + levelOf(level) * 4;
}

// Estado de una opción después de responder.
export function tileState(index: number, chosen: number | null, answer: number): TileState {
  if (chosen === null) return 'idle';
  if (index === answer) return 'correct';
  return index === chosen ? 'wrong' : 'dimmed';
}

// ---- Geometría común de las filas (ondas, ruido, fibra, muestreo) ----
export const ROW_GAP = 6;
export const ROW_BORDER = 1.5;
export const ROW_PAD_X = 8;
export const ROW_PAD_Y = 4;
export const BADGE_SIZE = 26;
export const BADGE_GAP = 8;
// Alto máximo de una fila: en pantallas grandes las filas no necesitan crecer más.
export const ROW_MAX_HEIGHT = 120;

export interface RowGeometry {
  rowHeight: number;
  traceWidth: number;
  traceHeight: number;
}

// Reparte el tablero (ancho × alto) entre `count` filas; el dibujo ocupa lo que deja la letra.
export function rowGeometry(width: number, height: number, count: number): RowGeometry {
  const rowHeight = Math.max(1, Math.floor((height - ROW_GAP * (count - 1)) / count));
  const traceWidth = Math.max(1, Math.floor(width - 2 * (ROW_BORDER + ROW_PAD_X) - BADGE_SIZE - BADGE_GAP));
  const traceHeight = Math.max(1, Math.floor(rowHeight - 2 * (ROW_BORDER + ROW_PAD_Y)));
  return { rowHeight, traceWidth, traceHeight };
}

const round1 = (value: number) => Math.round(value * 10) / 10;

// Puntos → trazo SVG ("M x y L x y …").
export function polylinePath(points: ReadonlyArray<readonly [number, number]>): string {
  return points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${round1(x)} ${round1(y)}`).join(' ');
}

// Valores (-limit..limit) repartidos a lo ancho → trazo SVG centrado en la mitad del alto.
export function samplesPath(samples: readonly number[], width: number, height: number, limit = 1, pad = 3): string {
  const scale = (height / 2 - pad) / limit;
  const last = Math.max(1, samples.length - 1);
  return polylinePath(samples.map((value, index) => [(index / last) * width, height / 2 - value * scale] as const));
}

// ---- 1 · ¿Cuál vibra más? (frecuencia de una onda) ----
export type WaveAsk = 'fastest' | 'slowest';

export interface WaveOption {
  letter: string;
  // Ciclos completos en la misma ventana de tiempo: eso es la frecuencia.
  cycles: number;
  // Altura de la onda (0 a 1 de la mitad del alto): no cambia la frecuencia.
  amplitude: number;
  phase: number;
}

export interface WaveFrequencyRound {
  ask: WaveAsk;
  options: WaveOption[];
  answer: number;
  note: string;
}

interface CycleRules {
  count: number;
  gap: number;
  spacing: number;
  max: number;
  ask: WaveAsk;
}

// Ciclos distintos entre sí; la respuesta (la mayor o la menor) se separa de la siguiente al menos `gap`.
function pickCycles({ count, gap, spacing, max, ask }: CycleRules, random: Random): number[] {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const sorted = shuffle(range(2, max), random)
      .slice(0, count)
      .sort((a, b) => a - b);
    const spaced = sorted.every((value, index) => index === 0 || value - sorted[index - 1] >= spacing);
    const edge = ask === 'fastest' ? sorted[count - 1] - sorted[count - 2] : sorted[1] - sorted[0];
    if (spaced && edge >= gap) return sorted;
  }
  return Array.from({ length: count }, (_, index) => 3 + index * 3);
}

export function waveFrequencyRound(level: number, random: Random = Math.random): WaveFrequencyRound {
  const lv = levelOf(level);
  const count = lv >= 3 ? 4 : 3;
  // Más difícil = ciclos más parecidos (de 3 de diferencia a 1).
  const gap = lv <= 1 ? 3 : lv <= 4 ? 2 : 1;
  const ask: WaveAsk = lv > 0 && random() < 0.2 + lv * 0.04 ? 'slowest' : 'fastest';
  const cycles = pickCycles({ count, gap, spacing: gap >= 2 ? 2 : 1, max: lv <= 1 ? 9 : 12, ask }, random);
  const options: WaveOption[] = shuffle(cycles, random).map((value, index) => ({
    letter: OPTION_LETTERS[index],
    cycles: value,
    // Desde la ronda 3 las alturas distintas despistan: la altura no es la frecuencia.
    amplitude: lv >= 2 ? between(random, 0.5, 1) : 0.85,
    // Arrancan cerca de cero para que contar crestas no tenga trampa en los bordes.
    phase: (random() < 0.5 ? 0 : Math.PI) + between(random, -0.45, 0.45),
  }));
  const target = ask === 'fastest' ? Math.max(...cycles) : Math.min(...cycles);
  const answer = options.findIndex((option) => option.cycles === target);
  const letter = options[answer].letter;
  const note =
    ask === 'fastest'
      ? `La ${letter} da ${target} ciclos: más ciclos en el mismo tiempo = más rápida.`
      : `La ${letter} da solo ${target} ciclos: menos ciclos en el mismo tiempo = más lenta.`;
  return { ask, options, answer, note };
}

// Alturas de la onda (-1..1) a lo largo de la ventana de tiempo.
export function waveSamples(option: Pick<WaveOption, 'cycles' | 'amplitude' | 'phase'>, steps: number): number[] {
  return Array.from({ length: steps + 1 }, (_, index) => option.amplitude * Math.sin(TAU * option.cycles * (index / steps) + option.phase));
}

export function wavePath(width: number, height: number, option: Pick<WaveOption, 'cycles' | 'amplitude' | 'phase'>): string {
  return samplesPath(waveSamples(option, Math.max(80, Math.ceil(option.cycles * 18))), width, height);
}

// ---- 2 · ¿AM o FM? (modulación) ----
export type Modulation = 'am' | 'fm' | 'none';

export interface AmFmRound {
  kind: Modulation;
  choices: Modulation[];
  answer: number;
  // Ciclos de la portadora y del mensaje en la ventana de tiempo.
  carrier: number;
  message: number;
  // AM: índice de modulación (cuánto sube y baja la altura). FM: desviación relativa de la frecuencia.
  depth: number;
  messagePhase: number;
  carrierPhase: number;
  note: string;
}

export const amFmNotes: Record<Modulation, string> = {
  am: 'Era AM: la altura de la onda sube y baja con el mensaje.',
  fm: 'Era FM: las crestas se juntan y se separan; la altura no cambia.',
  none: 'Sin modular: la altura y la separación son siempre iguales.',
};

export function amFmRound(level: number, random: Random = Math.random): AmFmRound {
  const lv = levelOf(level);
  const choices: Modulation[] = lv >= 2 ? ['am', 'fm', 'none'] : ['am', 'fm'];
  const kind = choices[Math.floor(random() * choices.length)];
  // Más difícil = el cambio se nota menos (pero siempre se nota).
  const depth =
    kind === 'am'
      ? clamp(ramp(lv, 0.85, 0.34) + between(random, -0.04, 0.04), 0.3, 0.9)
      : kind === 'fm'
        ? clamp(ramp(lv, 0.5, 0.24) + between(random, -0.03, 0.03), 0.2, 0.55)
        : 0;
  return {
    kind,
    choices,
    answer: choices.indexOf(kind),
    carrier: intBetween(random, 13, 17),
    message: [1.5, 2, 2.5, 3][Math.floor(random() * 4)],
    depth,
    messagePhase: between(random, 0, TAU),
    carrierPhase: between(random, 0, TAU),
    note: amFmNotes[kind],
  };
}

export type ModulationParams = Pick<AmFmRound, 'kind' | 'carrier' | 'message' | 'depth' | 'messagePhase' | 'carrierPhase'>;

// Señal modulada (-1..1). AM: la altura sigue al mensaje. FM: la frecuencia sigue al mensaje
// (la fase es la integral de la frecuencia instantánea fc·(1 + d·sen(2π·fm·t))).
export function modulatedSamples(params: ModulationParams, count: number): number[] {
  const { kind, carrier, message, depth, messagePhase, carrierPhase } = params;
  const index = (carrier * depth) / message;
  return Array.from({ length: count }, (_, i) => {
    const t = count > 1 ? i / (count - 1) : 0;
    const wave = Math.sin(TAU * message * t + messagePhase);
    if (kind === 'am') return ((1 + depth * wave) / (1 + depth)) * Math.sin(TAU * carrier * t + carrierPhase);
    if (kind === 'fm') return Math.sin(TAU * carrier * t + carrierPhase + index * (Math.cos(messagePhase) - Math.cos(TAU * message * t + messagePhase)));
    return Math.sin(TAU * carrier * t + carrierPhase);
  });
}

export const AMFM_SAMPLES = 480;

export interface TraceStats {
  lobes: number;
  // Cociente entre la cresta más alta y la más baja (1 = todas iguales).
  heightRatio: number;
  // Cociente entre la mayor y la menor separación de cruces por cero (1 = parejas).
  spacingRatio: number;
}

// Mide lo mismo que se ve: la altura de cada cresta y la separación entre cruces por cero.
export function traceStats(samples: readonly number[]): TraceStats {
  const heights: number[] = [];
  const starts: number[] = [];
  let open = false;
  let top = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const before = samples[i - 1];
    const now = samples[i];
    if (before <= 0 && now > 0) {
      starts.push(i - 1 + -before / (now - before));
      open = true;
      top = now;
    } else if (now > 0) {
      top = Math.max(top, now);
    }
    if (now <= 0 && before > 0 && open) {
      heights.push(top);
      open = false;
    }
  }
  if (heights.length < 2 || starts.length < 3) return { lobes: heights.length, heightRatio: 1, spacingRatio: 1 };
  const gaps = starts.slice(1).map((start, index) => start - starts[index]);
  return { lobes: heights.length, heightRatio: Math.max(...heights) / Math.min(...heights), spacingRatio: Math.max(...gaps) / Math.min(...gaps) };
}

// ---- 3 · Canal libre (Wi-Fi 2,4 GHz) ----
// Un canal mide 22 MHz y los centros están a 5 MHz: los canales vecinos se pisan y solo el 1, 6 y 11 no.
export const CANDIDATE_CHANNELS = [1, 6, 11] as const;
export const SPECTRUM_FROM = -1.5;
export const SPECTRUM_TO = 13.5;
// Mitad del ancho de una red, en canales (22 MHz / 5 MHz / 2).
export const HILL_HALF = 2.2;

export type Strength = 1 | 2 | 3;

export interface Neighbor {
  channel: number;
  strength: Strength;
}

export interface WifiChannelRound {
  neighbors: Neighbor[];
  // Cuánta red vecina cae sobre cada canal candidato (en el orden de CANDIDATE_CHANNELS).
  loads: number[];
  answer: number;
  note: string;
}

// Altura de la loma de una red (0 a 1) a `offset` canales de su centro.
export function hillHeight(offset: number): number {
  return Math.abs(offset) >= HILL_HALF ? 0 : (1 + Math.cos((Math.PI * offset) / HILL_HALF)) / 2;
}

// Área acumulada de la loma (coseno elevado) hasta `u`.
function hillArea(u: number): number {
  return u / 2 + (HILL_HALF / (2 * Math.PI)) * Math.sin((Math.PI * u) / HILL_HALF);
}

// Qué parte (0 a 1) de la loma de una red vecina cae dentro de la franja del canal candidato.
export function bandShare(neighborChannel: number, candidate: number): number {
  const from = Math.max(-HILL_HALF, candidate - HILL_HALF - neighborChannel);
  const to = Math.min(HILL_HALF, candidate + HILL_HALF - neighborChannel);
  return to <= from ? 0 : (hillArea(to) - hillArea(from)) / HILL_HALF;
}

// Lo que ve el jugador: la cantidad de color (redes vecinas, más fuertes pesan más) dentro de la franja.
export function channelLoad(neighbors: readonly Neighbor[], candidate: number): number {
  return neighbors.reduce((total, neighbor) => total + neighbor.strength * bandShare(neighbor.channel, candidate), 0);
}

// El canal elegido gana por un margen claro sobre cada uno de los otros.
export function isClearWinner(loads: readonly number[], index: number, gap: number): boolean {
  return loads.every((load, other) => other === index || load - loads[index] >= gap);
}

function randomStrength(random: Random): Strength {
  const value = random();
  return value < 0.35 ? 1 : value < 0.75 ? 2 : 3;
}

function wifiNote(channel: number): string {
  return `El canal ${channel} estaba más libre: casi nadie se le monta encima. Solo 1, 6 y 11 no se pisan.`;
}

export function wifiChannelRound(level: number, random: Random = Math.random): WifiChannelRound {
  const lv = levelOf(level);
  const count = 4 + (lv >= 3 ? 1 : 0) + (lv >= 6 ? 1 : 0);
  // Margen mínimo (en "redes completas") entre el canal libre y el siguiente.
  const gap = ramp(lv, 1.5, 0.6);
  const target = Math.floor(random() * CANDIDATE_CHANNELS.length);
  for (let attempt = 0; attempt < 800; attempt += 1) {
    const neighbors: Neighbor[] = Array.from({ length: count }, () => ({ channel: intBetween(random, 1, 11), strength: randomStrength(random) }));
    const loads = CANDIDATE_CHANNELS.map((channel) => channelLoad(neighbors, channel));
    if (isClearWinner(loads, target, gap)) return { neighbors, loads, answer: target, note: wifiNote(CANDIDATE_CHANNELS[target]) };
  }
  // Respaldo (casi nunca): redes solo sobre los otros dos canales candidatos.
  const others = CANDIDATE_CHANNELS.filter((_, index) => index !== target);
  const neighbors: Neighbor[] = [
    { channel: others[0], strength: 3 },
    { channel: others[1], strength: 2 },
    { channel: others[0], strength: 1 },
    { channel: others[1], strength: 1 },
  ];
  return { neighbors, loads: CANDIDATE_CHANNELS.map((channel) => channelLoad(neighbors, channel)), answer: target, note: wifiNote(CANDIDATE_CHANNELS[target]) };
}

// Posición horizontal de un canal en un espectro de `width` px.
export function spectrumX(channel: number, width: number): number {
  return ((channel - SPECTRUM_FROM) / (SPECTRUM_TO - SPECTRUM_FROM)) * width;
}

// Contorno de la loma de una red (cerrado sobre la línea base).
export function hillPath(neighbor: Neighbor, width: number, baseline: number, maxHeight: number): string {
  const steps = 24;
  const points: Array<[number, number]> = Array.from({ length: steps + 1 }, (_, index) => {
    const offset = -HILL_HALF + (2 * HILL_HALF * index) / steps;
    return [spectrumX(neighbor.channel + offset, width), baseline - (neighbor.strength / 3) * maxHeight * hillHeight(offset)];
  });
  return `${polylinePath(points)} Z`;
}

// ---- 4 · Luz atrapada (fibra óptica) ----
// Índices de refracción del dibujo (exagerados para que se vean los rebotes): el núcleo guía la luz.
export const CORE_INDEX = 1.5;
export const CLADDING_INDEX = 1.2;
// Ángulo crítico (desde la normal a la pared) y su complemento (desde el eje de la fibra).
export const CRITICAL_ANGLE = Math.asin(CLADDING_INDEX / CORE_INDEX) / DEG;
export const MAX_AXIS_ANGLE = 90 - CRITICAL_ANGLE;

// Con un ángulo menor al límite (casi paralelo a la fibra) hay reflexión interna total.
export function staysInside(axisAngle: number): boolean {
  return axisAngle < MAX_AXIS_ANGLE;
}

export interface RayTrace {
  // Recorrido dentro del núcleo (x de 0 a `length`, y centrado en 0).
  points: Point[];
  // Puntos donde rebota en la pared.
  bounces: Point[];
  escaped: boolean;
  // Tramo que se escapa al revestimiento: de la pared hacia afuera (vacío si queda atrapado).
  leak: Point[];
}

// Sigue un rayo que entra con `axisAngle` grados respecto al eje; `direction` 1 = baja, -1 = sube.
export function traceRay(axisAngle: number, offset: number, direction: 1 | -1, length: number, halfWidth: number, leakLength = halfWidth * 2.2): RayTrace {
  const angle = axisAngle * DEG;
  const dx = Math.cos(angle);
  let dy = direction * Math.sin(angle);
  const points: Point[] = [{ x: 0, y: offset * halfWidth }];
  const bounces: Point[] = [];
  const escapes = !staysInside(axisAngle);
  let x = 0;
  let y = offset * halfWidth;
  if (Math.abs(dy) < 1e-9) {
    points.push({ x: length, y });
    return { points, bounces, escaped: false, leak: [] };
  }
  for (let guard = 0; guard < 500; guard += 1) {
    const toWall = ((dy > 0 ? halfWidth : -halfWidth) - y) / dy;
    const toEnd = (length - x) / dx;
    if (toEnd <= toWall) {
      points.push({ x: length, y: y + dy * toEnd });
      return { points, bounces, escaped: false, leak: [] };
    }
    x += dx * toWall;
    y = dy > 0 ? halfWidth : -halfWidth;
    points.push({ x, y });
    if (escapes) {
      // Ley de Snell: al salir a un medio de menor índice el rayo se abre (se aleja de la normal).
      const refracted = Math.asin(Math.min(1, (CORE_INDEX / CLADDING_INDEX) * Math.sin((90 - axisAngle) * DEG)));
      const out = Math.PI / 2 - refracted;
      return { points, bounces, escaped: true, leak: [{ x, y }, { x: x + Math.cos(out) * leakLength, y: y + Math.sign(dy) * Math.sin(out) * leakLength }] };
    }
    bounces.push({ x, y });
    dy = -dy;
  }
  return { points, bounces, escaped: false, leak: [] };
}

export type FiberAsk = 'trapped' | 'escaping';

export interface FiberOption {
  letter: string;
  angle: number;
  offset: number;
  direction: 1 | -1;
  trapped: boolean;
}

export interface FiberAngleRound {
  ask: FiberAsk;
  options: FiberOption[];
  answer: number;
  note: string;
}

// `count` ángulos entre `min` y `max`, separados al menos `spacing` grados.
function spreadAngles(random: Random, count: number, min: number, max: number, spacing: number): number[] {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const values = Array.from({ length: count }, () => between(random, min, max)).sort((a, b) => a - b);
    if (values.every((value, index) => index === 0 || value - values[index - 1] >= spacing)) return values;
  }
  return Array.from({ length: count }, (_, index) => (count === 1 ? (min + max) / 2 : min + ((max - min) * index) / (count - 1)));
}

export function fiberAngleRound(level: number, random: Random = Math.random): FiberAngleRound {
  const lv = levelOf(level);
  const count = lv >= 3 ? 4 : 3;
  // Desde la ronda 4, a veces hay que encontrar la luz que SE ESCAPA.
  const ask: FiberAsk = lv >= 3 && random() < 0.3 ? 'escaping' : 'trapped';
  // Más difícil = ángulos más cerca del límite (siempre con al menos 6° de margen).
  const trappedMax = MAX_AXIS_ANGLE - ramp(lv, 17, 6);
  const escapeMin = MAX_AXIS_ANGLE + ramp(lv, 22, 8);
  const trappedCount = ask === 'trapped' ? 1 : count - 1;
  const angles = [
    ...spreadAngles(random, trappedCount, Math.max(9, trappedMax - 15), trappedMax, 3.5).map((angle) => ({ angle, trapped: true })),
    ...spreadAngles(random, count - trappedCount, escapeMin, Math.min(80, escapeMin + 26), 5).map((angle) => ({ angle, trapped: false })),
  ];
  const options: FiberOption[] = shuffle(angles, random).map((item, index) => ({
    letter: OPTION_LETTERS[index],
    angle: item.angle,
    offset: between(random, -0.55, 0.55),
    direction: random() < 0.5 ? 1 : -1,
    trapped: item.trapped,
  }));
  const answer = options.findIndex((option) => option.trapped === (ask === 'trapped'));
  const letter = options[answer].letter;
  const note = ask === 'trapped' ? `La ${letter} va casi paralela a la fibra: rebota y queda atrapada.` : `La ${letter} pega muy de frente en la pared: por eso se escapa.`;
  return { ask, options, answer, note };
}

// Medidas del dibujo de la fibra en un espacio de `width` × `height` px.
export function fiberLayout(width: number, height: number) {
  return { mid: height / 2, half: Math.max(8, Math.min(height * 0.3, 26)), startX: 10, length: Math.max(20, width - 10) };
}

// ---- 5 · Señal clara (relación señal-ruido) ----
export const NOISE_SAMPLES = 120;
export const SIGNAL_AMPLITUDE = 0.7;
// La señal con ruido se dibuja dentro de ±TRACE_LIMIT.
export const TRACE_LIMIT = 1.15;

export type NoiseShape = 'sine' | 'square';

export interface NoiseOption {
  letter: string;
  // Valores que se dibujan (señal + ruido).
  samples: number[];
  // Relación señal-ruido medida en lo dibujado, en dB.
  snr: number;
}

export interface SignalNoiseRound {
  shape: NoiseShape;
  cycles: number;
  options: NoiseOption[];
  answer: number;
  note: string;
}

// Ruido normal (Box–Muller).
export function gaussian(random: Random): number {
  return Math.sqrt(-2 * Math.log(Math.max(random(), 1e-12))) * Math.cos(TAU * random());
}

// Señal sin ruido: seno, o "digital" (cuadrada con esquinas redondeadas).
export function cleanSignal(shape: NoiseShape, cycles: number, phase: number, count = NOISE_SAMPLES): number[] {
  return Array.from({ length: count }, (_, index) => {
    const wave = Math.sin(TAU * cycles * (index / (count - 1)) + phase);
    return SIGNAL_AMPLITUDE * (shape === 'sine' ? wave : Math.tanh(5 * wave));
  });
}

// SNR = 10·log10(potencia de la señal / potencia del ruido), medido sobre lo dibujado.
export function snrDb(clean: readonly number[], noisy: readonly number[]): number {
  let signal = 0;
  let noise = 0;
  clean.forEach((value, index) => {
    signal += value * value;
    noise += (noisy[index] - value) ** 2;
  });
  return 10 * Math.log10(signal / Math.max(noise, 1e-9));
}

export function noisyTrace(clean: readonly number[], sigma: number, random: Random): number[] {
  return clean.map((value) => clamp(value + sigma * gaussian(random), -TRACE_LIMIT, TRACE_LIMIT));
}

export function signalNoiseRound(level: number, random: Random = Math.random): SignalNoiseRound {
  const lv = levelOf(level);
  const count = lv >= 3 ? 4 : 3;
  // Más difícil = ruidos más parecidos (de 6 dB de diferencia a 2).
  const margin = ramp(lv, 6, 2);
  const ratio = ramp(lv, 2.4, 1.4);
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const shape: NoiseShape = random() < 0.5 ? 'sine' : 'square';
    const cycles = intBetween(random, 2, 4);
    const clean = cleanSignal(shape, cycles, between(random, 0, TAU));
    const cleanest = between(random, 0.04, 0.11);
    const options = shuffle(
      Array.from({ length: count }, (_, index) => Math.min(0.5, cleanest * ratio ** index * between(random, 0.95, 1.05))),
      random,
    ).map((sigma, index) => {
      const samples = noisyTrace(clean, sigma, random);
      return { letter: OPTION_LETTERS[index], samples, snr: snrDb(clean, samples) };
    });
    const ranked = options.map((option) => option.snr).sort((a, b) => b - a);
    if (ranked[0] - ranked[1] < margin) continue;
    const answer = options.findIndex((option) => option.snr === ranked[0]);
    return { shape, cycles, options, answer, note: `La ${options[answer].letter} era la más limpia: tiene la mayor relación señal-ruido (${Math.round(ranked[0])} dB).` };
  }
  // Respaldo (casi nunca): tres niveles de ruido muy separados.
  const clean = cleanSignal('sine', 3, 0.4);
  const options = shuffle([0.05, 0.25, 0.5], random).map((sigma, index) => {
    const samples = noisyTrace(clean, sigma, random);
    return { letter: OPTION_LETTERS[index], samples, snr: snrDb(clean, samples) };
  });
  const best = Math.max(...options.map((option) => option.snr));
  const answer = options.findIndex((option) => option.snr === best);
  return { shape: 'sine', cycles: 3, options, answer, note: `La ${options[answer].letter} era la más limpia: tiene la mayor relación señal-ruido (${Math.round(best)} dB).` };
}

// ---- 6 · Muestrea la onda (muestreo y aliasing) ----
export interface SamplingOption {
  letter: string;
  // Muestras tomadas en la ventana (la onda tiene `cycles` ciclos en ella).
  samples: number;
  // Ciclos (con signo) de la onda que se reconstruye con esas muestras.
  recon: number;
  faithful: boolean;
}

export interface SamplingRound {
  cycles: number;
  phase: number;
  options: SamplingOption[];
  answer: number;
  note: string;
}

// La onda reconstruida pasa por las mismas muestras; entre todas las ondas posibles queda la más lenta
// (la ideal, la que no supera la mitad del ritmo de muestreo): ese es el alias.
export function reconCycles(cycles: number, samples: number): number {
  return cycles - Math.round(cycles / samples) * samples;
}

// Cuánto se aparta lo reconstruido de la onda original (promedio de |diferencia|, de 0 a ~1,3).
export function mismatch(cycles: number, phase: number, recon: number, steps = 400): number {
  let total = 0;
  for (let index = 0; index < steps; index += 1) {
    const t = (index + 0.5) / steps;
    total += Math.abs(Math.sin(TAU * cycles * t + phase) - Math.sin(TAU * recon * t + phase));
  }
  return total / steps;
}

export function samplingRound(level: number, random: Random = Math.random): SamplingRound {
  const lv = levelOf(level);
  const count = lv >= 3 ? 4 : 3;
  const cycles = intBetween(random, 3, 5);
  const phase = between(random, 0, TAU);
  // La buena toma más de 2 muestras por ciclo (cada vez menos sobrada); las malas, menos de 2.
  const good = Math.max(Math.ceil(cycles * 2.3), Math.round(cycles * between(random, ramp(lv, 4.5, 2.4), ramp(lv, 7, 3.1))));
  const wrong: number[] = [];
  const accepts = (samples: number) => {
    const recon = reconCycles(cycles, samples);
    return (
      samples >= 3 &&
      samples / cycles < 1.9 &&
      !wrong.some((other) => other === samples || Math.abs(reconCycles(cycles, other)) === Math.abs(recon)) &&
      mismatch(cycles, phase, recon) >= 0.4
    );
  };
  for (let attempt = 0; attempt < 200 && wrong.length < count - 1; attempt += 1) {
    const samples = Math.round(cycles * between(random, ramp(lv, 0.7, 1.3), ramp(lv, 1.35, 1.8)));
    if (accepts(samples)) wrong.push(samples);
  }
  // Si faltan (pocas muestras posibles), completa con las más cercanas al límite.
  for (let samples = Math.floor(cycles * 1.89); samples >= 3 && wrong.length < count - 1; samples -= 1) {
    if (accepts(samples)) wrong.push(samples);
  }
  const options: SamplingOption[] = shuffle([good, ...wrong], random).map((samples, index) => ({
    letter: OPTION_LETTERS[index],
    samples,
    recon: reconCycles(cycles, samples),
    faithful: samples === good,
  }));
  const answer = options.findIndex((option) => option.faithful);
  const note = `La ${options[answer].letter} toma ${good} puntos en ${cycles} ciclos: más de 2 por ciclo mantiene la forma.`;
  return { cycles, phase, options, answer, note };
}

export interface SamplingDrawing {
  original: string;
  recon: string;
  dots: Array<[number, number]>;
}

// Original (punteada), reconstrucción (gruesa) y las muestras (puntos sobre la original).
export function samplingDrawing(round: Pick<SamplingRound, 'cycles' | 'phase'>, option: SamplingOption, width: number, height: number): SamplingDrawing {
  const amp = height / 2 - 6;
  const wave = (cycles: number, t: number) => height / 2 - amp * Math.sin(TAU * cycles * t + round.phase);
  const curve = (cycles: number) => polylinePath(Array.from({ length: 241 }, (_, index) => [(index / 240) * width, wave(cycles, index / 240)] as const));
  return {
    original: curve(round.cycles),
    recon: curve(option.recon),
    dots: Array.from({ length: option.samples }, (_, index) => [(index / option.samples) * width + width / (2 * option.samples), wave(round.cycles, index / option.samples + 1 / (2 * option.samples))] as [number, number]),
  };
}
