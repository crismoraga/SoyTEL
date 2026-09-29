import { achievements } from '@/data/achievements';
import { achievementProgress, achievementRatio, evaluateAchievements, wonMicroGames, type AchievementContext } from '@/lib/achievements';
import { medallionGlyphs } from '@/graphics/medallions';
import { defaultProfile } from '@/storage/profile';
import type { GameResult } from '@/types/game';

function result(partial: Partial<GameResult>): GameResult {
  return {
    gameId: 'burst',
    score: 100,
    accuracy: 0.5,
    durationSeconds: 60,
    completedAt: '2026-09-28T12:00:00.000Z',
    ...partial,
  };
}

function context(partial: Partial<AchievementContext> = {}): AchievementContext {
  return { profile: defaultProfile, results: [], mascotDays: 0, careerAreas: 0, ...partial };
}

describe('achievement data', () => {
  it('has fourteen unique achievements with valid glyphs and thresholds', () => {
    expect(achievements).toHaveLength(14);
    expect(new Set(achievements.map((item) => item.id)).size).toBe(14);
    for (const achievement of achievements) {
      expect(achievement.threshold).toBeGreaterThan(0);
      expect(medallionGlyphs[achievement.glyph]).toBeDefined();
      expect(achievement.hint.length).toBeGreaterThan(5);
    }
  });

  it('covers every rarity tier', () => {
    expect(new Set(achievements.map((item) => item.tier))).toEqual(new Set(['bronce', 'plata', 'oro', 'platino']));
  });
});

describe('achievement evaluation', () => {
  it('starts with nothing unlocked', () => {
    expect(evaluateAchievements(context())).toEqual([]);
  });

  it('unlocks the first signal after any activity', () => {
    expect(evaluateAchievements(context({ results: [result({ gameId: 'story' })] }))).toContain('first-signal');
  });

  it('counts bursts, quiz answers and journeys', () => {
    const results = [
      result({}),
      result({}),
      result({}),
      result({ gameId: 'millionaire', metadata: { correctAnswers: 6 } }),
      result({ gameId: 'millionaire', metadata: { correctAnswers: 4 } }),
      result({ gameId: 'journey' }),
      result({ gameId: 'journey' }),
    ];
    const unlocked = evaluateAchievements(context({ results }));
    expect(unlocked).toEqual(expect.arrayContaining(['burst-starter', 'quiz-bronze', 'journey-host']));
  });

  it('only counts perfect runs in burst or millionaire', () => {
    expect(achievementProgress('perfect-run', context({ results: [result({ gameId: 'story', accuracy: 1 })] }))).toBe(0);
    expect(achievementProgress('perfect-run', context({ results: [result({ accuracy: 1 })] }))).toBe(1);
  });

  it('tracks won microgames for the collector and security badges', () => {
    const results = [
      result({ metadata: { won: 'firewall,password-strong,wifi-boost' } }),
      result({ metadata: { won: 'firewall,packet-catch' } }),
      result({ metadata: { won: 'password-strong,firewall' } }),
    ];
    expect(wonMicroGames(results)).toHaveLength(7);
    expect(achievementProgress('burst-collector', context({ results }))).toBe(4);
    expect(achievementProgress('security-guard', context({ results }))).toBe(5);
    expect(evaluateAchievements(context({ results }))).toContain('security-guard');
  });

  it('unlocks the story badge only after the fifth chapter', () => {
    const four = [result({ gameId: 'story', metadata: { chapter: 4 } })];
    const five = [...four, result({ gameId: 'story', metadata: { chapter: 5 } })];
    expect(evaluateAchievements(context({ results: four }))).not.toContain('signal-restored');
    expect(evaluateAchievements(context({ results: five }))).toContain('signal-restored');
  });

  it('uses profile, Telix days and career areas', () => {
    const unlocked = evaluateAchievements(
      context({ profile: { ...defaultProfile, level: 10, streakDays: 3 }, mascotDays: 7, careerAreas: 6 }),
    );
    expect(unlocked).toEqual(expect.arrayContaining(['level-five', 'level-ten', 'streak-three', 'telix-friend', 'career-explorer']));
  });

  it('reports partial progress as a ratio', () => {
    expect(achievementRatio('telix-friend', context({ mascotDays: 3 }))).toBeCloseTo(3 / 7);
    expect(achievementRatio('telix-friend', context({ mascotDays: 12 }))).toBe(1);
  });
});
