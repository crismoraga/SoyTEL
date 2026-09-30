import { circle, path, rect, type Drawing, type Shape } from './shapes';

// Templo de Telemática (Didactic-Tel): frontón, cinco pilares y basamento.
// Cada pilar se pinta con el color de su área cuando está encendido.
export interface TemplePillar {
  color: string;
  lit: boolean;
}

const CREAM = '#F4ECD7';
const OFF = '#16364C';
const OFF_STROKE = '#2E5877';

export function templeDrawing(pillars: TemplePillar[]): Drawing {
  const all = pillars.length > 0 && pillars.every((pillar) => pillar.lit);
  const shapes: Shape[] = [];
  if (all) {
    for (let ray = 0; ray < 7; ray += 1) {
      shapes.push(path(`M160 40 L${40 + ray * 40} -10`, { stroke: '#FBE3A1', sop: 0.35, sw: 6, cap: 'round' }));
    }
  }
  shapes.push(path('M18 64 L160 14 L302 64 Z', { fill: 'url(#templeRoof)', stroke: CREAM, sop: 0.5, sw: 2 }));
  shapes.push(circle(160, 46, 9, { fill: all ? '#0B2D45' : '#15384F', stroke: CREAM, sop: 0.6 }));
  shapes.push(rect(22, 64, 276, 14, 3, { fill: all ? '#E6D9B8' : '#23506C' }));
  pillars.forEach((pillar, index) => {
    shapes.push(rect(36 + index * 56, 80, 24, 88, 4, { fill: pillar.lit ? pillar.color : OFF, stroke: pillar.lit ? CREAM : OFF_STROKE, sw: 2 }));
  });
  shapes.push(rect(14, 170, 292, 11, 3, { fill: all ? '#E6D9B8' : '#23506C' }));
  shapes.push(rect(6, 182, 308, 11, 3, { fill: all ? '#D6C7A0' : '#1C4460' }));
  return {
    w: 320,
    h: 196,
    gradients: [
      {
        id: 'templeRoof',
        kind: 'linear',
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 1,
        stops: [
          { offset: 0, color: all ? '#FBE3A1' : '#2A5673' },
          { offset: 1, color: all ? '#DDAE3E' : '#1C4460' },
        ],
      },
    ],
    shapes,
  };
}
