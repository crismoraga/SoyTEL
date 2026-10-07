import { useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { microGameCatalog } from '@/features/burst/catalog';
import { createPacketBag, PACKETS_NEEDED, packetRushTarget } from '@/features/burst/packets';
import { netAccuracy } from '@/features/puzzles/netwalk';
import { BINARY_ROUNDS, binaryPoints, CIPHER_ROUNDS, cipherPoints } from '@/features/puzzles/codes';
import { MakerBoardsGame } from '@/features/stations/games/MakerBoardsGame';
import { gameNow, useAskContinue, useGameTimeout, withContinue, type StationGameProps } from '@/features/stations/kit';
import { boardInfo } from '@/features/stations/logic/maker';
import { securityCards } from '@/features/stations/logic/security';
import { bestEpoch, EPOCHS, stopQuality, stopVerdict, validationLoss } from '@/features/stations/logic/vision';
import { wifiSecurities } from '@/features/burst/concepts';
import { mulberry32 } from '@/route/random';

// Hallazgos de juegos de la auditoría (GAME-05, 07, 08, 10, 11, 12, 13 y 15).

describe('GAME-12 · puntajes que suman exactamente 1000', () => {
  it('tres mensajes cifrados perfectos suman 1000', () => {
    const total = Array.from({ length: CIPHER_ROUNDS }, (_, index) => cipherPoints(0, index)).reduce((sum, value) => sum + value, 0);
    expect(total).toBe(1000);
  });

  it('las rondas de binario perfectas suman 1000', () => {
    const total = Array.from({ length: BINARY_ROUNDS }, (_, index) => binaryPoints(0, index)).reduce((sum, value) => sum + value, 0);
    expect(total).toBe(1000);
  });

  it('cada comprobación fallida resta, sin bajar del mínimo por mensaje', () => {
    for (let index = 0; index < CIPHER_ROUNDS; index += 1) {
      expect(cipherPoints(1, index)).toBeLessThan(cipherPoints(0, index));
      expect(cipherPoints(2, index)).toBeLessThan(cipherPoints(1, index));
      expect(cipherPoints(50, index)).toBe(120);
    }
  });
});

describe('GAME-13 · Congestión de red', () => {
  it('el objetivo anunciado no contradice lo que exige cada ronda', () => {
    const info = microGameCatalog.find((game) => game.id === 'packet-rush')!;
    // La meta cambia con la ronda: el texto fijo del catálogo no promete un número.
    expect(`${info.instruction} ${info.tip}`).not.toMatch(/\d/);
    expect([0, 1, 2, 3, 4, 7].map(packetRushTarget)).toEqual([12, 14, 16, 18, 18, 18]);
  });
});

describe('GAME-07 · Atrapa el paquete siempre se puede ganar', () => {
  it('entre las primeras diez apariciones hay al menos cinco paquetes sanos, con cualquier semilla y nivel', () => {
    for (let level = 0; level <= 7; level += 1) {
      for (let seed = 1; seed <= 400; seed += 1) {
        const next = createPacketBag(level, mulberry32(seed));
        const first = Array.from({ length: 10 }, () => next());
        const healthy = first.filter((bad) => !bad).length;
        if (healthy < PACKETS_NEEDED) throw new Error(`nivel ${level}, semilla ${seed}: solo ${healthy} sanos`);
      }
    }
  });

  it('la semilla 247 del reporte (ronda 8) ya no deja la ronda sin solución', () => {
    const next = createPacketBag(7, mulberry32(247));
    const twenty = Array.from({ length: 20 }, () => next());
    expect(twenty.filter((bad) => !bad).length).toBeGreaterThanOrEqual(10);
  });

  it('sigue habiendo infectados, y más en las rondas avanzadas', () => {
    const share = (level: number) => {
      const next = createPacketBag(level, mulberry32(9));
      const list = Array.from({ length: 400 }, () => next());
      return list.filter(Boolean).length / list.length;
    };
    expect(share(0)).toBeGreaterThan(0.15);
    expect(share(7)).toBeGreaterThan(share(0));
    expect(share(7)).toBeLessThanOrEqual(0.5);
  });
});

describe('GAME-08 · Entrena la IA: el mejor momento es el mínimo que se dibuja', () => {
  it('para cada entrenamiento posible, el mínimo de la curva está en la época que da puntaje completo', () => {
    for (let best = 11; best <= 16; best += 1) {
      let minimum = 0;
      for (let epoch = 1; epoch <= EPOCHS; epoch += 1) {
        if (validationLoss(epoch, best) < validationLoss(minimum, best)) minimum = epoch;
      }
      expect(minimum).toBe(best);
      expect(stopQuality(minimum, best)).toBe(1);
      expect(stopQuality(minimum - 2, best)).toBeLessThan(1);
      expect(stopQuality(minimum + 2, best)).toBeLessThan(1);
    }
    // bestEpoch entrega valores dentro de ese rango.
    const random = mulberry32(5);
    for (let index = 0; index < 50; index += 1) {
      const best = bestEpoch(random);
      expect(best).toBeGreaterThanOrEqual(11);
      expect(best).toBeLessThanOrEqual(16);
    }
  });

  it('el mensaje al detener coincide con la pendiente de la curva', () => {
    expect(stopVerdict(13, 13)).toMatchObject({ tone: 'good' });
    expect(stopVerdict(13, 13).text).toMatch(/mínimo/);
    expect(stopVerdict(11, 13).text).toMatch(/todavía (estaba )?baja/i);
    expect(stopVerdict(15, 13).text).toMatch(/empezaba a subir/i);
    expect(stopVerdict(4, 13)).toMatchObject({ tone: 'bad' });
    expect(stopVerdict(4, 13).text).toMatch(/pronto/i);
    expect(stopVerdict(26, 13)).toMatchObject({ tone: 'bad' });
    expect(stopVerdict(26, 13).text).toMatch(/tarde/i);
  });
});

describe('GAME-11 · Conecta la red: la precisión descuenta lo que resolvieron las pistas', () => {
  it('una solución hecha solo con pistas no cuenta como 100% propia', () => {
    expect(netAccuracy(11, 0, 11)).toBe(0);
  });

  it('una solución manual óptima mantiene el 100% y los giros de más la bajan', () => {
    expect(netAccuracy(11, 11, 0)).toBe(1);
    expect(netAccuracy(11, 22, 0)).toBeCloseTo(0.5);
  });

  it('una solución mixta refleja cuánto ayudaron las pistas', () => {
    const mixed = netAccuracy(12, 8, 4);
    expect(mixed).toBeCloseTo(8 / 12);
    expect(netAccuracy(12, 6, 6)).toBeLessThan(mixed);
    expect(netAccuracy(12, 16, 4)).toBeLessThan(mixed);
  });
});

describe('GAME-15 · Wi-Fi abierta y HTTPS', () => {
  it('las explicaciones distinguen el cifrado de la red del cifrado del sitio', () => {
    const open = wifiSecurities.find((item) => item.level === 0)!;
    expect(open.why).toMatch(/HTTPS/);
    expect(open.why).not.toMatch(/cualquiera cerca puede leer lo que envías/i);
    const card = securityCards.find((item) => item.id === 't-wifi')!;
    const note = card.flags.find((flag) => flag.text === 'sin contraseña')!;
    expect(note.why).toMatch(/HTTPS/);
    expect(note.why).not.toMatch(/Cualquiera puede espiar el tráfico\.?$/);
  });

  it('el portal falso que pide la clave de una red social sigue siendo una amenaza', () => {
    const portal = securityCards.find((item) => /Instagram/.test(item.body))!;
    expect(portal.threat).toBe(true);
    expect(portal.flags.some((flag) => /claves de redes sociales/.test(flag.why))).toBe(true);
  });
});

// ——— Reloj del juego (GAME-05 y GAME-10) ———

function Probe({ onComplete }: StationGameProps) {
  const [endsAt] = useState(() => gameNow() + 10_000);
  const [state, setState] = useState('jugando');
  const ask = useAskContinue();
  useGameTimeout(state === 'jugando' || state === 'leyendo' ? endsAt : null, () => setState('se acabó el tiempo'));
  return (
    <View>
      <Text>{state}</Text>
      <Text accessibilityRole="button" onPress={() => {
        setState('leyendo');
        ask(() => setState('jugando'), 'Seguir');
      }}>
        responder
      </Text>
      <Text accessibilityRole="button" onPress={() => onComplete({ score: 1, accuracy: 1 })}>
        terminar
      </Text>
    </View>
  );
}

const WrappedProbe = withContinue(Probe);

describe('reloj del juego', () => {
  let appStateListener: ((state: string) => void) | null = null;

  beforeEach(() => {
    jest.useFakeTimers();
    appStateListener = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, listener: (state: string) => void) => {
      appStateListener = listener;
      return { remove: () => (appStateListener = null) };
    }) as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('GAME-10 · mientras se lee una explicación, el tiempo de la etapa no corre', () => {
    render(<WrappedProbe seed={1} onComplete={() => undefined} />);
    act(() => jest.advanceTimersByTime(4000));
    fireEvent.press(screen.getByText('responder'));
    // Un minuto leyendo: la etapa no se acaba.
    act(() => jest.advanceTimersByTime(60_000));
    expect(screen.getByText('leyendo')).toBeTruthy();
    fireEvent.press(screen.getByText('Seguir'));
    expect(screen.getByText('jugando')).toBeTruthy();
    // Quedaban 6 segundos de los 10.
    act(() => jest.advanceTimersByTime(5500));
    expect(screen.getByText('jugando')).toBeTruthy();
    act(() => jest.advanceTimersByTime(700));
    expect(screen.getByText('se acabó el tiempo')).toBeTruthy();
  });

  it('GAME-05 · en práctica, salir de la app detiene el juego hasta que el jugador lo reanuda', () => {
    render(<WrappedProbe seed={1} onComplete={() => undefined} />);
    act(() => jest.advanceTimersByTime(3000));
    act(() => appStateListener?.('background'));
    act(() => jest.advanceTimersByTime(5 * 60_000));
    act(() => appStateListener?.('active'));
    // Volver no reanuda solo: hay que tocar. (El juego queda detrás del aviso, oculto para el lector de pantalla.)
    expect(screen.getByText('Juego en pausa')).toBeTruthy();
    expect(screen.getByText('jugando', { includeHiddenElements: true })).toBeTruthy();
    act(() => jest.advanceTimersByTime(30_000));
    expect(screen.getByText('jugando', { includeHiddenElements: true })).toBeTruthy();
    fireEvent.press(screen.getByText('Seguir jugando'));
    expect(screen.queryByText('Juego en pausa')).toBeNull();
    // Quedaban 7 segundos.
    act(() => jest.advanceTimersByTime(6500));
    expect(screen.getByText('jugando')).toBeTruthy();
    act(() => jest.advanceTimersByTime(700));
    expect(screen.getByText('se acabó el tiempo')).toBeTruthy();
  });

  it('GAME-05 · en la ruta en vivo (con cierre impuesto por el stand) el juego no se pausa por salir de la app', () => {
    render(<WrappedProbe seed={1} deadline={Date.now() + 120_000} onComplete={() => undefined} />);
    act(() => appStateListener?.('background'));
    act(() => jest.advanceTimersByTime(11_000));
    act(() => appStateListener?.('active'));
    expect(screen.queryByText('Juego en pausa')).toBeNull();
    expect(screen.getByText('se acabó el tiempo')).toBeTruthy();
  });

  it('una partida nueva no hereda la pausa de la anterior', () => {
    const first = render(<WrappedProbe seed={1} onComplete={() => undefined} />);
    fireEvent.press(screen.getByText('responder'));
    first.unmount();
    render(<WrappedProbe seed={2} onComplete={() => undefined} />);
    act(() => jest.advanceTimersByTime(10_500));
    expect(screen.getByText('se acabó el tiempo')).toBeTruthy();
  });

  it('GAME-10 · Placas maker: leer la explicación del primer proyecto no descarta los otros tres', () => {
    render(<WrappedMaker seed={7} onComplete={() => undefined} />);
    act(() => jest.advanceTimersByTime(600));
    fireEvent.press(screen.getByLabelText(/^Etapa 1:/));
    expect(screen.getByText('PROYECTO 1 DE 4')).toBeTruthy();
    fireEvent.press(screen.getByLabelText(boardInfo.arduino.name));
    // Un minuto leyendo la explicación (la etapa dura mucho menos).
    act(() => jest.advanceTimersByTime(60_000));
    fireEvent.press(screen.getByText('Siguiente proyecto'));
    expect(screen.getByText('PROYECTO 2 DE 4')).toBeTruthy();
  });
});

const WrappedMaker = withContinue(MakerBoardsGame);
