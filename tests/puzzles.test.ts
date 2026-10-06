import AsyncStorage from '@react-native-async-storage/async-storage';
import { microGameCatalog } from '@/features/burst/catalog';
import { dailyDays, dailyKey, dailySeed, isDailyDone } from '@/features/burst/daily';
import { binaryRound, bitsValue, dataUnits, fastRouteRound, ipRound, isValidIpv4, orderRound, tcpIpStack, urlRound } from '@/features/burst/logic';
import { microGameRegistry, pickBurstGames } from '@/features/burst/registry';
import { binaryChallenges, caesar, cipherRounds, explainBinary, toBitString } from '@/features/puzzles/codes';
import {
  createNetPuzzle,
  currentMasks,
  EAST,
  generateNet,
  hintOrder,
  isNetSolved,
  minimalMoves,
  minTerminals,
  netScore,
  netSizeForLevel,
  NORTH,
  portCount,
  rotateMask,
  SOUTH,
  terminalCount,
  turnsToSolve,
  WEST,
} from '@/features/puzzles/netwalk';
import { evaluateAchievements, puzzleLevels } from '@/lib/achievements';
import { mulberry32 } from '@/route/random';
import { defaultProfile } from '@/storage/profile';
import { loadPuzzleProgress, recordPuzzleSolved } from '@/storage/puzzles';
import type { GameResult } from '@/types/game';

describe('micro games catalog', () => {
  it('has 22 unique micro games, each with a component and a Rutix tip', () => {
    expect(microGameCatalog).toHaveLength(22);
    expect(new Set(microGameCatalog.map((game) => game.id)).size).toBe(22);
    microGameRegistry.forEach((game) => {
      expect(game.Component).toBeDefined();
      expect(game.tip.length).toBeGreaterThan(15);
      expect(game.durationSeconds).toBeGreaterThanOrEqual(8);
    });
  });

  it('picks the same daily games for the same day', () => {
    const day = new Date(2026, 9, 5, 10);
    const first = pickBurstGames(5, mulberry32(dailySeed(day))).map((game) => game.id);
    const again = pickBurstGames(5, mulberry32(dailySeed(new Date(2026, 9, 5, 23)))).map((game) => game.id);
    const tomorrow = pickBurstGames(5, mulberry32(dailySeed(new Date(2026, 9, 6, 10)))).map((game) => game.id);
    expect(again).toEqual(first);
    expect(tomorrow).not.toEqual(first);
    expect(dailyKey(day)).toBe('2026-10-05');
  });

  it('tracks completed daily challenges', () => {
    const base = { gameId: 'burst' as const, score: 500, accuracy: 1, durationSeconds: 60, completedAt: '2026-10-05T12:00:00.000Z' };
    const results: GameResult[] = [
      { ...base, metadata: { daily: '2026-10-05' } },
      { ...base, metadata: { daily: '2026-10-05' } },
      { ...base, metadata: { daily: '2026-10-04' } },
      { ...base, metadata: { daily: '' } },
    ];
    expect(isDailyDone(results, '2026-10-05')).toBe(true);
    expect(isDailyDone(results, '2026-10-06')).toBe(false);
    expect(dailyDays(results)).toBe(2);
  });
});

describe('new micro game rules', () => {
  const random = mulberry32(42);

  it('binary: bits add up to their weights', () => {
    expect(bitsValue([true, false, true, false])).toBe(10);
    expect(bitsValue([false, false, false, true, true])).toBe(3);
    for (let round = 0; round < 30; round += 1) {
      const { target, bits } = binaryRound(random, 4);
      expect(target).toBeGreaterThanOrEqual(1);
      expect(target).toBeLessThanOrEqual(2 ** bits - 1);
    }
  });

  it('order: keeps the right order and never arrives solved', () => {
    for (let round = 0; round < 30; round += 1) {
      const { correct, shuffled } = orderRound(dataUnits, 4, random);
      expect(correct).toHaveLength(4);
      expect(correct.map((item) => dataUnits.indexOf(item))).toEqual([...correct.map((item) => dataUnits.indexOf(item))].sort((a, b) => a - b));
      expect(shuffled.map((item) => item.id).sort()).toEqual(correct.map((item) => item.id).sort());
      expect(shuffled.map((item) => item.id)).not.toEqual(correct.map((item) => item.id));
    }
    expect(orderRound(tcpIpStack, 4, random).correct.map((item) => item.id)).toEqual(['link', 'internet', 'transport', 'app']);
  });

  it('ip: exactly one valid IPv4 among the options', () => {
    expect(isValidIpv4('192.168.1.20')).toBe(true);
    expect(isValidIpv4('256.1.1.1')).toBe(false);
    expect(isValidIpv4('10.0.0')).toBe(false);
    expect(isValidIpv4('10.0.0.1.5')).toBe(false);
    expect(isValidIpv4('10.a.0.1')).toBe(false);
    for (let round = 0; round < 40; round += 1) {
      const options = ipRound(random);
      expect(options).toHaveLength(4);
      expect(options.filter((option) => option.valid)).toHaveLength(1);
      options.forEach((option) => expect(isValidIpv4(option.text)).toBe(option.valid));
    }
  });

  it('routes: a single fastest route', () => {
    for (let round = 0; round < 40; round += 1) {
      const routes = fastRouteRound(random, round % 5);
      const totals = routes.map((route) => route.total).sort((a, b) => a - b);
      expect(totals[1] - totals[0]).toBeGreaterThanOrEqual(4);
      routes.forEach((route) => expect(route.total).toBe(route.hops.reduce((sum, value) => sum + value, 0)));
    }
  });

  it('urls: one legit site and three fakes with a reason', () => {
    for (let round = 0; round < 20; round += 1) {
      const options = urlRound(random);
      expect(options.filter((option) => option.legit)).toHaveLength(1);
      options.forEach((option) => expect(option.why.length).toBeGreaterThan(8));
    }
  });
});

describe('netwalk puzzle', () => {
  it('rotates pieces clockwise', () => {
    expect(rotateMask(NORTH, 1)).toBe(EAST);
    expect(rotateMask(NORTH | EAST, 1)).toBe(EAST | SOUTH);
    expect(rotateMask(WEST, 1)).toBe(NORTH);
    expect(rotateMask(NORTH | SOUTH, 2)).toBe(NORTH | SOUTH);
    expect(turnsToSolve(NORTH | SOUTH, 2)).toBe(0);
    expect(turnsToSolve(NORTH, 1)).toBe(3);
  });

  it('generates a spanning tree: solved state powers every cell with n-1 links', () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const size = 3 + (seed % 4);
      const net = generateNet(size, mulberry32(seed));
      expect(net.solved).toHaveLength(size * size);
      expect(isNetSolved(size, net.server, net.solved)).toBe(true);
      expect(net.solved.reduce((sum, mask) => sum + portCount(mask), 0)).toBe(2 * (size * size - 1));
      net.solved.forEach((mask) => expect(portCount(mask)).toBeLessThanOrEqual(3));
    }
  });

  it('delivers scrambled but solvable puzzles that grow with the level', () => {
    expect([1, 2, 4, 7].map(netSizeForLevel)).toEqual([3, 4, 5, 6]);
    for (let level = 1; level <= 8; level += 1) {
      const puzzle = createNetPuzzle(level, mulberry32(level * 31));
      expect(isNetSolved(puzzle.size, puzzle.server, currentMasks(puzzle, puzzle.turns))).toBe(false);
      expect(minimalMoves(puzzle)).toBeGreaterThan(0);
      // Aplicar los giros mínimos de cada pieza resuelve el tablero.
      const fixed = puzzle.turns.map((turns, index) => turns + turnsToSolve(puzzle.solved[index], turns));
      expect(isNetSolved(puzzle.size, puzzle.server, currentMasks(puzzle, fixed))).toBe(true);
    }
    expect(netScore(10, 10)).toBe(1000);
    expect(netScore(10, 20)).toBe(800);
  });

  it('builds branching networks and hints outward from the server', () => {
    for (let level = 1; level <= 8; level += 1) {
      for (let seed = 1; seed <= 12; seed += 1) {
        const puzzle = createNetPuzzle(level, mulberry32(level * 97 + seed));
        expect(terminalCount(puzzle)).toBeGreaterThanOrEqual(minTerminals(puzzle.size));
        const order = hintOrder(puzzle);
        // El orden recorre todas las piezas una vez, parte por el servidor y nunca salta a una
        // pieza que no esté unida (en la solución) a alguna anterior.
        expect(order[0]).toBe(puzzle.server);
        expect([...order].sort((a, b) => a - b)).toEqual(puzzle.solved.map((_, index) => index));
        order.slice(1).forEach((cell, position) => {
          const earlier = order.slice(0, position + 1);
          const linked = earlier.some((other) => {
            const delta = cell - other;
            if (delta === 1 && cell % puzzle.size !== 0) return Boolean(puzzle.solved[other] & EAST);
            if (delta === -1 && other % puzzle.size !== 0) return Boolean(puzzle.solved[other] & WEST);
            if (delta === puzzle.size) return Boolean(puzzle.solved[other] & SOUTH);
            if (delta === -puzzle.size) return Boolean(puzzle.solved[other] & NORTH);
            return false;
          });
          expect(linked).toBe(true);
        });
      }
    }
  });
});

describe('code puzzles', () => {
  it('binary challenges alternate directions with a single right answer', () => {
    const challenges = binaryChallenges(4, mulberry32(9));
    expect(challenges).toHaveLength(5);
    challenges.forEach((challenge) => {
      expect(challenge.bits).toBe(8);
      expect(challenge.value).toBeGreaterThan(0);
      expect(challenge.value).toBeLessThanOrEqual(255);
      if (challenge.kind === 'toDecimal') {
        expect(new Set(challenge.options).size).toBe(challenge.options.length);
        expect(challenge.options).toContain(challenge.value);
      }
    });
    expect(toBitString(5, 4)).toBe('0101');
    expect(explainBinary(164, 8)).toBe('128 + 32 + 4 = 164');
  });

  it('caesar cipher shifts and wraps around', () => {
    expect(caesar('ABC XYZ', 3)).toBe('DEF ABC');
    expect(caesar(caesar('FIBRA OPTICA', 11), -11)).toBe('FIBRA OPTICA');
    cipherRounds(3, mulberry32(4)).forEach((round) => {
      expect(caesar(round.cipher, -round.shift)).toBe(round.plain);
      expect(round.cipher).not.toBe(round.plain);
      expect(round.shift).toBeLessThanOrEqual(round.maxShift);
    });
  });
});

describe('puzzle progress and achievements', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('remembers the highest level and best score', async () => {
    await recordPuzzleSolved('red', 1, 700);
    await recordPuzzleSolved('red', 2, 900);
    const progress = await recordPuzzleSolved('red', 1, 950);
    expect(progress.red).toEqual({ level: 2, best: 950, solved: 3 });
    expect((await loadPuzzleProgress()).binario.level).toBe(0);
  });

  it('unlocks puzzle and daily achievements from results', () => {
    const base = { score: 800, accuracy: 1, durationSeconds: 60, completedAt: '2026-10-05T12:00:00.000Z' };
    const results: GameResult[] = [
      ...[1, 2, 3, 4, 5, 5].map((level) => ({ ...base, gameId: 'puzzle' as const, metadata: { game: 'red', level } })),
      ...[1, 2, 3].map((level) => ({ ...base, gameId: 'puzzle' as const, metadata: { game: 'cifrado', level } })),
      ...['2026-10-03', '2026-10-04', '2026-10-05'].map((daily) => ({ ...base, gameId: 'burst' as const, metadata: { daily, won: '' } })),
    ];
    expect(puzzleLevels(results, 'red')).toBe(5);
    const unlocked = evaluateAchievements({ profile: defaultProfile, results, mascotDays: 0, careerAreas: 0 });
    expect(unlocked).toEqual(expect.arrayContaining(['net-architect', 'code-breaker', 'daily-three']));
    expect(unlocked).not.toContain('binary-brain');
    expect(unlocked).not.toContain('burst-master');
  });
});
