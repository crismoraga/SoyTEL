import {
  calculateGameXp,
  isValidJourneyCode,
  journeyCodeFromSeed,
  levelFromXp,
  progressToNextLevel,
  xpForLevel,
} from '@/lib/progression';

describe('progression', () => {
  it('starts at level 1 with zero XP', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(xpForLevel(1)).toBe(0);
  });

  it('increases level thresholds progressively', () => {
    expect(xpForLevel(2)).toBe(155);
    expect(xpForLevel(3)).toBeGreaterThan(xpForLevel(2));
    expect(levelFromXp(155)).toBe(2);
  });

  it('keeps next-level progress within bounds', () => {
    expect(progressToNextLevel(0)).toBe(0);
    expect(progressToNextLevel(60)).toBeGreaterThan(0);
    expect(progressToNextLevel(155)).toBe(0);
  });

  it('rewards score, accuracy and short sessions', () => {
    const fastPerfect = calculateGameXp(500, 1, 180);
    const slowLow = calculateGameXp(100, 0.5, 900);
    expect(fastPerfect).toBeGreaterThan(slowLow);
  });

  it('generates six-character journey codes without ambiguous characters', () => {
    const code = journeyCodeFromSeed(123456);
    expect(code).toHaveLength(6);
    expect(isValidJourneyCode(code)).toBe(true);
    expect(isValidJourneyCode('TEL001')).toBe(false);
  });
});
