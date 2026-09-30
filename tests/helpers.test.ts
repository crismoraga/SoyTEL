import { careerAreas } from '@/data/career';
import { tipForDate, tips } from '@/data/tips';
import { dayGroup, formatNumber, relativeTime } from '@/lib/format';
import { nextMission } from '@/lib/missions';
import type { GameResult } from '@/types/game';

const now = new Date('2026-09-28T15:00:00');

describe('formatting', () => {
  it('formats relative times in Spanish', () => {
    expect(relativeTime(new Date(now.getTime() - 20_000).toISOString(), now)).toBe('Ahora');
    expect(relativeTime(new Date(now.getTime() - 5 * 60_000).toISOString(), now)).toBe('Hace 5 min');
    expect(relativeTime(new Date('2026-09-27T10:05:00').toISOString(), now)).toBe('Ayer 10:05');
    expect(relativeTime(new Date('2026-09-02T10:05:00').toISOString(), now)).toBe('2 sept');
  });

  it('groups by day', () => {
    expect(dayGroup(new Date('2026-09-28T08:00:00').toISOString(), now)).toBe('HOY');
    expect(dayGroup(new Date('2026-09-27T08:00:00').toISOString(), now)).toBe('AYER');
    expect(dayGroup(new Date('2026-09-01T08:00:00').toISOString(), now)).toBe('ANTES');
  });

  it('adds thousands separators', () => {
    expect(formatNumber(32000)).toBe('32.000');
    expect(formatNumber(950)).toBe('950');
  });
});

describe('missions', () => {
  const burstToday: GameResult = { gameId: 'burst', score: 500, accuracy: 1, durationSeconds: 90, completedAt: now.toISOString() };

  it('starts new players with a burst', () => {
    expect(nextMission([], [], now).route).toBe('/burst');
  });

  it('then suggests the next story chapter', () => {
    const mission = nextMission([burstToday], ['chapter-1'], now);
    expect(mission.route).toBe('/story');
    expect(mission.title).toContain('2');
  });

  it('suggests the quiz after finishing the story and playing today', () => {
    const chapters = ['chapter-1', 'chapter-2', 'chapter-3', 'chapter-4', 'chapter-5'];
    expect(nextMission([burstToday], chapters, now).route).toBe('/millionaire');
  });
});

describe('content', () => {
  it('has six career areas with examples', () => {
    expect(careerAreas).toHaveLength(6);
    careerAreas.forEach((area) => {
      expect(area.examples.length).toBeGreaterThanOrEqual(3);
      expect(area.description.length).toBeGreaterThan(60);
    });
  });

  it('rotates daily tips', () => {
    expect(tips.length).toBeGreaterThanOrEqual(20);
    expect(tipForDate(new Date('2026-01-01T12:00:00Z')).id).not.toBe(tipForDate(new Date('2026-01-02T12:00:00Z')).id);
  });
});
