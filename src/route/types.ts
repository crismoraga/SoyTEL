// Modelo de la Ruta Telemática en vivo: stand → B215 → B213 → pasillo.

export type RouteStop = 'stand' | 'b215' | 'b213' | 'hall';
export type CheckinStop = Exclude<RouteStop, 'stand'>;

// Listas cerradas: todo identificador que llega por la red se compara contra ellas.
export const CHECKIN_STOPS = ['b215', 'b213', 'hall'] as const satisfies readonly CheckinStop[];
export const PILLAR_IDS = ['datos', 'software', 'redes', 'teleco', 'hardware'] as const;
export const STATION_GAME_IDS = ['red-b215', ...PILLAR_IDS] as const;

export type PillarId = (typeof PILLAR_IDS)[number];
export type StationGameId = (typeof STATION_GAME_IDS)[number];

export function isCheckinStop(value: unknown): value is CheckinStop {
  return typeof value === 'string' && (CHECKIN_STOPS as readonly string[]).includes(value);
}

export function isPillarId(value: unknown): value is PillarId {
  return typeof value === 'string' && (PILLAR_IDS as readonly string[]).includes(value);
}

export function isStationGameId(value: unknown): value is StationGameId {
  return typeof value === 'string' && (STATION_GAME_IDS as readonly string[]).includes(value);
}

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
  // Ritmo de los juegos para todo el grupo (multiplica sus tiempos; 1 = ritmo rápido original).
  pace?: number;
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
  joinedAt: number;
  lastSeen: number;
  kicked: boolean;
  checkins: Partial<Record<CheckinStop, number>>;
  games: Partial<Record<StationGameId, GameScore>>;
  quizPoints: number;
  quizCorrect: number;
  answers: Record<number, QuizAnswer>;
  // Juegos cuyo puntaje llegó en un tiempo imposible (se marca para el equipo del stand).
  suspect?: Partial<Record<StationGameId, number>>;
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
  // Inicio de la fase de proyectos (B213), para validar los tiempos de cada juego.
  projectsAt?: number | null;
  // Hasta cuándo se recibe el puntaje de un proyecto que quedó abierto al partir la trivia.
  projectsCloseAt?: number | null;
  // true solo si la trivia terminó completa; false si el anfitrión cerró la ruta antes.
  completed?: boolean;
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
  answeredCount: number;
  flagged: boolean;
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
  version: 2;
  code: string;
  // Quién publica: época de conducción, instancia del stand y número de publicación. Los teléfonos
  // solo aceptan un estado más nuevo que el último (época, instancia, publicación), sin mirar relojes.
  epoch: number;
  owner: string;
  pub: number;
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
  projectsCloseAt: number | null;
  completed: boolean;
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
}

// Respuesta del anfitrión a una acción: aplicada, todavía no (el teléfono reintenta) o rechazada.
export type RejectCode = 'invalid' | 'phase' | 'closed' | 'duplicate' | 'kicked' | 'unknown';

export type ActionVerdict =
  | { status: 'accepted' }
  | { status: 'retry'; reason: 'early' }
  | { status: 'rejected'; reason: RejectCode };

export interface StationResult {
  score: number;
  accuracy: number;
}
