import { microGameCatalog } from '@/features/burst/catalog';
import { acronymRound, acronyms, deviceRound, devices, portRound, services, wifiRound, wifiSecurities, type ConceptRound } from '@/features/burst/concepts';
import { microGameRegistry } from '@/features/burst/registry';
import { puzzles } from '@/features/puzzles/catalog';
import { createMemoryDeck, isMemoryMatch, memoryConcepts, memoryPairsForLevel, memoryScore, MEMORY_MAX_LEVEL } from '@/features/puzzles/memory';
import { getTutorial } from '@/features/tutorial/tutorials';
import { icons } from '@/graphics/icons';
import { isAccessoryUnlocked, rutixAccessories, rutixAccessory, rutixAccessoryBack, rutixAccessoryFront, rutixDrawing, rutixFace, rutixWardrobe } from '@/graphics/rutix';
import { evaluateAchievements } from '@/lib/achievements';
import { missionPools, missionsFor, missionStates, todaysResults } from '@/lib/dailyMissions';
import { PACE_ACCELERATION, paceFactor, paceLabels } from '@/lib/pace';
import { mulberry32 } from '@/route/random';
import { defaultProfile } from '@/storage/profile';
import { defaultSettings, parseSettings } from '@/storage/settings';
import type { GameResult } from '@/types/game';

function expectOneRightAnswer(round: ConceptRound) {
  expect(round.options).toHaveLength(4);
  expect(round.options.filter((option) => option.correct)).toHaveLength(1);
  expect(new Set(round.options.map((option) => option.label)).size).toBe(4);
  round.options.forEach((option) => expect(option.why.length).toBeGreaterThan(10));
  expect(round.prompt.length).toBeGreaterThan(10);
  expect(round.footer.length).toBeGreaterThan(10);
}

describe('concept micro games', () => {
  const random = mulberry32(21);

  it('asks for the port of a service with a single right answer', () => {
    for (let round = 0; round < 40; round += 1) {
      const question = portRound(random);
      expectOneRightAnswer(question);
      const right = question.options.find((option) => option.correct);
      const service = services.find((item) => question.prompt.includes(item.name));
      expect(right?.label).toBe(`Puerto ${service?.port}`);
    }
  });

  it('describes a network device and names it', () => {
    for (let round = 0; round < 40; round += 1) {
      const question = deviceRound(random);
      expectOneRightAnswer(question);
      const right = question.options.find((option) => option.correct);
      const device = devices.find((item) => item.name === right?.label);
      expect(question.prompt).toContain(device?.clue);
    }
  });

  it('picks the best protected Wi-Fi among four networks', () => {
    for (let round = 0; round < 40; round += 1) {
      const question = wifiRound(random);
      expectOneRightAnswer(question);
      const level = (tag?: string) => wifiSecurities.find((item) => item.tag === tag)?.level ?? -1;
      const right = question.options.find((option) => option.correct);
      question.options.forEach((option) => expect(level(option.detail)).toBeLessThanOrEqual(level(right?.detail)));
    }
  });

  it('expands an acronym', () => {
    for (let round = 0; round < 40; round += 1) {
      const question = acronymRound(random);
      expectOneRightAnswer(question);
      const right = question.options.find((option) => option.correct);
      expect(acronyms.some((item) => item.full === right?.label && question.prompt.includes(item.short))).toBe(true);
    }
  });

  it('registers 22 micro games with a component each', () => {
    expect(microGameCatalog).toHaveLength(22);
    ['port-match', 'device-role', 'wifi-safe', 'acronym'].forEach((id) => {
      const game = microGameRegistry.find((item) => item.id === id);
      expect(game?.Component).toBeDefined();
      expect(icons[game!.icon]).toBeDefined();
    });
  });
});

describe('memory puzzle', () => {
  it('deals two cards per concept and grows with the level', () => {
    expect([1, 2, 3, 4, 5, 9].map(memoryPairsForLevel)).toEqual([4, 6, 8, 10, 12, 12]);
    expect(memoryConcepts.length).toBeGreaterThanOrEqual(memoryPairsForLevel(MEMORY_MAX_LEVEL));
    for (let level = 1; level <= MEMORY_MAX_LEVEL; level += 1) {
      const deck = createMemoryDeck(level, mulberry32(level * 13));
      expect(deck).toHaveLength(memoryPairsForLevel(level) * 2);
      expect(deck.map((card) => card.key)).toEqual(deck.map((_, index) => index));
      const byPair = new Map<string, string[]>();
      deck.forEach((card) => byPair.set(card.pair, [...(byPair.get(card.pair) ?? []), card.side]));
      byPair.forEach((sides) => expect(sides.sort()).toEqual(['clue', 'term']));
    }
    memoryConcepts.forEach((concept) => {
      expect(icons[concept.icon]).toBeDefined();
      expect(concept.clue.length).toBeLessThanOrEqual(32);
    });
  });

  it('matches only the two faces of the same concept and rewards few attempts', () => {
    const deck = createMemoryDeck(1, mulberry32(4));
    const first = deck[0];
    const partner = deck.find((card) => card.pair === first.pair && card.key !== first.key)!;
    const other = deck.find((card) => card.pair !== first.pair)!;
    expect(isMemoryMatch(first, partner)).toBe(true);
    expect(isMemoryMatch(first, first)).toBe(false);
    expect(isMemoryMatch(first, other)).toBe(false);
    expect(memoryScore(6, 6)).toBe(1000);
    expect(memoryScore(6, 10)).toBe(840);
    expect(memoryScore(6, 60)).toBe(300);
  });

  it('is listed with the other untimed challenges and has a tutorial', () => {
    expect(puzzles.map((puzzle) => puzzle.id)).toEqual(['red', 'memoria', 'binario', 'cifrado']);
    puzzles.forEach((puzzle) => expect(getTutorial(`puzzle-${puzzle.id}`)?.steps.length).toBeGreaterThanOrEqual(3));
    expect(puzzles.find((puzzle) => puzzle.id === 'memoria')?.levelName(3)).toBe('8 parejas');
  });
});

describe('pace and settings', () => {
  it('defaults to the unhurried pace and moves old defaults to it', () => {
    expect(defaultSettings.pace).toBe('relaxed');
    expect(paceFactor('relaxed')).toBeGreaterThan(paceFactor('calm'));
    expect(PACE_ACCELERATION.relaxed).toBe(0);
    expect(paceLabels.relaxed.label).toBe('Sin apuro');
    // "calm" guardado con la versión anterior era el valor por defecto: pasa a "relaxed".
    expect(parseSettings(JSON.stringify({ pace: 'calm' })).pace).toBe('relaxed');
    // Elegido a propósito después del cambio: se respeta.
    expect(parseSettings(JSON.stringify({ pace: 'calm', paceRev: 2 })).pace).toBe('calm');
    expect(parseSettings(JSON.stringify({ pace: 'fast' })).pace).toBe('fast');
    expect(parseSettings(JSON.stringify({ rutixAccessory: 'cape' })).rutixAccessory).toBe('cape');
  });
});

describe('Rutix wardrobe', () => {
  it('draws every accessory and knows how each one is unlocked', () => {
    expect(rutixWardrobe.map((item) => item.id)).toEqual(rutixAccessories);
    rutixAccessories
      .filter((id) => id !== 'none')
      .forEach((id) => {
        const pieces = rutixAccessory(id).length + rutixAccessoryBack(id).length + rutixAccessoryFront(id).length;
        expect(pieces).toBeGreaterThan(0);
        expect(rutixDrawing({ accessory: id }).shapes.length).toBeGreaterThan(rutixDrawing().shapes.length);
      });
    expect(rutixAccessoryFront('glasses').length).toBeGreaterThan(0);
    expect(rutixAccessoryBack('cape').length).toBeGreaterThan(0);
    const scarf = rutixWardrobe.find((item) => item.id === 'scarf')!;
    expect(isAccessoryUnlocked(scarf, { level: 9, achievements: [] })).toBe(false);
    expect(isAccessoryUnlocked(scarf, { level: 1, achievements: ['runner-rookie'] })).toBe(true);
    const cape = rutixWardrobe.find((item) => item.id === 'cape')!;
    expect(isAccessoryUnlocked(cape, { level: 6, achievements: [] })).toBe(true);
  });

  it('looks to the side by shifting the whole face', () => {
    expect(rutixFace('neutral', false, 0)).toEqual(rutixFace('neutral'));
    const looking = rutixFace('neutral', false, 1);
    expect(looking).toHaveLength(1);
    expect(looking[0]).toMatchObject({ t: 'g', tf: 'translate(3.2 0)' });
  });
});

describe('daily missions', () => {
  const day = new Date(2026, 9, 6, 15);
  const at = (hour: number) => new Date(2026, 9, 6, hour).toISOString();
  const base = { score: 400, accuracy: 0.8, durationSeconds: 90 };

  it('offers the same three missions all day, one from each pool', () => {
    const morning = missionsFor(new Date(2026, 9, 6, 8)).map((mission) => mission.id);
    expect(missionsFor(new Date(2026, 9, 6, 22)).map((mission) => mission.id)).toEqual(morning);
    expect(morning).toHaveLength(3);
    morning.forEach((id, index) => expect(missionPools[index].some((mission) => mission.id === id)).toBe(true));
    const week = new Set(Array.from({ length: 14 }, (_, offset) => missionsFor(new Date(2026, 9, 6 + offset)).map((mission) => mission.id).join('|')));
    expect(week.size).toBeGreaterThan(3);
    missionPools.flat().forEach((mission) => {
      expect(icons[mission.icon]).toBeDefined();
      expect(mission.goal).toBeGreaterThan(0);
    });
  });

  it('counts only today and caps progress at the goal', () => {
    const results: GameResult[] = [
      { ...base, gameId: 'burst', completedAt: at(10), metadata: { lives: 3, daily: '2026-10-06', rounds: 8 } },
      { ...base, gameId: 'runner', completedAt: at(11), metadata: { distance: 520, data: 44 } },
      { ...base, gameId: 'puzzle', completedAt: at(12), metadata: { game: 'memoria', level: 1 } },
      { ...base, gameId: 'practice', completedAt: at(12), metadata: { area: 'redes' } },
      { ...base, gameId: 'station', completedAt: at(13), metadata: { game: 'datos' } },
      { ...base, gameId: 'millionaire', completedAt: at(13), metadata: { correctAnswers: 7 } },
      { ...base, gameId: 'runner', completedAt: new Date(2026, 9, 5, 20).toISOString(), metadata: { distance: 900, data: 90 } },
    ];
    expect(todaysResults(results, day)).toHaveLength(6);
    const states = missionStates(results, day);
    expect(states.every((state) => state.done)).toBe(true);
    states.forEach((state) => expect(state.value).toBe(state.mission.goal));
    expect(missionStates([], day).every((state) => !state.done && state.value === 0)).toBe(true);
    // Lo de ayer no cuenta para hoy.
    expect(missionStates(results.slice(-1), day).some((state) => state.done)).toBe(false);
  });
});

describe('new achievements', () => {
  const base = { score: 700, accuracy: 0.9, durationSeconds: 80, completedAt: '2026-10-06T12:00:00.000Z' };
  const check = (results: GameResult[]) => evaluateAchievements({ profile: defaultProfile, results, mascotDays: 0, careerAreas: 0 });

  it('rewards memory, variety, flawless bursts and daily constancy', () => {
    const memory: GameResult[] = [1, 2, 3].map((level) => ({ ...base, gameId: 'puzzle', metadata: { game: 'memoria', level } }));
    expect(check(memory)).toContain('memory-ace');
    const many: GameResult[] = [...memory, ...[1, 2, 3, 4].map((level) => ({ ...base, gameId: 'puzzle' as const, metadata: { game: 'red', level } })), ...[1, 2, 3].map((level) => ({ ...base, gameId: 'puzzle' as const, metadata: { game: 'cifrado', level } }))];
    expect(check(many)).toContain('puzzle-fan');
    expect(check(many.slice(0, 9))).not.toContain('puzzle-fan');

    const modes: GameResult[] = (['burst', 'runner', 'puzzle', 'station', 'millionaire', 'story'] as const).map((gameId) => ({ ...base, gameId }));
    expect(check(modes)).toContain('all-rounder');
    expect(check(modes.slice(0, 5))).not.toContain('all-rounder');

    expect(check([{ ...base, gameId: 'burst', metadata: { lives: 3, rounds: 8, focus: '' } }])).toContain('burst-flawless');
    expect(check([{ ...base, gameId: 'burst', metadata: { lives: 2, rounds: 8, focus: '' } }])).not.toContain('burst-flawless');
    expect(check([{ ...base, gameId: 'burst', metadata: { lives: 3, rounds: 3, focus: 'firewall' } }])).not.toContain('burst-flawless');

    const days: GameResult[] = Array.from({ length: 7 }, (_, index) => ({ ...base, gameId: 'burst' as const, metadata: { daily: `2026-10-0${index + 1}`, lives: 1, rounds: 5 } }));
    expect(check(days)).toEqual(expect.arrayContaining(['daily-three', 'daily-seven']));
    expect(check(days.slice(0, 6))).not.toContain('daily-seven');
  });
});
