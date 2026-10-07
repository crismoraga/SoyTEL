import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import { DAILY_BONUS, dailyBonusId, isDailyComplete, isDailyDone } from '@/features/burst/daily';
import { achievementProgress } from '@/lib/achievements';
import { localDayKey, msUntilNextLocalDay } from '@/lib/day';
import { onAppEvent, type AppEvent } from '@/lib/events';
import { starterGuide } from '@/lib/guide';
import { combineStats, emptyStats, summarize } from '@/lib/progressStats';
import { useResultSaver } from '@/lib/resultSaver';
import { getInboxSnapshot, loadInbox, markInboxRead, parseInbox, pushInbox, resetInboxCache } from '@/storage/inbox';
import { exclusive, withLock } from '@/storage/locks';
import { claimMissionReward, loadMissionClaim } from '@/storage/missions';
import {
  applyMascotDecay,
  loadAchievementContext,
  loadProfile,
  loadProgressSummary,
  loadResults,
  mergeAccountProgress,
  parseProfile,
  progressStatsOf,
  recordGameResult,
  RESULTS_LIMIT,
  updateIdentity,
  updateMascotMood,
} from '@/storage/profile';
import { ResetError, resetAllData } from '@/storage/reset';
import { loadRunnerSave, recordRun } from '@/storage/runner';
import { getSettings, initSettings, resetSettingsCache, updateSettings } from '@/storage/settings';
import { countMascotCare } from '@/storage/story';
import type { GameResult } from '@/types/game';
import { failStorage, holdStorage, restoreStorage } from './support/storageFaults';

const base: GameResult = { gameId: 'burst', score: 400, accuracy: 0.6, durationSeconds: 90, completedAt: new Date().toISOString() };
const DAY = 86_400_000;

beforeEach(async () => {
  restoreStorage();
  await AsyncStorage.clear();
  await resetAllData({ keepOnboarding: false });
});

afterEach(restoreStorage);

describe('escrituras coordinadas (UXS-01)', () => {
  it('dos resultados simultáneos conservan ambos y un mismo id cuenta una vez', async () => {
    const [a, b, again] = await Promise.all([
      recordGameResult({ ...base, id: 'run-a' }),
      recordGameResult({ ...base, id: 'run-b', gameId: 'puzzle', metadata: { game: 'red', level: 1 } }),
      recordGameResult({ ...base, id: 'run-a' }),
    ]);
    const profile = await loadProfile();
    expect(profile.gamesPlayed).toBe(2);
    expect(profile.xp).toBe(a.xpGained + b.xpGained);
    expect(again).toMatchObject({ alreadyRecorded: true, xpGained: a.xpGained });
    expect(await loadResults()).toHaveLength(2);
  });

  it('un resultado, un cuidado de Rutix, un cambio de alias y una carrera cruzados no se pisan', async () => {
    await Promise.all([
      recordGameResult({ ...base, id: 'run-1' }),
      updateMascotMood(5),
      updateIdentity({ alias: 'Cami' }),
      recordRun({ data: 30, score: 900, distance: 400 }),
      recordGameResult({ ...base, id: 'run-2' }),
      updateMascotMood(5),
    ]);
    const profile = await loadProfile();
    expect(profile.alias).toBe('Cami');
    expect(profile.gamesPlayed).toBe(2);
    // 72 de base + 4 por partida (×2) + 5 por cuidado (×2).
    expect(profile.mascotMood).toBe(72 + 8 + 10);
    expect((await loadRunnerSave()).data).toBe(30);
  });

  it('si la escritura falla no queda el perfil adelantado sin su historial, y reintentar no duplica', async () => {
    failStorage('multiSet', { key: '@soytel/profile' });
    await expect(recordGameResult({ ...base, id: 'run-x' })).rejects.toThrow();
    expect((await loadProfile()).gamesPlayed).toBe(0);
    expect(await loadResults()).toEqual([]);
    const retried = await recordGameResult({ ...base, id: 'run-x' });
    expect(retried.alreadyRecorded).toBeUndefined();
    expect((await loadProfile()).gamesPlayed).toBe(1);
  });
});

describe('ánimo de Rutix (UXS-02)', () => {
  it('guardar el perfil varias veces no vuelve a descontar los mismos días', async () => {
    const lastPlayedAt = new Date(Date.now() - 3 * DAY - 3_600_000).toISOString();
    await AsyncStorage.setItem('@soytel/profile', JSON.stringify({ alias: 'Ana', avatar: 1, xp: 0, mascotMood: 80, lastPlayedAt, streakDays: 1, unlockedAchievements: [], gamesPlayed: 3, createdAt: lastPlayedAt }));
    expect((await loadProfile()).mascotMood).toBe(62);
    for (let index = 0; index < 10; index += 1) await updateIdentity({ alias: `Ana ${index}`, avatar: index });
    expect((await loadProfile()).mascotMood).toBe(62);
    // Un cuidado suma su parte sin volver a descontar los días ya procesados.
    await updateMascotMood(6);
    expect((await loadProfile()).mascotMood).toBe(68);
    // Un día más descuenta 6 una sola vez.
    const tomorrow = Date.now() + DAY;
    const profile = await loadProfile();
    const decayed = applyMascotDecay(profile, tomorrow);
    expect(decayed.mascotMood).toBe(62);
    expect(applyMascotDecay(decayed, tomorrow).mascotMood).toBe(62);
    expect(applyMascotDecay({ ...profile, mascotMood: 12 }, Date.now() + 30 * DAY).mascotMood).toBe(10);
  });
});

describe('recompensa de las misiones (UXS-03)', () => {
  it('un fallo a medio camino se completa al reintentar, cada parte una sola vez', async () => {
    const restore = failStorage('multiSet', { key: '@soytel/profile', times: 99 });
    await expect(claimMissionReward('2026-10-06')).rejects.toThrow();
    // Los paquetes ya llegaron, pero el día no quedó marcado como reclamado.
    expect((await loadRunnerSave()).data).toBeGreaterThan(0);
    expect(await loadMissionClaim()).toBeNull();
    restore();

    const packets = (await loadRunnerSave()).data;
    expect(await claimMissionReward('2026-10-06')).toBe(true);
    expect((await loadRunnerSave()).data).toBe(packets);
    expect((await loadProfile()).mascotMood).toBeGreaterThan(72);
    expect(await loadMissionClaim()).toBe('2026-10-06');
    const mood = (await loadProfile()).mascotMood;
    expect(await claimMissionReward('2026-10-06')).toBe(false);
    expect((await loadProfile()).mascotMood).toBe(mood);
  });

  it('dos reclamos simultáneos entregan una sola recompensa y el día siguiente entrega otra', async () => {
    const results = await Promise.all([claimMissionReward('2026-10-06'), claimMissionReward('2026-10-06')]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const first = await loadRunnerSave();
    expect(await claimMissionReward('2026-10-07')).toBe(true);
    expect((await loadRunnerSave()).data).toBe(first.data * 2);
  });
});

describe('borrado de datos (UXS-05)', () => {
  it('una escritura que venía en camino no resucita datos después del borrado', async () => {
    const { release } = holdStorage('multiSet', '@soytel/profile');
    const editing = updateIdentity({ alias: 'Resucitado' });
    const resetting = resetAllData({ keepOnboarding: false });
    // El borrado espera a que termine lo que ya se estaba guardando.
    await new Promise((resolve) => setTimeout(resolve, 20));
    release();
    await Promise.all([editing, resetting]);
    restoreStorage();
    expect((await loadProfile()).alias).toBe('Explorador TEL');
    expect(await AsyncStorage.getItem('@soytel/profile')).toBeNull();
  });

  it('si una etapa falla lo informa, igual limpia la memoria, y se puede repetir', async () => {
    await updateSettings({ haptics: false });
    await pushInbox([{ kind: 'aviso', title: 'Hola', body: 'x' }]);
    failStorage('multiRemove', { error: new Error('bloqueado') });
    await expect(resetAllData()).rejects.toBeInstanceOf(ResetError);
    expect(getSettings().haptics).toBe(true);
    expect(getInboxSnapshot()).toEqual([]);
    await resetAllData();
    expect(await AsyncStorage.getItem('@soytel/settings')).toBeNull();
  });

  it('lo que llega durante un borrado espera a que termine, y dos borrados a la vez no se traban', async () => {
    await recordGameResult({ ...base, id: 'antes' });
    const order: string[] = [];
    const clearing = exclusive(async () => {
      order.push('borrado-empieza');
      await new Promise((resolve) => setTimeout(resolve, 15));
      order.push('borrado-termina');
    });
    const writing = withLock('profile', async () => {
      order.push('escritura');
    });
    await Promise.all([clearing, writing]);
    expect(order).toEqual(['borrado-empieza', 'borrado-termina', 'escritura']);

    await Promise.all([resetAllData(), resetAllData(), recordGameResult({ ...base, id: 'durante' }).catch(() => undefined)]);
    await resetAllData();
    expect((await loadProfile()).gamesPlayed).toBe(0);
    expect(await loadResults()).toEqual([]);
    await expect(exclusive(async () => 'ok')).resolves.toBe('ok');
  });
});

describe('ajustes (UXS-04, UXS-14)', () => {
  it('un cambio hecho mientras se leían los ajustes guardados no se pierde', async () => {
    await AsyncStorage.setItem('@soytel/settings', JSON.stringify({ haptics: true, pace: 'fast', motion: 'minimal', paceRev: 2, rutixAccessory: 'scarf' }));
    resetSettingsCache();
    const { release } = holdStorage('getItem', '@soytel/settings');
    const loading = initSettings();
    const saving = updateSettings({ haptics: false });
    expect(getSettings().haptics).toBe(false);
    release();
    await Promise.all([loading, saving]);
    restoreStorage();
    // La intención del usuario gana, y lo que ya estaba guardado se conserva.
    expect(getSettings()).toMatchObject({ haptics: false, pace: 'fast', motion: 'minimal', rutixAccessory: 'scarf' });
    expect(JSON.parse((await AsyncStorage.getItem('@soytel/settings'))!)).toMatchObject({ haptics: false, pace: 'fast', motion: 'minimal' });
    // Repetir la carga no pisa nada.
    await initSettings();
    expect(getSettings().haptics).toBe(false);
  });

  it('si no se puede guardar, el ajuste vuelve atrás y se avisa', async () => {
    await initSettings();
    const events: AppEvent[] = [];
    const stop = onAppEvent((event) => events.push(event));
    failStorage('multiSet', { key: '@soytel/settings' });
    await updateSettings({ haptics: false });
    stop();
    expect(getSettings().haptics).toBe(true);
    expect(events).toEqual([expect.objectContaining({ type: 'toast', title: 'No se pudo guardar el ajuste' })]);
    expect(await AsyncStorage.getItem('@soytel/settings')).toBeNull();
    // El reintento guarda la intención y sobrevive al reinicio.
    await updateSettings({ haptics: false });
    resetSettingsCache();
    expect((await initSettings()).haptics).toBe(false);
  });

  it('un guardado fallido no deshace un cambio posterior del mismo ajuste', async () => {
    await initSettings();
    failStorage('multiSet', { key: '@soytel/settings' });
    await Promise.all([updateSettings({ pace: 'fast' }), updateSettings({ pace: 'normal' })]);
    expect(getSettings().pace).toBe('normal');
    expect(JSON.parse((await AsyncStorage.getItem('@soytel/settings'))!).pace).toBe('normal');
  });
});

describe('progreso acumulado más allá del historial (UXS-06)', () => {
  it('201+ partidas de otro modo no bajan contadores ni reabren pasos de la guía', async () => {
    await recordGameResult({ ...base, id: 'rafaga', accuracy: 1, metadata: { won: 'firewall,ping-check', lives: 3, rounds: 8, daily: '2026-10-01' } });
    await recordGameResult({ ...base, id: 'ruta', gameId: 'route', score: 4200, metadata: { completed: true, pillars: 5, rank: 1, players: 4, solo: false } });
    const stats = emptyStats();
    stats.total = 0;
    for (let index = 0; index < RESULTS_LIMIT + 5; index += 1) {
      await recordGameResult({ ...base, id: `puzzle-${index}`, gameId: 'puzzle', score: 100, metadata: { game: 'red', level: (index % 3) + 1 } });
    }
    const results = await loadResults();
    expect(results).toHaveLength(RESULTS_LIMIT);
    expect(results.some((result) => result.gameId === 'burst' || result.gameId === 'route')).toBe(false);

    const context = await loadAchievementContext();
    expect(achievementProgress('burst-collector', context)).toBe(2);
    expect(achievementProgress('burst-starter', context)).toBe(1);
    expect(achievementProgress('daily-three', context)).toBe(1);
    expect(achievementProgress('route-champion', context)).toBe(1);
    expect(achievementProgress('temple-restored', context)).toBe(1);
    expect(achievementProgress('station-explorer', context)).toBe(6);
    expect(achievementProgress('net-architect', context)).toBe(3);
    expect(achievementProgress('all-rounder', context)).toBe(3);
    expect(achievementProgress('first-signal', context)).toBe(1);

    const profile = await loadProfile();
    const guide = starterGuide({ results, mascotDays: 0, careerAreas: 0, stats: progressStatsOf(profile, results) });
    expect(guide.filter((step) => step.done).map((step) => step.id)).toEqual(['burst', 'puzzle', 'station']);
    // Sin el resumen acumulado, el historial solo ya no lo sabría.
    expect(starterGuide({ results, mascotDays: 0, careerAreas: 0 }).find((step) => step.id === 'burst')?.done).toBe(false);

    const summary = await loadProgressSummary();
    expect(summary).toMatchObject({ games: RESULTS_LIMIT + 7, bestRoute: 4200, routes: 1 });
    expect(profile.unlockedAchievements).toEqual(expect.arrayContaining(['route-champion', 'temple-restored']));
  });

  it('resumir por partes y combinar da lo mismo que resumir todo junto', () => {
    const results: GameResult[] = [
      { ...base, metadata: { won: 'firewall,firewall2', lives: 3, rounds: 8, daily: '2026-10-01' }, accuracy: 1 },
      { ...base, gameId: 'millionaire', metadata: { correctAnswers: 10 } },
      { ...base, gameId: 'route', score: 3000, metadata: { completed: true, pillars: 5, rank: 2, players: 5, solo: false } },
      { ...base, gameId: 'route', score: 5000, metadata: { completed: true, pillars: 3, rank: 1, players: 2, solo: true } },
      { ...base, gameId: 'puzzle', metadata: { game: 'binario', level: 2 } },
      { ...base, gameId: 'runner', metadata: { distance: 800, data: 40 } },
      { ...base, gameId: 'story', metadata: { chapter: 3 } },
      { ...base, gameId: 'station', metadata: { game: 'teleco' } },
      { ...base, metadata: { won: 'firewall', lives: 1, rounds: 8, daily: '2026-10-02' } },
    ];
    for (let cut = 0; cut <= results.length; cut += 1) {
      const split = combineStats(summarize(results.slice(0, cut)), summarize(results.slice(cut)));
      const whole = summarize(results);
      expect({ ...split, stations: [...split.stations].sort(), dailyDays: [...split.dailyDays].sort() }).toEqual({ ...whole, stations: [...whole.stations].sort(), dailyDays: [...whole.dailyDays].sort() });
    }
    expect(summarize(results)).toMatchObject({ total: 9, liveBestRank: 2, bestRoute: 5000, routesCompleted: 2, millionaireBest: 10, runnerData: 40, storyChapter: 3 });
  });
});

describe('avisos (UXS-07)', () => {
  it('una carga antigua no pisa un aviso nuevo ni su marca de leído', async () => {
    await pushInbox([{ kind: 'aviso', title: 'Viejo', body: 'x' }]);
    resetInboxCache();
    (AsyncStorage.getItem as jest.Mock).mockClear();
    const { release } = holdStorage('getItem', '@soytel/inbox');
    // Carga de foco y carga de arranque comparten la misma lectura.
    const first = loadInbox();
    const second = loadInbox();
    const pushing = pushInbox([{ kind: 'logro', title: 'Nuevo', body: 'y' }]);
    release();
    await Promise.all([first, second, pushing]);
    // Una sola lectura del disco para ambas cargas.
    expect((AsyncStorage.getItem as jest.Mock).mock.calls.filter(([key]) => key === '@soytel/inbox')).toHaveLength(1);
    restoreStorage();
    const id = getInboxSnapshot().find((item) => item.title === 'Nuevo')!.id;
    await markInboxRead(id);
    expect(getInboxSnapshot().map((item) => item.title)).toEqual(['Nuevo', 'Viejo']);
    expect(getInboxSnapshot()[0].read).toBe(true);
    expect(parseInbox(JSON.parse((await AsyncStorage.getItem('@soytel/inbox'))!)).map((item) => `${item.title}:${item.read}`)).toEqual(['Nuevo:true', 'Viejo:false']);
  });

  it('si no se puede guardar, el aviso no se da por guardado', async () => {
    await loadInbox();
    failStorage('multiSet', { key: '@soytel/inbox' });
    await expect(pushInbox([{ kind: 'aviso', title: 'Perdido', body: 'x' }])).rejects.toThrow();
    expect(getInboxSnapshot()).toEqual([]);
  });
});

describe('datos guardados con forma inválida (UXS-08)', () => {
  it('un perfil o historial dañado no rompe la app', async () => {
    await AsyncStorage.setItem('@soytel/profile', JSON.stringify({ alias: 7, xp: '900', level: 'alto', mascotMood: 'mal', streakDays: -4, lastPlayedAt: 'ayer', unlockedAchievements: [1, 'first-signal', null], gamesPlayed: null, appliedResults: 'x', archive: [1, 2] }));
    await AsyncStorage.setItem('@soytel/results', JSON.stringify([null, 'x', [], { gameId: 'burst' }, { gameId: 'burst', score: Number.NaN, accuracy: 1, completedAt: 'x' }, { ...base, score: 700 }]));
    const profile = await loadProfile();
    expect(profile).toMatchObject({ alias: 'Explorador TEL', xp: 0, level: 1, mascotMood: 72, streakDays: 0, lastPlayedAt: null, unlockedAchievements: ['first-signal'], gamesPlayed: 0 });
    expect(await loadResults()).toHaveLength(1);
    const summary = await loadProgressSummary();
    expect(summary).toMatchObject({ xp: 0, games: 1, bestRoute: 0 });
    // Y se puede seguir jugando sobre esos datos.
    const outcome = await recordGameResult({ ...base, id: 'nuevo' });
    expect(outcome.profile.gamesPlayed).toBe(2);
    expect(parseProfile('texto')).toMatchObject({ xp: 0 });
    expect(parseProfile([1])).toMatchObject({ xp: 0 });
    expect(parseInbox([null, { id: 'a', title: 't', body: 'b', kind: 'raro' }, { id: 5 }])).toEqual([expect.objectContaining({ id: 'a', kind: 'aviso', read: false })]);
  });
});

describe('día local para todo lo diario (UXS-18)', () => {
  it('la clave del día sigue al reloj del teléfono, no a UTC', () => {
    expect(localDayKey(new Date(2026, 9, 6, 20, 0))).toBe('2026-10-06');
    expect(localDayKey(new Date(2026, 9, 6, 23, 59))).toBe('2026-10-06');
    expect(localDayKey(new Date(2026, 9, 7, 0, 1))).toBe('2026-10-07');
    expect(msUntilNextLocalDay(new Date(2026, 9, 6, 23, 59, 0))).toBeLessThanOrEqual(61_000);
    expect(msUntilNextLocalDay(new Date(2026, 9, 6, 0, 0, 0))).toBeGreaterThan(23 * 3_600_000);
  });

  it('el cupo diario de cuidados de Rutix se cuenta por día local y no admite dobles', async () => {
    const evening = new Date(2026, 9, 6, 21, 30);
    const results = await Promise.all([countMascotCare(3, evening), countMascotCare(3, evening), countMascotCare(3, evening), countMascotCare(3, evening)]);
    expect(results.filter((item) => item.counted)).toHaveLength(3);
    expect((await countMascotCare(3, new Date(2026, 9, 6, 23, 50))).counted).toBe(false);
    expect((await countMascotCare(3, new Date(2026, 9, 7, 0, 5))).counted).toBe(true);
  });
});

describe('desafío diario (GAME-01, GAME-02)', () => {
  it('el bono se entrega una vez por día aunque se repita sin salir de la pantalla', async () => {
    const day = '2026-10-06';
    const play = (id: string) => recordGameResult({ ...base, id, score: 300, metadata: { daily: day, rounds: 5, lives: 2 } }, { bonus: { id: dailyBonusId(day), score: DAILY_BONUS } });
    const first = await play('diario-1');
    const second = await play('diario-2');
    const [third, fourth] = await Promise.all([play('diario-3'), play('diario-4')]);
    expect(first.bonusGranted).toBe(true);
    expect([second.bonusGranted, third.bonusGranted, fourth.bonusGranted]).toEqual([false, false, false]);
    const results = await loadResults();
    expect(results.map((result) => result.score).sort()).toEqual([300, 300, 300, 550]);
    expect(isDailyDone(results, day)).toBe(true);
    // Al día siguiente hay bono otra vez.
    const next = await recordGameResult({ ...base, id: 'diario-5', score: 300, metadata: { daily: '2026-10-07' } }, { bonus: { id: dailyBonusId('2026-10-07'), score: DAILY_BONUS } });
    expect(next.bonusGranted).toBe(true);
  });

  it('perder las vidas antes de la última ronda no completa el desafío', () => {
    expect(isDailyComplete(3, 5)).toBe(false);
    expect(isDailyComplete(5, 5)).toBe(true);
    expect(isDailyComplete(0, 0)).toBe(false);
    // Un intento fallido se guarda sin la marca del día: no cuenta como hecho ni suma días.
    const attempt: GameResult = { ...base, metadata: { daily: '', dailyAttempt: '2026-10-06', rounds: 3, lives: 0 } };
    expect(isDailyDone([attempt], '2026-10-06')).toBe(false);
    expect(summarize([attempt]).dailyDays).toEqual([]);
  });
});

describe('guardado desde las pantallas de juego (GAME-03, GAME-04)', () => {
  it('un doble toque guarda una sola vez', async () => {
    const { release } = holdStorage('multiSet', '@soytel/profile');
    const { result } = renderHook(() => useResultSaver());
    let outcomes: unknown[] = [];
    await act(async () => {
      const first = result.current.save({ ...base, id: 'capitulo-1', gameId: 'story', metadata: { chapter: 1 } });
      const second = result.current.save({ ...base, id: 'capitulo-1', gameId: 'story', metadata: { chapter: 1 } });
      release();
      outcomes = await Promise.all([first, second]);
    });
    restoreStorage();
    expect(outcomes[1]).toBeNull();
    expect(outcomes[0]).toMatchObject({ xpGained: expect.any(Number) });
    expect(result.current.status).toBe('saved');
    expect(await loadResults()).toHaveLength(1);
    expect((await loadProfile()).gamesPlayed).toBe(1);
  });

  it('la respuesta de una partida anterior no toca la partida nueva', async () => {
    const { release } = holdStorage('multiSet', '@soytel/profile');
    const { result, unmount } = renderHook(() => useResultSaver());
    let old: Promise<unknown> = Promise.resolve();
    let stillCurrent: () => boolean = () => true;
    await act(async () => {
      stillCurrent = result.current.mark();
      old = result.current.save({ ...base, id: 'partida-a', gameId: 'station', score: 800 });
    });
    expect(result.current.status).toBe('saving');
    // "Jugar de nuevo" antes de que termine el guardado anterior.
    act(() => result.current.reset());
    expect(result.current.status).toBe('idle');
    expect(stillCurrent()).toBe(false);
    await act(async () => {
      release();
      await old;
    });
    restoreStorage();
    // El resultado viejo se guardó, pero no reemplazó el estado de la partida nueva.
    expect(result.current.status).toBe('idle');
    expect(result.current.outcome).toBeNull();
    expect(await loadResults()).toHaveLength(1);
    unmount();
  });

  it('un fallo se informa y se puede reintentar sin duplicar', async () => {
    failStorage('multiSet', { key: '@soytel/profile' });
    const { result } = renderHook(() => useResultSaver());
    await act(async () => {
      await result.current.save({ ...base, id: 'partida-b' });
    });
    expect(result.current.status).toBe('failed');
    await act(async () => {
      await result.current.retry();
    });
    expect(result.current.status).toBe('saved');
    expect(await loadResults()).toHaveLength(1);
  });
});

describe('progreso de la cuenta al recuperarla (BE-08)', () => {
  it('conserva rutas, mejor ruta y la racha solo si sigue viva', async () => {
    const yesterday = new Date(Date.now() - DAY).toISOString();
    await mergeAccountProgress({ alias: 'Ana', avatar: 2, xp: 5000, games: 40, achievements: ['first-signal', 'inventado'], streak: 50, routes: 4, bestRoute: 4300, lastActiveAt: yesterday });
    const profile = await loadProfile();
    expect(profile).toMatchObject({ alias: 'Ana', xp: 5000, gamesPlayed: 40, streakDays: 50, unlockedAchievements: ['first-signal'] });
    expect(await loadProgressSummary()).toMatchObject({ streak: 50, routes: 4, bestRoute: 4300, games: 40 });
    // Jugar hoy continúa la racha recuperada.
    const outcome = await recordGameResult({ ...base, id: 'hoy' });
    expect(outcome.profile.streakDays).toBe(51);

    await resetAllData({ keepOnboarding: false });
    // Una racha de hace semanas ya venció: no se adopta.
    await mergeAccountProgress({ alias: 'Ana', avatar: 2, xp: 5000, games: 40, achievements: [], streak: 50, routes: 4, bestRoute: 4300, lastActiveAt: new Date(Date.now() - 20 * DAY).toISOString() });
    expect((await loadProfile()).streakDays).toBe(0);
    expect((await loadProgressSummary()).routes).toBe(4);
  });
});
