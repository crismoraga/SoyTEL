import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAppEvent, type AppEvent } from '@/lib/events';
import { loadCareerProgress, masteredAreas, recordAreaPractice } from '@/storage/career';
import { ensureDailyInbox, getInboxSnapshot, loadInbox, markAllInboxRead, pushInbox } from '@/storage/inbox';
import { applyMascotDecay, defaultProfile, loadProfile, loadResults, recordGameResult, syncAchievements, updateAlias } from '@/storage/profile';
import { resetAllData } from '@/storage/reset';
import { logMascotDay } from '@/storage/story';

beforeEach(async () => {
  await AsyncStorage.clear();
  await resetAllData({ keepOnboarding: false });
});

describe('game results', () => {
  it('records a result, grants XP and unlocks the first achievement', async () => {
    const events: AppEvent[] = [];
    const stop = onAppEvent((event) => events.push(event));
    const outcome = await recordGameResult({
      gameId: 'burst',
      score: 900,
      accuracy: 1,
      durationSeconds: 120,
      completedAt: new Date().toISOString(),
      metadata: { won: 'firewall,ping-check' },
    });
    stop();

    expect(outcome.xpGained).toBeGreaterThan(100);
    expect(outcome.newAchievements).toEqual(expect.arrayContaining(['first-signal', 'perfect-run']));
    expect(outcome.profile.streakDays).toBe(1);
    expect(events.some((event) => event.type === 'achievement')).toBe(true);
    expect(await loadResults()).toHaveLength(1);

    const inbox = await loadInbox();
    expect(inbox.some((item) => item.kind === 'logro')).toBe(true);
  });

  it('does not announce the same achievement twice', async () => {
    const base = { gameId: 'story' as const, score: 200, accuracy: 1, durationSeconds: 60, completedAt: new Date().toISOString() };
    await recordGameResult(base);
    const second = await recordGameResult(base);
    expect(second.newAchievements).not.toContain('first-signal');
  });

  it('counts career areas only when they are practiced well, not when viewed', async () => {
    const at = new Date().toISOString();
    await recordAreaPractice('redes', 0.4, at);
    expect(masteredAreas(await loadCareerProgress())).toEqual([]);
    for (const area of ['redes', 'teleco', 'software', 'seguridad', 'hardware', 'innovacion']) {
      await recordAreaPractice(area, 0.6, at);
    }
    const progress = await loadCareerProgress();
    expect(progress.redes?.sessions).toBe(2);
    expect(masteredAreas(progress)).toHaveLength(6);
    expect(await syncAchievements()).toContain('career-explorer');
    expect((await loadProfile()).unlockedAchievements).toContain('career-explorer');
  });

  it('records area practice from practice results and the story', async () => {
    const completedAt = new Date().toISOString();
    await recordGameResult({ gameId: 'practice', score: 480, accuracy: 0.8, durationSeconds: 60, completedAt, metadata: { area: 'teleco', correct: 4 } });
    await recordGameResult({ gameId: 'story', score: 200, accuracy: 1, durationSeconds: 60, completedAt, metadata: { chapter: 1 } });
    expect(masteredAreas(await loadCareerProgress()).sort()).toEqual(['innovacion', 'teleco']);
    expect((await loadProfile()).gamesPlayed).toBe(2);
  });

  it('counts distinct Rutix care days', async () => {
    // Dos cuidados el mismo día local (aunque en UTC el segundo ya sea "mañana") cuentan un día.
    await logMascotDay(new Date(2026, 8, 1, 10, 0));
    const days = await logMascotDay(new Date(2026, 8, 1, 23, 30));
    expect(days).toEqual(['2026-09-01']);
    expect(await logMascotDay(new Date(2026, 8, 2, 0, 10))).toEqual(['2026-09-01', '2026-09-02']);
  });
});

describe('profile', () => {
  it('trims and limits the alias', async () => {
    expect((await updateAlias('   Nodo Valparaíso   ')).alias).toBe('Nodo Valparaíso');
    expect((await updateAlias('')).alias).toBe(defaultProfile.alias);
  });

  it('lowers Rutix mood when days pass without playing', () => {
    const profile = { ...defaultProfile, mascotMood: 80, lastPlayedAt: '2026-09-20T12:00:00.000Z' };
    const decayed = applyMascotDecay(profile, new Date('2026-09-23T12:00:00.000Z').getTime());
    expect(decayed.mascotMood).toBe(62);
  });
});

describe('inbox', () => {
  it('stores items and marks them as read', async () => {
    await pushInbox([{ kind: 'aviso', title: 'Hola', body: 'Bienvenido' }]);
    expect(getInboxSnapshot().filter((item) => !item.read)).toHaveLength(1);
    await markAllInboxRead();
    expect(getInboxSnapshot().filter((item) => !item.read)).toHaveLength(0);
  });

  it('adds one daily tip per day and warns when Rutix is low', async () => {
    const day = new Date('2026-09-28T09:00:00.000Z');
    await ensureDailyInbox(30, day);
    await ensureDailyInbox(30, day);
    const items = await loadInbox();
    expect(items.filter((item) => item.kind === 'dato')).toHaveLength(1);
    expect(items.filter((item) => item.kind === 'rutix')).toHaveLength(1);
  });
});
