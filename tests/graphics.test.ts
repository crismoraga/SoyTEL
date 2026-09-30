import { campusMapDrawing } from '@/graphics/campusMap';
import { iconNames, icons } from '@/graphics/icons';
import { illustrationDrawing, illustrationNames } from '@/graphics/illustrations';
import { medallionDrawing, medallionGlyphs, type MedallionGlyph } from '@/graphics/medallions';
import { networkMesh, patternPreviews, starField } from '@/graphics/patterns';
import { arcPath, seededRandom, star4Path, star5Path, type Shape } from '@/graphics/shapes';
import { expressionForMood, signalForMood, telixDrawing, telixExpressions } from '@/graphics/telix';

function countShapes(shapes: Shape[]): number {
  return shapes.reduce((total, shape) => total + (shape.t === 'g' ? countShapes(shape.children) : 1), 0);
}

function allFinite(shapes: Shape[]): boolean {
  return shapes.every((shape) => {
    switch (shape.t) {
      case 'g':
        return allFinite(shape.children);
      case 'path':
        return !/NaN|undefined/.test(shape.d);
      case 'circle':
        return Number.isFinite(shape.cx) && Number.isFinite(shape.cy) && Number.isFinite(shape.r);
      default:
        return true;
    }
  });
}

describe('shape helpers', () => {
  it('builds star and arc paths', () => {
    expect(star4Path(10, 10, 5)).toMatch(/^M10 5 Q/);
    expect(star5Path(12, 12, 10)).toMatch(/Z$/);
    expect(arcPath(50, 50, 10, 0, 270)).toContain('A10 10 0 1 1');
  });

  it('produces deterministic random sequences', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('icon set', () => {
  it('has more than eighty drawable icons', () => {
    expect(iconNames.length).toBeGreaterThan(80);
    iconNames.forEach((name) => {
      expect(icons[name].length).toBeGreaterThan(0);
      expect(allFinite(icons[name])).toBe(true);
    });
  });
});

describe('medallions', () => {
  const glyphs = Object.keys(medallionGlyphs) as MedallionGlyph[];

  it('draws every glyph in every state', () => {
    for (const glyph of glyphs) {
      for (const state of ['unlocked', 'progress', 'locked'] as const) {
        const drawing = medallionDrawing({ glyph, state, progress: 0.5 });
        expect(drawing.w).toBe(120);
        expect(countShapes(drawing.shapes)).toBeGreaterThan(10);
        expect(allFinite(drawing.shapes)).toBe(true);
      }
    }
  });

  it('uses unique gradient ids per tier', () => {
    const ids = (['crema', 'bronce', 'plata', 'oro', 'platino'] as const).map((tier) => medallionDrawing({ glyph: 'star', tier }).gradients?.[0].id);
    expect(new Set(ids).size).toBe(5);
  });

  it('grows taller when drawn with a ribbon', () => {
    expect(medallionDrawing({ glyph: 'trophy', ribbon: true }).h).toBeGreaterThan(120);
  });
});

describe('Telix', () => {
  it('draws every expression', () => {
    telixExpressions.forEach((expression) => {
      const drawing = telixDrawing({ expression });
      expect(allFinite(drawing.shapes)).toBe(true);
      expect(countShapes(drawing.shapes)).toBeGreaterThan(20);
    });
  });

  it('maps mood to expression and signal bars', () => {
    expect(expressionForMood(95)).toBe('happy');
    expect(expressionForMood(20)).toBe('sad');
    expect(signalForMood(95)).toBe(4);
    expect(signalForMood(5)).toBe(0);
  });
});

describe('illustrations and patterns', () => {
  it('draws every illustration in both tones', () => {
    illustrationNames.forEach((name) => {
      expect(countShapes(illustrationDrawing(name, 'light').shapes)).toBeGreaterThan(5);
      expect(allFinite(illustrationDrawing(name, 'dark').shapes)).toBe(true);
    });
  });

  it('builds the campus map and background patterns', () => {
    expect(countShapes(campusMapDrawing().shapes)).toBeGreaterThan(40);
    expect(starField({ width: 300, height: 600 }).length).toBeGreaterThan(20);
    expect(networkMesh({ width: 300, height: 600 }).length).toBeGreaterThan(16);
    expect(Object.keys(patternPreviews())).toHaveLength(4);
  });
});
