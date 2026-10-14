import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { getPuzzle } from '@/features/puzzles/catalog';
import { ZipPuzzleGame } from '@/features/puzzles/ZipPuzzleGame';
import { B215Circuit, roundMax } from '@/features/stations/b215/Circuit';
import { rounds as rutaRounds } from '@/features/stations/b215/parts/ruta';
import { pickB215Rounds } from '@/features/stations/b215/pool';
import type { B215Round, RoundProps } from '@/features/stations/b215/types';
import { createZipPuzzle, type ZipPuzzle } from '@/features/stations/b215/zip/logic';
import { ZipBoard } from '@/features/stations/b215/zip/ZipBoard';
import { ZipRound } from '@/features/stations/b215/zip/ZipRound';
import { useAskContinue, withContinue } from '@/features/stations/kit';
import { getTutorial } from '@/features/tutorial/tutorials';

// El circuito elige sus rondas con pickB215Rounds: aquí se le entregan rondas de mentira.
jest.mock('@/features/stations/b215/pool', () => ({ pickB215Rounds: jest.fn() }));

const pick = pickB215Rounds as jest.MockedFunction<typeof pickB215Rounds>;

// Ronda de mentira: termina al tocar «terminar» con el puntaje dado, o con 0,4 cuando se acaba el tiempo.
function fakeRound(id: string, score: number, seconds = 30): B215Round {
  function Fake({ timeUp, onDone }: RoundProps) {
    useEffect(() => {
      if (timeUp) onDone({ score: 0.4, accuracy: 0.5, detail: `tiempo ${id}` });
    }, [timeUp, onDone]);
    return (
      <View>
        <Text>{`jugando ${id}`}</Text>
        <Text accessibilityRole="button" onPress={() => onDone({ score, accuracy: score, detail: `listo ${id}` })}>{`terminar ${id}`}</Text>
      </View>
    );
  }
  return { id, title: `Ronda ${id}`, device: 'Equipo', icon: 'router', art: 'router', goal: `Meta ${id}`, explain: ['Uno', 'Dos'], learned: `Aprendiste ${id}.`, seconds, Component: Fake };
}

function press(label: string) {
  fireEvent.press(screen.getByText(label));
}

beforeEach(() => {
  jest.useFakeTimers();
  pick.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Circuito B215', () => {
  it('juega tres rondas con su explicación y su resultado, y suma 1000 como máximo', () => {
    pick.mockReturnValue([fakeRound('a', 1), fakeRound('b', 1), fakeRound('c', 1)]);
    const onComplete = jest.fn();
    render(<B215Circuit seed={5} groupSeed={9} onComplete={onComplete} />);
    expect(pick).toHaveBeenCalledWith(3, 9);

    // Tarjeta de explicación: equipo, título, meta y las dos frases; el reloj aún no corre.
    expect(screen.getByText('Ronda 1 de 3')).toBeTruthy();
    expect(screen.getByText('Equipo')).toBeTruthy();
    expect(screen.getByText('Ronda a')).toBeTruthy();
    expect(screen.getByText('Meta a')).toBeTruthy();
    expect(screen.getByText('Uno')).toBeTruthy();
    expect(screen.getByText('Dos')).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(120_000);
    });
    expect(screen.queryByText('jugando a')).toBeNull();

    press('¡Vamos!');
    expect(screen.getByText('RONDA 1/3')).toBeTruthy();
    press('terminar a');
    expect(screen.getByText('333')).toBeTruthy();
    expect(screen.getByText('listo a')).toBeTruthy();
    expect(screen.getByText('Aprendiste a.')).toBeTruthy();
    press('Siguiente ronda');

    expect(screen.getByText('Ronda 2 de 3')).toBeTruthy();
    press('¡Vamos!');
    press('terminar b');
    expect(screen.getByText('333')).toBeTruthy();
    press('Siguiente ronda');

    press('¡Vamos!');
    press('terminar c');
    expect(screen.getByText('334')).toBeTruthy();
    press('Ver resultado');

    expect(screen.getByText('1000')).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();
    press('Enviar mi puntaje');
    press('Enviar mi puntaje');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ score: 1000, accuracy: 1 });
  });

  it('muestra los lados de la carrera (redes, hardware, software) y da estrellas según el resultado', () => {
    pick.mockReturnValue([
      { ...fakeRound('a', 1), track: 'redes' },
      { ...fakeRound('b', 0.6), track: 'hardware' },
      { ...fakeRound('c', 0.1), track: 'software' },
    ]);
    render(<B215Circuit seed={1} onComplete={jest.fn()} />);
    expect(screen.getByText('Redes')).toBeTruthy();
    expect(screen.getByText('Hardware')).toBeTruthy();
    expect(screen.getByText('Software')).toBeTruthy();
    // El tiempo de la ronda se ve antes de empezar.
    expect(screen.getByText('30 s')).toBeTruthy();
    press('¡Vamos!');
    press('terminar a');
    expect(screen.getByLabelText('3 de 3 estrellas')).toBeTruthy();
    expect(screen.getByText('¡Muy bien!')).toBeTruthy();
    press('Siguiente ronda');
    press('¡Vamos!');
    press('terminar b');
    expect(screen.getByLabelText('2 de 3 estrellas')).toBeTruthy();
    press('Siguiente ronda');
    press('¡Vamos!');
    press('terminar c');
    expect(screen.getByLabelText('1 de 3 estrellas')).toBeTruthy();
    expect(screen.getByText('¡Buen intento!')).toBeTruthy();
    press('Ver resultado');
    expect(screen.getByText('Redes · Ronda a')).toBeTruthy();
    expect(screen.getByText('Hardware · Ronda b')).toBeTruthy();
    expect(screen.getByText('Software · Ronda c')).toBeTruthy();
  });

  it('reparte el puntaje por ronda y nunca pasa de 1000', () => {
    expect([0, 1, 2].map((index) => roundMax(3, index))).toEqual([333, 333, 334]);
    expect([0, 1].map((index) => roundMax(2, index))).toEqual([500, 500]);
    expect(roundMax(1, 0)).toBe(1000);

    pick.mockReturnValue([fakeRound('a', 0.5), fakeRound('b', 0.2), fakeRound('c', 7)]);
    const onComplete = jest.fn();
    render(<B215Circuit seed={1} onComplete={onComplete} />);
    press('¡Vamos!');
    press('terminar a');
    press('Siguiente ronda');
    press('¡Vamos!');
    press('terminar b');
    press('Siguiente ronda');
    press('¡Vamos!');
    // Un puntaje fuera de rango se acota a 1.
    press('terminar c');
    press('Ver resultado');
    press('Enviar mi puntaje');
    // 0,5 × 333 + 0,2 × 333 + 1 × 334
    expect(onComplete).toHaveBeenCalledWith({ score: 167 + 67 + 334, accuracy: (0.5 + 0.2 + 1) / 3 });
  });

  it('funciona con una sola ronda (vale los 1000)', () => {
    pick.mockReturnValue([fakeRound('solo', 1)]);
    const onComplete = jest.fn();
    render(<B215Circuit seed={3} onComplete={onComplete} />);
    expect(screen.getByText('Ronda 1 de 1')).toBeTruthy();
    press('¡Vamos!');
    press('terminar solo');
    expect(screen.getByText('1000')).toBeTruthy();
    press('Ver resultado');
    press('Enviar mi puntaje');
    expect(onComplete).toHaveBeenCalledWith({ score: 1000, accuracy: 1 });
  });

  it('usa la semilla propia si no hay semilla de grupo, y cada ronda recibe la suya', () => {
    const seen: number[] = [];
    function Spy({ seed, level, onDone }: RoundProps) {
      seen.push(seed * 10 + level);
      return <Text accessibilityRole="button" onPress={() => onDone({ score: 1, accuracy: 1, detail: 'ok' })}>terminar</Text>;
    }
    pick.mockReturnValue([{ ...fakeRound('a', 1), Component: Spy }, { ...fakeRound('b', 1), Component: Spy }]);
    render(<B215Circuit seed={100} onComplete={jest.fn()} />);
    expect(pick).toHaveBeenCalledWith(3, 100);
    press('¡Vamos!');
    press('terminar');
    press('Siguiente ronda');
    press('¡Vamos!');
    expect(seen[0]).toBe(100 * 10 + 1);
    expect(seen[seen.length - 1]).toBe(101 * 10 + 1);
  });

  it('cuando se acaba el tiempo la ronda recibe timeUp y entrega lo hecho; el ritmo alarga el tiempo', () => {
    pick.mockReturnValue([fakeRound('a', 1, 30), fakeRound('b', 1, 30)]);
    render(<B215Circuit seed={1} pace={2} onComplete={jest.fn()} />);
    press('¡Vamos!');
    act(() => {
      jest.advanceTimersByTime(59_000);
    });
    expect(screen.getByText('jugando a')).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(1_500);
    });
    expect(screen.getByText('tiempo a')).toBeTruthy();
    // 0,4 de 500 puntos
    expect(screen.getByText('200')).toBeTruthy();
  });

  it('el cierre de la ruta en vivo cuenta lo hecho, deja en 0 las rondas que faltan y entrega una sola vez', () => {
    pick.mockReturnValue([fakeRound('a', 1), fakeRound('b', 1), fakeRound('c', 1)]);
    const onComplete = jest.fn();
    render(<B215Circuit seed={1} deadline={Date.now() + 20_000} onComplete={onComplete} />);
    press('¡Vamos!');
    press('terminar a');
    press('Siguiente ronda');
    press('¡Vamos!');
    expect(onComplete).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(20_500);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    // Ronda 1: 333; ronda 2 (en curso): 0,4 × 333 = 133; ronda 3: 0.
    expect(onComplete.mock.calls[0][0].score).toBe(333 + 133);
    expect(onComplete.mock.calls[0][0].accuracy).toBeCloseTo((1 + 0.5) / 3);
    act(() => {
      jest.advanceTimersByTime(120_000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByText('466')).toBeTruthy();
  });

  it('si el cierre llega con la explicación en pantalla, entrega solo lo terminado', () => {
    pick.mockReturnValue([fakeRound('a', 1), fakeRound('b', 1)]);
    const onComplete = jest.fn();
    render(<B215Circuit seed={1} deadline={Date.now() + 10_000} onComplete={onComplete} />);
    press('¡Vamos!');
    press('terminar a');
    press('Siguiente ronda');
    act(() => {
      jest.advanceTimersByTime(10_500);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0].score).toBe(500);
  });

  it('si la ronda no responde al cierre, no se queda esperando', () => {
    function Frozen() {
      return <Text>congelada</Text>;
    }
    pick.mockReturnValue([fakeRound('a', 1), { ...fakeRound('b', 1), Component: Frozen }]);
    const onComplete = jest.fn();
    render(<B215Circuit seed={1} deadline={Date.now() + 10_000} onComplete={onComplete} />);
    press('¡Vamos!');
    press('terminar a');
    press('Siguiente ronda');
    press('¡Vamos!');
    act(() => {
      jest.advanceTimersByTime(10_200);
    });
    expect(onComplete).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0].score).toBe(500);
  });

  it('con withContinue el tiempo de la ronda se detiene mientras hay un «Continuar» pendiente', () => {
    function Asking({ timeUp, onDone }: RoundProps) {
      const ask = useAskContinue();
      useEffect(() => {
        if (timeUp) onDone({ score: 0.4, accuracy: 0.5, detail: 'se acabó' });
      }, [timeUp, onDone]);
      return (
        <View>
          <Text>jugando</Text>
          <Text accessibilityRole="button" onPress={() => ask(() => undefined, 'Seguir')}>
            preguntar
          </Text>
        </View>
      );
    }
    pick.mockReturnValue([{ ...fakeRound('q', 1, 30), Component: Asking }]);
    const Wrapped = withContinue(B215Circuit);
    render(<Wrapped seed={1} onComplete={jest.fn()} />);
    press('¡Vamos!');
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    press('preguntar');
    act(() => {
      jest.advanceTimersByTime(120_000);
    });
    expect(screen.getByText('jugando')).toBeTruthy();
    press('Seguir');
    act(() => {
      jest.advanceTimersByTime(19_000);
    });
    expect(screen.getByText('jugando')).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(2_000);
    });
    expect(screen.getByText('se acabó')).toBeTruthy();
  });
});

// ——— Ruta del paquete ———

const SNAKE = [0, 1, 2, 3, 7, 6, 5, 4, 8, 9, 10, 11, 15, 14, 13, 12];
const snake: ZipPuzzle = { size: 4, checkpoints: [0, 3, 4, 11, 12], solution: SNAKE };

interface Pt {
  x: number;
  y: number;
}

const SIDE = 320;
let stamp = 1;

function centerOf(cell: number, size: number): Pt {
  const unit = SIDE / size;
  return { x: ((cell % size) + 0.5) * unit, y: (Math.floor(cell / size) + 0.5) * unit };
}

// Da al tablero el tamaño que en el teléfono le daría FitBox.
function layoutBoard() {
  const boxes = screen.UNSAFE_getAllByType(View).filter((node) => typeof node.props.onLayout === 'function');
  act(() => {
    boxes[0].props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: SIDE, height: SIDE } } });
  });
}

function touch(point: Pt, previous: Pt) {
  stamp += 1;
  return {
    nativeEvent: { locationX: point.x, locationY: point.y, pageX: point.x, pageY: point.y, identifier: 1, timestamp: stamp, touches: [], changedTouches: [] },
    touchHistory: {
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: stamp,
      numberActiveTouches: 1,
      touchBank: [
        {
          touchActive: true,
          startPageX: previous.x,
          startPageY: previous.y,
          startTimeStamp: 1,
          currentPageX: point.x,
          currentPageY: point.y,
          currentTimeStamp: stamp,
          previousPageX: previous.x,
          previousPageY: previous.y,
          previousTimeStamp: stamp - 1,
        },
      ],
    },
  };
}

// Un dedo que baja en el primer punto, pasa por los demás y se levanta.
function drag(points: Pt[]) {
  const board = screen.getByTestId('zip-board');
  let previous = points[0];
  fireEvent(board, 'responderGrant', touch(points[0], previous));
  for (const point of points.slice(1)) {
    fireEvent(board, 'responderMove', touch(point, previous));
    previous = point;
  }
  fireEvent(board, 'responderRelease', touch(previous, previous));
}

const trace = (cells: number[], size: number) => drag(cells.map((cell) => centerOf(cell, size)));

describe('Ruta del paquete · tablero', () => {
  it('se arrastra desde el paquete, rechaza un punto fuera de orden y deshace', () => {
    const onSolved = jest.fn();
    render(<ZipBoard puzzle={snake} onSolved={onSolved} />);
    layoutBoard();
    expect(screen.getByText('1/16')).toBeTruthy();
    expect(screen.getByText('Une del 1 al 5 sin dejar casillas vacías.')).toBeTruthy();

    // La casilla 4 es el punto 3 y todavía toca el 2.
    trace([0, 4], 4);
    expect(screen.getByText('Primero pasa por el 2.')).toBeTruthy();
    expect(screen.getByText('1/16')).toBeTruthy();

    trace([0, 1, 2, 3], 4);
    expect(screen.getByText('4/16')).toBeTruthy();
    expect(screen.getByText('¡Punto 2! Sigue al 3.')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Deshacer'));
    expect(screen.getByText('3/16')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Reiniciar'));
    expect(screen.getByText('1/16')).toBeTruthy();
    // Reiniciar también se puede deshacer.
    fireEvent.press(screen.getByLabelText('Deshacer'));
    expect(screen.getByText('3/16')).toBeTruthy();
    expect(onSolved).not.toHaveBeenCalled();
  });

  it('volver sobre el cable o tocar una casilla recorrida lo corta hasta ahí', () => {
    render(<ZipBoard puzzle={snake} onSolved={jest.fn()} />);
    layoutBoard();
    trace([0, 1, 2, 3], 4);
    expect(screen.getByText('4/16')).toBeTruthy();
    // Arrastrar hacia atrás hasta la casilla 1.
    drag([centerOf(3, 4), centerOf(2, 4), centerOf(1, 4)]);
    expect(screen.getByText('2/16')).toBeTruthy();
    // Un toque sobre una casilla vecina la suma; un toque sobre el punto de partida corta todo.
    drag([centerOf(2, 4)]);
    expect(screen.getByText('3/16')).toBeTruthy();
    drag([centerOf(0, 4)]);
    expect(screen.getByText('1/16')).toBeTruthy();
  });

  it('avisa si el último punto se alcanza antes de cubrir todo y si el dedo baja lejos del paquete', () => {
    const early: ZipPuzzle = { size: 4, checkpoints: [0, 3, 4, 12], solution: SNAKE };
    render(<ZipBoard puzzle={early} onSolved={jest.fn()} />);
    layoutBoard();
    trace([0, 1, 2, 3, 7, 6, 5, 4, 8, 12], 4);
    expect(screen.getByText('Antes del 4, pasa por todas las casillas.')).toBeTruthy();
    expect(screen.getByText('9/16')).toBeTruthy();

    // Un toque lejos del paquete no hace nada, pero explica de dónde se arrastra.
    drag([centerOf(14, 4)]);
    expect(screen.getByText('Arrastra desde el paquete: va al final del cable.')).toBeTruthy();
    expect(screen.getByText('9/16')).toBeTruthy();
  });

  it('avisa cuando el camino deja una casilla sin salida', () => {
    render(<ZipBoard puzzle={snake} onSolved={jest.fn()} />);
    layoutBoard();
    // La casilla 4 solo se alcanzaría desde la cabeza (8) y ahí se acabaría el camino.
    trace([0, 1, 5, 9, 8], 4);
    expect(screen.getByText('Así quedarán casillas sin paso. Retrocede un poco.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Deshacer'));
    expect(screen.getByText('4/16')).toBeTruthy();
  });

  it('resuelve el tablero: estalla, avisa una sola vez y ya no acepta más', () => {
    const onSolved = jest.fn();
    render(<ZipBoard puzzle={snake} onSolved={onSolved} />);
    layoutBoard();
    trace(SNAKE, 4);
    expect(screen.getByText('16/16')).toBeTruthy();
    expect(screen.getAllByText('¡Paquete entregado!').length).toBeGreaterThan(0);
    expect(onSolved).toHaveBeenCalledTimes(1);
    expect(onSolved.mock.calls[0][0].steps).toBe(15);
    trace([12, 13], 4);
    expect(screen.getByText('16/16')).toBeTruthy();
    expect(onSolved).toHaveBeenCalledTimes(1);
  });

  it('no responde cuando está desactivado', () => {
    render(<ZipBoard puzzle={snake} disabled onSolved={jest.fn()} />);
    layoutBoard();
    trace([0, 1, 2], 4);
    expect(screen.getByText('1/16')).toBeTruthy();
  });
});

describe('Ruta del paquete · ronda del circuito', () => {
  it('está registrada con los datos pedidos', () => {
    expect(rutaRounds).toHaveLength(1);
    const [round] = rutaRounds;
    expect(round).toMatchObject({ id: 'ruta-paquete', title: 'Ruta del paquete', device: 'Router', art: 'router', icon: 'route', seconds: 45 });
    expect(round.goal).toBe('Lleva el paquete del 1 al último número pasando por todas las casillas.');
    expect(round.goal.length).toBeLessThanOrEqual(80);
    expect(round.explain).toHaveLength(2);
    expect(round.learned).toBe('Un paquete llega a su destino saltando por varios routers, uno tras otro.');
  });

  it('resuelta entrega 0,85 a 1 según el tiempo que sobró', () => {
    const onDone = jest.fn();
    render(<ZipRound seed={7} level={0} pace={1} timeUp={false} onDone={onDone} />);
    layoutBoard();
    const { solution } = createZipPuzzle(4, 7);
    act(() => {
      jest.advanceTimersByTime(9_000);
    });
    trace(solution, 4);
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    const result = onDone.mock.calls[0][0];
    // Quedaban 36 de 45 segundos: 0,85 + 0,15 × 0,8.
    expect(result.score).toBeCloseTo(0.97, 2);
    expect(result.accuracy).toBe(1);
    expect(result.detail).toContain('16 casillas');
  });

  it('con el ritmo más lento el tiempo que sobra se mide sobre el tiempo total', () => {
    const onDone = jest.fn();
    render(<ZipRound seed={7} level={0} pace={2} timeUp={false} onDone={onDone} />);
    layoutBoard();
    act(() => {
      jest.advanceTimersByTime(18_000);
    });
    trace(createZipPuzzle(4, 7).solution, 4);
    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    // Quedaban 72 de 90 segundos.
    expect(onDone.mock.calls[0][0].score).toBeCloseTo(0.97, 2);
  });

  it('al acabarse el tiempo vale 0,6 por la parte cubierta y se entrega una sola vez', () => {
    const onDone = jest.fn();
    const view = render(<ZipRound seed={7} level={0} pace={1} timeUp={false} onDone={onDone} />);
    layoutBoard();
    trace(createZipPuzzle(4, 7).solution.slice(0, 4), 4);
    view.rerender(<ZipRound seed={7} level={0} pace={1} timeUp onDone={onDone} />);
    expect(onDone).toHaveBeenCalledTimes(1);
    const result = onDone.mock.calls[0][0];
    expect(result.score).toBeCloseTo(0.6 * (4 / 16));
    expect(result.accuracy).toBe(1);
    expect(result.detail).toBe('Cubriste 4 de 16 casillas.');
    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('sin jugadas y sin tiempo vale 0', () => {
    const onDone = jest.fn();
    render(<ZipRound seed={3} level={1} pace={1} timeUp onDone={onDone} />);
    expect(onDone).toHaveBeenCalledWith({ score: 0.6 * (1 / 25), accuracy: 0, detail: 'Cubriste 1 de 25 casillas.' });
  });
});

describe('Ruta del paquete · desafío sin reloj', () => {
  it('está en el catálogo con su tutorial y sus niveles', () => {
    const info = getPuzzle('paquete');
    expect(info?.title).toBe('Ruta del paquete');
    expect([1, 2, 3, 4, 6].map((level) => info?.levelName(level))).toEqual(['4×4', '5×5', '6×6', '7×7', '7×7']);
    expect(getTutorial('puzzle-paquete')?.steps.length).toBeGreaterThanOrEqual(3);
  });

  it('crece con el nivel: 4×4, 5×5, 6×6 y 7×7', () => {
    [
      [1, 4],
      [2, 5],
      [3, 6],
      [5, 7],
    ].forEach(([level, size]) => {
      const view = render(<ZipPuzzleGame level={level} seed={5} onSolved={jest.fn()} say={jest.fn()} />);
      layoutBoard();
      expect(screen.getByLabelText(new RegExp(`Tablero de ${size} por ${size}`))).toBeTruthy();
      view.unmount();
    });
  });

  it('Rutix comenta y, al resolver, entrega 1000 si no hubo pasos de más', () => {
    const onSolved = jest.fn();
    const say = jest.fn();
    render(<ZipPuzzleGame level={1} seed={5} onSolved={onSolved} say={say} />);
    layoutBoard();
    const { solution } = createZipPuzzle(4, 5);
    trace(solution, 4);
    expect(say).toHaveBeenCalledWith(expect.stringMatching(/^¡Punto 2!/), 'good');
    expect(say).toHaveBeenLastCalledWith('¡Paquete entregado! Pasaste por todas las casillas.', 'great');
    expect(onSolved).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    expect(onSolved).toHaveBeenCalledTimes(1);
    expect(onSolved).toHaveBeenCalledWith({ score: 1000, accuracy: 1, detail: '16 casillas · sin retroceder' });
  });

  it('los pasos de más bajan el puntaje pero siempre vale al menos 600', () => {
    const onSolved = jest.fn();
    render(<ZipPuzzleGame level={1} seed={5} onSolved={onSolved} say={jest.fn()} />);
    layoutBoard();
    const { solution } = createZipPuzzle(4, 5);
    // Un tramo de ida y vuelta antes de resolver.
    trace(solution.slice(0, 3), 4);
    drag([centerOf(solution[2], 4), centerOf(solution[1], 4), centerOf(solution[0], 4)]);
    trace(solution, 4);
    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    const result = onSolved.mock.calls[0][0];
    expect(result.score).toBeGreaterThanOrEqual(600);
    expect(result.score).toBeLessThan(1000);
    expect(result.detail).toMatch(/2 pasos de más/);
  });
});
