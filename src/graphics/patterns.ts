import { arcPath, circle, line, path, seededRandom, star4Path, type Drawing, type Shape } from './shapes';

// Patrones de fondo de la marca: "Patrón de red", "Patrón de señal" y cielo estrellado.
const CREAM = '#F4ECD7';
const SKY = '#6FB3D9';
const SOFT = '#A7D4ED';

export interface StarFieldOptions {
  width: number;
  height: number;
  seed?: number;
  stars?: number;
  dots?: number;
}

export function starField({ width, height, seed = 7, stars = 14, dots = 26 }: StarFieldOptions): Shape[] {
  const random = seededRandom(seed);
  const shapes: Shape[] = [];
  for (let index = 0; index < dots; index += 1) {
    shapes.push(
      circle(random() * width, random() * height, 0.8 + random() * 1.6, {
        fill: random() > 0.35 ? CREAM : SOFT,
        op: 0.25 + random() * 0.55,
      }),
    );
  }
  for (let index = 0; index < stars; index += 1) {
    const size = 3 + random() * 7;
    shapes.push(
      path(star4Path(random() * width, random() * height, size), {
        fill: random() > 0.4 ? CREAM : SKY,
        op: 0.25 + random() * 0.45,
      }),
    );
  }
  return shapes;
}

export function networkMesh({ width, height, seed = 11, nodes = 16 }: { width: number; height: number; seed?: number; nodes?: number }): Shape[] {
  const random = seededRandom(seed);
  const points = Array.from({ length: nodes }, () => [random() * width, random() * height] as const);
  const shapes: Shape[] = [];
  points.forEach(([x, y], index) => {
    const nearest = points
      .map(([px, py], other) => ({ other, distance: Math.hypot(px - x, py - y) }))
      .filter((item) => item.other !== index)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2);
    nearest.forEach(({ other }) => {
      if (other > index) {
        shapes.push(line(x, y, points[other][0], points[other][1], { stroke: SKY, sw: 1.2, op: 0.35 }));
      }
    });
  });
  points.forEach(([x, y]) => {
    const big = random() > 0.7;
    shapes.push(circle(x, y, big ? 4.5 : 2.6, { fill: big ? CREAM : SKY, op: big ? 0.8 : 0.6 }));
  });
  return shapes;
}

export function signalRings({ cx, cy, rings = 5, gap = 26, start = 30 }: { cx: number; cy: number; rings?: number; gap?: number; start?: number }): Shape[] {
  const shapes: Shape[] = [];
  for (let index = 0; index < rings; index += 1) {
    const r = start + index * gap;
    shapes.push(
      path(arcPath(cx, cy, r, 200, 340), { fill: 'none', stroke: SKY, sw: 2.2, cap: 'round', op: 0.45 - index * 0.06 }),
      path(arcPath(cx, cy, r, 20, 160), { fill: 'none', stroke: SKY, sw: 2.2, cap: 'round', op: 0.3 - index * 0.04 }),
    );
  }
  shapes.push(circle(cx, cy, 6, { fill: CREAM, op: 0.8 }));
  return shapes;
}

// Anillos orbitales como la pantalla de bienvenida de la marca (círculos crema con puntos).
export function orbitRings({ width, height }: { width: number; height: number }): Shape[] {
  const shapes: Shape[] = [];
  const corners: [number, number, number][] = [
    [width * 0.02, height * 0.12, width * 0.46],
    [width * 0.98, height * 0.9, width * 0.5],
  ];
  corners.forEach(([cx, cy, r], cornerIndex) => {
    shapes.push(circle(cx, cy, r, { fill: 'none', stroke: CREAM, sw: 3, op: 0.35 }));
    shapes.push(circle(cx, cy, r * 0.82, { fill: 'none', stroke: SKY, sw: 1.5, op: 0.25 }));
    for (let index = 0; index < 9; index += 1) {
      const angle = (cornerIndex === 0 ? 10 : 190) + index * 11;
      const radians = (angle * Math.PI) / 180;
      shapes.push(circle(cx + r * 1.08 * Math.cos(radians), cy + r * 1.08 * Math.sin(radians), 1.6 + (index % 3), { fill: CREAM, op: 0.5 }));
    }
  });
  return shapes;
}

export function patternPreviews(): Record<string, Drawing> {
  const background = (w: number, h: number): Shape => ({ t: 'rect', x: 0, y: 0, w, h, rx: 16, fill: '#0B2D45' });
  return {
    estrellas: { w: 360, h: 240, shapes: [background(360, 240), ...starField({ width: 360, height: 240 })] },
    red: { w: 360, h: 240, shapes: [background(360, 240), ...networkMesh({ width: 360, height: 240 })] },
    senal: { w: 360, h: 240, shapes: [background(360, 240), ...signalRings({ cx: 180, cy: 150 })] },
    orbitas: { w: 360, h: 240, shapes: [background(360, 240), ...orbitRings({ width: 360, height: 240 })] },
  };
}
