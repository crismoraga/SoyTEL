import { pillarIds } from './content';
import { getRouteQuestion, routeQuestions, type RouteQuestion } from './quizBank';
import { mulberry32, seededShuffle } from './random';
import type {
  CheckinStop,
  HostAction,
  NewPlayer,
  PlayerAction,
  PlayerRecord,
  PublicPlayer,
  PublicQuiz,
  QuizArea,
  QuizGain,
  RouteSettings,
  RouteSnapshot,
  RouteState,
  StationGameId,
} from './types';

// Motor autoritativo de la ruta. Lo ejecuta el dispositivo del stand; es puro y determinista.

export const DEFAULT_SETTINGS: RouteSettings = {
  countdownSeconds: 5,
  b215GameSeconds: 120,
  graceSeconds: 12,
  resultsSeconds: 14,
  projectsSeconds: 15 * 60,
  quizQuestions: 10,
  questionSeconds: 20,
  revealSeconds: 8,
  offlineAfterSeconds: 45,
};

export const MAX_PLAYERS = 60;
export const MAX_GAME_SCORE = 1000;
// Bonos para los tres primeros en responder bien cada pregunta.
export const QUIZ_FIRST_BONUS = [200, 120, 60];
const QUIZ_BASE = 500;
const QUIZ_SPEED = 300;
const NEXT_QUESTION_DELAY = 1500;

export function createRoute(code: string, now: number, seed: number, settings: RouteSettings = DEFAULT_SETTINGS): RouteState {
  return {
    version: 1,
    code,
    createdAt: now,
    seed,
    rev: 1,
    phase: 'lobby',
    stop: 'stand',
    phaseAt: now,
    startsAt: null,
    deadline: null,
    players: {},
    order: [],
    quiz: null,
    settings,
    finishedAt: null,
  };
}

function bump(state: RouteState, patch: Partial<RouteState>): RouteState {
  return { ...state, ...patch, rev: state.rev + 1 };
}

function withPlayer(state: RouteState, player: PlayerRecord): RouteState {
  return { ...state, players: { ...state.players, [player.id]: player } };
}

export function sanitizeAlias(alias: string): string {
  const clean = alias
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 18)
    .trim();
  return clean || 'Jugador';
}

export function playerTotal(player: PlayerRecord): number {
  const games = Object.values(player.games).reduce((sum, game) => sum + (game?.score ?? 0), 0);
  return games + player.quizPoints;
}

export function isOnline(player: PlayerRecord, now: number, settings: RouteSettings): boolean {
  return !player.kicked && now - player.lastSeen <= settings.offlineAfterSeconds * 1000;
}

export function activePlayers(state: RouteState, now: number): PlayerRecord[] {
  return state.order.map((id) => state.players[id]).filter((player) => player && isOnline(player, now, state.settings));
}

export function rankedPlayers(state: RouteState): PlayerRecord[] {
  return state.order
    .map((id) => state.players[id])
    .filter((player) => player && !player.kicked)
    .sort((a, b) => playerTotal(b) - playerTotal(a) || b.quizCorrect - a.quizCorrect || a.joinedAt - b.joinedAt);
}

export type JoinResult = { state: RouteState; ok: true } | { state: RouteState; ok: false; reason: 'full' | 'finished' | 'taken' | 'kicked' };

export function addPlayer(state: RouteState, incoming: NewPlayer, now: number): JoinResult {
  const existing = state.players[incoming.id];
  if (existing) {
    if (existing.boxKey !== incoming.boxKey) return { state, ok: false, reason: 'taken' };
    if (existing.kicked) return { state, ok: false, reason: 'kicked' };
    return { state: withPlayer(state, { ...existing, lastSeen: now }), ok: true };
  }
  if (state.phase === 'podium') return { state, ok: false, reason: 'finished' };
  if (state.order.filter((id) => !state.players[id]?.kicked).length >= MAX_PLAYERS) return { state, ok: false, reason: 'full' };

  const base = sanitizeAlias(incoming.alias);
  const taken = new Set(Object.values(state.players).map((player) => player.alias.toLowerCase()));
  let alias = base;
  for (let suffix = 2; taken.has(alias.toLowerCase()); suffix += 1) alias = `${base.slice(0, 15)} ${suffix}`;

  const player: PlayerRecord = {
    id: incoming.id,
    alias,
    avatar: Math.max(0, Math.floor(incoming.avatar) || 0),
    boxKey: incoming.boxKey,
    token: incoming.token,
    joinedAt: now,
    lastSeen: now,
    kicked: false,
    checkins: {},
    games: {},
    quizPoints: 0,
    quizCorrect: 0,
    answers: {},
  };
  const next = bump(withPlayer(state, player), { order: [...state.order, player.id] });
  return { state: next, ok: true };
}

// ——— Transiciones ———

function toCheckin(state: RouteState, stop: CheckinStop, now: number): RouteState {
  return bump(state, { phase: 'checkin', stop, phaseAt: now, startsAt: null, deadline: null });
}

function toPlay(state: RouteState, now: number): RouteState {
  const startsAt = now + state.settings.countdownSeconds * 1000;
  const deadline = startsAt + (state.settings.b215GameSeconds + state.settings.graceSeconds) * 1000;
  return bump(state, { phase: 'play', stop: 'b215', phaseAt: now, startsAt, deadline });
}

function toResults(state: RouteState, now: number): RouteState {
  return bump(state, { phase: 'results', stop: 'b215', phaseAt: now, startsAt: null, deadline: now + state.settings.resultsSeconds * 1000 });
}

function toProjects(state: RouteState, now: number): RouteState {
  return bump(state, { phase: 'projects', stop: 'b213', phaseAt: now, startsAt: null, deadline: now + state.settings.projectsSeconds * 1000 });
}

export function pickQuizQuestions(seed: number, count: number, bank: RouteQuestion[] = routeQuestions): string[] {
  const random = mulberry32(seed ^ 0x9e3779b9);
  const byArea = new Map<QuizArea, RouteQuestion[]>();
  bank.forEach((question) => byArea.set(question.area, [...(byArea.get(question.area) ?? []), question]));
  const queues = seededShuffle([...byArea.values()], random).map((items) => seededShuffle(items, random));
  const picked: string[] = [];
  // Reparte las preguntas entre áreas para que la trivia cubra todo lo visto.
  while (picked.length < Math.min(count, bank.length)) {
    for (const queue of queues) {
      const question = queue.shift();
      if (question && picked.length < count) picked.push(question.id);
    }
  }
  return seededShuffle(picked, random);
}

function toQuiz(state: RouteState, now: number): RouteState {
  const startsAt = now + state.settings.countdownSeconds * 1000;
  return bump(state, {
    phase: 'quiz',
    stop: 'hall',
    phaseAt: now,
    startsAt: null,
    deadline: null,
    quiz: {
      questionIds: pickQuizQuestions(state.seed, state.settings.quizQuestions),
      index: 0,
      step: 'question',
      startsAt,
      endsAt: startsAt + state.settings.questionSeconds * 1000,
      revealUntil: 0,
    },
  });
}

function toPodium(state: RouteState, now: number): RouteState {
  return bump(state, { phase: 'podium', stop: 'hall', phaseAt: now, startsAt: null, deadline: null, finishedAt: now });
}

export function quizPoints(elapsedMs: number, totalMs: number, rank: number): number {
  const ratio = Math.min(1, Math.max(0, elapsedMs / totalMs));
  return QUIZ_BASE + Math.round(QUIZ_SPEED * (1 - ratio)) + (QUIZ_FIRST_BONUS[rank - 1] ?? 0);
}

function revealQuestion(state: RouteState, now: number): RouteState {
  const quiz = state.quiz;
  if (!quiz || quiz.step !== 'question') return state;
  const question = getRouteQuestion(quiz.questionIds[quiz.index]);
  const totalMs = state.settings.questionSeconds * 1000;
  const correct = Object.values(state.players)
    .filter((player) => !player.kicked && player.answers[quiz.index]?.option === question?.answer)
    .sort((a, b) => a.answers[quiz.index].at - b.answers[quiz.index].at);
  const ranks = new Map(correct.map((player, position) => [player.id, position + 1]));

  const players = { ...state.players };
  Object.values(state.players).forEach((player) => {
    const answer = player.answers[quiz.index];
    if (!answer) return;
    const rank = ranks.get(player.id) ?? null;
    const points = rank ? quizPoints(answer.at - quiz.startsAt, totalMs, rank) : 0;
    players[player.id] = {
      ...player,
      quizPoints: player.quizPoints + points,
      quizCorrect: player.quizCorrect + (rank ? 1 : 0),
      answers: { ...player.answers, [quiz.index]: { ...answer, points, correct: Boolean(rank), rank } },
    };
  });
  return bump(state, { players, quiz: { ...quiz, step: 'reveal', revealUntil: now + state.settings.revealSeconds * 1000 } });
}

function nextQuestion(state: RouteState, now: number): RouteState {
  const quiz = state.quiz;
  if (!quiz) return state;
  if (quiz.index + 1 >= quiz.questionIds.length) return toPodium(state, now);
  const startsAt = now + NEXT_QUESTION_DELAY;
  return bump(state, {
    quiz: { ...quiz, index: quiz.index + 1, step: 'question', startsAt, endsAt: startsAt + state.settings.questionSeconds * 1000, revealUntil: 0 },
  });
}

// Avanza cuando todo el grupo activo cumplió la condición de la fase actual.
export function advanceIfReady(state: RouteState, now: number): RouteState {
  const active = activePlayers(state, now);
  if (active.length === 0) return state;
  switch (state.phase) {
    case 'checkin': {
      const stop = state.stop as CheckinStop;
      if (!active.every((player) => player.checkins[stop])) return state;
      if (stop === 'b215') return toPlay(state, now);
      if (stop === 'b213') return toProjects(state, now);
      return toQuiz(state, now);
    }
    case 'play':
      return active.every((player) => player.games['red-b215']) ? toResults(state, now) : state;
    case 'projects':
      return active.every((player) => pillarIds.every((id) => player.games[id])) ? toCheckin(state, 'hall', now) : state;
    case 'quiz': {
      const quiz = state.quiz;
      if (!quiz || quiz.step !== 'question') return state;
      return active.every((player) => player.answers[quiz.index]) ? revealQuestion(state, now) : state;
    }
    default:
      return state;
  }
}

// Vencimientos de tiempo; se llama periódicamente desde el anfitrión.
export function tick(state: RouteState, now: number): RouteState {
  let next = state;
  if (next.phase === 'play' && next.deadline !== null && now >= next.deadline) next = toResults(next, now);
  else if (next.phase === 'results' && next.deadline !== null && now >= next.deadline) next = toCheckin(next, 'b213', now);
  else if (next.phase === 'projects' && next.deadline !== null && now >= next.deadline) next = toCheckin(next, 'hall', now);
  else if (next.phase === 'quiz' && next.quiz) {
    if (next.quiz.step === 'question' && now >= next.quiz.endsAt) next = revealQuestion(next, now);
    else if (next.quiz.step === 'reveal' && now >= next.quiz.revealUntil) next = nextQuestion(next, now);
  }
  return advanceIfReady(next, now);
}

const PROJECT_PHASES = new Set(['projects']);

function acceptsScore(state: RouteState, game: StationGameId): boolean {
  if (game === 'red-b215') return state.phase === 'play' || state.phase === 'results';
  // Se aceptan envíos tardíos mientras el grupo camina al pasillo.
  return PROJECT_PHASES.has(state.phase) || (state.phase === 'checkin' && state.stop === 'hall');
}

export function applyPlayerAction(state: RouteState, id: string, action: PlayerAction, now: number): RouteState {
  const player = state.players[id];
  if (!player || player.kicked) return state;
  const touched = withPlayer(state, { ...player, lastSeen: now });

  switch (action.type) {
    case 'heartbeat':
      return advanceIfReady(touched, now);
    case 'checkin': {
      if (state.phase !== 'checkin' || state.stop !== action.stop || player.checkins[action.stop]) return advanceIfReady(touched, now);
      const updated = bump(withPlayer(touched, { ...touched.players[id], checkins: { ...player.checkins, [action.stop]: now } }), {});
      return advanceIfReady(updated, now);
    }
    case 'score': {
      if (!acceptsScore(state, action.game) || player.games[action.game]) return advanceIfReady(touched, now);
      const score = Math.round(Math.min(MAX_GAME_SCORE, Math.max(0, Number(action.score) || 0)));
      const accuracy = Math.min(1, Math.max(0, Number(action.accuracy) || 0));
      const games = { ...player.games, [action.game]: { score, accuracy, at: now } };
      return advanceIfReady(bump(withPlayer(touched, { ...touched.players[id], games }), {}), now);
    }
    case 'answer': {
      const quiz = state.quiz;
      const question = quiz ? getRouteQuestion(quiz.questionIds[quiz.index]) : undefined;
      const valid =
        state.phase === 'quiz' &&
        quiz &&
        question &&
        quiz.step === 'question' &&
        action.index === quiz.index &&
        !player.answers[quiz.index] &&
        Number.isInteger(action.option) &&
        action.option >= 0 &&
        action.option < question.options.length &&
        now >= quiz.startsAt - 500 &&
        now <= quiz.endsAt + 1500;
      if (!valid || !quiz) return advanceIfReady(touched, now);
      const answers = { ...player.answers, [quiz.index]: { option: action.option, at: Math.max(now, quiz.startsAt), points: 0, correct: false, rank: null } };
      return advanceIfReady(bump(withPlayer(touched, { ...touched.players[id], answers }), {}), now);
    }
    case 'leave': {
      const players = { ...state.players };
      delete players[id];
      return advanceIfReady(bump(state, { players, order: state.order.filter((item) => item !== id) }), now);
    }
    default:
      return state;
  }
}

export function applyHostAction(state: RouteState, action: HostAction, now: number): RouteState {
  switch (action.type) {
    case 'start':
      return state.phase === 'lobby' && rankedPlayers(state).length > 0 ? toCheckin(state, 'b215', now) : state;
    case 'kick': {
      const player = state.players[action.id];
      if (!player || player.kicked) return state;
      return advanceIfReady(bump(withPlayer(state, { ...player, kicked: true }), {}), now);
    }
    case 'finish':
      return state.phase === 'lobby' || state.phase === 'podium' ? state : toPodium(state, now);
    case 'advance':
      switch (state.phase) {
        case 'lobby':
          return rankedPlayers(state).length > 0 ? toCheckin(state, 'b215', now) : state;
        case 'checkin':
          if (state.stop === 'b215') return toPlay(state, now);
          if (state.stop === 'b213') return toProjects(state, now);
          return toQuiz(state, now);
        case 'play':
          return toResults(state, now);
        case 'results':
          return toCheckin(state, 'b213', now);
        case 'projects':
          return toCheckin(state, 'hall', now);
        case 'quiz':
          return state.quiz?.step === 'question' ? revealQuestion(state, now) : nextQuestion(state, now);
        default:
          return state;
      }
    default:
      return state;
  }
}

export function snapshot(state: RouteState, now: number): RouteSnapshot {
  const ranked = rankedPlayers(state);
  const quiz = state.quiz;
  const checkinStop = state.phase === 'checkin' ? (state.stop as CheckinStop) : null;

  const players: PublicPlayer[] = ranked.map((player, index) => ({
    id: player.id,
    alias: player.alias,
    avatar: player.avatar,
    online: isOnline(player, now, state.settings),
    checkedIn: checkinStop ? Boolean(player.checkins[checkinStop]) : false,
    games: Object.fromEntries(Object.entries(player.games).map(([game, value]) => [game, value?.score ?? 0])),
    quizPoints: player.quizPoints,
    quizCorrect: player.quizCorrect,
    answered: quiz ? Boolean(player.answers[quiz.index]) : false,
    total: playerTotal(player),
    rank: index + 1,
  }));

  let publicQuiz: PublicQuiz | null = null;
  if (quiz && state.phase === 'quiz') {
    const question = getRouteQuestion(quiz.questionIds[quiz.index]);
    if (question) {
      const answeredPlayers = ranked.filter((player) => player.answers[quiz.index]);
      let reveal: PublicQuiz['reveal'] = null;
      if (quiz.step === 'reveal') {
        const counts = question.options.map(() => 0);
        const gains: Record<string, QuizGain> = {};
        ranked.forEach((player) => {
          const answer = player.answers[quiz.index];
          if (answer) counts[answer.option] += 1;
          gains[player.id] = answer
            ? { points: answer.points, correct: answer.correct, rank: answer.rank, option: answer.option }
            : { points: 0, correct: false, rank: null, option: null };
        });
        reveal = { correct: question.answer, counts, explanation: question.explanation, gains };
      }
      publicQuiz = {
        index: quiz.index,
        total: quiz.questionIds.length,
        step: quiz.step,
        startsAt: quiz.startsAt,
        endsAt: quiz.endsAt,
        revealUntil: quiz.revealUntil,
        question: { id: question.id, prompt: question.prompt, options: [...question.options], area: question.area },
        answered: answeredPlayers.length,
        reveal,
      };
    }
  }

  return {
    version: 1,
    code: state.code,
    rev: state.rev,
    now,
    phase: state.phase,
    stop: state.stop,
    phaseAt: state.phaseAt,
    startsAt: state.startsAt,
    deadline: state.deadline,
    players,
    quiz: publicQuiz,
    settings: state.settings,
    finishedAt: state.finishedAt,
    kicked: state.order.filter((id) => state.players[id]?.kicked),
  };
}
