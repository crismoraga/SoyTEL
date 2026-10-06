import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render } from '@testing-library/react-native';
import { answerNote, pillarState, scoreStatus } from '@/features/route/status';
import { ShieldedGame } from '@/features/stations/games/ShieldedGame';
import { useDeadline, useSubmitOnce, type StationGameResult } from '@/features/stations/kit';
import { HostController, newHostRecord } from '@/route/host';
import { hostManager } from '@/route/hostManager';
import { saveHost } from '@/route/storage';
import { loadProfile, loadResults, recordGameResult } from '@/storage/profile';
import { resetAllData } from '@/storage/reset';
import type { GameResult } from '@/types/game';
import { SimNet } from './support/routeHarness';

beforeEach(async () => {
  await AsyncStorage.clear();
  await resetAllData({ keepOnboarding: false });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('indicadores honestos del participante (RT-09)', () => {
  it('solo dice "puntos" cuando el stand ya tiene el puntaje', () => {
    expect(scoreStatus(undefined, { state: 'sent' })).toMatchObject({ title: 'Enviando tu puntaje…', lost: false });
    expect(scoreStatus(undefined, { state: 'queued' }).title).toBe('Puntaje guardado en tu teléfono');
    expect(scoreStatus(undefined, undefined).title).toBe('Enviando tu puntaje…');
    expect(scoreStatus(undefined, { state: 'accepted' }).title).toBe('Puntaje recibido por el stand');
    expect(scoreStatus(820, { state: 'sent' })).toMatchObject({ title: '¡820 puntos!', note: 'Guardado en el stand.' });
    // Nunca "¡0 puntos!" por un envío que no llegó.
    ['sent', 'queued', 'rejected', 'expired'].forEach((state) => expect(scoreStatus(undefined, { state: state as 'sent' }).title).not.toContain('puntos!'));
  });

  it('explica por qué un puntaje no quedó y cuándo se puede reintentar', () => {
    expect(scoreStatus(undefined, { state: 'expired' })).toMatchObject({ lost: true, canRetry: false });
    expect(scoreStatus(undefined, { state: 'rejected', reason: 'closed' })).toMatchObject({ lost: true, canRetry: false });
    expect(scoreStatus(undefined, { state: 'rejected', reason: 'phase' }).note).toContain('ya había avanzado');
    expect(scoreStatus(undefined, { state: 'rejected', reason: 'invalid' })).toMatchObject({ lost: true, canRetry: true });
    expect(scoreStatus(undefined, { state: 'rejected', reason: 'kicked' }).canRetry).toBe(false);
  });

  it('la trivia distingue enviada, registrada y perdida', () => {
    expect(answerNote(false, undefined)).toBeNull();
    expect(answerNote(false, { state: 'sent' })).toBe('Enviando tu respuesta…');
    expect(answerNote(false, { state: 'queued' })).toContain('Sin conexión');
    expect(answerNote(false, { state: 'accepted' })).toBe('¡Respuesta registrada!');
    expect(answerNote(true, { state: 'sent' })).toBe('¡Respuesta registrada!');
    expect(answerNote(false, { state: 'expired' })).toContain('no alcanzó a llegar');
    expect(pillarState(undefined, { state: 'sent' })).toBe('Enviando…');
    expect(pillarState(undefined, { state: 'queued' })).toBe('En el teléfono');
    expect(pillarState(640, { state: 'sent' })).toBe('640');
  });
});

describe('cierre forzado de un juego abierto (RT-18)', () => {
  function Probe({ deadline, onComplete, tapTwice }: { deadline: number | null; onComplete: (result: StationGameResult) => void; tapTwice?: boolean }) {
    const submit = useSubmitOnce(onComplete);
    useDeadline(deadline, () => submit({ score: 300, accuracy: 0.5 }));
    if (tapTwice) {
      submit({ score: 900, accuracy: 1 });
      submit({ score: 900, accuracy: 1 });
    }
    return null;
  }

  it('entrega el resultado una sola vez aunque coincidan el plazo y el botón', () => {
    jest.useFakeTimers();
    const onComplete = jest.fn();
    render(<Probe deadline={Date.now() + 500} onComplete={onComplete} />);
    expect(onComplete).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ score: 300, accuracy: 0.5 });

    const again = jest.fn();
    render(<Probe deadline={1} onComplete={again} tapTwice />);
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(again).toHaveBeenCalledTimes(1);
    expect(again).toHaveBeenCalledWith({ score: 900, accuracy: 1 });
  });

  it('un proyecto de B213 con el plazo vencido se cierra solo y entrega lo logrado', () => {
    jest.useFakeTimers();
    const onComplete = jest.fn();
    render(<ShieldedGame seed={7} deadline={1} onComplete={onComplete} />);
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0][0] as StationGameResult;
    expect(Number.isFinite(result.score)).toBe(true);
    expect(Number.isFinite(result.accuracy)).toBe(true);
    expect(result.score).toBe(0);
    // Sin plazo no se cierra solo.
    const open = jest.fn();
    render(<ShieldedGame seed={7} onComplete={open} />);
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(open).not.toHaveBeenCalled();
  });
});

describe('recompensa del podio (RT-13)', () => {
  const result: GameResult = {
    id: 'route:ABC234:stp0123456789abcdef',
    gameId: 'route',
    score: 4200,
    accuracy: 0.8,
    durationSeconds: 1200,
    completedAt: new Date().toISOString(),
    metadata: { rank: 1, players: 3, pillars: 5, solo: false, code: 'ABC234', completed: true },
  };

  it('18 · el podio se abre dos veces y el primer guardado falla: la XP se suma una sola vez', async () => {
    jest.spyOn(AsyncStorage, 'multiSet').mockRejectedValueOnce(new Error('disco lleno'));
    await expect(recordGameResult(result)).rejects.toThrow('disco lleno');
    // Nada quedó a medias: se puede reintentar.
    expect((await loadProfile()).xp).toBe(0);
    expect(await loadResults()).toEqual([]);

    // Dos montajes del podio (o un reintento mientras el primero sigue en curso).
    const [first, second] = await Promise.all([recordGameResult(result), recordGameResult(result)]);
    expect([first.alreadyRecorded === true, second.alreadyRecorded === true].filter(Boolean)).toHaveLength(1);
    expect(first.xpGained).toBeGreaterThan(0);
    expect(second.xpGained).toBe(first.xpGained);

    const profile = await loadProfile();
    expect(profile.xp).toBe(first.xpGained);
    expect(profile.gamesPlayed).toBe(1);
    expect(await loadResults()).toHaveLength(1);

    // Volver a entrar al podio más tarde tampoco suma, y muestra la misma XP.
    const later = await recordGameResult(result);
    expect(later).toMatchObject({ alreadyRecorded: true, xpGained: first.xpGained });
    expect((await loadProfile()).xp).toBe(first.xpGained);
  });

  it('dos resultados distintos guardados a la vez se conservan ambos', async () => {
    const other: GameResult = { ...result, id: 'route:XYZ789:stp0123456789abcdef', score: 1000 };
    const [a, b] = await Promise.all([recordGameResult(result), recordGameResult(other)]);
    const profile = await loadProfile();
    expect(profile.xp).toBe(a.xpGained + b.xpGained);
    expect(profile.gamesPlayed).toBe(2);
    expect((await loadResults()).map((item) => item.id).sort()).toEqual([other.id, result.id].sort());
  });
});

describe('apertura de una ruta en el stand (RT-07)', () => {
  it('dos aperturas simultáneas comparten un solo controlador y "tomar el control" detiene al anterior', async () => {
    const net = new SimNet();
    await saveHost(newHostRecord('ABC234', 'sthprueba', 0, {}, Date.now(), 'a000000000aa'));
    const created: HostController[] = [];
    jest.spyOn(HostController, 'fromRecord').mockImplementation((record) => {
      const controller = new HostController(record, net.link(`stand${created.length}`), { locks: null });
      created.push(controller);
      return controller;
    });
    try {
      const [first, second] = await Promise.all([hostManager.open('ABC234'), hostManager.open('ABC234')]);
      expect(first).not.toBeNull();
      expect(second).toBe(first);
      expect(created).toHaveLength(1);
      expect(await hostManager.open('ABC234')).toBe(first);
      expect(first?.getView().role).toBe('driver');

      const epoch = first!.epoch;
      const taken = await hostManager.open('ABC234', true);
      expect(taken).not.toBe(first);
      expect(created).toHaveLength(2);
      expect(first?.getView().role).toBe('idle');
      expect(taken?.getView().role).toBe('driver');
      expect(taken!.epoch).toBeGreaterThan(epoch);
      expect(await hostManager.open('NOEXIS')).toBeNull();
    } finally {
      hostManager.stopAll();
    }
  });
});
