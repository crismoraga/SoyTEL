import { rutixJokes, rutixTrueFalse, pickDifferent, tickleReactions } from '@/data/rutixPlay';
import { microGameCatalog } from '@/features/burst/catalog';
import { microGameGuides } from '@/features/burst/guides';
import { getRunnerCharacter, nextRunnerCharacter, runnerCharacters } from '@/features/runner/characters';
import {
  applyRunnerInput,
  basePerks,
  createRunnerState,
  HIT_RANGE,
  isAirborne,
  LANES,
  ROW_GAP,
  runnerAccuracy,
  runnerLevel,
  runnerScore,
  runnerSpeed,
  spawnRunnerRow,
  stepRunner,
  VIEW_AHEAD,
  WARMUP_METERS,
  type RunnerItem,
  type RunnerItemKind,
  type RunnerState,
} from '@/features/runner/logic';
import { tutorials } from '@/features/tutorial/tutorials';
import { icons } from '@/graphics/icons';
import { runnerCharacterDrawing, runnerItemDrawing, runnerItemKinds } from '@/graphics/runners';
import { evaluateAchievements } from '@/lib/achievements';
import { guideProgress, starterGuide } from '@/lib/guide';
import { mulberry32 } from '@/route/random';
import { defaultProfile } from '@/storage/profile';
import { applyRun, applyUnlock, defaultRunnerSave, parseRunnerSave } from '@/storage/runner';
import type { GameResult } from '@/types/game';

const never = () => 0.999;

// Estado sin filas automáticas, con un solo objeto justo delante del corredor.
function withItem(kind: RunnerItemKind, lane = 1, perks = basePerks): RunnerState {
  const state = createRunnerState(perks);
  state.nextRowAt = Number.POSITIVE_INFINITY;
  state.items = [{ id: 1, kind, lane, at: 0.4 }];
  return state;
}

describe('runner rules', () => {
  it('speeds up with distance and slows down with a calm pace', () => {
    expect(runnerSpeed(0)).toBe(9);
    expect(runnerSpeed(700)).toBeGreaterThan(runnerSpeed(0));
    expect(runnerSpeed(5000)).toBe(16);
    expect(runnerSpeed(0, 1.7)).toBeLessThan(runnerSpeed(0, 1.35));
    expect(runnerSpeed(0, 1.35)).toBeLessThan(runnerSpeed(0, 1));
    expect([0, 149, 150, 5000].map(runnerLevel)).toEqual([0, 0, 1, 6]);
  });

  it('moves between three lanes and jumps once at a time', () => {
    const state = createRunnerState();
    expect(state.lane).toBe(1);
    expect(applyRunnerInput(state, 'left')).toBe(true);
    expect(applyRunnerInput(state, 'left')).toBe(false);
    expect(state.lane).toBe(0);
    applyRunnerInput(state, 'right');
    applyRunnerInput(state, 'right');
    expect(applyRunnerInput(state, 'right')).toBe(false);
    expect(state.lane).toBe(LANES - 1);
    expect(applyRunnerInput(state, 'jump')).toBe(true);
    expect(isAirborne(state)).toBe(true);
    expect(applyRunnerInput(state, 'jump')).toBe(false);
  });

  it('builds fair rows: warm-up, breathing space and never three viruses', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const random = mulberry32(seed);
      const state = createRunnerState();
      let sinceObstacle = 99;
      for (let at = 12; at < 1600; at += ROW_GAP) {
        const row = spawnRunnerRow(state, at, random);
        const viruses = row.filter((item) => item.kind === 'virus');
        const obstacle = row.some((item) => item.kind === 'virus' || item.kind === 'cable');
        expect(viruses.length).toBeLessThan(LANES);
        expect(new Set(row.map((item) => item.lane)).size).toBe(row.length);
        if (at < WARMUP_METERS) expect(obstacle).toBe(false);
        if (obstacle) {
          expect(sinceObstacle).toBeGreaterThanOrEqual(2);
          sinceObstacle = 0;
        } else {
          sinceObstacle += 1;
        }
        // Con virus en dos pistas, la tercera lleva un paquete que muestra por dónde pasar.
        if (viruses.length === 2) expect(row.some((item) => item.kind === 'packet')).toBe(true);
      }
    }
  });

  it('collects packets, doubles them with fiber and attracts them with the magnet', () => {
    const plain = withItem('packet');
    expect(stepRunner(plain, 0.016, never)).toEqual(['collect']);
    expect(plain.data).toBe(1);
    expect(plain.items).toHaveLength(0);

    const boosted = withItem('fiber');
    expect(stepRunner(boosted, 0.016, never)).toEqual(['boost']);
    boosted.items = [{ id: 2, kind: 'packet', lane: 1, at: boosted.distance + 0.2 }];
    stepRunner(boosted, 0.016, never);
    expect(boosted.data).toBe(2);

    const far = withItem('packet', 0);
    stepRunner(far, 0.016, never);
    expect(far.data).toBe(0);
    const magnet = withItem('packet', 0, getRunnerCharacter('paqui').perks);
    stepRunner(magnet, 0.016, never);
    expect(magnet.data).toBe(1);
  });

  it('loses a life on a virus, jumps cables and is saved by the firewall', () => {
    const hit = withItem('virus');
    expect(stepRunner(hit, 0.016, never)).toEqual(['hit']);
    expect(hit.lives).toBe(basePerks.lives - 1);
    // Parpadeo de seguridad: el siguiente golpe inmediato no cuenta.
    hit.items = [{ id: 2, kind: 'virus', lane: 1, at: hit.distance + 0.2 }];
    expect(stepRunner(hit, 0.016, never)).toEqual([]);
    expect(hit.lives).toBe(basePerks.lives - 1);

    const jumped = withItem('cable');
    applyRunnerInput(jumped, 'jump');
    expect(stepRunner(jumped, 0.016, never)).toEqual([]);
    expect(jumped.lives).toBe(basePerks.lives);
    const tripped = withItem('cable');
    expect(stepRunner(tripped, 0.016, never)).toEqual(['hit']);
    // Un virus no se puede saltar.
    const tall = withItem('virus');
    applyRunnerInput(tall, 'jump');
    expect(stepRunner(tall, 0.016, never)).toEqual(['hit']);

    const shielded = withItem('virus', 1, getRunnerCharacter('routa').perks);
    expect(shielded.shield).toBe(true);
    expect(stepRunner(shielded, 0.016, never)).toEqual(['blocked']);
    expect(shielded.shield).toBe(false);
    expect(shielded.lives).toBe(basePerks.lives);
  });

  it('ends without lives, unless the cloud backup brings the runner back once', () => {
    const state = withItem('virus');
    state.lives = 1;
    expect(stepRunner(state, 0.016, never)).toEqual(['hit', 'over']);
    expect(state.over).toBe(true);
    expect(stepRunner(state, 1, never)).toEqual([]);
    expect(applyRunnerInput(state, 'left')).toBe(false);

    const backed = withItem('virus', 1, getRunnerCharacter('nubi').perks);
    backed.lives = 1;
    expect(stepRunner(backed, 0.016, never)).toEqual(['hit', 'revive']);
    expect(backed.over).toBe(false);
    expect(backed.lives).toBe(1);
    expect(backed.backupLeft).toBe(false);
  });

  it('runs a whole race deterministically and keeps the item list bounded', () => {
    const play = (seed: number) => {
      const random = mulberry32(seed);
      const state = createRunnerState();
      let revisions = 0;
      for (let frame = 0; frame < 60 * 40 && !state.over; frame += 1) {
        const before = state.revision;
        stepRunner(state, 1 / 60, random, 1.7);
        if (state.revision !== before) revisions += 1;
        expect(state.items.length).toBeLessThanOrEqual(Math.ceil((VIEW_AHEAD + 5) / ROW_GAP + 1) * LANES);
        state.items.forEach((item: RunnerItem) => expect(item.at).toBeGreaterThanOrEqual(state.distance - 5 - HIT_RANGE));
      }
      return { distance: state.distance, data: state.data, lives: state.lives, revisions };
    };
    expect(play(7)).toEqual(play(7));
    expect(play(7).distance).toBeGreaterThan(100);
    expect(play(7).revisions).toBeGreaterThan(10);
    expect(runnerScore({ distance: 320.6, data: 12 })).toBe(441);
    expect(runnerAccuracy({ dodged: 9, hits: 1 })).toBeCloseTo(0.9);
    expect(runnerAccuracy({ dodged: 0, hits: 0 })).toBe(1);
  });
});

describe('runner characters and savings', () => {
  it('has seven telematics characters with a drawing, a fact and a growing price', () => {
    expect(runnerCharacters).toHaveLength(7);
    expect(new Set(runnerCharacters.map((character) => character.id)).size).toBe(7);
    expect(runnerCharacters[0]).toMatchObject({ id: 'rutix', cost: 0 });
    const costs = runnerCharacters.map((character) => character.cost);
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
    runnerCharacters.forEach((character) => {
      expect(character.fact.length).toBeGreaterThan(30);
      expect(character.perk.length).toBeGreaterThan(10);
      expect(runnerCharacterDrawing(character.id).shapes.length).toBeGreaterThan(5);
    });
    runnerItemKinds.forEach((kind) => expect(runnerItemDrawing(kind).shapes.length).toBeGreaterThan(1));
    expect(runnerItemKinds.sort()).toEqual(['cable', 'fiber', 'packet', 'shield', 'virus']);
    expect(getRunnerCharacter('no-existe').id).toBe('rutix');
  });

  it('saves packets, records and unlocks only what can be paid', () => {
    const afterRun = applyRun(defaultRunnerSave, { data: 70, score: 520, distance: 180 });
    expect(afterRun).toMatchObject({ data: 70, totalData: 70, best: 520, bestDistance: 180, runs: 1 });
    expect(applyUnlock(afterRun, 'routa')).toBe(afterRun);
    const withPaqui = applyUnlock(afterRun, 'paqui');
    expect(withPaqui).toMatchObject({ data: 10, totalData: 70, selected: 'paqui' });
    expect(withPaqui.unlocked).toEqual(['rutix', 'paqui']);
    expect(applyUnlock(withPaqui, 'paqui')).toBe(withPaqui);
    expect(nextRunnerCharacter(withPaqui.unlocked)?.id).toBe('routa');
    expect(nextRunnerCharacter(runnerCharacters.map((character) => character.id))).toBeNull();
    const worse = applyRun(withPaqui, { data: 5, score: 100, distance: 60 });
    expect(worse).toMatchObject({ data: 15, best: 520, bestDistance: 180, runs: 2 });
  });

  it('repairs damaged saves', () => {
    expect(parseRunnerSave(null)).toEqual(defaultRunnerSave);
    expect(parseRunnerSave({ data: -5, best: 'x', unlocked: ['hacker', 'paqui'], selected: 'nubi' })).toMatchObject({ data: 0, best: 0, unlocked: ['rutix', 'paqui'], selected: 'rutix' });
    expect(parseRunnerSave({ data: 12.9, totalData: 3, unlocked: ['rutix', 'routa'], selected: 'routa' })).toMatchObject({ data: 12, totalData: 12, selected: 'routa' });
  });

  it('unlocks runner achievements from results', () => {
    const base = { gameId: 'runner' as const, score: 900, accuracy: 0.9, durationSeconds: 80, completedAt: '2026-10-05T12:00:00.000Z' };
    const results: GameResult[] = [
      { ...base, metadata: { distance: 260, data: 800 } },
      { ...base, metadata: { distance: 1040, data: 750 } },
    ];
    const unlocked = evaluateAchievements({ profile: defaultProfile, results, mascotDays: 0, careerAreas: 0 });
    expect(unlocked).toEqual(expect.arrayContaining(['runner-rookie', 'runner-courier', 'data-collector']));
    expect(evaluateAchievements({ profile: defaultProfile, results: [{ ...base, metadata: { distance: 150, data: 20 } }], mascotDays: 0, careerAreas: 0 })).not.toContain('runner-rookie');
  });
});

describe('guidance for new players', () => {
  it('explains every game step by step with known icons', () => {
    Object.values(tutorials).forEach((tutorial) => {
      expect(tutorial.steps.length).toBeGreaterThanOrEqual(3);
      tutorial.steps.forEach((step) => {
        expect(icons[step.icon]).toBeDefined();
        expect(step.title.length).toBeGreaterThan(3);
        expect(step.text.length).toBeGreaterThan(20);
        expect(step.text.length).toBeLessThan(140);
      });
    });
  });

  it('gives every micro game short how-to steps and a lesson', () => {
    microGameCatalog.forEach((game) => {
      const guide = microGameGuides[game.id];
      expect(guide.steps.length).toBeGreaterThanOrEqual(2);
      expect(guide.steps.length).toBeLessThanOrEqual(3);
      guide.steps.forEach((step) => expect(step.length).toBeLessThan(90));
      expect(guide.learn.length).toBeGreaterThan(30);
    });
    expect(Object.keys(microGameGuides)).toHaveLength(microGameCatalog.length);
  });

  it('walks through the starter guide in order', () => {
    const empty = starterGuide({ results: [], mascotDays: 0, careerAreas: 0 });
    expect(empty.map((step) => step.id)).toEqual(['burst', 'runner', 'puzzle', 'station', 'rutix', 'career']);
    expect(guideProgress(empty)).toMatchObject({ done: 0, total: 6 });
    expect(guideProgress(empty).next?.id).toBe('burst');
    const base = { score: 100, accuracy: 1, durationSeconds: 30, completedAt: '2026-10-05T12:00:00.000Z' };
    const some = starterGuide({ results: [{ ...base, gameId: 'burst' }, { ...base, gameId: 'route' }], mascotDays: 2, careerAreas: 0 });
    expect(some.filter((step) => step.done).map((step) => step.id)).toEqual(['burst', 'station', 'rutix']);
    expect(guideProgress(some).next?.id).toBe('runner');
    const all = starterGuide({ results: (['burst', 'runner', 'puzzle', 'station'] as const).map((gameId) => ({ ...base, gameId })), mascotDays: 1, careerAreas: 1 });
    expect(guideProgress(all).next).toBeNull();
  });

  it('keeps Rutix entertaining without repeating himself', () => {
    expect(rutixJokes.length).toBeGreaterThanOrEqual(10);
    expect(tickleReactions.length).toBeGreaterThanOrEqual(5);
    expect(rutixTrueFalse.some((item) => item.answer)).toBe(true);
    expect(rutixTrueFalse.some((item) => !item.answer)).toBe(true);
    rutixTrueFalse.forEach((item) => expect(item.why.length).toBeGreaterThan(20));
    const random = mulberry32(3);
    let previous = -1;
    for (let round = 0; round < 60; round += 1) {
      const next = pickDifferent(rutixJokes, previous, random);
      expect(next).not.toBe(previous);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(rutixJokes.length);
      previous = next;
    }
    expect(pickDifferent(['solo'], 0)).toBe(0);
  });
});
