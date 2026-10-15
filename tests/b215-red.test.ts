import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { rounds } from '@/features/stations/b215/parts/red';
import { BuildNetworkRound } from '@/features/stations/b215/rounds/BuildNetworkRound';
import { FirewallRound } from '@/features/stations/b215/rounds/FirewallRound';
import { WifiChannelRound } from '@/features/stations/b215/rounds/WifiChannelRound';
import {
  assignLanes,
  bestChannel,
  channelCosts,
  correctSlots,
  decide,
  DEVICES,
  describeScenario,
  explainChannel,
  explainDecision,
  feedbackLine,
  feedbackWait,
  firewallPrompt,
  hillArea,
  hillPoints,
  HOSTILE_POOL,
  isComplete,
  listNames,
  makeFirewallRound,
  makeNetworkRound,
  makeWifiScenarios,
  normalizeLevel,
  onlineState,
  overlapArea,
  placementResult,
  polygonPath,
  ruleText,
  scoreRound,
  SERVICES,
  slotLabel,
  SLOT_NEEDS,
  slotsForLevel,
  stepCaption,
  topologyLayout,
  WIFI_CHANNELS,
  WIFI_PROMPT_FIRST,
  type Connection,
  type FirewallRoundData,
  type FirewallRule,
  type Neighbor,
  type SlotId,
} from '@/features/stations/b215/rounds/red.logic';
import type { RoundProps } from '@/features/stations/b215/types';
import { icons } from '@/graphics/icons';
import { feedbackSuccess, feedbackWarning } from '@/lib/feedback';

jest.mock('@/lib/feedback', () => ({
  feedbackSuccess: jest.fn(async () => undefined),
  feedbackWarning: jest.fn(async () => undefined),
  feedbackTap: jest.fn(async () => undefined),
  feedbackHeavy: jest.fn(async () => undefined),
}));

const SEEDS = [...Array.from({ length: 300 }, (_, index) => index + 1), 0, 2 ** 31, 4294967295];
const LEVELS = [0, 1, 2];
const success = feedbackSuccess as jest.Mock;
const warning = feedbackWarning as jest.Mock;

// Evaluación independiente de la de la app: la primera regla que calza decide.
function firstMatch(rules: FirewallRule[], connection: Connection): { action: string; index: number } {
  for (let index = 0; index < rules.length; index += 1) {
    const match = rules[index].match;
    const hit = match.kind === 'any' || (match.kind === 'service' && match.service === connection.service) || (match.kind === 'origin' && match.ip === connection.originIp);
    if (hit) return { action: rules[index].action, index };
  }
  return { action: 'deny', index: -1 };
}

function longestRun(values: string[]): number {
  let best = 0;
  let run = 0;
  values.forEach((value, index) => {
    run = index > 0 && value === values[index - 1] ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

describe('rondas de red · metadatos', () => {
  it('registra las tres rondas con los textos acordados', () => {
    expect(rounds.map((round) => round.id)).toEqual(['firewall-reglas', 'canal-wifi', 'arma-red']);
    expect(rounds.map((round) => round.seconds)).toEqual([35, 30, 40]);
    expect(rounds.map((round) => round.title)).toEqual(['¿Pasa o no pasa?', 'Canal libre', 'Arma la red']);
    expect(rounds.map((round) => round.art)).toEqual(['firewall', 'accessPoint', 'switch']);
    rounds.forEach((round) => {
      expect(round.goal.length).toBeLessThanOrEqual(80);
      expect(round.explain).toHaveLength(2);
      round.explain.forEach((sentence) => expect(sentence.length).toBeLessThanOrEqual(80));
      expect(round.learned.length).toBeGreaterThan(20);
      expect(icons[round.icon]).toBeDefined();
      expect(typeof round.Component).toBe('function');
    });
  });

  it('ninguna ronda usa alturas fijas grandes (el tablero se ajusta con FitBox)', () => {
    ['FirewallRound', 'WifiChannelRound', 'BuildNetworkRound'].forEach((name) => {
      const source = readFileSync(join(__dirname, '..', 'src', 'features', 'stations', 'b215', 'rounds', `${name}.tsx`), 'utf8');
      const heights = [...source.matchAll(/[hH]eight:\s*(\d+)/g)].map((match) => Number(match[1]));
      expect(heights.length).toBeGreaterThan(0);
      heights.forEach((value) => expect(value).toBeLessThanOrEqual(200));
    });
  });
});

describe('utilidades comunes', () => {
  it('normaliza el nivel', () => {
    expect([NaN, -3, 0, 1.4, 1.6, 2, 9].map(normalizeLevel)).toEqual([1, 0, 0, 1, 2, 2, 2]);
  });

  it('el ritmo más lento alarga la reacción y nunca se sale de rango', () => {
    expect(feedbackWait(1000, 1)).toBe(1000);
    expect(feedbackWait(1000, 2)).toBe(2000);
    expect(feedbackWait(1000, 10)).toBe(3000);
    expect(feedbackWait(1000, 0.1)).toBe(700);
    expect(feedbackWait(1000, 0)).toBe(1000);
    expect(feedbackWait(1000, NaN)).toBe(1000);
  });

  it('puntaje = aciertos / total, precisión = aciertos / intentos', () => {
    expect(scoreRound(5, 6, 6, 'conexiones bien decididas')).toEqual({ score: 5 / 6, accuracy: 5 / 6, detail: '5 de 6 conexiones bien decididas' });
    expect(scoreRound(3, 5, 3, 'x')).toEqual({ score: 1, accuracy: 0.6, detail: '3 de 3 x' });
    expect(scoreRound(0, 0, 6, 'x')).toEqual({ score: 0, accuracy: 0, detail: '0 de 6 x' });
    expect(scoreRound(2, 2, 6, 'x').score).toBeCloseTo(1 / 3);
    // Valores fuera de rango se acotan.
    expect(scoreRound(10, 10, 6, 'x')).toMatchObject({ score: 1, accuracy: 1, detail: '6 de 6 x' });
    expect(scoreRound(-2, 3, 6, 'x')).toMatchObject({ score: 0, accuracy: 0 });
    expect(scoreRound(1, 2, 0, 'x').score).toBe(1);
  });
});

describe('firewall · reglas y conexiones', () => {
  function eachRound(check: (data: FirewallRoundData, seed: number, level: number) => void) {
    LEVELS.forEach((level) => SEEDS.forEach((seed) => check(makeFirewallRound(seed, level), seed, level)));
  }

  it('cada nivel tiene su cantidad de reglas y siempre termina en "todo lo demás"', () => {
    eachRound((data, seed, level) => {
      expect(data.rules).toHaveLength([3, 4, 5][level]);
      expect(data.rules[data.rules.length - 1]).toEqual({ action: 'deny', match: { kind: 'any' } });
      expect(ruleText(data.rules[data.rules.length - 1])).toBe('Todo lo demás');
      const origins = data.rules.filter((rule) => rule.match.kind === 'origin');
      if (level === 2) {
        expect(origins).toHaveLength(1);
        expect(data.rules[0]).toEqual({ action: 'deny', match: { kind: 'origin', ip: data.exceptionIp } });
        expect(HOSTILE_POOL).toContain(data.exceptionIp);
        expect(ruleText(data.rules[0])).toBe(`Cualquier cosa desde ${data.exceptionIp}`);
        // La excepción va ARRIBA de las reglas que permiten.
        expect(data.rules.findIndex((rule) => rule.action === 'allow')).toBeGreaterThan(0);
      } else {
        expect(origins).toHaveLength(0);
        expect(data.exceptionIp).toBeNull();
      }
      expect(data.rules.filter((rule) => rule.action === 'allow')).toHaveLength(2);
      expect(seed).toBeGreaterThanOrEqual(0);
    });
  });

  it('son 6 conexiones distintas, con permitidas y bloqueadas, sin rachas largas', () => {
    eachRound((data, seed, level) => {
      const where = `nivel ${level}, semilla ${seed}`;
      expect({ where, count: data.connections.length }).toEqual({ where, count: 6 });
      expect(data.connections.map((connection) => connection.id)).toEqual([0, 1, 2, 3, 4, 5]);
      const pairs = data.connections.map((connection) => `${connection.originIp}|${connection.service}`);
      expect(new Set(pairs).size).toBe(6);
      const verdicts = data.connections.map((connection) => decide(data.rules, connection).action);
      const allowed = verdicts.filter((verdict) => verdict === 'allow').length;
      expect({ where, ok: allowed >= 2 && allowed <= 4 }).toEqual({ where, ok: true });
      expect({ where, run: longestRun(verdicts) <= 3 }).toEqual({ where, run: true });
    });
  });

  it('la decisión coincide con la lectura de arriba hacia abajo y cada conexión tiene una sola respuesta', () => {
    eachRound((data) => {
      data.connections.forEach((connection) => {
        const expected = firstMatch(data.rules, connection);
        const decision = decide(data.rules, connection);
        expect(decision).toEqual({ action: expected.action, ruleIndex: expected.index });
        expect(decision.ruleIndex).toBeGreaterThanOrEqual(0);
      });
    });
  });

  it('nivel 0: solo reglas simples; lo que no está permitido cae en "todo lo demás"', () => {
    SEEDS.forEach((seed) => {
      const data = makeFirewallRound(seed, 0);
      data.connections.forEach((connection) => {
        const decision = decide(data.rules, connection);
        if (decision.action === 'deny') expect(decision.ruleIndex).toBe(data.rules.length - 1);
      });
    });
  });

  it('nivel 1: hay una conexión que bloquea una regla con nombre y otra que cae en lo demás', () => {
    SEEDS.forEach((seed) => {
      const data = makeFirewallRound(seed, 1);
      const indexes = data.connections.map((connection) => decide(data.rules, connection).ruleIndex);
      expect(indexes).toContain(data.rules.length - 2);
      expect(indexes).toContain(data.rules.length - 1);
      expect(data.rules[data.rules.length - 2].match.kind).toBe('service');
    });
  });

  it('nivel 2: la excepción gana por ir primero, y si se cambiara el orden la trampa pasaría', () => {
    SEEDS.forEach((seed) => {
      const data = makeFirewallRound(seed, 2);
      const traps = data.connections.filter((connection) => connection.originIp === data.exceptionIp);
      expect(traps.length).toBeGreaterThanOrEqual(1);
      // Con la excepción abajo (justo antes de "todo lo demás"), cada trampa de un servicio permitido pasaría.
      const reordered = [...data.rules.slice(1, -1), data.rules[0], data.rules[data.rules.length - 1]];
      let bitten = 0;
      traps.forEach((trap) => {
        expect(decide(data.rules, trap)).toEqual({ action: 'deny', ruleIndex: 0 });
        if (decide(reordered, trap).action === 'allow') bitten += 1;
      });
      expect(bitten).toBeGreaterThanOrEqual(1);
      // Y hay una conexión permitida al mismo servicio de la trampa desde otro origen: hay que leer el origen.
      const trap = traps.find((item) => decide(reordered, item).action === 'allow');
      const twin = data.connections.find((item) => item.service === trap?.service && item.originIp !== data.exceptionIp);
      expect(twin).toBeDefined();
      expect(decide(data.rules, twin as Connection).action).toBe('allow');
    });
  });

  it('es determinista y cambia con la semilla', () => {
    expect(makeFirewallRound(42, 1)).toEqual(makeFirewallRound(42, 1));
    const seeds = Array.from({ length: 100 }, (_, index) => index + 1);
    expect(new Set(seeds.map((seed) => makeFirewallRound(seed, 1).rules.map(ruleText).join('|'))).size).toBeGreaterThanOrEqual(3);
    expect(new Set(seeds.map((seed) => JSON.stringify(makeFirewallRound(seed, 1).connections.map((c) => [c.service, c.originIp])))).size).toBeGreaterThanOrEqual(80);
  });

  it('los puertos son los de verdad y no se repiten', () => {
    expect(SERVICES.https.port).toBe(443);
    expect(SERVICES.http.port).toBe(80);
    expect(SERVICES.dns.port).toBe(53);
    expect(SERVICES.telnet.port).toBe(23);
    expect(SERVICES.ssh.port).toBe(22);
    expect(SERVICES.ftp.port).toBe(21);
    expect(SERVICES.rdp.port).toBe(3389);
    expect(new Set(Object.values(SERVICES).map((service) => service.port)).size).toBe(Object.keys(SERVICES).length);
    Object.values(SERVICES).forEach((service) => expect(icons[service.icon]).toBeDefined());
  });

  it('sin ninguna regla que calce, se bloquea', () => {
    const connection: Connection = { id: 0, originName: 'x', originIp: '1.1.1.1', service: 'ftp' };
    expect(decide([{ action: 'allow', match: { kind: 'service', service: 'dns' } }], connection)).toEqual({ action: 'deny', ruleIndex: -1 });
    expect(explainDecision([], connection, { action: 'deny', ruleIndex: -1 })).toMatch(/se bloquea/);
  });

  it('la explicación nombra la regla que decide (número, puerto o IP)', () => {
    eachRound((data, _seed, level) => {
      data.connections.forEach((connection) => {
        const decision = decide(data.rules, connection);
        const text = explainDecision(data.rules, connection, decision);
        expect(text).toContain(`regla ${decision.ruleIndex + 1}`);
        const rule = data.rules[decision.ruleIndex];
        if (rule.match.kind === 'service') {
          expect(text).toContain(`puerto ${SERVICES[connection.service].port}`);
          expect(text).toContain(rule.action === 'allow' ? 'deja pasar' : 'bloquea');
        } else if (rule.match.kind === 'origin') {
          expect(level).toBe(2);
          expect(text).toContain(rule.match.ip);
        } else {
          expect(text).toContain('Todo lo demás');
        }
        expect(text.length).toBeLessThanOrEqual(110);
      });
    });
  });

  it('frases de reacción y mensajes de ayuda', () => {
    expect(feedbackLine(true, 'la regla 2 deja pasar DNS (puerto 53).')).toBe('¡Bien! La regla 2 deja pasar DNS (puerto 53).');
    expect(feedbackLine(false, 'la regla 3 bloquea Telnet (puerto 23).')).toBe('Ojo: la regla 3 bloquea Telnet (puerto 23).');
    expect(firewallPrompt(2)).toMatch(/orden/);
    expect(firewallPrompt(1)).not.toMatch(/orden/);
  });
});

describe('Wi-Fi · colinas y canal libre', () => {
  const margins = [5, 3, 2];
  const counts = [
    [2, 3],
    [3, 3],
    [4, 4],
  ];

  it('el área de una colina coincide con la suma numérica y 1, 6 y 11 no se pisan', () => {
    const riemann = (from: number, to: number) => {
      const steps = 20000;
      let sum = 0;
      for (let index = 0; index < steps; index += 1) {
        const x = from + ((to - from) * (index + 0.5)) / steps;
        sum += Math.max(0, 0.5 * (1 + Math.cos((Math.PI * x) / 2.5))) * (Math.abs(x) < 2.5 ? 1 : 0) * ((to - from) / steps);
      }
      return sum;
    };
    [
      [-2.5, 2.5],
      [-1, 3],
      [0.5, 4],
      [-4, 0],
      [-0.3, 0.3],
    ].forEach(([from, to]) => expect(hillArea(from, to)).toBeCloseTo(riemann(from, to), 3));
    expect(hillArea(-2.5, 2.5)).toBeCloseTo(2.5, 6);
    expect(hillArea(3, 5)).toBe(0);
    const neighbor: Neighbor = { name: 'x', channel: 6, strength: 2 };
    expect(overlapArea(6, neighbor)).toBeCloseTo(5, 6);
    expect(overlapArea(1, neighbor)).toBeCloseTo(0, 9);
    expect(overlapArea(11, neighbor)).toBeCloseTo(0, 9);
    // Un canal vecino sí se pisa, y cuanto más cerca más.
    expect(overlapArea(5, neighbor)).toBeGreaterThan(overlapArea(4, neighbor));
    expect(overlapArea(4, neighbor)).toBeGreaterThan(overlapArea(2, neighbor));
  });

  it('cada escenario tiene un único mejor canal, claro y distinto en cada uno', () => {
    LEVELS.forEach((level) =>
      SEEDS.forEach((seed) => {
        const where = `nivel ${level}, semilla ${seed}`;
        const scenarios = makeWifiScenarios(seed, level);
        expect({ where, count: scenarios.length }).toEqual({ where, count: 3 });
        expect([...scenarios.map((scenario) => scenario.best)].sort((a, b) => a - b)).toEqual([1, 6, 11]);
        const names = scenarios.flatMap((scenario) => scenario.neighbors.map((neighbor) => neighbor.name));
        expect({ where, unique: new Set(names).size === names.length }).toEqual({ where, unique: true });
        scenarios.forEach((scenario) => {
          const costs = channelCosts(scenario.neighbors);
          expect(scenario.costs).toEqual(costs);
          expect(bestChannel(scenario.neighbors)).toBe(scenario.best);
          const ranked = [...WIFI_CHANNELS].sort((a, b) => costs[a] - costs[b]);
          expect(ranked[0]).toBe(scenario.best);
          expect({ where, margin: costs[ranked[1]] - costs[ranked[0]] >= margins[level] - 1e-9 }).toEqual({ where, margin: true });
          // Con 3 o más vecinas nunca se usó la salida de emergencia.
          expect(scenario.neighbors.length).toBeGreaterThanOrEqual(counts[level][0]);
          expect(scenario.neighbors.length).toBeLessThanOrEqual(counts[level][1]);
          const channels = scenario.neighbors.map((neighbor) => neighbor.channel).sort((a, b) => a - b);
          channels.forEach((channel, index) => {
            expect(channel).toBeGreaterThanOrEqual(1);
            expect(channel).toBeLessThanOrEqual(11);
            if (index > 0) expect(channel - channels[index - 1]).toBeGreaterThanOrEqual(2);
          });
          scenario.neighbors.forEach((neighbor) => {
            expect([1, 2, 3]).toContain(neighbor.strength);
            expect(neighbor.name.length).toBeLessThanOrEqual(10);
          });
          // Rótulos: como mucho dos filas.
          expect(Math.max(...assignLanes(scenario.neighbors, 4.4))).toBeLessThanOrEqual(1);
        });
      }),
    );
  });

  it('es determinista y varía con la semilla', () => {
    expect(makeWifiScenarios(9, 1)).toEqual(makeWifiScenarios(9, 1));
    const seeds = Array.from({ length: 60 }, (_, index) => index + 1);
    expect(new Set(seeds.map((seed) => JSON.stringify(makeWifiScenarios(seed, 1)))).size).toBe(60);
    expect(new Set(seeds.map((seed) => makeWifiScenarios(seed, 1)[0].best)).size).toBe(3);
  });

  it('los contornos SVG son válidos', () => {
    makeWifiScenarios(5, 2).forEach((scenario) => {
      scenario.neighbors.forEach((neighbor) => {
        const path = polygonPath(hillPoints(neighbor.channel, neighbor.strength), (x) => 10 + x * 20, (y) => 100 - y * 80, 100);
        expect(path.startsWith('M')).toBe(true);
        expect(path.endsWith('Z')).toBe(true);
        expect(path).not.toMatch(/NaN|Infinity/);
      });
    });
    // Recorte fuera de la colina: nada que dibujar.
    expect(hillPoints(6, 2, 20, 30)).toEqual([]);
    expect(polygonPath([], (x) => x, (y) => y, 0)).toBe('');
    const sliced = hillPoints(6, 3, 3.5, 5);
    expect(sliced[0].x).toBeCloseTo(3.5);
    expect(sliced[sliced.length - 1].x).toBeCloseTo(5);
  });

  it('rótulos cercanos se reparten en filas distintas', () => {
    const near: Neighbor[] = [
      { name: 'a', channel: 3, strength: 2 },
      { name: 'b', channel: 5, strength: 2 },
      { name: 'c', channel: 10, strength: 2 },
    ];
    const lanes = assignLanes(near, 4.4);
    expect(lanes[0]).not.toBe(lanes[1]);
    expect(lanes[2]).toBe(0);
  });

  it('la explicación dice cuál era el mejor canal y con quién se pisaba', () => {
    makeWifiScenarios(3, 1).forEach((scenario) => {
      const best = explainChannel(scenario, scenario.best);
      expect(best.startsWith('¡Bien!')).toBe(true);
      expect(best).toContain(`canal ${scenario.best}`);
      WIFI_CHANNELS.filter((channel) => channel !== scenario.best).forEach((channel) => {
        const text = explainChannel(scenario, channel);
        expect(text).toContain(`El canal ${channel} se pisa con «`);
        expect(text).toContain(`El más libre es el ${scenario.best}.`);
        expect(text.length).toBeLessThanOrEqual(110);
      });
      describeScenario(scenario) && scenario.neighbors.forEach((neighbor) => expect(describeScenario(scenario)).toContain(neighbor.name));
    });
    expect(listNames([])).toBe('');
    expect(listNames(['Café'])).toBe('«Café»');
    expect(listNames(['Café', 'Kiosco'])).toBe('«Café» y «Kiosco»');
    expect(listNames(['A', 'B', 'C'])).toBe('«A», «B» y «C»');
    expect(WIFI_PROMPT_FIRST).toMatch(/1, 6 y 11 no se pisan/);
  });
});

describe('red · huecos y equipos', () => {
  it('cada nivel tiene sus huecos y una bandeja con todo lo necesario más un distractor', () => {
    LEVELS.forEach((level) =>
      SEEDS.forEach((seed) => {
        const data = makeNetworkRound(seed, level);
        const expectedSlots: SlotId[] = level === 2 ? ['firewall', 'router', 'switch', 'ap'] : ['router', 'switch', 'ap'];
        expect(data.slots).toEqual(expectedSlots);
        expect(slotsForLevel(level)).toEqual(expectedSlots);
        expect(data.tray).toHaveLength(expectedSlots.length + 1);
        expect(new Set(data.tray).size).toBe(data.tray.length);
        expect(['printer', 'camera']).toContain(data.distractor);
        // Resoluble: cada hueco tiene exactamente un equipo que calza en la bandeja.
        expectedSlots.forEach((slot) => {
          expect(data.tray.filter((device) => placementResult(slot, device).ok)).toEqual([SLOT_NEEDS[slot]]);
        });
        expect(data.tray.filter((device) => !expectedSlots.some((slot) => SLOT_NEEDS[slot] === device))).toEqual([data.distractor]);
      }),
    );
  });

  it('es determinista y la bandeja cambia de orden con la semilla', () => {
    expect(makeNetworkRound(7, 2)).toEqual(makeNetworkRound(7, 2));
    const orders = new Set(Array.from({ length: 50 }, (_, index) => makeNetworkRound(index + 1, 1).tray.join(',')));
    expect(orders.size).toBeGreaterThanOrEqual(5);
  });

  it('acertar da el rol del equipo; equivocarse explica cuál iba, en una frase corta', () => {
    expect(placementResult('router', 'router')).toEqual({ ok: true, text: 'El router conecta la sala con Internet.' });
    expect(placementResult('switch', 'switch').text).toBe('El switch une por cable los equipos de la sala.');
    expect(placementResult('ap', 'ap').text).toBe('El access point reparte Wi-Fi a los celulares.');
    expect(placementResult('firewall', 'firewall').ok).toBe(true);
    (Object.keys(SLOT_NEEDS) as SlotId[]).forEach((slot) => {
      (Object.keys(DEVICES) as (keyof typeof DEVICES)[])
        .filter((device) => device !== SLOT_NEEDS[slot])
        .forEach((device) => {
          const result = placementResult(slot, device);
          expect(result.ok).toBe(false);
          expect(result.text.toLowerCase()).toContain(`ahí va el ${DEVICES[SLOT_NEEDS[slot]].name.toLowerCase()}`);
          expect(result.text.length).toBeLessThanOrEqual(90);
        });
    });
    expect(placementResult('router', 'switch').text).toBe('El switch une los cables; ahí va el router, que conecta con Internet.');
    expect(placementResult('router', 'printer').text).toBe('La impresora usa la red, pero no la arma: ahí va el router.');
  });

  it('los enlaces se encienden desde Internet hacia afuera', () => {
    const level1: SlotId[] = ['router', 'switch', 'ap'];
    expect(onlineState({}, level1)).toMatchObject({ pcs: false, phones: false });
    // El switch solo no tiene Internet si falta el router.
    expect(onlineState({ switch: 'switch' }, level1).slots.switch).toBe(false);
    expect(onlineState({ router: 'router' }, level1).slots).toMatchObject({ router: true, switch: false, ap: false });
    const wired = onlineState({ router: 'router', switch: 'switch' }, level1);
    expect(wired).toMatchObject({ pcs: true, phones: false });
    expect(wired.slots.ap).toBe(false);
    // El access point sin switch no da Wi-Fi con Internet.
    expect(onlineState({ router: 'router', ap: 'ap' }, level1).phones).toBe(false);
    const all = onlineState({ router: 'router', switch: 'switch', ap: 'ap' }, level1);
    expect(all).toMatchObject({ pcs: true, phones: true });
    // Con firewall (nivel 2) también hay que ponerlo.
    const level2: SlotId[] = ['firewall', 'router', 'switch', 'ap'];
    expect(onlineState({ router: 'router', switch: 'switch', ap: 'ap' }, level2)).toMatchObject({ pcs: false, phones: false });
    expect(onlineState({ firewall: 'firewall', router: 'router', switch: 'switch', ap: 'ap' }, level2)).toMatchObject({ pcs: true, phones: true });
    expect(correctSlots({ router: 'router', switch: 'camera' }, level1)).toBe(1);
    expect(isComplete({ router: 'router', switch: 'switch', ap: 'ap' }, level1)).toBe(true);
    expect(isComplete({ router: 'router', switch: 'switch' }, level1)).toBe(false);
  });

  it('el dibujo cabe y no se encima en cualquier tablero razonable (huecos de al menos 44 px)', () => {
    [280, 296, 320, 360, 412].forEach((width) =>
      [128, 150, 200, 260].forEach((height) =>
        [1, 2].forEach((level) => {
          const slots = slotsForLevel(level);
          const layout = topologyLayout(width, height, slots);
          const where = `${width}x${height} nivel ${level}`;
          expect(layout.nodes.filter((node) => node.kind === 'pc')).toHaveLength(3);
          expect(layout.nodes.filter((node) => node.kind === 'phone')).toHaveLength(2);
          expect(layout.nodes.filter((node) => node.kind === 'slot')).toHaveLength(slots.length);
          layout.nodes.filter((node) => node.kind === 'slot').forEach((node) => expect({ where, size: Math.min(node.w, node.h) >= 44 }).toEqual({ where, size: true }));
          layout.nodes.forEach((node) => {
            const inside = node.x - node.w / 2 >= 0 && node.x + node.w / 2 <= width && node.y - node.h / 2 >= 0 && node.y + node.h / 2 <= height;
            expect({ where, id: node.id, inside }).toEqual({ where, id: node.id, inside: true });
          });
          layout.nodes.forEach((a, index) =>
            layout.nodes.slice(index + 1).forEach((b) => {
              const apart = Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.y - b.y) >= (a.h + b.h) / 2;
              expect({ where, pair: `${a.id}/${b.id}`, apart }).toEqual({ where, pair: `${a.id}/${b.id}`, apart: true });
            }),
          );
          const ids = new Set(layout.nodes.map((node) => node.id));
          layout.links.forEach((link) => {
            expect(ids.has(link.from)).toBe(true);
            expect(ids.has(link.to)).toBe(true);
          });
          expect(layout.links.filter((link) => link.kind === 'wifi')).toHaveLength(2);
          layout.wifi.radii.forEach((radius) => expect(radius).toBeGreaterThan(0));
          expect(layout.labels.pcs.y + 16).toBeLessThanOrEqual(height);
        }),
      ),
    );
  });

  it('nombres de hueco y guía de pasos', () => {
    expect(slotLabel('router', ['router', 'switch', 'ap'], {})).toBe('Hueco 1 de 3, entre Internet y la red de la sala, vacío');
    expect(slotLabel('ap', ['router', 'switch', 'ap'], { ap: 'ap' })).toBe('Hueco 3 de 3, junto a los celulares: Access point puesto');
    expect(stepCaption(null, null)).toBe('1 · Toca un hueco vacío');
    expect(stepCaption('router', null)).toMatch(/equipo que va ahí/);
    expect(stepCaption(null, 'router')).toMatch(/hueco para este equipo/);
  });
});

// ——— Humo de las pantallas ———

function props(overrides: Partial<RoundProps> = {}): RoundProps {
  return { seed: 11, level: 1, pace: 1, timeUp: false, onDone: jest.fn(), ...overrides };
}

// En Jest no hay medición de pantalla: se le da a cada contenedor con onLayout (FitBox) un tamaño de teléfono.
function layoutAll(width: number, height: number) {
  const hosts = screen.UNSAFE_root.findAll((node) => typeof node.type === 'string' && typeof node.props.onLayout === 'function');
  act(() => {
    hosts.forEach((node) => node.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width, height } } }));
  });
}

function wait(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe('pantallas de las rondas de red', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Firewall', () => {
    const answer = (data: FirewallRoundData, mode: 'right' | 'wrong', from = 0, to = data.connections.length) => {
      data.connections.slice(from, to).forEach((connection) => {
        const truth = decide(data.rules, connection).action;
        const pick = mode === 'right' ? truth : truth === 'allow' ? 'deny' : 'allow';
        fireEvent.press(screen.getByLabelText(pick === 'allow' ? 'Permitir' : 'Bloquear'));
        wait(3500);
      });
    };

    it('6 aciertos: puntaje 1, una sola vez, con vibración de éxito', () => {
      LEVELS.forEach((level) => {
        const onDone = jest.fn();
        const view = render(createElement(FirewallRound, props({ seed: 5, level, onDone })));
        answer(makeFirewallRound(5, level), 'right');
        expect(onDone).toHaveBeenCalledTimes(1);
        expect(onDone).toHaveBeenCalledWith({ score: 1, accuracy: 1, detail: '6 de 6 conexiones bien decididas' });
        wait(10_000);
        expect(onDone).toHaveBeenCalledTimes(1);
        view.unmount();
      });
      expect(success).toHaveBeenCalledTimes(18);
      expect(warning).not.toHaveBeenCalled();
    });

    it('6 errores: puntaje 0 y cada error explica la regla que aplica', () => {
      const onDone = jest.fn();
      render(createElement(FirewallRound, props({ seed: 5, level: 1, onDone })));
      const data = makeFirewallRound(5, 1);
      const first = data.connections[0];
      const decision = decide(data.rules, first);
      fireEvent.press(screen.getByLabelText(decision.action === 'allow' ? 'Bloquear' : 'Permitir'));
      expect(screen.getByText(feedbackLine(false, explainDecision(data.rules, first, decision)))).toBeTruthy();
      expect(warning).toHaveBeenCalledTimes(1);
      wait(3500);
      answer(data, 'wrong', 1);
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onDone).toHaveBeenCalledWith({ score: 0, accuracy: 0, detail: '0 de 6 conexiones bien decididas' });
      expect(warning).toHaveBeenCalledTimes(6);
    });

    it('al acabarse el tiempo entrega lo logrado hasta ahí, una sola vez', () => {
      const onDone = jest.fn();
      const data = makeFirewallRound(5, 1);
      const view = render(createElement(FirewallRound, props({ seed: 5, level: 1, onDone })));
      answer(data, 'right', 0, 1);
      const truth = decide(data.rules, data.connections[1]).action;
      fireEvent.press(screen.getByLabelText(truth === 'allow' ? 'Permitir' : 'Bloquear'));
      expect(onDone).not.toHaveBeenCalled();
      view.rerender(createElement(FirewallRound, props({ seed: 5, level: 1, onDone, timeUp: true })));
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onDone).toHaveBeenCalledWith({ score: 2 / 6, accuracy: 1, detail: '2 de 6 conexiones bien decididas' });
      const other = jest.fn();
      wait(10_000);
      view.rerender(createElement(FirewallRound, props({ seed: 5, level: 1, onDone: other, timeUp: true })));
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(other).not.toHaveBeenCalled();
    });

    it('si el tiempo ya se acabó al empezar, entrega 0 y los botones no responden', () => {
      const onDone = jest.fn();
      render(createElement(FirewallRound, props({ onDone, timeUp: true })));
      expect(onDone).toHaveBeenCalledWith({ score: 0, accuracy: 0, detail: '0 de 6 conexiones bien decididas' });
      fireEvent.press(screen.getByLabelText('Permitir'));
      expect(success).not.toHaveBeenCalled();
      expect(warning).not.toHaveBeenCalled();
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it('muestra las reglas numeradas y la conexión con su servicio y puerto', () => {
      render(createElement(FirewallRound, props({ seed: 5, level: 2 })));
      const data = makeFirewallRound(5, 2);
      data.rules.forEach((rule, index) => expect(screen.getByLabelText(new RegExp(`^Regla ${index + 1}: (permitir|bloquear) ${ruleText(rule).replace(/[()·.]/g, '\\$&')}`))).toBeTruthy());
      const first = data.connections[0];
      expect(screen.getByText(SERVICES[first.service].name)).toBeTruthy();
      expect(screen.getByText(`puerto ${SERVICES[first.service].port}`)).toBeTruthy();
      expect(screen.getByText(firewallPrompt(2))).toBeTruthy();
    });
  });

  describe('Canal Wi-Fi', () => {
    const pick = (seed: number, level: number, mode: 'right' | 'wrong', from = 0, to = 3) => {
      makeWifiScenarios(seed, level)
        .slice(from, to)
        .forEach((scenario) => {
          const channel = mode === 'right' ? scenario.best : WIFI_CHANNELS.find((item) => item !== scenario.best);
          fireEvent.press(screen.getByLabelText(`Canal ${channel}`));
          wait(4000);
        });
    };

    it('3 aciertos: puntaje 1, una sola vez; el gráfico muestra los nombres de las redes', () => {
      LEVELS.forEach((level) => {
        const onDone = jest.fn();
        const view = render(createElement(WifiChannelRound, props({ seed: 7, level, onDone })));
        layoutAll(340, 220);
        const first = makeWifiScenarios(7, level)[0];
        first.neighbors.forEach((neighbor) => expect(screen.getByText(neighbor.name)).toBeTruthy());
        expect(screen.getByText(WIFI_PROMPT_FIRST)).toBeTruthy();
        pick(7, level, 'right');
        expect(onDone).toHaveBeenCalledTimes(1);
        expect(onDone).toHaveBeenCalledWith({ score: 1, accuracy: 1, detail: '3 de 3 canales bien elegidos' });
        view.unmount();
      });
      expect(success).toHaveBeenCalledTimes(9);
      expect(warning).not.toHaveBeenCalled();
    });

    it('un error explica con quién se pisaba y cuál era el libre', () => {
      const onDone = jest.fn();
      render(createElement(WifiChannelRound, props({ seed: 7, level: 1, onDone })));
      const scenario = makeWifiScenarios(7, 1)[0];
      const wrong = WIFI_CHANNELS.find((item) => item !== scenario.best) as 1 | 6 | 11;
      fireEvent.press(screen.getByLabelText(`Canal ${wrong}`));
      expect(screen.getByText(explainChannel(scenario, wrong))).toBeTruthy();
      expect(warning).toHaveBeenCalledTimes(1);
      wait(4000);
      pick(7, 1, 'wrong', 1);
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onDone).toHaveBeenCalledWith({ score: 0, accuracy: 0, detail: '0 de 3 canales bien elegidos' });
    });

    it('al acabarse el tiempo entrega lo logrado, una sola vez', () => {
      const onDone = jest.fn();
      const view = render(createElement(WifiChannelRound, props({ seed: 7, level: 1, onDone })));
      pick(7, 1, 'right', 0, 1);
      view.rerender(createElement(WifiChannelRound, props({ seed: 7, level: 1, onDone, timeUp: true })));
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onDone).toHaveBeenCalledWith({ score: 1 / 3, accuracy: 1, detail: '1 de 3 canales bien elegidos' });
      wait(10_000);
      view.rerender(createElement(WifiChannelRound, props({ seed: 7, level: 1, onDone, timeUp: true })));
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it('los tres botones de canal existen y se bloquean cuando se acaba el tiempo', () => {
      const onDone = jest.fn();
      render(createElement(WifiChannelRound, props({ onDone, timeUp: true })));
      WIFI_CHANNELS.forEach((channel) => expect(screen.getByLabelText(`Canal ${channel}`)).toBeTruthy());
      fireEvent.press(screen.getByLabelText('Canal 6'));
      expect(success).not.toHaveBeenCalled();
      expect(warning).not.toHaveBeenCalled();
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onDone).toHaveBeenCalledWith({ score: 0, accuracy: 0, detail: '0 de 3 canales bien elegidos' });
    });
  });

  describe('Arma la red', () => {
    const fill = (seed: number, level: number) => {
      const data = makeNetworkRound(seed, level);
      data.slots.forEach((slot, index) => {
        fireEvent.press(screen.getByLabelText(new RegExp(`^Hueco ${index + 1} de ${data.slots.length}`)));
        fireEvent.press(screen.getByLabelText(`Elegir ${DEVICES[SLOT_NEEDS[slot]].name}`));
      });
      return data;
    };

    it('equivocarse explica el rol; completar la red entrega puntaje 1 con la precisión real', () => {
      const onDone = jest.fn();
      render(createElement(BuildNetworkRound, props({ seed: 3, level: 1, onDone })));
      layoutAll(340, 220);
      const data = makeNetworkRound(3, 1);
      expect(screen.getByText('1 · Toca un hueco vacío')).toBeTruthy();
      fireEvent.press(screen.getByLabelText(/^Hueco 1 de 3/));
      expect(screen.getByText('2 · Ahora toca el equipo que va ahí')).toBeTruthy();
      fireEvent.press(screen.getByLabelText(`Elegir ${DEVICES[data.distractor].name}`));
      expect(screen.getByText(placementResult('router', data.distractor).text)).toBeTruthy();
      expect(warning).toHaveBeenCalledTimes(1);
      expect(screen.getByLabelText(/^Hueco 1 de 3.*vacío/)).toBeTruthy();
      fill(3, 1);
      expect(success).toHaveBeenCalledTimes(3);
      expect(screen.getByText('¡Red lista! Todos tienen Internet.')).toBeTruthy();
      expect(onDone).not.toHaveBeenCalled();
      wait(2500);
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onDone).toHaveBeenCalledWith({ score: 1, accuracy: 3 / 4, detail: '3 de 3 equipos en su lugar' });
      wait(10_000);
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it('también se puede tocar primero el equipo y luego el hueco; el nivel 2 suma el firewall', () => {
      const onDone = jest.fn();
      render(createElement(BuildNetworkRound, props({ seed: 9, level: 2, onDone })));
      layoutAll(300, 200);
      const data = makeNetworkRound(9, 2);
      expect(data.slots).toHaveLength(4);
      fireEvent.press(screen.getByLabelText('Elegir Firewall'));
      expect(screen.getByText('2 · Ahora toca el hueco para este equipo')).toBeTruthy();
      fireEvent.press(screen.getByLabelText(/^Hueco 1 de 4/));
      expect(screen.getByText(DEVICES.firewall.role)).toBeTruthy();
      // Tocar un hueco lleno repite el rol; el equipo puesto ya no se puede elegir de nuevo.
      fireEvent.press(screen.getByLabelText(/^Hueco 1 de 4.*Firewall puesto/));
      expect(screen.getByText(DEVICES.firewall.role)).toBeTruthy();
      data.slots.slice(1).forEach((slot, index) => {
        fireEvent.press(screen.getByLabelText(new RegExp(`^Hueco ${index + 2} de 4`)));
        fireEvent.press(screen.getByLabelText(`Elegir ${DEVICES[SLOT_NEEDS[slot]].name}`));
      });
      wait(2500);
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onDone).toHaveBeenCalledWith({ score: 1, accuracy: 1, detail: '4 de 4 equipos en su lugar' });
    });

    it('al acabarse el tiempo entrega lo logrado, una sola vez, y deja de aceptar toques', () => {
      const onDone = jest.fn();
      const view = render(createElement(BuildNetworkRound, props({ seed: 3, level: 1, onDone })));
      layoutAll(340, 220);
      fireEvent.press(screen.getByLabelText(/^Hueco 1 de 3/));
      fireEvent.press(screen.getByLabelText('Elegir Router'));
      view.rerender(createElement(BuildNetworkRound, props({ seed: 3, level: 1, onDone, timeUp: true })));
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onDone).toHaveBeenCalledWith({ score: 1 / 3, accuracy: 1, detail: '1 de 3 equipos en su lugar' });
      fireEvent.press(screen.getByLabelText(/^Hueco 2 de 3/));
      fireEvent.press(screen.getByLabelText('Elegir Switch'));
      wait(5000);
      view.rerender(createElement(BuildNetworkRound, props({ seed: 3, level: 1, onDone, timeUp: true })));
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(success).toHaveBeenCalledTimes(1);
    });

    it('sin jugar y con el tiempo agotado entrega 0', () => {
      const onDone = jest.fn();
      render(createElement(BuildNetworkRound, props({ onDone, timeUp: true })));
      expect(onDone).toHaveBeenCalledWith({ score: 0, accuracy: 0, detail: '0 de 3 equipos en su lugar' });
    });
  });
});
