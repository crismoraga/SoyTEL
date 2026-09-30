// Lógica de "Viaje de la luz": reflexión total interna en la fibra y transmisión por pulsos.

export const N_CORE = 1.48;
const DEG = Math.PI / 180;

export interface FiberLevel {
  cladding: number;
  laserOffset: number;
  length: number;
}

export const fiberLevels: FiberLevel[] = [
  { cladding: 1.46, laserOffset: 0, length: 1 },
  { cladding: 1.47, laserOffset: -15, length: 1 },
  { cladding: 1.475, laserOffset: 13, length: 1 },
];

export function numericalAperture(cladding: number): number {
  return Math.sqrt(N_CORE * N_CORE - cladding * cladding);
}

// Ángulo máximo de entrada (en el aire) que queda atrapado por reflexión total interna.
export function acceptanceAngle(cladding: number): number {
  return Math.asin(Math.min(1, numericalAperture(cladding))) / DEG;
}

export interface FiberGeometry {
  laserX: number;
  laserY: number;
  entryX: number;
  exitX: number;
  coreTop: number;
  coreBottom: number;
}

export interface RayTrace {
  points: { x: number; y: number }[];
  outcome: 'delivered' | 'missed' | 'leaked';
  bounces: number;
}

export function traceRay(geometry: FiberGeometry, angleDeg: number, cladding: number): RayTrace {
  const { laserX, laserY, entryX, exitX, coreTop, coreBottom } = geometry;
  const theta = angleDeg * DEG;
  const entryY = laserY + Math.tan(theta) * (entryX - laserX);
  const points = [
    { x: laserX, y: laserY },
    { x: entryX, y: entryY },
  ];
  if (entryY <= coreTop || entryY >= coreBottom) {
    return { points, outcome: 'missed', bounces: 0 };
  }
  // Refracción al entrar al núcleo (Snell: sen θ = n · sen θ').
  const inside = Math.asin(Math.sin(theta) / N_CORE);
  const critical = Math.acos(cladding / N_CORE);
  let x = entryX;
  let y = entryY;
  let slope = Math.tan(inside);
  let bounces = 0;
  const trapped = Math.abs(inside) <= critical;
  for (let guard = 0; guard < 400; guard += 1) {
    if (Math.abs(slope) < 1e-6) {
      points.push({ x: exitX, y });
      return { points, outcome: 'delivered', bounces };
    }
    const wallY = slope > 0 ? coreBottom : coreTop;
    const hitX = x + (wallY - y) / slope;
    if (hitX >= exitX) {
      points.push({ x: exitX, y: y + slope * (exitX - x) });
      return { points, outcome: 'delivered', bounces };
    }
    points.push({ x: hitX, y: wallY });
    if (!trapped) {
      // Sin reflexión total la luz atraviesa el revestimiento y se pierde.
      const escape = Math.sign(slope) * 26;
      points.push({ x: hitX + Math.min(70, Math.abs(escape / slope)), y: wallY + escape });
      return { points, outcome: 'leaked', bounces };
    }
    bounces += 1;
    x = hitX;
    y = wallY;
    slope = -slope;
  }
  return { points, outcome: 'delivered', bounces };
}

export const ANGLE_MAX = 60;
export const LEVEL_MAX = 130;
export const ANGLES_MAX = LEVEL_MAX * 3;
export const PULSES_MAX = 610;

export function levelScore(failedShots: number, remainingRatio: number): number {
  return Math.max(40, Math.round(LEVEL_MAX * (0.7 + 0.3 * Math.max(0, Math.min(1, remainingRatio))) - failedShots * 28));
}

const WORDS = ['HOLA', 'DATO', 'ONDA', 'NUBE', 'BITS', 'LUZ!'];

export function pickWord(random: () => number): string {
  return WORDS[Math.floor(random() * WORDS.length)];
}

// Cada carácter viaja como 8 bits (ASCII): luz encendida = 1, apagada = 0.
export function toBits(word: string): number[] {
  return word.split('').flatMap((character) =>
    character
      .charCodeAt(0)
      .toString(2)
      .padStart(8, '0')
      .split('')
      .map(Number),
  );
}

export function decodeBits(bits: number[]): string {
  let out = '';
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    const code = parseInt(bits.slice(i, i + 8).join(''), 2);
    out += code >= 32 && code < 127 ? String.fromCharCode(code) : '·';
  }
  return out;
}

export const BIT_MS = 430;
