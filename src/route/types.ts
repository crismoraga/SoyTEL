// Modelo de la Ruta Telemática en vivo: stand → B215 → B213 → pasillo.

export type RouteStop = 'stand' | 'b215' | 'b213' | 'hall';
export type CheckinStop = Exclude<RouteStop, 'stand'>;

export type PillarId = 'datos' | 'software' | 'redes' | 'teleco' | 'hardware';
export type StationGameId = 'red-b215' | PillarId;

export type RoutePhase = 'lobby' | 'checkin' | 'play' | 'results' | 'projects' | 'quiz' | 'podium';

export type QuizArea = 'redes' | 'teleco' | 'datos' | 'software' | 'hardware' | 'carrera';

export interface RouteSettings {
  countdownSeconds: number;
  b215GameSeconds: number;
  graceSeconds: number;
  resultsSeconds: number;
  projectsSeconds: number;
  quizQuestions: number;
  questionSeconds: number;
  revealSeconds: number;
  offlineAfterSeconds: number;
}

export interface GameScore {
  score: number;
  accuracy: number;
  at: number;
}

export interface QuizAnswer {
  option: number;
  at: number;
  points: number;
  correct: boolean;
  rank: number | null;
}

export interface PlayerRecord {
  id: string;
  alias: string;
  avatar: number;
  boxKey: string;
  token: string;
  joinedAt: number;
  lastSeen: number;
  kicked: boolean;
  checkins: Partial<Record<CheckinStop, number>>;
  games: Partial<Record<StationGameId, GameScore>>;
  quizPoints: number;
  quizCorrect: number;
  answers: Record<number, QuizAnswer>;
}

export interface QuizState {
  questionIds: string[];
  index: number;
  step: 'question' | 'reveal';
  startsAt: number;
  endsAt: number;
  revealUntil: number;
}

export interface RouteState {
  version: 1;
  code: string;
  createdAt: number;
  seed: number;
  rev: number;
  phase: RoutePhase;
  stop: RouteStop;
  phaseAt: number;
  startsAt: number | null;
  deadline: number | null;
  players: Record<string, PlayerRecord>;
  order: string[];
  quiz: QuizState | null;
  settings: RouteSettings;
  finishedAt: number | null;
}

export interface PublicPlayer {
  id: string;
  alias: string;
  avatar: number;
  online: boolean;
  checkedIn: boolean;
  games: Partial<Record<StationGameId, number>>;
  quizPoints: number;
  quizCorrect: number;
  answered: boolean;
  total: number;
  rank: number;
}

export interface PublicQuestion {
  id: string;
  prompt: string;
  options: string[];
  area: QuizArea;
}

export interface QuizGain {
  points: number;
  correct: boolean;
  rank: number | null;
  option: number | null;
}

export interface QuizReveal {
  correct: number;
  counts: number[];
  explanation: string;
  gains: Record<string, QuizGain>;
}

export interface PublicQuiz {
  index: number;
  total: number;
  step: 'question' | 'reveal';
  startsAt: number;
  endsAt: number;
  revealUntil: number;
  question: PublicQuestion;
  answered: number;
  reveal: QuizReveal | null;
}

export interface RouteSnapshot {
  version: 1;
  code: string;
  rev: number;
  now: number;
  phase: RoutePhase;
  stop: RouteStop;
  phaseAt: number;
  startsAt: number | null;
  deadline: number | null;
  players: PublicPlayer[];
  quiz: PublicQuiz | null;
  settings: RouteSettings;
  finishedAt: number | null;
  kicked: string[];
}

export type PlayerAction =
  | { type: 'heartbeat' }
  | { type: 'checkin'; stop: CheckinStop }
  | { type: 'score'; game: StationGameId; score: number; accuracy: number }
  | { type: 'answer'; index: number; option: number }
  | { type: 'leave' };

export type HostAction = { type: 'start' } | { type: 'advance' } | { type: 'kick'; id: string } | { type: 'finish' };

export interface NewPlayer {
  id: string;
  alias: string;
  avatar: number;
  boxKey: string;
  token: string;
}

export interface StationResult {
  score: number;
  accuracy: number;
}
