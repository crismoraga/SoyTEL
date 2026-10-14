import { createElement, type ComponentType } from 'react';
import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { rounds } from '@/features/stations/b215/parts/equipos';
import { RouterRound } from '@/features/stations/b215/rounds/RouterRound';
import { SwitchRound } from '@/features/stations/b215/rounds/SwitchRound';
import {
  buildResult,
  checkSwitchAnswer,
  expectedSwitchAnswer,
  FLOOD,
  holdMs,
  internetHosts,
  makeRouterRound,
  makeSwitchRound,
  matchingRows,
  normalizeLevel,
  praiseFor,
  ROUND_ITEMS,
  ROUTER_DEFAULT_HINT,
  routeFor,
  routerBoardLayout,
  routerFeedback,
  streakOf,
  SWITCH_FLOOD_HINT,
  switchBoardLayout,
  switchFeedback,
  switchTableAfter,
  type Level,
  type Rect,
  type RouteRow,
  type RouterRoundData,
  type SwitchFrame,
  type SwitchRoundData,
} from '@/features/stations/b215/rounds/equipos.logic';
import { icons } from '@/graphics/icons';
import type { RoundProps, RoundResult } from '@/features/stations/b215/types';

// Rondas «El switch reparte» y «¿Por dónde sale?» del circuito de la sala B215.

const mockHaptics = { success: jest.fn(), warning: jest.fn() };

jest.mock('@/lib/feedback', () => ({
  feedbackSuccess: () => {
    mockHaptics.success();
    return Promise.resolve();
  },
  feedbackWarning: () => {
    mockHaptics.warning();
    return Promise.resolve();
  },
  feedbackTap: () => Promise.resolve(),
  feedbackHeavy: () => Promise.resolve(),
}));

// Todo acierto empieza con un elogio (o con la racha).
const PRAISE = /^(¡Bien!|¡Eso!|¡Justo!|¡Genial!|¡Perfecto!|¡Así!|¡Racha x\d+!)/;

const SEEDS = Array.from({ length: 300 }, (_, index) => index + 1);
const LEVELS: Level[] = [0, 1, 2];

// Falla con la semilla y el nivel a la vista (en bucles largos, un expect solo no diría cuál falló).
function must(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

describe('nivel', () => {
  it('se acota a 0–2 y, sin número válido, es normal', () => {
    expect([-3, 0, 0.4, 1, 1.6, 2, 9].map(normalizeLevel)).toEqual([0, 0, 0, 1, 2, 2, 2]);
    expect(normalizeLevel(Number.NaN)).toBe(1);
  });
});

describe('switch: generador', () => {
  it('arma un tablero válido y resoluble con cualquier semilla y nivel', () => {
    for (const level of LEVELS) {
      for (const seed of SEEDS) {
        const where = `nivel ${level}, semilla ${seed}`;
        const data = makeSwitchRound(seed, level);
        must(data.ports === (level === 2 ? 6 : 4), `${where}: puertos`);
        must(data.learning === level >= 1, `${where}: aprendizaje`);
        must(data.devices.length === data.ports, `${where}: equipos`);
        must(new Set(data.devices.map((device) => device.name)).size === data.ports, `${where}: nombres repetidos`);
        must(new Set(data.devices.map((device) => device.mac)).size === data.ports, `${where}: MAC repetidas`);
        data.devices.forEach((device, position) => {
          must(device.port === position + 1, `${where}: número de puerto`);
          must(/^[2-579ACEF]{2}$/.test(device.mac), `${where}: formato de MAC ${device.mac}`);
        });
        must(data.devices.some((device) => device.kind !== 'pc' && device.kind !== 'laptop'), `${where}: sin equipos distintos a un PC`);
        must(data.frames.length === ROUND_ITEMS, `${where}: cantidad de mensajes`);
      }
    }
  });

  it('cada mensaje tiene una única respuesta correcta', () => {
    for (const level of LEVELS) {
      for (const seed of SEEDS) {
        const data = makeSwitchRound(seed, level);
        data.frames.forEach((frame, index) => {
          const where = `nivel ${level}, semilla ${seed}, mensaje ${index}`;
          must(frame.from !== frame.to, `${where}: se envía a sí mismo`);
          must(frame.from >= 1 && frame.from <= data.ports && frame.to >= 1 && frame.to <= data.ports, `${where}: puerto fuera de rango`);
          must(expectedSwitchAnswer(frame, data.learning) === frame.answer, `${where}: la respuesta no sigue la regla`);
          const right = [FLOOD, ...data.devices.map((device) => device.port)].filter((choice) => checkSwitchAnswer(frame, choice));
          must(right.length === 1, `${where}: ${right.length} respuestas correctas`);
          must(data.learning || right[0] === frame.to, `${where}: sin tabla debe ir al puerto del destino`);
        });
      }
    }
  });

  it('nivel 0: sin tabla, todos los puertos reciben algo y ninguno se repite seguido', () => {
    for (const seed of SEEDS) {
      const data = makeSwitchRound(seed, 0);
      const targets = data.frames.map((frame) => frame.to);
      must(new Set(targets).size === data.ports, `semilla ${seed}: algún puerto no recibe nada`);
      must(targets.every((to, index) => index === 0 || to !== targets[index - 1]), `semilla ${seed}: mismo destino seguido`);
      must(data.frames.every((frame) => frame.table.length === 0 && frame.learned.length === 0 && frame.answer === frame.to), `semilla ${seed}: aparece tabla`);
    }
  });

  it('niveles 1 y 2: la tabla parte vacía, aprende lo correcto y los destinos conocidos van a su puerto', () => {
    for (const level of [1, 2] as const) {
      for (const seed of SEEDS) {
        const data = makeSwitchRound(seed, level);
        const where = `nivel ${level}, semilla ${seed}`;
        must(data.frames[0].table.length === 0 && data.frames[0].answer === FLOOD, `${where}: el primero debe ser «A todos» con la tabla vacía`);
        must(data.frames[1].answer !== FLOOD, `${where}: el segundo ya debe usar lo aprendido`);
        data.frames.forEach((frame, index) => {
          const known = new Set(frame.table.map((entry) => entry.port));
          must(known.size === frame.table.length, `${where}, mensaje ${index}: entradas repetidas`);
          frame.table.forEach((entry) => must(data.devices[entry.port - 1].mac === entry.mac, `${where}: MAC que no es del puerto`));
          must(frame.answer === (known.has(frame.to) ? frame.to : FLOOD), `${where}, mensaje ${index}: respuesta contra la tabla`);
          // Anota a quien envía (si es nuevo) y, tras un «A todos», a quien responde.
          const expected = [...(known.has(frame.from) ? [] : [frame.from]), ...(frame.answer === FLOOD ? [frame.to] : [])];
          must(JSON.stringify(frame.learned.map((entry) => entry.port)) === JSON.stringify(expected), `${where}, mensaje ${index}: lo que anota`);
          frame.learned.forEach((entry) => must(!known.has(entry.port) && data.devices[entry.port - 1].mac === entry.mac, `${where}: entrada aprendida inválida`));
          if (index + 1 < data.frames.length) {
            must(JSON.stringify(data.frames[index + 1].table) === JSON.stringify(switchTableAfter(frame)), `${where}, mensaje ${index}: la tabla siguiente no es la anterior más lo aprendido`);
          }
        });
        const floods = data.frames.filter((frame) => frame.answer === FLOOD).length;
        must(level === 1 ? floods >= 2 && floods <= 3 : floods >= 3 && floods <= 4, `${where}: ${floods} «A todos»`);
      }
    }
  });

  it('es determinista por semilla y cambia de una semilla a otra', () => {
    expect(makeSwitchRound(7, 1)).toEqual(makeSwitchRound(7, 1));
    expect(makeSwitchRound(7, 2)).toEqual(makeSwitchRound(7, 2));
    for (const level of LEVELS) {
      const variants = new Set(SEEDS.slice(0, 60).map((seed) => JSON.stringify(makeSwitchRound(seed, level))));
      expect(variants.size).toBeGreaterThanOrEqual(55);
    }
    const names = new Set(SEEDS.flatMap((seed) => makeSwitchRound(seed, 2).devices.map((device) => device.name)));
    expect(names.size).toBeGreaterThanOrEqual(15);
  });

  it('las explicaciones nombran el puerto y el equipo, y calzan con la respuesta', () => {
    for (const level of LEVELS) {
      for (const seed of SEEDS.slice(0, 80)) {
        const data = makeSwitchRound(seed, level);
        data.frames.forEach((frame, index) => {
          const dest = data.devices[frame.to - 1];
          for (const choice of [FLOOD, ...data.devices.map((device) => device.port)]) {
            if (!data.learning && choice === FLOOD) continue;
            const result = switchFeedback(data, index, choice);
            const where = `nivel ${level}, semilla ${seed}, mensaje ${index}, respuesta ${choice}`;
            must(result.ok === (choice === frame.answer), `${where}: ok`);
            must(!result.text.includes('undefined') && result.text.length <= 55, `${where}: texto «${result.text}»`);
            if (result.ok) must(PRAISE.test(result.text), `${where}: sin elogio «${result.text}»`);
            if (!result.ok && frame.answer !== FLOOD) must(result.text.includes(`puerto ${frame.to}`) && result.text.includes(dest.det), `${where}: no explica el puerto correcto`);
            if (!result.ok && frame.answer === FLOOD) must(result.text.includes('A todos'), `${where}: no explica el «A todos»`);
          }
        });
      }
    }
    const level0 = makeSwitchRound(3, 0);
    const wrong = level0.devices.find((device) => device.port !== level0.frames[0].to)!.port;
    expect(switchFeedback(level0, 0, wrong).text).toMatch(/^Iba al puerto \d, donde está (el|la) /);
  });
});

describe('router: generador', () => {
  const private172 = /^172\.(1[6-9]|2\d|3[01])\./;
  const isPrivate = (ip: string) => ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('127.') || ip.startsWith('169.254.') || private172.test(ip);

  it('arma una tabla y seis paquetes resolubles con cualquier semilla y nivel', () => {
    for (const level of LEVELS) {
      for (const seed of SEEDS) {
        const where = `nivel ${level}, semilla ${seed}`;
        const data = makeRouterRound(seed, level);
        must(data.rows.length === (level === 2 ? 4 : 3), `${where}: filas`);
        must(data.rows[data.rows.length - 1].id === 'internet' && data.rows[data.rows.length - 1].prefix === null, `${where}: la ruta por defecto va al final`);
        must(new Set(data.rows.map((row) => row.id)).size === data.rows.length, `${where}: filas repetidas`);
        must(data.rows.slice(0, -1).every((row) => /^10\.0\.[123]\.x$/.test(row.network)), `${where}: redes`);
        must(data.packets.length === ROUND_ITEMS, `${where}: paquetes`);
        must(data.packets[0].exit !== 'internet', `${where}: el primero debe ser de una sala`);
        const toInternet = data.packets.filter((packet) => packet.exit === 'internet');
        must(toInternet.length >= 1 && toInternet.length <= 2, `${where}: ${toInternet.length} paquetes a Internet`);
        must(data.firstInternet === data.packets.findIndex((packet) => packet.exit === 'internet'), `${where}: primer paquete a Internet`);
        must(data.rows.slice(0, -1).every((row) => data.packets.some((packet) => packet.exit === row.id)), `${where}: una sala sin paquetes`);
        must(new Set(data.packets.map((packet) => packet.ip)).size === ROUND_ITEMS, `${where}: IP repetidas`);
        data.packets.forEach((packet) => {
          must(routeFor(data.rows, packet.ip) === packet.exit, `${where}: ${packet.ip} no sale por ${packet.exit}`);
          must(matchingRows(data.rows, packet.ip).length === (packet.exit === 'internet' ? 0 : 1), `${where}: ${packet.ip} calza con más de una fila`);
          must(packet.note.length > 3, `${where}: sin nombre amigable`);
          if (packet.exit === 'internet') {
            must(internetHosts.some((host) => host.ip === packet.ip) && !isPrivate(packet.ip), `${where}: ${packet.ip} no es una IP pública conocida`);
          } else {
            must(/^10\.0\.[123]\.(\d+)$/.test(packet.ip) && Number(packet.ip.split('.')[3]) >= 2 && Number(packet.ip.split('.')[3]) <= 250, `${where}: IP local ${packet.ip}`);
          }
        });
      }
    }
  });

  it('la ruta por defecto solo se usa cuando ninguna fila calza', () => {
    const rows: RouteRow[] = makeRouterRound(1, 2).rows;
    expect(routeFor(rows, '10.0.1.5')).toBe('b215');
    expect(routeFor(rows, '10.0.2.250')).toBe('b213');
    expect(routeFor(rows, '10.0.3.9')).toBe('biblioteca');
    // 10.0.12.5 empieza igual que 10.0.1, pero la red 10.0.1.x termina en el punto.
    expect(routeFor(rows, '10.0.12.5')).toBe('internet');
    expect(routeFor(rows, '8.8.8.8')).toBe('internet');
    expect(routeFor(makeRouterRound(1, 1).rows, '10.0.3.9')).toBe('internet');
    expect(internetHosts.map((host) => host.ip)).toEqual(expect.arrayContaining(['8.8.8.8', '1.1.1.1']));
  });

  it('es determinista, mezcla el orden de la tabla y varía entre semillas', () => {
    expect(makeRouterRound(5, 2)).toEqual(makeRouterRound(5, 2));
    const orders = new Set(SEEDS.map((seed) => makeRouterRound(seed, 1).rows.map((row) => row.id).join()));
    expect(orders.size).toBe(2);
    const variants = new Set(SEEDS.slice(0, 60).map((seed) => JSON.stringify(makeRouterRound(seed, 1))));
    expect(variants.size).toBeGreaterThanOrEqual(58);
    const internet = new Set(SEEDS.flatMap((seed) => makeRouterRound(seed, 0).packets.filter((packet) => packet.exit === 'internet').map((packet) => packet.ip)));
    expect(internet.size).toBe(internetHosts.length);
  });

  it('cada explicación nombra la fila correcta y su resultado calza con la respuesta', () => {
    const data: RouterRoundData = makeRouterRound(9, 2);
    data.packets.forEach((packet, index) => {
      for (const row of data.rows) {
        const result = routerFeedback(data, index, row.id);
        expect(result.ok).toBe(row.id === packet.exit);
        if (!result.ok || packet.exit === 'internet') expect(result.text).toContain(packet.ip);
        if (result.ok) expect(result.text).toMatch(PRAISE);
        expect(result.text.length).toBeLessThanOrEqual(55);
        if (packet.exit === 'internet') expect(result.text).toContain('Internet');
        else expect(result.text).toContain(data.rows.find((candidate) => candidate.id === packet.exit)!.name);
      }
    });
  });
});

describe('elogios y racha', () => {
  it('cuenta los aciertos seguidos al final', () => {
    expect(streakOf([])).toBe(0);
    expect(streakOf([true, true, false])).toBe(0);
    expect(streakOf([false, true, true, true])).toBe(3);
    expect(streakOf([true, true, true, true, true, true])).toBe(6);
  });

  it('elogia distinto cada vez y desde tres seguidos celebra la racha', () => {
    const plain = Array.from({ length: 6 }, (_, index) => praiseFor(index, 1));
    expect(new Set(plain).size).toBe(6);
    expect(praiseFor(0, 2)).toBe(plain[0]);
    expect(praiseFor(2, 3)).toBe('¡Racha x3!');
    expect(praiseFor(5, 6)).toBe('¡Racha x6!');
  });

  it('la racha llega al texto del acierto, no al de un error', () => {
    const switchData = makeSwitchRound(4, 1);
    expect(switchFeedback(switchData, 3, switchData.frames[3].answer, 4).text).toMatch(/^¡Racha x4!/);
    const routerData = makeRouterRound(4, 1);
    expect(routerFeedback(routerData, 3, routerData.packets[3].exit, 3).text).toMatch(/^¡Racha x3!/);
    const wrong = routerData.rows.find((row) => row.id !== routerData.packets[3].exit)!.id;
    expect(routerFeedback(routerData, 3, wrong, 0).text).not.toMatch(/Racha/);
  });
});

describe('puntaje', () => {
  it('score = aciertos / 6 y accuracy = aciertos / respondidos', () => {
    expect(buildResult('switch', 6, 6)).toEqual({ score: 1, accuracy: 1, detail: '6 de 6 mensajes entregados' });
    expect(buildResult('switch', 5, 6)).toEqual({ score: 5 / 6, accuracy: 5 / 6, detail: '5 de 6 mensajes entregados' });
    expect(buildResult('router', 0, 6)).toEqual({ score: 0, accuracy: 0, detail: '0 de 6 paquetes bien enrutados' });
  });

  it('al acabarse el tiempo cuenta lo respondido y no divide por cero', () => {
    expect(buildResult('switch', 2, 3)).toEqual({ score: 2 / 6, accuracy: 2 / 3, detail: '2 de 6 mensajes entregados' });
    expect(buildResult('router', 0, 0)).toEqual({ score: 0, accuracy: 0, detail: '0 de 6 paquetes bien enrutados' });
  });

  it('acota valores imposibles', () => {
    expect(buildResult('switch', 9, 9)).toMatchObject({ score: 1, accuracy: 1 });
    expect(buildResult('switch', Number.NaN, Number.NaN)).toMatchObject({ score: 0, accuracy: 0 });
    expect(buildResult('switch', 3, 1)).toMatchObject({ score: 0.5, accuracy: 1 });
    expect(buildResult('switch', -2, 4)).toMatchObject({ score: 0, accuracy: 0 });
  });

  it('un error se lee con más calma y un ritmo lento alarga la pausa sin disparar el tiempo', () => {
    expect(holdMs(false, 1)).toBeGreaterThan(holdMs(true, 1));
    expect(holdMs(true, 2.5)).toBeGreaterThan(holdMs(true, 1));
    expect(holdMs(false, 99)).toBeLessThanOrEqual(5500);
    expect(holdMs(true, Number.NaN)).toBe(holdMs(true, 1));
  });
});

describe('tableros: caben y se pueden tocar', () => {
  const widths = [280, 300, 328, 360, 412];
  const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  const inside = (rect: Rect, width: number, height: number) => rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= width && rect.y + rect.height <= height;

  it('switch: casillas dentro del tablero, sin chocar y de al menos 44 px', () => {
    for (const width of widths) {
      for (const ports of [4, 6]) {
        for (const flood of [true, false]) {
          for (const height of [110, 150, 186, 236, 300, 400]) {
            const layout = switchBoardLayout(width, height, ports, flood);
            const where = `${width}x${height}, ${ports} puertos`;
            const boxes = [...layout.tiles, layout.bar];
            boxes.forEach((box) => must(inside(box, width, height), `${where}: fuera del tablero`));
            boxes.forEach((box, index) => boxes.slice(index + 1).forEach((other) => must(!overlaps(box, other), `${where}: se superponen`)));
            const enough = ports === 6 ? height >= 160 : height >= 110;
            if (enough) {
              layout.tiles.forEach((tile) => must(tile.height >= 44 && tile.width >= 96, `${where}: casilla de ${tile.width}x${tile.height}`));
              // El botón descuenta el borde del switch (3 px) y sus márgenes (6 px).
              if (flood) must(layout.bar.width - 9 >= 44 && layout.bar.height >= 94, `${where}: «A todos» menor a 44 px`);
            }
          }
        }
      }
    }
  });

  it('router: filas dentro del tablero, sin chocar y de al menos 44 px', () => {
    for (const width of widths) {
      for (const rows of [3, 4]) {
        for (const height of [150, 186, 238, 260, 300, 400]) {
          const layout = routerBoardLayout(width, height, rows);
          const where = `${width}x${height}, ${rows} filas`;
          const boxes = [layout.header, ...layout.rows];
          boxes.forEach((box) => must(inside(box, width, height), `${where}: fuera del tablero`));
          boxes.forEach((box, index) => boxes.slice(index + 1).forEach((other) => must(!overlaps(box, other), `${where}: se superponen`)));
          if (height >= (rows === 4 ? 238 : 186)) layout.rows.forEach((row) => must(row.height >= 44, `${where}: fila de ${row.height} px`));
        }
      }
    }
  });
});

describe('registro en el circuito', () => {
  it('declara las dos rondas con los datos acordados', () => {
    expect(rounds.map((round) => round.id)).toEqual(['switch-reparte', 'router-salida']);
    const [sw, router] = rounds;
    expect(sw).toMatchObject({ title: 'El switch reparte', device: 'Switch', art: 'switch', icon: 'lanSwitch', seconds: 35, Component: SwitchRound });
    expect(router).toMatchObject({ title: '¿Por dónde sale?', device: 'Router', art: 'router', icon: 'router', seconds: 35, Component: RouterRound });
    for (const round of rounds) {
      expect(icons[round.icon]).toBeDefined();
      expect(round.goal.length).toBeLessThanOrEqual(80);
      expect(round.explain).toHaveLength(2);
      expect(round.learned.length).toBeGreaterThan(20);
    }
  });
});

// ——— Pantalla ———

type Round = ComponentType<RoundProps>;

function mount(Component: Round, extra: Partial<RoundProps> = {}) {
  const onDone = jest.fn<void, [RoundResult]>();
  const props: RoundProps = { seed: 11, level: 1, pace: 1, timeUp: false, onDone, ...extra };
  const view = render(createElement(Component, props));
  layout(view);
  return { onDone, view, rerender: (change: Partial<RoundProps>) => view.rerender(createElement(Component, { ...props, ...change })) };
}

// FitBox no dibuja nada hasta conocer su tamaño: en pruebas se lo damos a mano.
function layout(view: RenderResult, width = 360, height = 330) {
  act(() => {
    view.UNSAFE_root
      .findAll((node) => typeof node.props.onLayout === 'function')
      .forEach((node) => (node.props.onLayout as (event: unknown) => void)({ nativeEvent: { layout: { x: 0, y: 0, width, height } } }));
  });
}

// Pasa la pausa en que se lee el resultado.
function settle() {
  act(() => {
    jest.advanceTimersByTime(8000);
  });
}

function pressSwitch(view: RenderResult, choice: number) {
  fireEvent.press(view.getByLabelText(choice === FLOOD ? /^A todos/ : new RegExp(`^Puerto ${choice}:`)));
}

// Una respuesta equivocada que existe en pantalla: «A todos» si no era la correcta, o un puerto que no es el del destino.
function wrongSwitchChoice(data: SwitchRoundData, frame: SwitchFrame): number {
  if (data.learning && frame.answer !== FLOOD) return FLOOD;
  return data.devices.find((device) => device.port !== frame.answer && device.port !== frame.to)!.port;
}

function pressExit(view: RenderResult, data: RouterRoundData, exit: string) {
  const row: RouteRow = data.rows.find((candidate) => candidate.id === exit)!;
  fireEvent.press(view.getByLabelText(new RegExp(`^Salir por ${row.name},`)));
}

function wrongExit(data: RouterRoundData, index: number) {
  return data.rows.find((row) => row.id !== data.packets[index].exit)!.id;
}

describe('pantalla', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockHaptics.success.mockClear();
    mockHaptics.warning.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe.each([0, 1, 2])('El switch reparte (nivel %i)', (level) => {
    it('seis respuestas correctas dan el puntaje completo y avisan una sola vez', () => {
      const data = makeSwitchRound(11, level);
      const { onDone, view, rerender } = mount(SwitchRound, { level });
      data.frames.forEach((frame) => {
        pressSwitch(view, frame.answer);
        expect(onDone).not.toHaveBeenCalled();
        settle();
      });
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onDone).toHaveBeenCalledWith({ score: 1, accuracy: 1, detail: '6 de 6 mensajes entregados' });
      expect(mockHaptics.success).toHaveBeenCalledTimes(6);
      expect(mockHaptics.warning).not.toHaveBeenCalled();
      // Un cierre por tiempo posterior no vuelve a entregar.
      rerender({ timeUp: true });
      settle();
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it('los errores explican la respuesta correcta y restan al puntaje', () => {
      const data = makeSwitchRound(11, level);
      const { onDone, view } = mount(SwitchRound, { level });
      data.frames.forEach((frame, index) => {
        const wrong = index % 2 === 0;
        pressSwitch(view, wrong ? wrongSwitchChoice(data, frame) : frame.answer);
        const feedback = switchFeedback(data, index, wrong ? wrongSwitchChoice(data, frame) : frame.answer);
        expect(feedback.ok).toBe(!wrong);
        expect(view.getByText(feedback.text)).toBeTruthy();
        settle();
      });
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onDone).toHaveBeenCalledWith({ score: 0.5, accuracy: 0.5, detail: '3 de 6 mensajes entregados' });
      expect(mockHaptics.success).toHaveBeenCalledTimes(3);
      expect(mockHaptics.warning).toHaveBeenCalledTimes(3);
    });

    it('al acabarse el tiempo entrega lo logrado, una sola vez, y deja de aceptar respuestas', () => {
      const data = makeSwitchRound(11, level);
      const { onDone, view, rerender } = mount(SwitchRound, { level });
      pressSwitch(view, data.frames[0].answer);
      settle();
      pressSwitch(view, wrongSwitchChoice(data, data.frames[1]));
      rerender({ timeUp: true });
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onDone).toHaveBeenCalledWith({ score: 1 / 6, accuracy: 0.5, detail: '1 de 6 mensajes entregados' });
      settle();
      pressSwitch(view, data.frames[2].answer);
      rerender({ timeUp: true });
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(mockHaptics.success).toHaveBeenCalledTimes(1);
    });

    it('mientras se lee el resultado no se aceptan más toques', () => {
      const data = makeSwitchRound(11, level);
      const { onDone, view, rerender } = mount(SwitchRound, { level });
      pressSwitch(view, data.frames[0].answer);
      pressSwitch(view, wrongSwitchChoice(data, data.frames[0]));
      pressSwitch(view, data.frames[0].answer);
      rerender({ timeUp: true });
      expect(onDone).toHaveBeenCalledWith({ score: 1 / 6, accuracy: 1, detail: '1 de 6 mensajes entregados' });
      expect(mockHaptics.success).toHaveBeenCalledTimes(1);
      expect(mockHaptics.warning).not.toHaveBeenCalled();
    });
  });

  it('un acierto celebra (tarjeta verde y +1) y un error no; tres seguidos dan racha', () => {
    const data = makeSwitchRound(11, 1);
    const { view } = mount(SwitchRound, { level: 1 });
    expect(view.getByLabelText(/^Mensaje 1 de 6\.[^]*\.$/)).toBeTruthy();
    expect(view.queryByLabelText(/Correcto\.$/)).toBeNull();
    expect(view.queryByText('+1')).toBeNull();
    pressSwitch(view, data.frames[0].answer);
    expect(view.getByLabelText(/^Mensaje 1 de 6\.[^]* Correcto\.$/)).toBeTruthy();
    expect(view.getByText('+1')).toBeTruthy();
    settle();
    expect(view.queryByText('+1')).toBeNull();
    pressSwitch(view, data.frames[1].answer);
    settle();
    pressSwitch(view, data.frames[2].answer);
    expect(view.getByText(/^¡Racha x3!/)).toBeTruthy();
    settle();
    pressSwitch(view, wrongSwitchChoice(data, data.frames[3]));
    expect(view.getByLabelText(/Incorrecto\.$/)).toBeTruthy();
    expect(view.queryByText('+1')).toBeNull();
    expect(view.queryByText(/Racha/)).toBeNull();
  });

  it('router: también celebra el acierto con la tarjeta verde y el +1', () => {
    const data = makeRouterRound(11, 1);
    const { view } = mount(RouterRound, { level: 1 });
    pressExit(view, data, data.packets[0].exit);
    expect(view.getByLabelText(/Correcto\.$/)).toBeTruthy();
    expect(view.getByText('+1')).toBeTruthy();
    settle();
    pressExit(view, data, wrongExit(data, 1));
    expect(view.getByLabelText(/Incorrecto\.$/)).toBeTruthy();
    expect(view.queryByText('+1')).toBeNull();
  });

  it('switch: sin tiempo y sin respuestas, el resultado es cero', () => {
    const { onDone } = mount(SwitchRound, { timeUp: true });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith({ score: 0, accuracy: 0, detail: '0 de 6 mensajes entregados' });
  });

  it('switch: el nivel 0 no muestra MAC ni tabla; el nivel 1 sí, y la tabla aprende', () => {
    const simple = mount(SwitchRound, { level: 0 });
    expect(simple.view.queryByLabelText(/^Tabla MAC/)).toBeNull();
    expect(simple.view.queryByLabelText(/^A todos/)).toBeNull();
    expect(simple.view.queryByText(SWITCH_FLOOD_HINT)).toBeNull();
    simple.view.unmount();

    const data = makeSwitchRound(11, 1);
    const { view } = mount(SwitchRound, { level: 1 });
    const first = data.frames[0];
    expect(view.getByLabelText('Tabla MAC: vacía')).toBeTruthy();
    expect(view.getByText(SWITCH_FLOOD_HINT)).toBeTruthy();
    expect(view.getByText(`Para: MAC ${data.devices[first.to - 1].mac}`)).toBeTruthy();
    expect(view.getByLabelText(new RegExp(`^Puerto ${first.to}: .*MAC ${data.devices[first.to - 1].mac}$`))).toBeTruthy();
    pressSwitch(view, FLOOD);
    expect(view.getByLabelText(new RegExp(`MAC ${data.devices[first.to - 1].mac} en el puerto ${first.to}`))).toBeTruthy();
    settle();
    expect(view.queryByText(SWITCH_FLOOD_HINT)).toBeNull();
    expect(view.getByLabelText(/^Tabla MAC: MAC/)).toBeTruthy();
  });

  describe.each([0, 1, 2])('¿Por dónde sale? (nivel %i)', (level) => {
    it('seis respuestas correctas dan el puntaje completo y avisan una sola vez', () => {
      const data = makeRouterRound(11, level);
      const { onDone, view, rerender } = mount(RouterRound, { level });
      data.packets.forEach((packet) => {
        pressExit(view, data, packet.exit);
        expect(onDone).not.toHaveBeenCalled();
        settle();
      });
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onDone).toHaveBeenCalledWith({ score: 1, accuracy: 1, detail: '6 de 6 paquetes bien enrutados' });
      expect(mockHaptics.success).toHaveBeenCalledTimes(6);
      rerender({ timeUp: true });
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it('los errores explican la salida correcta y el cierre por tiempo cuenta lo respondido', () => {
      const data = makeRouterRound(11, level);
      const { onDone, view, rerender } = mount(RouterRound, { level });
      pressExit(view, data, wrongExit(data, 0));
      expect(view.getByText(routerFeedback(data, 0, wrongExit(data, 0)).text)).toBeTruthy();
      expect(mockHaptics.warning).toHaveBeenCalledTimes(1);
      settle();
      pressExit(view, data, data.packets[1].exit);
      settle();
      pressExit(view, data, data.packets[2].exit);
      rerender({ timeUp: true });
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onDone).toHaveBeenCalledWith({ score: 2 / 6, accuracy: 2 / 3, detail: '2 de 6 paquetes bien enrutados' });
      settle();
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it('la tabla de rutas muestra todas las salidas y el nivel 0 trae el nombre amigable', () => {
      const data = makeRouterRound(11, level);
      const { view } = mount(RouterRound, { level });
      data.rows.forEach((row) => expect(view.getByLabelText(new RegExp(`^Salir por ${row.name},`))).toBeTruthy());
      const note = `(${data.packets[0].note})`;
      if (level === 0) expect(view.getByText(note)).toBeTruthy();
      else expect(view.queryByText(note)).toBeNull();
      expect(view.queryByLabelText(/^Salir por Biblioteca/) !== null).toBe(level === 2);
    });
  });

  it('router: la ruta por defecto se explica una sola vez, con el primer paquete a Internet', () => {
    const data = makeRouterRound(11, 1);
    const { view } = mount(RouterRound, { level: 1 });
    data.packets.forEach((packet, index) => {
      if (index === data.firstInternet) expect(view.getByText(ROUTER_DEFAULT_HINT)).toBeTruthy();
      else expect(view.queryByText(ROUTER_DEFAULT_HINT)).toBeNull();
      pressExit(view, data, packet.exit);
      settle();
    });
  });
});
