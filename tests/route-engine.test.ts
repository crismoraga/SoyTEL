import { pillarIds } from '@/route/content';
import {
  addPlayer,
  applyHostAction,
  applyPlayerAction,
  createRoute,
  DEFAULT_SETTINGS,
  MIN_B215_MS,
  MIN_PROJECT_MS,
  pickQuizQuestions,
  quizPoints,
  sanitizeAlias,
  snapshot,
  tick,
} from '@/route/engine';
import { brokerIndexForCode, CODE_ALPHABET, generateRouteCode } from '@/route/protocol';
import { getRouteQuestion, routeQuestions } from '@/route/quizBank';
import type { RouteState } from '@/route/types';

const T0 = 1_000_000;

function join(state: RouteState, id: string, alias: string, at = T0): RouteState {
  const result = addPlayer(state, { id, alias, avatar: 1, boxKey: `pk-${id}`, token: `tok-${id}` }, at);
  expect(result.ok).toBe(true);
  return result.state;
}

function setup(ids = ['ana', 'beto', 'caro']) {
  let state = createRoute('ABC234', T0, 12345);
  ids.forEach((id) => {
    state = join(state, id, id.toUpperCase());
  });
  return state;
}

describe('route engine', () => {
  it('runs the whole route: stand → B215 → B213 → pasillo → podio', () => {
    let state = setup();
    let now = T0 + 1000;
    state = applyHostAction(state, { type: 'start' }, now);
    expect(state.phase).toBe('checkin');
    expect(state.stop).toBe('b215');

    // Todos confirman estar en B215 → el juego parte con cuenta regresiva.
    ['ana', 'beto'].forEach((id) => {
      state = applyPlayerAction(state, id, { type: 'checkin', stop: 'b215' }, now);
    });
    expect(state.phase).toBe('checkin');
    state = applyPlayerAction(state, 'caro', { type: 'checkin', stop: 'b215' }, now);
    expect(state.phase).toBe('play');
    expect(state.startsAt).toBe(now + DEFAULT_SETTINGS.countdownSeconds * 1000);

    now += 30_000;
    state = applyPlayerAction(state, 'ana', { type: 'score', game: 'red-b215', score: 900, accuracy: 0.9 }, now);
    state = applyPlayerAction(state, 'beto', { type: 'score', game: 'red-b215', score: 5000, accuracy: 2 }, now);
    expect(state.players.beto.games['red-b215']?.score).toBe(1000);
    expect(state.phase).toBe('play');
    state = applyPlayerAction(state, 'caro', { type: 'score', game: 'red-b215', score: 400, accuracy: 0.4 }, now);
    expect(state.phase).toBe('results');

    now += DEFAULT_SETTINGS.resultsSeconds * 1000 + 1;
    state = tick(state, now);
    expect(state.phase).toBe('checkin');
    expect(state.stop).toBe('b213');
    ['ana', 'beto', 'caro'].forEach((id) => {
      state = applyPlayerAction(state, id, { type: 'checkin', stop: 'b213' }, now);
    });
    expect(state.phase).toBe('projects');

    // Cada proyecto toma su tiempo: los cinco se envían uno tras otro.
    pillarIds.forEach((game, step) => {
      ['ana', 'beto', 'caro'].forEach((id, index) => {
        state = applyPlayerAction(state, id, { type: 'score', game, score: 500 + index * 100, accuracy: 0.7 }, now + (step + 1) * (MIN_PROJECT_MS + 1000));
      });
    });
    now += pillarIds.length * (MIN_PROJECT_MS + 1000);
    expect(state.phase).toBe('checkin');
    expect(state.stop).toBe('hall');
    ['ana', 'beto', 'caro'].forEach((id) => {
      state = applyPlayerAction(state, id, { type: 'checkin', stop: 'hall' }, now);
    });
    expect(state.phase).toBe('quiz');
    expect(state.quiz?.questionIds).toHaveLength(DEFAULT_SETTINGS.quizQuestions);

    // Trivia: responder antes de que parta la pregunta no cuenta.
    const early = applyPlayerAction(state, 'ana', { type: 'answer', index: 0, option: 0 }, now);
    expect(early.players.ana.answers[0]).toBeUndefined();

    for (let index = 0; index < DEFAULT_SETTINGS.quizQuestions; index += 1) {
      const quiz = state.quiz!;
      const question = getRouteQuestion(quiz.questionIds[index])!;
      const wrong = (question.answer + 1) % 4;
      state = applyPlayerAction(state, 'beto', { type: 'answer', index, option: question.answer }, quiz.startsAt + 1000);
      state = applyPlayerAction(state, 'ana', { type: 'answer', index, option: question.answer }, quiz.startsAt + 4000);
      state = applyPlayerAction(state, 'caro', { type: 'answer', index, option: wrong }, quiz.startsAt + 500);
      expect(state.quiz?.step).toBe('reveal');
      const view = snapshot(state, quiz.startsAt + 5000);
      expect(view.quiz?.reveal?.correct).toBe(question.answer);
      expect(view.quiz?.reveal?.gains.beto.rank).toBe(1);
      expect(view.quiz?.reveal?.gains.ana.rank).toBe(2);
      expect(view.quiz?.reveal?.gains.caro.points).toBe(0);
      state = tick(state, state.quiz!.revealUntil + 1);
    }
    expect(state.phase).toBe('podium');
    const final = snapshot(state, state.finishedAt!);
    expect(final.completed).toBe(true);
    expect(final.players[0].answeredCount).toBe(DEFAULT_SETTINGS.quizQuestions);
    expect(final.players.map((player) => player.id)).toEqual(['beto', 'ana', 'caro']);
    expect(final.players[0].quizCorrect).toBe(DEFAULT_SETTINGS.quizQuestions);
    expect(final.players[0].rank).toBe(1);
  });

  it('hides the answer while the question is open', () => {
    let state = setup(['ana']);
    state = applyHostAction(state, { type: 'start' }, T0);
    state = applyHostAction(state, { type: 'advance' }, T0); // b215 → play
    state = applyHostAction(state, { type: 'advance' }, T0); // play → results
    state = applyHostAction(state, { type: 'advance' }, T0); // results → checkin b213
    state = applyHostAction(state, { type: 'advance' }, T0); // → projects
    state = applyHostAction(state, { type: 'advance' }, T0); // → checkin hall
    state = applyHostAction(state, { type: 'advance' }, T0); // → quiz
    const view = snapshot(state, T0);
    expect(view.phase).toBe('quiz');
    expect(view.quiz?.reveal).toBeNull();
    expect(JSON.stringify(view)).not.toContain('"answer"');
  });

  it('does not wait for offline or kicked players', () => {
    let state = setup();
    state = applyHostAction(state, { type: 'start' }, T0);
    const later = T0 + (DEFAULT_SETTINGS.offlineAfterSeconds + 5) * 1000;
    state = applyPlayerAction(state, 'beto', { type: 'heartbeat' }, later);
    state = applyPlayerAction(state, 'ana', { type: 'checkin', stop: 'b215' }, later);
    expect(state.phase).toBe('checkin');
    state = applyHostAction(state, { type: 'kick', id: 'beto' }, later);
    // caro quedó sin conexión: el grupo activo (solo ana) ya confirmó.
    expect(state.phase).toBe('play');
    expect(snapshot(state, later).kicked).toEqual(['beto']);
  });

  it('ignores duplicated scores and out-of-phase actions', () => {
    let state = setup(['ana', 'beto']);
    const score = applyPlayerAction(state, 'ana', { type: 'score', game: 'datos', score: 800, accuracy: 1 }, T0);
    expect(score.players.ana.games.datos).toBeUndefined();
    state = applyHostAction(state, { type: 'start' }, T0);
    state = applyHostAction(state, { type: 'advance' }, T0);
    const later = state.startsAt! + MIN_B215_MS + 1000;
    state = applyPlayerAction(state, 'ana', { type: 'score', game: 'red-b215', score: 700, accuracy: 1 }, later);
    state = applyPlayerAction(state, 'ana', { type: 'score', game: 'red-b215', score: 10, accuracy: 1 }, later + 1000);
    expect(state.players.ana.games['red-b215']?.score).toBe(700);
  });

  it('rejects scores that arrive faster than the game can be played, and flags impossible ones', () => {
    let state = setup(['ana', 'beto']);
    state = applyHostAction(state, { type: 'start' }, T0);
    state = applyHostAction(state, { type: 'advance' }, T0); // → play
    const startsAt = state.startsAt!;
    // A los 3 s es imposible: se ignora y se marca.
    state = applyPlayerAction(state, 'ana', { type: 'score', game: 'red-b215', score: 1000, accuracy: 1 }, startsAt + 3000);
    expect(state.players.ana.games['red-b215']).toBeUndefined();
    expect(snapshot(state, startsAt + 3000).players.find((player) => player.id === 'ana')?.flagged).toBe(true);
    // A los 15 s todavía no se acepta, pero no se marca (el teléfono reintenta).
    state = applyPlayerAction(state, 'beto', { type: 'score', game: 'red-b215', score: 800, accuracy: 1 }, startsAt + 15_000);
    expect(state.players.beto.games['red-b215']).toBeUndefined();
    expect(state.players.beto.suspect).toBeUndefined();
    // El reintento, ya pasado el mínimo, entra.
    state = applyPlayerAction(state, 'beto', { type: 'score', game: 'red-b215', score: 800, accuracy: 1 }, startsAt + MIN_B215_MS + 10);
    expect(state.players.beto.games['red-b215']?.score).toBe(800);
  });

  it('spaces the B213 projects: two games cannot finish at the same time', () => {
    let state = setup(['ana']);
    state = applyHostAction(state, { type: 'start' }, T0);
    for (let step = 0; step < 4; step += 1) state = applyHostAction(state, { type: 'advance' }, T0); // → projects
    expect(state.phase).toBe('projects');
    const opened = state.projectsAt!;
    state = applyPlayerAction(state, 'ana', { type: 'score', game: 'datos', score: 600, accuracy: 0.8 }, opened + MIN_PROJECT_MS + 1);
    state = applyPlayerAction(state, 'ana', { type: 'score', game: 'redes', score: 600, accuracy: 0.8 }, opened + MIN_PROJECT_MS + 2000);
    expect(state.players.ana.games.datos?.score).toBe(600);
    expect(state.players.ana.games.redes).toBeUndefined();
    state = applyPlayerAction(state, 'ana', { type: 'score', game: 'redes', score: 600, accuracy: 0.8 }, opened + 2 * MIN_PROJECT_MS + 10);
    expect(state.players.ana.games.redes?.score).toBe(600);
  });

  it('marks a route closed early by the stand as not completed', () => {
    let state = setup(['ana']);
    state = applyHostAction(state, { type: 'start' }, T0);
    state = applyHostAction(state, { type: 'finish' }, T0 + 1000);
    expect(state.phase).toBe('podium');
    expect(snapshot(state, T0 + 1000).completed).toBe(false);
  });

  it('removes players who leave and keeps aliases unique', () => {
    let state = createRoute('ABC234', T0, 1);
    state = join(state, 'p1', 'Cris');
    state = join(state, 'p2', 'cris');
    expect(state.players.p2.alias).toBe('cris 2');
    state = applyPlayerAction(state, 'p1', { type: 'leave' }, T0);
    expect(state.order).toEqual(['p2']);
    const taken = addPlayer(state, { id: 'p2', alias: 'X', avatar: 0, boxKey: 'otra', token: 't' }, T0);
    expect(taken.ok).toBe(false);
  });

  it('sanitizes aliases', () => {
    expect(sanitizeAlias('  <b>Ana</b>   María  ')).toBe('bAna/b María');
    expect(sanitizeAlias('')).toBe('Jugador');
    expect(sanitizeAlias('x'.repeat(40))).toHaveLength(18);
  });
});

describe('route quiz', () => {
  it('rewards speed and the first correct answers', () => {
    expect(quizPoints(0, 20_000, 1)).toBe(1000);
    expect(quizPoints(20_000, 20_000, 4)).toBe(500);
    expect(quizPoints(10_000, 20_000, 2)).toBe(500 + 150 + 120);
  });

  it('picks unique questions from every area, reproducibly', () => {
    const ids = pickQuizQuestions(99, 10);
    expect(new Set(ids).size).toBe(10);
    expect(pickQuizQuestions(99, 10)).toEqual(ids);
    const areas = new Set(ids.map((id) => getRouteQuestion(id)!.area));
    expect(areas.size).toBe(6);
  });

  it('has a well-formed question bank', () => {
    const ids = new Set<string>();
    routeQuestions.forEach((question) => {
      expect(ids.has(question.id)).toBe(false);
      ids.add(question.id);
      expect(question.options).toHaveLength(4);
      expect(new Set(question.options).size).toBe(4);
      expect(question.explanation.length).toBeGreaterThan(10);
    });
    expect(routeQuestions.length).toBeGreaterThanOrEqual(30);
  });
});

describe('route codes', () => {
  it('encodes the broker in the first character', () => {
    for (let broker = 0; broker < 3; broker += 1) {
      const code = generateRouteCode(broker, 3);
      expect(code).toMatch(new RegExp(`^[${CODE_ALPHABET}]{6}$`));
      expect(brokerIndexForCode(code, 3)).toBe(broker);
    }
  });
});
