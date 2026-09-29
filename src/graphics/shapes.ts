// Formato de dibujo declarativo: los mismos datos se renderizan con react-native-svg
// en la app y se exportan a SVG/HTML para la hoja de diseño (scripts/export-design.js).

export interface Paint {
  fill?: string;
  stroke?: string;
  sw?: number;
  op?: number;
  fop?: number;
  sop?: number;
  cap?: 'round' | 'butt' | 'square';
  join?: 'round' | 'miter' | 'bevel';
  dash?: string;
  tf?: string;
}

export type Shape =
  | (Paint & { t: 'path'; d: string })
  | (Paint & { t: 'circle'; cx: number; cy: number; r: number })
  | (Paint & { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number })
  | (Paint & { t: 'rect'; x: number; y: number; w: number; h: number; rx?: number })
  | (Paint & { t: 'line'; x1: number; y1: number; x2: number; y2: number })
  | (Paint & { t: 'g'; children: Shape[] });

export interface GradientStop {
  offset: number;
  color: string;
  opacity?: number;
}

export type Gradient =
  | { id: string; kind: 'linear'; x1: number; y1: number; x2: number; y2: number; stops: GradientStop[] }
  | { id: string; kind: 'radial'; cx: number; cy: number; r: number; stops: GradientStop[] };

export interface Drawing {
  w: number;
  h: number;
  gradients?: Gradient[];
  shapes: Shape[];
}

export const path = (d: string, paint: Paint = {}): Shape => ({ t: 'path', d, ...paint });
export const circle = (cx: number, cy: number, r: number, paint: Paint = {}): Shape => ({ t: 'circle', cx, cy, r, ...paint });
export const ellipse = (cx: number, cy: number, rx: number, ry: number, paint: Paint = {}): Shape => ({ t: 'ellipse', cx, cy, rx, ry, ...paint });
export const rect = (x: number, y: number, w: number, h: number, rx = 0, paint: Paint = {}): Shape => ({ t: 'rect', x, y, w, h, rx, ...paint });
export const line = (x1: number, y1: number, x2: number, y2: number, paint: Paint = {}): Shape => ({ t: 'line', x1, y1, x2, y2, ...paint });
export const group = (children: Shape[], paint: Paint = {}): Shape => ({ t: 'g', children, ...paint });

const fmt = (value: number) => Number(value.toFixed(2));

// Estrella de cuatro puntas cóncava, el "sticker" de la marca.
export function star4Path(cx: number, cy: number, r: number, pinch = 0.18): string {
  const k = r * pinch;
  return [
    `M${fmt(cx)} ${fmt(cy - r)}`,
    `Q${fmt(cx + k)} ${fmt(cy - k)} ${fmt(cx + r)} ${fmt(cy)}`,
    `Q${fmt(cx + k)} ${fmt(cy + k)} ${fmt(cx)} ${fmt(cy + r)}`,
    `Q${fmt(cx - k)} ${fmt(cy + k)} ${fmt(cx - r)} ${fmt(cy)}`,
    `Q${fmt(cx - k)} ${fmt(cy - k)} ${fmt(cx)} ${fmt(cy - r)}Z`,
  ].join(' ');
}

export function star5Path(cx: number, cy: number, outer: number, inner = outer * 0.45): string {
  const points: string[] = [];
  for (let index = 0; index < 10; index += 1) {
    const radiusValue = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    points.push(`${fmt(cx + radiusValue * Math.cos(angle))} ${fmt(cy + radiusValue * Math.sin(angle))}`);
  }
  return `M${points.join(' L')}Z`;
}

// Ángulos en grados, 0° = derecha, sentido horario (coordenadas SVG).
export function polar(cx: number, cy: number, r: number, degrees: number): [number, number] {
  const radians = (degrees * Math.PI) / 180;
  return [fmt(cx + r * Math.cos(radians)), fmt(cy + r * Math.sin(radians))];
}

export function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const [x1, y1] = polar(cx, cy, r, startDeg);
  const [x2, y2] = polar(cx, cy, r, endDeg);
  const span = ((endDeg - startDeg) % 360 + 360) % 360;
  const largeArc = span > 180 ? 1 : 0;
  return `M${x1} ${y1} A${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

// PRNG determinista para patrones reproducibles (misma semilla = mismo dibujo).
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
