import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAppEvent, type AppEvent } from '@/lib/events';
import { markAreaViewed } from '@/storage/career';
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

  it('syncs achievements earned outside games', async () => {
    for (const area of ['redes', 'teleco', 'software', 'seguridad', 'hardware', 'innovacion']) {
      await markAreaViewed(area);
    }
    expect(await syncAchievements()).toContain('career-explorer');
    expect((await loadProfile()).unlockedAchievements).toContain('career-explorer');
  });

  it('counts distinct Telix care days', async () => {
    await logMascotDay('2026-09-01T10:00:00.000Z');
    const days = await logMascotDay('2026-09-01T18:00:00.000Z');
    expect(days).toHaveLength(1);
  });
});

describe('profile', () => {
  it('trims and limits the alias', async () => {
    expect((await updateAlias('   Nodo Valparaíso   ')).alias).toBe('Nodo Valparaíso');
    expect((await updateAlias('')).alias).toBe(defaultProfile.alias);
  });

  it('lowers Telix mood when days pass without playing', () => {
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

  it('adds one daily tip per day and warns when Telix is low', async () => {
    const day = new Date('2026-09-28T09:00:00.000Z');
    await ensureDailyInbox(30, day);
    await ensureDailyInbox(30, day);
    const items = await loadInbox();
    expect(items.filter((item) => item.kind === 'dato')).toHaveLength(1);
    expect(items.filter((item) => item.kind === 'telix')).toHaveLength(1);
  });
});
