import { brokerAuth, brokerUrls, webAppUrl } from '@/realtime/config';
import {
  deriveRouteSecrets,
  keyFingerprint,
  newBoxKeys,
  newSessionKey,
  newSignKeys,
  openFrom,
  openShared,
  pairKey,
  randomHex,
  sealShared,
  signSealed,
  verificationCode,
  verifySealed,
  type RouteSecrets,
} from '@/realtime/crypto';
import { MqttClient } from '@/realtime/mqttClient';
import { Budget, RecentSet, systemClock, type RouteClock } from './clock';
import { addPlayer, applyHostAction, createRoute, DEFAULT_SETTINGS, ownPlayer, resumeRoute, snapshot, submitPlayerAction, tick } from './engine';
import { LocalRouteLink, MultiRouteLink, type BrokerState, type LinkStatus, type LocalBus, type RouteLink } from './link';
import {
  compareAuthority,
  generateRouteCode,
  HELLO_WIRE_VERSION,
  isClientId,
  openHello,
  parseActionPayload,
  parseJoinEnvelope,
  parseJoinRequest,
  parseSealedMessage,
  parseSnapshot,
  parseStateEnvelope,
  PROTOCOL_VERSION,
  routeTopics,
  sealHello,
  stateSignContext,
  topicTail,
  type AckItem,
  type DirectMessage,
  type HelloMessage,
  type RouteTopics,
  type StateEnvelope,
} from './protocol';
import { deviceHostStore, deviceLocks, FencedError, ROUTE_RECORD_VERSION, type HostLock, type HostLockProvider, type HostRecord, type HostStore } from './storage';
import type { ActionVerdict, HostAction, RouteSettings, RouteSnapshot, RouteState } from './types';

// 'driver' conduce la ruta (única autoridad); 'observer' solo la muestra (otra pantalla la conduce).
export type HostRole = 'idle' | 'driver' | 'observer';

// 'failing': un guardado falló y se reintenta (nada se confirma hasta lograrlo).
// 'volatile': el dispositivo no puede guardar; la ruta sigue, pero se pierde si se cierra la pantalla.
export type HostStorageState = 'ok' | 'failing' | 'volatile';

export interface HostView {
  code: string;
  state: RouteState;
  snapshot: RouteSnapshot;
  link: LinkStatus;
  // Servidores listos y total: la ruta funciona mientras quede al menos uno.
  brokersOnline: number;
  brokerCount: number;
  joinUrl: string;
  role: HostRole;
  readOnly: boolean;
  solo: boolean;
  storage: HostStorageState;
  // Código corto que el teléfono del participante muestra para confirmar que se unió a este stand.
  verification: string;
  // Otro dispositivo publicó un saludo con este código hace poco (posible suplantación).
  impostor: boolean;
  // Hace poco intentó unirse un teléfono con una versión anterior de la app.
  legacyClient: boolean;
}

// Contadores para diagnóstico (sin llaves, alias ni identificadores de personas).
export interface HostCounters {
  published: number;
  saves: number;
  saveFailures: number;
  joinsAccepted: number;
  joinsRejected: number;
  joinsStale: number;
  joinsReplayed: number;
  joinsThrottled: number;
  actionsAccepted: number;
  actionsRejected: number;
  actionsRetry: number;
  actionsReplayed: number;
  actionsInvalid: number;
  fenced: number;
  lastSaveMs: number;
}

// Estado de la conexión y del guardado para mostrar o copiar (sin llaves, alias ni el código de la ruta).
export interface HostDiagnostics {
  protocol: number;
  role: HostRole;
  link: LinkStatus;
  broker: number;
  brokers: number;
  // Servidores con conexión lista (el stand publica y escucha en todos a la vez).
  brokersOnline: number;
  brokerStates: LinkStatus[];
  epoch: number;
  publications: number;
  storage: HostStorageState;
  phase: RouteState['phase'];
  players: number;
  online: number;
  counters: HostCounters;
}

export interface HostOptions {
  solo?: boolean;
  autoStart?: boolean;
  clock?: RouteClock;
  // null: la ruta vive solo en memoria (modo individual y pruebas).
  store?: HostStore | null;
  locks?: HostLockProvider | null;
  // Identificador de la pestaña/proceso que conduce.
  owner?: string;
}

const TICK_MS = 500;
const HEARTBEAT_MS = 5000;
const HELLO_MS = 15_000;
const FAILOVER_MS = 25_000;
const DENIED_FAILOVER_MS = 3000;
const IMPOSTOR_WINDOW_MS = 120_000;
const REASSERT_MS = 2000;
// Mientras haya un impostor activo, el saludo propio se repite seguido: así quien se une con el código
// escrito ve ambos saludos dentro de su ventana de espera y no se une a ninguno.
const IMPOSTOR_HELLO_MS = 1500;
// El desafío del saludo cambia cada pocos segundos y vale por un rato corto: una unión capturada deja
// de servir en menos de un minuto.
const CHALLENGE_MS = 10_000;
const CHALLENGE_TTL_MS = 45_000;
const HELLO_MIN_GAP_MS = 1000;
const JOIN_MEMORY_MS = 120_000;
// Solicitudes de unión que se intentan abrir por segundo (acota el costo de una inundación de basura).
const JOIN_OPEN_BURST = 120;
const JOIN_OPEN_PER_SECOND = 60;
// Firmas ajenas (saludos y estados) que se verifican por segundo.
const VERIFY_BURST = 40;
const VERIFY_PER_SECOND = 20;
// Tope de contadores de envío guardados de participantes que ya no están en la ruta.
const SEQS_LIMIT = 2000;
// Uniones de participantes nuevos: ráfaga de 30 y luego 5 por segundo.
const JOIN_BURST = 30;
const JOIN_PER_SECOND = 5;
const VERDICTS_PER_PLAYER = 48;
const SAVE_RETRY_MS = [500, 1500, 4000];
const VOLATILE_AFTER = 3;
const SEQ_SAVE_MS = 30_000;
// Pausa mínima del stand para correr los plazos al retomar.
const RESUME_MIN_MS = 15_000;
const LEGACY_NOTICE_MS = 90_000;

// Identificador de esta pestaña/proceso para la concesión de la ruta.
const OWNER = randomHex(6);

// Comprueba que el broker sirva de verdad: conecta, se suscribe (con confirmación) y recibe su propio
// mensaje. Devuelve cuánto tardó (ms) o null si no sirve.
export function measureBroker(url: string, timeoutMs = 7000): Promise<number | null> {
  const startedAt = Date.now();
  return probeBroker(url, timeoutMs).then((reachable) => (reachable ? Date.now() - startedAt : null));
}

export function probeBroker(url: string, timeoutMs = 7000): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const topic = `soytel/probe/${randomHex(8)}`;
    const client = new MqttClient({
      url,
      clientId: `stp${randomHex(8)}`,
      username: brokerAuth.username,
      password: brokerAuth.password,
      connectTimeoutMs: timeoutMs,
    });
    let settled = false;
    const finish = (reachable: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.close();
      resolve(reachable);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    client.onStatus = (status) => {
      if (status === 'online') client.publish(topic, 'ping', { qos: 1 });
      else if (status === 'denied') finish(false);
    };
    client.onMessage = (incoming) => {
      if (incoming === topic) finish(true);
    };
    client.subscribe(topic, 1);
    client.connect();
  });
}

// Prueba todos los brokers a la vez y devuelve el más rápido que funciona, o null si ninguno responde.
// El stand se conecta a todos; este solo decide cuál va en el código (por dónde parten los teléfonos).
export async function findReachableBroker(timeoutMs = 7000, urls: string[] = brokerUrls): Promise<number | null> {
  const times = await Promise.all(urls.map((url) => measureBroker(url, timeoutMs)));
  let best: number | null = null;
  times.forEach((time, index) => {
    if (time !== null && (best === null || time < (times[best] as number))) best = index;
  });
  return best;
}

export class RouteUnavailableError extends Error {
  constructor(readonly reason: 'no-broker' | 'storage') {
    super(`route-${reason}`);
    this.name = 'RouteUnavailableError';
  }
}

export function newHostRecord(code: string, clientId: string, brokerIndex: number, settings: Partial<RouteSettings>, now: number, owner: string): HostRecord {
  return {
    v: ROUTE_RECORD_VERSION,
    code,
    clientId,
    brokerIndex,
    boxKeys: newBoxKeys(),
    signKeys: newSignKeys(),
    sessionKey: newSessionKey(),
    keyId: 1,
    epoch: 0,
    owner,
    state: createRoute(code, now, parseInt(randomHex(4), 16), { ...DEFAULT_SETTINGS, ...settings }),
    seqs: {},
    verdicts: {},
    savedAt: now,
  };
}

function ackFor(eventId: string, verdict: ActionVerdict): AckItem {
  if (verdict.status === 'accepted') return { e: eventId, s: 'ok' };
  if (verdict.status === 'retry') return { e: eventId, s: 'retry', why: verdict.reason };
  return { e: eventId, s: 'no', why: verdict.reason };
}

export class HostController {
  readonly code: string;
  readonly solo: boolean;
  private record: HostRecord;
  private link: RouteLink;
  private clock: RouteClock;
  private store: HostStore | null;
  private locks: HostLockProvider | null;
  private owner: string;
  private secrets: RouteSecrets;
  private topics: RouteTopics;
  private role: HostRole = 'idle';
  private starting = false;
  private lock: HostLock | null = null;
  private autoStart: boolean;
  private listeners = new Set<() => void>();
  private view: HostView;
  private timers: ReturnType<typeof setInterval>[] = [];
  private cleanups: (() => void)[] = [];
  // Hora del stand: la del equipo al tomar el control más el tiempo monótono transcurrido.
  private anchor: { wall: number; mono: number };

  // Publicación
  private pub = 0;
  private lastHelloMono = -Infinity;
  private challenges: { value: string; mono: number }[] = [];
  private liveKey: { key: string; kid: number };

  // Durabilidad: lo último guardado es lo único que se publica y se confirma.
  private durableState: RouteState;
  private saving = false;
  private dirty = false;
  private afterSave: (() => void)[] = [];
  private saveFailures = 0;
  private storage: HostStorageState = 'ok';
  private seqsDirtySince: number | null = null;
  private waiters: ReturnType<typeof setTimeout>[] = [];

  // Uniones
  private joinOpens: Budget;
  private verifications: Budget;
  // Sobres de estado ya vistos (los propios al publicarlos): no se vuelven a verificar.
  private seenStates = new RecentSet(512);
  private joinNonces = new Map<string, { clientId: string; reply: string; mono: number }>();
  private joinTokens = JOIN_BURST;
  private joinRefillMono = 0;
  private legacyMono = -Infinity;

  // Otras pantallas con la misma ruta
  private observed: RouteSnapshot | null = null;
  private observedAnchor: { wall: number; mono: number } | null = null;
  private lastReloadMono = -Infinity;
  private impostorMono = -Infinity;
  private lastReassertMono = -Infinity;
  private offlineSince: number | null = null;

  private counters: HostCounters = {
    published: 0,
    saves: 0,
    saveFailures: 0,
    joinsAccepted: 0,
    joinsRejected: 0,
    joinsStale: 0,
    joinsReplayed: 0,
    joinsThrottled: 0,
    actionsAccepted: 0,
    actionsRejected: 0,
    actionsRetry: 0,
    actionsReplayed: 0,
    actionsInvalid: 0,
    fenced: 0,
    lastSaveMs: 0,
  };

  constructor(record: HostRecord, link: RouteLink, options: HostOptions = {}) {
    this.record = record;
    this.code = record.code;
    this.link = link;
    this.solo = Boolean(options.solo);
    this.autoStart = Boolean(options.autoStart);
    this.clock = options.clock ?? systemClock;
    this.store = options.store === undefined ? (this.solo ? null : deviceHostStore) : options.store;
    this.locks = options.locks === undefined ? (this.solo ? null : deviceLocks) : options.locks;
    this.owner = options.owner ?? OWNER;
    this.secrets = deriveRouteSecrets(record.code);
    this.topics = routeTopics(this.secrets.roomId);
    this.anchor = { wall: Math.max(this.clock.now(), record.savedAt), mono: this.clock.mono() };
    this.durableState = record.state;
    this.liveKey = { key: record.sessionKey, kid: record.keyId };
    this.joinOpens = new Budget(JOIN_OPEN_BURST, JOIN_OPEN_PER_SECOND, this.clock);
    this.verifications = new Budget(VERIFY_BURST, VERIFY_PER_SECOND, this.clock);
    this.view = this.buildView();
  }

  static async create(settings: Partial<RouteSettings> = {}): Promise<HostController> {
    const brokerIndex = await findReachableBroker();
    if (brokerIndex === null) throw new RouteUnavailableError('no-broker');
    const code = generateRouteCode(brokerIndex, brokerUrls.length);
    const record = newHostRecord(code, `sth${randomHex(9)}`, brokerIndex, settings, Date.now(), OWNER);
    try {
      await deviceHostStore.save(record);
    } catch {
      throw new RouteUnavailableError('storage');
    }
    return new HostController(record, new MultiRouteLink(record.clientId, brokerIndex, false));
  }

  static fromRecord(record: HostRecord): HostController {
    return new HostController(record, new MultiRouteLink(record.clientId, record.brokerIndex, false));
  }

  // Ruta sobre un enlace dado (bus local del modo individual y pruebas).
  static createWithLink(link: RouteLink, settings: Partial<RouteSettings> = {}, options: HostOptions = {}): HostController {
    const clock = options.clock ?? systemClock;
    const code = generateRouteCode(link.brokerIndex, link.brokerCount);
    const record = newHostRecord(code, `loc${randomHex(6)}`, link.brokerIndex, settings, clock.now(), options.owner ?? OWNER);
    return new HostController(record, link, options);
  }

  // Ruta local en memoria para jugar sin conexión (un solo participante, se inicia sola).
  static createSolo(bus: LocalBus, settings: Partial<RouteSettings> = {}): HostController {
    return HostController.createWithLink(new LocalRouteLink(bus), settings, { solo: true, autoStart: true });
  }

  // Huella de la llave de firma (va en el QR; el participante solo acepta el saludo que calza).
  get fingerprint(): string {
    return keyFingerprint(this.record.signKeys.publicKey);
  }

  get joinUrl(): string {
    return `${webAppUrl}/ruta?codigo=${this.code}&k=${this.fingerprint}`;
  }

  get epoch(): number {
    return this.record.epoch;
  }

  getCounters(): HostCounters {
    return { ...this.counters };
  }

  getDiagnostics(): HostDiagnostics {
    const snap = this.view.snapshot;
    return {
      protocol: PROTOCOL_VERSION,
      role: this.role,
      link: this.link.status,
      broker: this.link.brokerIndex,
      brokers: this.link.brokerCount,
      brokersOnline: this.brokerStates().filter((item) => item.status === 'online').length,
      brokerStates: this.brokerStates().map((item) => item.status),
      epoch: this.role === 'observer' && this.observed ? this.observed.epoch : this.record.epoch,
      publications: this.pub,
      storage: this.storage,
      phase: snap.phase,
      players: snap.players.length,
      online: snap.players.filter((player) => player.online).length,
      counters: { ...this.counters },
    };
  }

  // Copia de lo que se guardaría ahora (pruebas y diagnóstico interno; contiene llaves).
  exportRecord(): HostRecord {
    return { ...this.record, state: this.durableState, savedAt: this.clock.now() };
  }

  // Hora del stand. No retrocede aunque alguien cambie la hora del equipo. Una pantalla en solo
  // lectura usa la de quien conduce (la del último estado recibido más el tiempo transcurrido).
  now(): number {
    const anchor = this.role === 'observer' && this.observedAnchor ? this.observedAnchor : this.anchor;
    return Math.round(anchor.wall + (this.clock.mono() - anchor.mono));
  }

  async start(force = false): Promise<void> {
    if (this.role !== 'idle' || this.starting) return;
    this.starting = true;
    try {
      if (this.locks) {
        // Candado exclusivo: si otra pestaña conduce la ruta, esta solo la muestra.
        const lock = await this.locks.acquire(this.code, this.owner, { steal: force, onLost: () => this.loseControl() });
        if (!lock) {
          this.observe();
          return;
        }
        this.lock = lock;
      }
      await this.drive();
    } finally {
      this.starting = false;
    }
  }

  // Toma la conducción: parte de lo último guardado, sube la época y la deja escrita antes de publicar.
  private async drive(): Promise<void> {
    if (this.store) {
      const latest = await this.store.load(this.code).catch(() => null);
      if (latest && (latest.epoch > this.record.epoch || latest.state.rev >= this.record.state.rev)) this.record = latest;
    }
    const wall = Math.max(this.clock.now(), this.record.savedAt);
    this.anchor = { wall, mono: this.clock.mono() };
    const downtime = wall - this.record.savedAt;
    this.record = {
      ...this.record,
      state: resumeRoute(this.record.state, downtime > RESUME_MIN_MS ? downtime : 0, wall),
      epoch: Math.max(this.record.epoch, this.observed?.epoch ?? 0) + 1,
      owner: this.owner,
      savedAt: wall,
    };
    this.liveKey = { key: this.record.sessionKey, kid: this.record.keyId };
    if (this.store) {
      try {
        await this.store.save(this.record);
        this.counters.saves += 1;
      } catch (error) {
        if (error instanceof FencedError) {
          this.counters.fenced += 1;
          this.lock?.release();
          this.lock = null;
          this.observe();
          return;
        }
        // Sin poder guardar, la ruta sigue pero avisando: se pierde si se cierra esta pantalla.
        this.counters.saveFailures += 1;
        this.storage = 'volatile';
      }
    }
    this.durableState = this.record.state;
    this.pub = 0;
    this.role = 'driver';
    this.attach();
    this.timers.push(setInterval(() => this.onTick(), TICK_MS));
    this.timers.push(
      setInterval(() => {
        if (this.link.status === 'online') this.publishState();
        // La presencia cambia con el tiempo aunque nadie envíe nada.
        this.refresh();
      }, HEARTBEAT_MS),
    );
    this.publishHello();
    this.publishState();
    this.refresh();
  }

  // Solo lectura: sigue lo que publica la pantalla que conduce.
  private observe() {
    this.role = 'observer';
    this.attach();
    this.refresh();
  }

  private attach() {
    if (this.cleanups.length > 0) return;
    this.cleanups.push(
      this.link.onMessage((topic, text) => this.onMessage(topic, text)),
      this.link.onStatus((status) => this.onLinkStatus(status)),
      this.link.onBrokerChange((index) => {
        if (this.role !== 'driver') return;
        this.record.brokerIndex = index;
        this.commit();
      }),
    );
    this.link.subscribe(this.topics.joinAll);
    this.link.subscribe(this.topics.upAll);
    this.link.subscribe(this.topics.hello);
    this.link.subscribe(this.topics.state);
    this.link.start();
  }

  stop(save = true): void {
    const wasDriving = this.role === 'driver';
    this.role = 'idle';
    this.timers.forEach((timer) => clearInterval(timer));
    this.timers = [];
    this.waiters.forEach((timer) => clearTimeout(timer));
    this.waiters = [];
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups = [];
    this.afterSave = [];
    if (save && wasDriving && this.store) void this.store.save({ ...this.record, savedAt: this.clock.now() }).catch(() => undefined);
    this.lock?.release();
    this.lock = null;
    this.link.stop();
    this.refresh();
  }

  // Otra pantalla tomó el control: esta deja de publicar y de guardar, y pasa a mostrar lo que publique la otra.
  private loseControl() {
    if (this.role !== 'driver') return;
    this.counters.fenced += 1;
    this.role = 'observer';
    this.timers.forEach((timer) => clearInterval(timer));
    this.timers = [];
    this.waiters.forEach((timer) => clearTimeout(timer));
    this.waiters = [];
    this.afterSave = [];
    this.dirty = false;
    this.lock?.release();
    this.lock = null;
    this.refresh();
  }

  nudge(): void {
    this.link.nudge();
  }

  dispatch(action: HostAction): void {
    if (this.role !== 'driver') return;
    const before = this.record.state;
    const next = applyHostAction(before, action, this.now());
    if (next === before) return;
    if (action.type !== 'kick') {
      this.apply(next);
      return;
    }
    // Quien fue quitado conserva la llave de sesión anterior: se cambia para que no lea lo que sigue.
    const removed = ownPlayer(next, action.id);
    this.record.sessionKey = newSessionKey();
    this.record.keyId += 1;
    const fresh = { key: this.record.sessionKey, kid: this.record.keyId };
    const recipients = next.order.flatMap((id) => {
      const player = ownPlayer(next, id);
      return player && !player.kicked ? [player] : [];
    });
    this.apply(next, () => {
      this.liveKey = fresh;
      if (removed) this.sendDirect(removed.id, removed.boxKey, { k: 'dm', type: 'kicked' });
      recipients.forEach((player) => this.sendDirect(player.id, player.boxKey, { k: 'dm', type: 'rekey', key: fresh.key, kid: fresh.kid }));
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getView(): HostView {
    return this.view;
  }

  private stamp() {
    return { epoch: this.record.epoch, owner: this.owner, pub: Math.max(1, this.pub) };
  }

  private brokerStates(): BrokerState[] {
    return this.link.brokers ?? [{ index: this.link.brokerIndex, status: this.link.status }];
  }

  private buildView(): HostView {
    const mono = this.clock.mono();
    const state = this.record.state;
    return {
      code: this.code,
      state,
      snapshot: this.role === 'observer' && this.observed ? this.observed : snapshot(state, this.now(), this.stamp()),
      link: this.link.status,
      brokersOnline: this.brokerStates().filter((item) => item.status === 'online').length,
      brokerCount: this.link.brokerCount,
      joinUrl: this.joinUrl,
      role: this.role,
      readOnly: this.role === 'observer',
      solo: this.solo,
      storage: this.storage,
      verification: verificationCode(this.record.signKeys.publicKey),
      impostor: mono - this.impostorMono < IMPOSTOR_WINDOW_MS,
      legacyClient: mono - this.legacyMono < LEGACY_NOTICE_MS,
    };
  }

  private refresh() {
    this.view = this.buildView();
    this.listeners.forEach((listener) => listener());
  }

  // Cambia el estado. Si la revisión avanzó, `effect` (confirmaciones, bienvenidas) y la publicación
  // esperan a que el cambio quede guardado; si no hubo cambio durable, `effect` corre de inmediato.
  private apply(next: RouteState, effect?: () => void) {
    const previous = this.record.state;
    this.record.state = next;
    if (next.rev !== previous.rev) {
      if (effect) this.afterSave.push(effect);
      this.commit();
    } else {
      effect?.();
    }
    if (next !== previous) this.refresh();
  }

  private commit() {
    this.dirty = true;
    if (!this.saving) void this.saveLoop();
  }

  // Lo que se guarda no crece sin fin: las respuestas de quienes ya no están se descartan, y de los
  // contadores de envío de ausentes se conservan solo los más recientes (evitan repetir sus mensajes).
  private trimRecord() {
    const players = this.record.state.players;
    const present = (id: string) => Object.prototype.hasOwnProperty.call(players, id);
    const verdictIds = Object.keys(this.record.verdicts);
    if (verdictIds.some((id) => !present(id))) this.record.verdicts = Object.fromEntries(verdictIds.filter(present).map((id) => [id, this.record.verdicts[id]]));
    const seqIds = Object.keys(this.record.seqs);
    if (seqIds.length > SEQS_LIMIT) {
      const absent = seqIds.filter((id) => !present(id));
      const drop = new Set(absent.slice(0, seqIds.length - SEQS_LIMIT));
      this.record.seqs = Object.fromEntries(seqIds.filter((id) => !drop.has(id)).map((id) => [id, this.record.seqs[id]]));
    }
  }

  private pause(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((item) => item !== timer);
        resolve();
      }, ms);
      this.waiters.push(timer);
    });
  }

  private async saveLoop(): Promise<void> {
    this.saving = true;
    try {
      while (this.dirty && this.role === 'driver') {
        this.dirty = false;
        const effects = this.afterSave.splice(0);
        const state = this.record.state;
        this.trimRecord();
        let saved = true;
        if (this.store) {
          const startedAt = this.clock.mono();
          try {
            const savedAt = this.clock.now();
            await this.store.save({ ...this.record, state, savedAt });
            this.record.savedAt = savedAt;
            this.counters.saves += 1;
            this.counters.lastSaveMs = Math.round(this.clock.mono() - startedAt);
          } catch (error) {
            if (error instanceof FencedError) {
              this.loseControl();
              return;
            }
            saved = false;
            this.counters.saveFailures += 1;
          }
        } else {
          // Sin almacenamiento (modo individual): un respiro para juntar los cambios del mismo instante.
          await Promise.resolve();
        }
        if (this.role !== 'driver') return;
        if (saved) {
          this.saveFailures = 0;
          this.storage = 'ok';
          this.seqsDirtySince = null;
        } else {
          this.saveFailures += 1;
          if (this.saveFailures < VOLATILE_AFTER) {
            // No se confirma ni se publica nada que no esté guardado: se reintenta.
            this.afterSave.unshift(...effects);
            this.dirty = true;
            this.storage = 'failing';
            this.refresh();
            await this.pause(SAVE_RETRY_MS[Math.min(this.saveFailures - 1, SAVE_RETRY_MS.length - 1)]);
            continue;
          }
          this.storage = 'volatile';
        }
        this.durableState = state;
        effects.forEach((effect) => effect());
        this.publishState();
        this.refresh();
      }
    } finally {
      this.saving = false;
    }
  }

  private onTick() {
    if (this.role !== 'driver') return;
    this.checkFailover();
    const mono = this.clock.mono();
    if (mono - this.impostorMono < IMPOSTOR_WINDOW_MS && mono - this.lastHelloMono > IMPOSTOR_HELLO_MS) this.publishHello();
    this.apply(tick(this.record.state, this.now()));
    // Los contadores de envío cambian con cada latido: se guardan cada tanto aunque no cambie el estado.
    if (this.seqsDirtySince !== null && mono - this.seqsDirtySince > SEQ_SAVE_MS) this.commit();
    this.pruneJoinMemory(mono);
  }

  // Si el broker no responde por un rato (o rechaza al stand), la ruta se muda al siguiente.
  private checkFailover() {
    if (this.solo) return;
    const status = this.link.status;
    if (status === 'online') {
      this.offlineSince = null;
      return;
    }
    const mono = this.clock.mono();
    if (this.offlineSince === null) {
      this.offlineSince = mono;
      return;
    }
    if (mono - this.offlineSince > (status === 'denied' ? DENIED_FAILOVER_MS : FAILOVER_MS)) {
      this.offlineSince = mono;
      this.link.moveToNextBroker();
    }
  }

  private onLinkStatus(status: LinkStatus) {
    if (status === 'online') {
      this.offlineSince = null;
      if (this.role === 'driver') {
        this.publishHello();
        this.publishState();
      }
    } else if (this.offlineSince === null) {
      this.offlineSince = this.clock.mono();
    }
    this.refresh();
  }

  private publishHello() {
    if (this.role !== 'driver') return;
    const mono = this.clock.mono();
    this.challenges = this.challenges.filter((item) => mono - item.mono <= CHALLENGE_TTL_MS);
    if (this.challenges.length === 0 || mono - this.challenges[0].mono >= CHALLENGE_MS) this.challenges.unshift({ value: randomHex(8), mono });
    const hello: HelloMessage = {
      v: HELLO_WIRE_VERSION,
      proto: PROTOCOL_VERSION,
      kind: 'soytel-route',
      box: this.record.boxKeys.publicKey,
      sign: this.record.signKeys.publicKey,
      at: this.now(),
      epoch: this.record.epoch,
      owner: this.owner,
      challenge: this.challenges[0].value,
    };
    this.lastHelloMono = mono;
    const envelope = sealHello(hello, this.secrets.helloKey, this.record.signKeys.secretKey);
    this.link.publish(this.topics.hello, JSON.stringify(envelope), { retain: true });
  }

  private helloSoon() {
    if (this.clock.mono() - this.lastHelloMono > HELLO_MIN_GAP_MS) this.publishHello();
  }

  // Publica el último estado guardado (nunca uno que todavía no esté en disco).
  private publishState() {
    if (this.role !== 'driver') return;
    const mono = this.clock.mono();
    if (mono - this.lastHelloMono >= HELLO_MS) this.publishHello();
    // La presencia (última señal de cada participante) no cambia la revisión y no necesita guardarse.
    const state = this.record.state.rev === this.durableState.rev ? this.record.state : this.durableState;
    this.pub += 1;
    const sealed = sealShared(JSON.stringify(snapshot(state, this.now(), this.stamp())), this.liveKey.key);
    this.seenStates.add(sealed.n);
    const envelope: StateEnvelope = { kid: this.liveKey.kid, sealed, sig: signSealed(sealed, this.record.signKeys.secretKey, stateSignContext(this.liveKey.kid)) };
    this.link.publish(this.topics.state, JSON.stringify(envelope), { retain: true });
    this.counters.published += 1;
  }

  private sendDirect(clientId: string, boxKey: string, message: DirectMessage) {
    const text = this.sealDirect(boxKey, message);
    if (text) this.link.publish(this.topics.dm(clientId), text, { qos: 1 });
  }

  private sealDirect(boxKey: string, message: unknown): string | null {
    const key = pairKey(boxKey, this.record.boxKeys.secretKey);
    return key ? JSON.stringify(sealShared(JSON.stringify(message), key)) : null;
  }

  private onMessage(topic: string, text: string) {
    if (topic === this.topics.state) {
      this.onPublishedState(text);
      return;
    }
    if (this.role !== 'driver') return;
    if (topic === this.topics.hello) {
      this.onForeignHello(text);
      return;
    }
    const clientId = topicTail(topic);
    if (!isClientId(clientId)) return;
    if (topic === this.topics.join(clientId)) this.onJoin(clientId, text);
    else if (topic === this.topics.up(clientId)) this.onAction(clientId, text);
  }

  // Un saludo con otras llaves en esta sala: alguien intenta hacerse pasar por el stand.
  // Se vuelve a publicar el saludo propio (queda como el retenido) y se avisa en pantalla.
  private onForeignHello(text: string) {
    if (!this.verifications.take()) return;
    const result = openHello(text, this.secrets.helloKey);
    if (!result.ok && result.reason === 'invalid') return;
    const sign = result.ok ? result.hello.sign : result.sign;
    if (sign === this.record.signKeys.publicKey) return;
    const mono = this.clock.mono();
    this.impostorMono = mono;
    if (mono - this.lastReassertMono > REASSERT_MS) {
      this.lastReassertMono = mono;
      this.publishHello();
    }
    this.refresh();
  }

  // Estados publicados con las llaves de esta ruta. Quien conduce los usa para saber si otra pantalla
  // tomó el control (época mayor); quien observa, para mostrar la ruta en vivo.
  private onPublishedState(text: string) {
    const envelope = parseStateEnvelope(text);
    // El eco de lo que esta misma pantalla publicó, o una copia de algo ya visto: nada que hacer.
    if (!envelope || this.seenStates.has(envelope.sealed.n) || !this.verifications.take()) return;
    if (!verifySealed(envelope.sealed, envelope.sig, this.record.signKeys.publicKey, stateSignContext(envelope.kid))) return;
    this.seenStates.add(envelope.sealed.n);
    const key = envelope.kid === this.liveKey.kid ? this.liveKey.key : envelope.kid === this.record.keyId ? this.record.sessionKey : null;
    if (!key) {
      // Sellado con una llave que esta pantalla no tiene: otra instancia cambió la llave después.
      if (envelope.kid > this.record.keyId) {
        if (this.role === 'driver') this.loseControl();
        this.reloadRecord();
      }
      return;
    }
    const snap = parseSnapshot(openShared(envelope.sealed, key));
    if (!snap || snap.code !== this.code) return;
    if (this.role === 'driver') {
      const authority = compareAuthority(snap, { epoch: this.record.epoch, owner: this.owner });
      if (authority > 0) {
        this.observed = snap;
        this.observedAnchor = { wall: snap.now, mono: this.clock.mono() };
        this.loseControl();
      } else if (authority < 0) {
        // Una pantalla que quedó atrás sigue publicando: se reafirma el estado vigente.
        const mono = this.clock.mono();
        if (mono - this.lastReassertMono > REASSERT_MS) {
          this.lastReassertMono = mono;
          this.publishHello();
          this.publishState();
        }
      }
      return;
    }
    if (this.role !== 'observer') return;
    const current = this.observed;
    if (current) {
      const authority = compareAuthority(snap, current);
      if (authority < 0 || (authority === 0 && snap.pub <= current.pub)) return;
    }
    this.observed = snap;
    this.observedAnchor = { wall: snap.now, mono: this.clock.mono() };
    this.refresh();
  }

  // Quien observa relee lo guardado por la pantalla que conduce (misma ruta, mismo dispositivo).
  private reloadRecord() {
    if (!this.store) return;
    const mono = this.clock.mono();
    if (mono - this.lastReloadMono < 2000) return;
    this.lastReloadMono = mono;
    void this.store
      .load(this.code)
      .then((latest) => {
        if (!latest || this.role !== 'observer' || latest.keyId <= this.record.keyId) return;
        this.record = latest;
        this.liveKey = { key: latest.sessionKey, kid: latest.keyId };
      })
      .catch(() => undefined);
  }

  private takeJoinToken(mono: number): boolean {
    const elapsed = Math.max(0, mono - this.joinRefillMono);
    this.joinTokens = Math.min(JOIN_BURST, this.joinTokens + (elapsed / 1000) * JOIN_PER_SECOND);
    this.joinRefillMono = mono;
    if (this.joinTokens < 1) return false;
    this.joinTokens -= 1;
    return true;
  }

  private pruneJoinMemory(mono: number) {
    if (this.joinNonces.size > 0) {
      this.joinNonces.forEach((entry, nonce) => {
        if (mono - entry.mono > JOIN_MEMORY_MS) this.joinNonces.delete(nonce);
      });
    }
  }

  private onJoin(clientId: string, text: string) {
    const mono = this.clock.mono();
    // Tope global antes de gastar criptografía. No es por participante: así nadie puede bloquear la
    // unión de otro publicando basura en su tópico.
    if (!this.joinOpens.take()) {
      this.counters.joinsThrottled += 1;
      return;
    }
    const envelope = parseJoinEnvelope(text);
    if (!envelope) return;
    const parsed = parseJoinRequest(openFrom(envelope.sealed, envelope.pk, this.record.boxKeys.secretKey));
    if (parsed.kind === 'legacy') {
      // Una app con el protocolo anterior: se le responde en su formato para que no quede esperando.
      this.legacyMono = mono;
      const reply = this.sealDirect(envelope.pk, { type: 'rejected', reason: 'version' });
      if (reply) this.link.publish(this.topics.dm(clientId), reply, { qos: 1 });
      this.refresh();
      return;
    }
    if (parsed.kind !== 'request') return;
    const request = parsed.request;
    // La solicitud debe venir por el tópico de quien la firma.
    if (request.id !== clientId) return;
    // Y responder al saludo vigente: una copia vieja no sirve.
    if (request.epoch !== this.record.epoch || !this.challenges.some((item) => item.value === request.challenge && mono - item.mono <= CHALLENGE_TTL_MS)) {
      this.counters.joinsStale += 1;
      this.helloSoon();
      return;
    }
    const known = this.joinNonces.get(request.nonce);
    if (known) {
      // Mismo intento otra vez (reenvío o copia): se repite la respuesta, sin tocar nada más.
      this.counters.joinsReplayed += 1;
      if (known.clientId === clientId) this.link.publish(this.topics.dm(clientId), known.reply, { qos: 1 });
      return;
    }
    const current = this.record.state;
    const now = this.now();
    if (!ownPlayer(current, clientId) && !this.takeJoinToken(mono)) {
      this.counters.joinsThrottled += 1;
      return;
    }
    let result = addPlayer(current, { id: clientId, alias: request.alias, avatar: request.avatar, boxKey: envelope.pk }, now);
    if (result.ok && this.autoStart && result.state.phase === 'lobby') {
      result = { ...result, state: applyHostAction(result.state, { type: 'start' }, now) };
    }
    const player = result.ok ? ownPlayer(result.state, clientId) : undefined;
    const message: DirectMessage =
      result.ok && player
        ? { k: 'dm', type: 'welcome', nonce: request.nonce, key: this.record.sessionKey, kid: this.record.keyId, id: clientId, alias: player.alias, epoch: this.record.epoch }
        : { k: 'dm', type: 'rejected', nonce: request.nonce, reason: result.ok ? 'full' : result.reason };
    const reply = this.sealDirect(envelope.pk, message);
    if (!reply) return;
    if (result.ok) this.counters.joinsAccepted += 1;
    else this.counters.joinsRejected += 1;
    this.joinNonces.set(request.nonce, { clientId, reply, mono });
    const returning = result.state.rev === current.rev;
    // La bienvenida sale cuando el participante ya quedó guardado.
    this.apply(result.state, () => this.link.publish(this.topics.dm(clientId), reply, { qos: 1 }));
    // Quien vuelve (recupera su lugar o la llave) recibe el estado vigente enseguida, sin esperar el próximo latido.
    if (returning && result.ok) this.publishState();
  }

  private knownVerdict(clientId: string, eventId: string): AckItem | undefined {
    const mine = Object.prototype.hasOwnProperty.call(this.record.verdicts, clientId) ? this.record.verdicts[clientId] : undefined;
    return mine && Object.prototype.hasOwnProperty.call(mine, eventId) ? mine[eventId] : undefined;
  }

  private rememberVerdict(clientId: string, ack: AckItem) {
    const mine = Object.prototype.hasOwnProperty.call(this.record.verdicts, clientId) ? this.record.verdicts[clientId] : {};
    const entries = [...Object.entries(mine).filter(([eventId]) => eventId !== ack.e), [ack.e, ack] as [string, AckItem]].slice(-VERDICTS_PER_PLAYER);
    this.record.verdicts = { ...this.record.verdicts, [clientId]: Object.fromEntries(entries) };
  }

  private onAction(clientId: string, text: string) {
    const player = ownPlayer(this.record.state, clientId);
    if (!player) return;
    const sealed = parseSealedMessage(text, 4096);
    const key = pairKey(player.boxKey, this.record.boxKeys.secretKey);
    if (!sealed || !key) return;
    const payload = parseActionPayload(openShared(sealed, key));
    if (!payload) {
      this.counters.actionsInvalid += 1;
      return;
    }
    // El contador solo avanza: una copia de un envío anterior (o uno que llega desordenado) no hace nada.
    const last = Object.prototype.hasOwnProperty.call(this.record.seqs, clientId) ? this.record.seqs[clientId] : 0;
    if (payload.seq <= last) {
      this.counters.actionsReplayed += 1;
      return;
    }
    this.record.seqs = { ...this.record.seqs, [clientId]: payload.seq };
    if (this.seqsDirtySince === null) this.seqsDirtySince = this.clock.mono();

    const eventId = payload.e;
    const now = this.now();
    if (eventId) {
      const known = this.knownVerdict(clientId, eventId);
      if (known) {
        // Reintento de algo ya resuelto: misma respuesta, sin aplicarlo otra vez.
        if (!player.kicked) this.apply({ ...this.record.state, players: { ...this.record.state.players, [clientId]: { ...player, lastSeen: now } } });
        this.sendDirect(clientId, player.boxKey, { k: 'dm', type: 'acks', list: [known] });
        return;
      }
    }
    const { state, verdict } = submitPlayerAction(this.record.state, clientId, payload.action, now);
    if (!eventId) {
      // Latidos: solo renuevan la señal de vida.
      this.apply(state);
      return;
    }
    if (verdict.status === 'accepted') this.counters.actionsAccepted += 1;
    else if (verdict.status === 'retry') this.counters.actionsRetry += 1;
    else this.counters.actionsRejected += 1;
    const ack = ackFor(eventId, verdict);
    if (verdict.status !== 'retry') this.rememberVerdict(clientId, ack);
    // La confirmación sale cuando el cambio ya está guardado.
    this.apply(state, () => this.sendDirect(clientId, player.boxKey, { k: 'dm', type: 'acks', list: [ack] }));
  }
}
