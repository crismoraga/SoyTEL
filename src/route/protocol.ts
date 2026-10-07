import { fromBase64 } from '@/realtime/bytes';
import { isPublicKey, openShared, sealShared, signSealed, verifySealed, type Sealed } from '@/realtime/crypto';
import {
  isCheckinStop,
  isStationGameId,
  STATION_GAME_IDS,
  type PlayerAction,
  type PublicPlayer,
  type PublicQuiz,
  type QuizArea,
  type QuizGain,
  type RejectCode,
  type RoutePhase,
  type RouteSettings,
  type RouteSnapshot,
  type RouteStop,
} from './types';

// Protocolo de la ruta sobre MQTT. El código nunca viaja en claro: de él se derivan el id de la sala
// (tópicos) y la llave que sella el saludo del stand (ver realtime/crypto).
//
// Versión 3 (ver docs/RUTA-PROTOCOLO.md):
// - Cada estado lleva época, instancia y número de publicación; solo se acepta uno más nuevo.
// - La unión prueba que es reciente (desafío del saludo) y queda atada al tópico y a la época.
// - Las acciones van selladas con una llave propia de cada participante y un contador persistente;
//   el anfitrión responde cada una (aceptada, reintentar o rechazada) cuando ya quedó guardada.

export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const PROTOCOL_VERSION = 3;
// Formato del sobre del saludo. Sigue en 2 para que una app anterior lo pueda leer: así intenta unirse,
// recibe un rechazo explícito y el stand puede avisar que ese teléfono necesita actualizarse.
export const HELLO_WIRE_VERSION = 2;

const ROOT = 'soytel/r2';

// Topes de tamaño antes de interpretar un mensaje (caracteres del texto recibido).
export const MAX_STATE_CHARS = 220_000;
export const MAX_CONTROL_CHARS = 8192;

export const MAX_SNAPSHOT_PLAYERS = 400;

const CLIENT_ID = /^[a-z][a-z0-9]{5,39}$/;
const EVENT_ID = /^[a-z0-9]{8,32}$/;
const HEX_TOKEN = /^[0-9a-f]{8,32}$/;

export function isClientId(value: unknown): value is string {
  return typeof value === 'string' && CLIENT_ID.test(value);
}

export function isEventId(value: unknown): value is string {
  return typeof value === 'string' && EVENT_ID.test(value);
}

export interface RouteTopics {
  hello: string;
  state: string;
  joinAll: string;
  upAll: string;
  join(clientId: string): string;
  up(clientId: string): string;
  dm(clientId: string): string;
}

export function routeTopics(roomId: string): RouteTopics {
  const base = `${ROOT}/${roomId}`;
  return {
    hello: `${base}/hello`,
    state: `${base}/state`,
    joinAll: `${base}/join/+`,
    upAll: `${base}/up/+`,
    join: (clientId) => `${base}/join/${clientId}`,
    up: (clientId) => `${base}/up/${clientId}`,
    dm: (clientId) => `${base}/dm/${clientId}`,
  };
}

export function topicTail(topic: string): string {
  return topic.slice(topic.lastIndexOf('/') + 1);
}

export function isRouteCode(code: unknown): code is string {
  return typeof code === 'string' && code.length === 6 && [...code].every((character) => CODE_ALPHABET.includes(character));
}

// El primer carácter del código indica en qué broker vive la ruta.
export function brokerIndexForCode(code: string, brokerCount: number): number {
  const position = CODE_ALPHABET.indexOf(code[0]);
  return position < 0 ? 0 : position % Math.max(1, brokerCount);
}

export function generateRouteCode(brokerIndex: number, brokerCount: number, random: () => number = Math.random): string {
  const count = Math.max(1, brokerCount);
  const firstOptions = [...CODE_ALPHABET].filter((_, position) => position % count === brokerIndex % count);
  let code = firstOptions[Math.floor(random() * firstOptions.length)];
  for (let i = 0; i < 5; i += 1) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return code;
}

// ——— Lectura segura de lo que llega por la red ———
// Nada de lo recibido se usa tal cual: cada mensaje se reconstruye campo por campo. Así un valor de
// otro tipo, una clave extra o `__proto__` nunca llegan al estado de la ruta.

type Fields = Record<string, unknown>;

function isPlainObject(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function field(source: Fields, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(source, key) ? source[key] : undefined;
}

function parseObject(text: string | null | undefined, maxChars: number): Fields | null {
  if (typeof text !== 'string' || text.length === 0 || text.length > maxChars) return null;
  try {
    const value: unknown = JSON.parse(text);
    return isPlainObject(value) ? value : null;
  } catch {
    return null;
  }
}

function text(value: unknown, max: number, min = 0): string | null {
  return typeof value === 'string' && value.length >= min && value.length <= max ? value : null;
}

function integer(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
}

function finite(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

function nullable<T>(value: unknown, read: (value: unknown) => T | null): { ok: true; value: T | null } | { ok: false } {
  if (value === null || value === undefined) return { ok: true, value: null };
  const parsed = read(value);
  return parsed === null ? { ok: false } : { ok: true, value: parsed };
}

// Marcas de tiempo en ms (hasta el año 2286) y contadores grandes pero seguros.
const TIME_MAX = 9_999_999_999_999;
const time = (value: unknown) => finite(value, 0, TIME_MAX);
const COUNTER_MAX = Number.MAX_SAFE_INTEGER;

function parseSealed(value: unknown, maxCipherChars: number): Sealed | null {
  if (!isPlainObject(value)) return null;
  const n = text(field(value, 'n'), 40, 8);
  const c = text(field(value, 'c'), maxCipherChars, 8);
  if (n === null || c === null) return null;
  try {
    if (fromBase64(n).length !== 24) return null;
  } catch {
    return null;
  }
  return { n, c };
}

// ——— Saludo del stand ———

export interface HelloMessage {
  v: typeof HELLO_WIRE_VERSION;
  // Versión del protocolo que habla el stand.
  proto: number;
  kind: 'soytel-route';
  box: string;
  sign: string;
  at: number;
  epoch: number;
  owner: string;
  // Valor reciente que debe repetir quien se une (cambia cada pocos segundos).
  challenge: string;
}

// El saludo va sellado con la llave derivada del código: quien no lo conoce no puede leerlo ni escribirlo.
export interface HelloEnvelope {
  v: number;
  sealed: Sealed;
  sig: string;
}

export function sealHello(hello: HelloMessage, helloKey: string, signSecretKey: string): HelloEnvelope {
  const sealed = sealShared(JSON.stringify(hello), helloKey);
  return { v: HELLO_WIRE_VERSION, sealed, sig: signSealed(sealed, signSecretKey) };
}

export type HelloResult =
  | { ok: true; hello: HelloMessage }
  // Saludo auténtico de un stand que habla otra versión: `side` dice quién debe actualizarse.
  | { ok: false; reason: 'incompatible'; side: 'host-old' | 'client-old'; sign: string }
  | { ok: false; reason: 'invalid' };

const INVALID_HELLO: HelloResult = { ok: false, reason: 'invalid' };

// Abre y verifica un saludo: cifrado con la llave del código y firmado con la llave que anuncia.
export function openHello(raw: string, helloKey: string): HelloResult {
  const envelope = parseObject(raw, MAX_CONTROL_CHARS);
  if (!envelope || field(envelope, 'v') !== HELLO_WIRE_VERSION) return INVALID_HELLO;
  const sealed = parseSealed(field(envelope, 'sealed'), 2048);
  const sig = text(field(envelope, 'sig'), 128, 16);
  if (!sealed || sig === null) return INVALID_HELLO;
  const hello = parseObject(openShared(sealed, helloKey), 2048);
  if (!hello || field(hello, 'v') !== HELLO_WIRE_VERSION || field(hello, 'kind') !== 'soytel-route') return INVALID_HELLO;
  const box = field(hello, 'box');
  const sign = field(hello, 'sign');
  if (!isPublicKey(box) || !isPublicKey(sign)) return INVALID_HELLO;
  if (!verifySealed(sealed, sig, sign)) return INVALID_HELLO;
  const proto = field(hello, 'proto');
  // Un stand con la versión 2 no anuncia `proto`.
  if (proto === undefined) return { ok: false, reason: 'incompatible', side: 'host-old', sign };
  const version = integer(proto, 1, 1000);
  if (version === null) return INVALID_HELLO;
  if (version !== PROTOCOL_VERSION) return { ok: false, reason: 'incompatible', side: version > PROTOCOL_VERSION ? 'client-old' : 'host-old', sign };
  const at = time(field(hello, 'at'));
  const epoch = integer(field(hello, 'epoch'), 1, COUNTER_MAX);
  const owner = field(hello, 'owner');
  const challenge = field(hello, 'challenge');
  if (at === null || epoch === null || typeof owner !== 'string' || !HEX_TOKEN.test(owner) || typeof challenge !== 'string' || !HEX_TOKEN.test(challenge)) {
    return INVALID_HELLO;
  }
  return { ok: true, hello: { v: HELLO_WIRE_VERSION, proto: version, kind: 'soytel-route', box, sign, at, epoch, owner, challenge } };
}

// ——— Unión ———

// Participante → anfitrión, sellado con box hacia la llave del anfitrión (solo él lo abre, y solo el
// dueño de `pk` pudo escribirlo). Dentro repite su id, la época y el desafío del saludo: una copia
// vieja o publicada en el tópico de otro participante no sirve.
export interface JoinEnvelope {
  pk: string;
  sealed: Sealed;
}

export interface JoinRequest {
  v: typeof PROTOCOL_VERSION;
  id: string;
  alias: string;
  avatar: number;
  // Identifica este intento: el anfitrión responde citándolo y no procesa dos veces el mismo.
  nonce: string;
  epoch: number;
  challenge: string;
}

export function parseJoinEnvelope(raw: string): JoinEnvelope | null {
  const envelope = parseObject(raw, MAX_CONTROL_CHARS);
  if (!envelope) return null;
  const pk = field(envelope, 'pk');
  const sealed = parseSealed(field(envelope, 'sealed'), 2048);
  return isPublicKey(pk) && sealed ? { pk, sealed } : null;
}

export type JoinParse = { kind: 'request'; request: JoinRequest } | { kind: 'legacy' } | { kind: 'invalid' };

export function parseJoinRequest(plain: string | null): JoinParse {
  const request = parseObject(plain, 2048);
  if (!request) return { kind: 'invalid' };
  // La versión 2 enviaba solo alias y avatar.
  if (field(request, 'v') === undefined && typeof field(request, 'alias') === 'string') return { kind: 'legacy' };
  if (field(request, 'v') !== PROTOCOL_VERSION) return { kind: 'invalid' };
  const id = field(request, 'id');
  const alias = text(field(request, 'alias'), 64);
  const avatar = finite(field(request, 'avatar'), -1000, 1000);
  const nonce = field(request, 'nonce');
  const epoch = integer(field(request, 'epoch'), 1, COUNTER_MAX);
  const challenge = field(request, 'challenge');
  if (!isClientId(id) || alias === null || avatar === null || epoch === null) return { kind: 'invalid' };
  if (typeof nonce !== 'string' || !HEX_TOKEN.test(nonce) || typeof challenge !== 'string' || !HEX_TOKEN.test(challenge)) return { kind: 'invalid' };
  return { kind: 'request', request: { v: PROTOCOL_VERSION, id, alias, avatar: Math.trunc(avatar), nonce, epoch, challenge } };
}

// ——— Mensajes directos del anfitrión ———

export type RejectReason = 'full' | 'finished' | 'taken' | 'kicked';

export interface AckItem {
  // Id del evento que se responde.
  e: string;
  s: 'ok' | 'retry' | 'no';
  why?: RejectCode | 'early';
}

// Anfitrión → participante, sellado con la llave que solo comparten ellos dos.
export type DirectMessage =
  | { k: 'dm'; type: 'welcome'; nonce: string; key: string; kid: number; id: string; alias: string; epoch: number }
  | { k: 'dm'; type: 'rejected'; nonce: string; reason: RejectReason }
  | { k: 'dm'; type: 'acks'; list: AckItem[] }
  | { k: 'dm'; type: 'rekey'; key: string; kid: number }
  | { k: 'dm'; type: 'kicked' };

const REJECT_REASONS: readonly RejectReason[] = ['full', 'finished', 'taken', 'kicked'];
const REJECT_CODES: readonly (RejectCode | 'early')[] = ['invalid', 'phase', 'closed', 'duplicate', 'kicked', 'unknown', 'early'];
const MAX_ACKS = 64;

function sessionKeyText(value: unknown): string | null {
  const key = text(value, 64, 40);
  if (key === null) return null;
  try {
    return fromBase64(key).length === 32 ? key : null;
  } catch {
    return null;
  }
}

export function parseSealedMessage(raw: string, maxCipherChars = MAX_CONTROL_CHARS): Sealed | null {
  const value = parseObject(raw, maxCipherChars + 256);
  return value ? parseSealed(value, maxCipherChars) : null;
}

export function parseDirect(plain: string | null): DirectMessage | null {
  const message = parseObject(plain, MAX_CONTROL_CHARS);
  if (!message || field(message, 'k') !== 'dm') return null;
  switch (field(message, 'type')) {
    case 'welcome': {
      const nonce = field(message, 'nonce');
      const key = sessionKeyText(field(message, 'key'));
      const kid = integer(field(message, 'kid'), 1, COUNTER_MAX);
      const id = field(message, 'id');
      const alias = text(field(message, 'alias'), 32, 1);
      const epoch = integer(field(message, 'epoch'), 1, COUNTER_MAX);
      if (typeof nonce !== 'string' || !HEX_TOKEN.test(nonce) || key === null || kid === null || !isClientId(id) || alias === null || epoch === null) return null;
      return { k: 'dm', type: 'welcome', nonce, key, kid, id, alias, epoch };
    }
    case 'rejected': {
      const nonce = field(message, 'nonce');
      const reason = field(message, 'reason');
      if (typeof nonce !== 'string' || !HEX_TOKEN.test(nonce) || !REJECT_REASONS.includes(reason as RejectReason)) return null;
      return { k: 'dm', type: 'rejected', nonce, reason: reason as RejectReason };
    }
    case 'acks': {
      const list = field(message, 'list');
      if (!Array.isArray(list) || list.length === 0 || list.length > MAX_ACKS) return null;
      const items: AckItem[] = [];
      for (const entry of list) {
        if (!isPlainObject(entry)) return null;
        const e = field(entry, 'e');
        const s = field(entry, 's');
        const why = field(entry, 'why');
        if (!isEventId(e) || (s !== 'ok' && s !== 'retry' && s !== 'no')) return null;
        if (why !== undefined && !REJECT_CODES.includes(why as RejectCode)) return null;
        items.push(why === undefined ? { e, s } : { e, s, why: why as RejectCode | 'early' });
      }
      return { k: 'dm', type: 'acks', list: items };
    }
    case 'rekey': {
      const key = sessionKeyText(field(message, 'key'));
      const kid = integer(field(message, 'kid'), 1, COUNTER_MAX);
      return key === null || kid === null ? null : { k: 'dm', type: 'rekey', key, kid };
    }
    case 'kicked':
      return { k: 'dm', type: 'kicked' };
    default:
      return null;
  }
}

// ——— Acciones del participante ———

// Participante → anfitrión, sellado con la llave del par (nadie más del grupo puede leerla ni imitarla).
export interface ActionPayload {
  k: 'act';
  // Contador propio del participante: crece en cada envío y no depende del reloj.
  seq: number;
  // Id estable de la acción; los reintentos lo repiten y el anfitrión la aplica una sola vez.
  e?: string;
  action: PlayerAction;
}

export function parsePlayerAction(value: unknown): PlayerAction | null {
  if (!isPlainObject(value)) return null;
  switch (field(value, 'type')) {
    case 'heartbeat':
      return { type: 'heartbeat' };
    case 'leave':
      return { type: 'leave' };
    case 'checkin': {
      const stop = field(value, 'stop');
      return isCheckinStop(stop) ? { type: 'checkin', stop } : null;
    }
    case 'score': {
      const game = field(value, 'game');
      const score = finite(field(value, 'score'), 0, 1_000_000);
      const accuracy = finite(field(value, 'accuracy'), 0, 1000);
      return isStationGameId(game) && score !== null && accuracy !== null ? { type: 'score', game, score, accuracy } : null;
    }
    case 'answer': {
      const index = integer(field(value, 'index'), 0, 255);
      const option = integer(field(value, 'option'), 0, 15);
      return index !== null && option !== null ? { type: 'answer', index, option } : null;
    }
    default:
      return null;
  }
}

export function parseActionPayload(plain: string | null): ActionPayload | null {
  const payload = parseObject(plain, 2048);
  if (!payload || field(payload, 'k') !== 'act') return null;
  const seq = integer(field(payload, 'seq'), 1, COUNTER_MAX);
  const action = parsePlayerAction(field(payload, 'action'));
  const e = field(payload, 'e');
  if (seq === null || !action) return null;
  if (e === undefined) return { k: 'act', seq, action };
  return isEventId(e) ? { k: 'act', seq, e, action } : null;
}

// ——— Estado del grupo ———

// Estado del grupo: sellado con la llave de sesión y firmado por el anfitrión. `kid` dice con qué
// llave va sellado (cambia cuando el stand quita a alguien) y también queda cubierto por la firma.
export interface StateEnvelope {
  kid: number;
  sealed: Sealed;
  sig: string;
}

export function stateSignContext(kid: number): string {
  return `soytel-state:${kid}`;
}

export function parseStateEnvelope(raw: string): StateEnvelope | null {
  const envelope = parseObject(raw, MAX_STATE_CHARS);
  if (!envelope) return null;
  const kid = integer(field(envelope, 'kid'), 1, COUNTER_MAX);
  const sealed = parseSealed(field(envelope, 'sealed'), MAX_STATE_CHARS);
  const sig = text(field(envelope, 'sig'), 128, 16);
  return kid !== null && sealed && sig !== null ? { kid, sealed, sig } : null;
}

const PHASES: readonly RoutePhase[] = ['lobby', 'checkin', 'play', 'results', 'projects', 'quiz', 'podium'];
const STOPS: readonly RouteStop[] = ['stand', 'b215', 'b213', 'hall'];
const AREAS: readonly QuizArea[] = ['redes', 'teleco', 'datos', 'software', 'hardware', 'carrera'];

function parseSettings(value: unknown): RouteSettings | null {
  if (!isPlainObject(value)) return null;
  const seconds = (key: string) => finite(field(value, key), 0, 86_400);
  const countdownSeconds = seconds('countdownSeconds');
  const b215GameSeconds = seconds('b215GameSeconds');
  const graceSeconds = seconds('graceSeconds');
  const resultsSeconds = seconds('resultsSeconds');
  const projectsSeconds = seconds('projectsSeconds');
  const quizQuestions = integer(field(value, 'quizQuestions'), 1, 64);
  const questionSeconds = seconds('questionSeconds');
  const revealSeconds = seconds('revealSeconds');
  const offlineAfterSeconds = seconds('offlineAfterSeconds');
  const pace = nullable(field(value, 'pace'), (item) => finite(item, 0.5, 5));
  if (
    countdownSeconds === null ||
    b215GameSeconds === null ||
    graceSeconds === null ||
    resultsSeconds === null ||
    projectsSeconds === null ||
    quizQuestions === null ||
    questionSeconds === null ||
    revealSeconds === null ||
    offlineAfterSeconds === null ||
    !pace.ok
  ) {
    return null;
  }
  const settings: RouteSettings = { countdownSeconds, b215GameSeconds, graceSeconds, resultsSeconds, projectsSeconds, quizQuestions, questionSeconds, revealSeconds, offlineAfterSeconds };
  if (pace.value !== null) settings.pace = pace.value;
  return settings;
}

function parsePlayer(value: unknown): PublicPlayer | null {
  if (!isPlainObject(value)) return null;
  const id = field(value, 'id');
  const alias = text(field(value, 'alias'), 32, 1);
  const avatar = integer(field(value, 'avatar'), 0, 999);
  const quizPoints = finite(field(value, 'quizPoints'), 0, 1e9);
  const quizCorrect = integer(field(value, 'quizCorrect'), 0, 1000);
  const answeredCount = integer(field(value, 'answeredCount'), 0, 1000);
  const total = finite(field(value, 'total'), 0, 1e9);
  const rank = integer(field(value, 'rank'), 1, MAX_SNAPSHOT_PLAYERS);
  const games = field(value, 'games');
  if (!isClientId(id) || alias === null || avatar === null || quizPoints === null || quizCorrect === null || answeredCount === null || total === null || rank === null || !isPlainObject(games)) {
    return null;
  }
  const scores: PublicPlayer['games'] = {};
  for (const game of STATION_GAME_IDS) {
    const raw = field(games, game);
    if (raw === undefined) continue;
    const score = finite(raw, 0, 1_000_000);
    if (score === null) return null;
    scores[game] = score;
  }
  return {
    id,
    alias,
    avatar,
    online: field(value, 'online') === true,
    checkedIn: field(value, 'checkedIn') === true,
    games: scores,
    quizPoints,
    quizCorrect,
    answered: field(value, 'answered') === true,
    answeredCount,
    flagged: field(value, 'flagged') === true,
    total,
    rank,
  };
}

function parseGain(value: unknown): QuizGain | null {
  if (!isPlainObject(value)) return null;
  const points = finite(field(value, 'points'), 0, 1e6);
  const rank = nullable(field(value, 'rank'), (item) => integer(item, 1, MAX_SNAPSHOT_PLAYERS));
  const option = nullable(field(value, 'option'), (item) => integer(item, 0, 15));
  if (points === null || !rank.ok || !option.ok) return null;
  return { points, correct: field(value, 'correct') === true, rank: rank.value, option: option.value };
}

function parseQuiz(value: unknown): PublicQuiz | null {
  if (!isPlainObject(value)) return null;
  const index = integer(field(value, 'index'), 0, 255);
  const total = integer(field(value, 'total'), 1, 256);
  const step = field(value, 'step');
  const startsAt = time(field(value, 'startsAt'));
  const endsAt = time(field(value, 'endsAt'));
  const revealUntil = time(field(value, 'revealUntil'));
  const answered = integer(field(value, 'answered'), 0, MAX_SNAPSHOT_PLAYERS);
  const question = field(value, 'question');
  if (index === null || total === null || (step !== 'question' && step !== 'reveal') || startsAt === null || endsAt === null || revealUntil === null || answered === null || !isPlainObject(question)) {
    return null;
  }
  const id = text(field(question, 'id'), 64, 1);
  const prompt = text(field(question, 'prompt'), 800, 1);
  const area = field(question, 'area');
  const options = field(question, 'options');
  if (id === null || prompt === null || !AREAS.includes(area as QuizArea) || !Array.isArray(options) || options.length < 2 || options.length > 8) return null;
  const optionTexts: string[] = [];
  for (const option of options) {
    const label = text(option, 400, 1);
    if (label === null) return null;
    optionTexts.push(label);
  }

  let reveal: PublicQuiz['reveal'] = null;
  const rawReveal = field(value, 'reveal');
  if (rawReveal !== null && rawReveal !== undefined) {
    if (!isPlainObject(rawReveal)) return null;
    const correct = integer(field(rawReveal, 'correct'), 0, optionTexts.length - 1);
    const explanation = text(field(rawReveal, 'explanation'), 1200);
    const counts = field(rawReveal, 'counts');
    const gains = field(rawReveal, 'gains');
    if (correct === null || explanation === null || !Array.isArray(counts) || counts.length !== optionTexts.length || !isPlainObject(gains)) return null;
    const countValues: number[] = [];
    for (const count of counts) {
      const amount = integer(count, 0, MAX_SNAPSHOT_PLAYERS);
      if (amount === null) return null;
      countValues.push(amount);
    }
    const gainEntries: [string, QuizGain][] = [];
    for (const key of Object.keys(gains)) {
      if (!isClientId(key) || gainEntries.length >= MAX_SNAPSHOT_PLAYERS) return null;
      const gain = parseGain(gains[key]);
      if (!gain) return null;
      gainEntries.push([key, gain]);
    }
    reveal = { correct, counts: countValues, explanation, gains: Object.fromEntries(gainEntries) };
  }
  return { index, total, step, startsAt, endsAt, revealUntil, question: { id, prompt, options: optionTexts, area: area as QuizArea }, answered, reveal };
}

// Reconstruye un estado recibido. Devuelve null si cualquier campo no es exactamente lo esperado.
export function parseSnapshot(plain: string | null): RouteSnapshot | null {
  const value = parseObject(plain, MAX_STATE_CHARS);
  if (!value || field(value, 'version') !== 2) return null;
  const code = field(value, 'code');
  const epoch = integer(field(value, 'epoch'), 1, COUNTER_MAX);
  const owner = field(value, 'owner');
  const pub = integer(field(value, 'pub'), 1, COUNTER_MAX);
  const rev = integer(field(value, 'rev'), 1, COUNTER_MAX);
  const now = time(field(value, 'now'));
  const phase = field(value, 'phase');
  const stop = field(value, 'stop');
  const phaseAt = time(field(value, 'phaseAt'));
  const startsAt = nullable(field(value, 'startsAt'), time);
  const deadline = nullable(field(value, 'deadline'), time);
  const finishedAt = nullable(field(value, 'finishedAt'), time);
  const projectsCloseAt = nullable(field(value, 'projectsCloseAt'), time);
  const settings = parseSettings(field(value, 'settings'));
  const players = field(value, 'players');
  const kicked = field(value, 'kicked');
  if (!isRouteCode(code) || epoch === null || typeof owner !== 'string' || !HEX_TOKEN.test(owner) || pub === null || rev === null || now === null || phaseAt === null) return null;
  if (!PHASES.includes(phase as RoutePhase) || !STOPS.includes(stop as RouteStop)) return null;
  if (!startsAt.ok || !deadline.ok || !finishedAt.ok || !projectsCloseAt.ok || !settings) return null;
  if (!Array.isArray(players) || players.length > MAX_SNAPSHOT_PLAYERS || !Array.isArray(kicked) || kicked.length > MAX_SNAPSHOT_PLAYERS) return null;

  const list: PublicPlayer[] = [];
  const seen = new Set<string>();
  for (const entry of players) {
    const player = parsePlayer(entry);
    if (!player || seen.has(player.id)) return null;
    seen.add(player.id);
    list.push(player);
  }
  const kickedIds: string[] = [];
  for (const id of kicked) {
    if (!isClientId(id)) return null;
    kickedIds.push(id);
  }
  const rawQuiz = field(value, 'quiz');
  let quiz: PublicQuiz | null = null;
  if (rawQuiz !== null && rawQuiz !== undefined) {
    quiz = parseQuiz(rawQuiz);
    if (!quiz) return null;
  }
  return {
    version: 2,
    code,
    epoch,
    owner,
    pub,
    rev,
    now,
    phase: phase as RoutePhase,
    stop: stop as RouteStop,
    phaseAt,
    startsAt: startsAt.value,
    deadline: deadline.value,
    players: list,
    quiz,
    settings,
    finishedAt: finishedAt.value,
    projectsCloseAt: projectsCloseAt.value,
    completed: field(value, 'completed') === true,
    kicked: kickedIds,
  };
}

// Orden total de las publicaciones: época de conducción, instancia del stand y contador.
export interface Stamp {
  epoch: number;
  owner: string;
  pub: number;
}

export function compareAuthority(a: { epoch: number; owner: string }, b: { epoch: number; owner: string }): number {
  if (a.epoch !== b.epoch) return a.epoch < b.epoch ? -1 : 1;
  if (a.owner === b.owner) return 0;
  return a.owner < b.owner ? -1 : 1;
}

export function isNewerStamp(candidate: Stamp, current: Stamp | null): boolean {
  if (!current) return true;
  const authority = compareAuthority(candidate, current);
  return authority > 0 || (authority === 0 && candidate.pub > current.pub);
}
