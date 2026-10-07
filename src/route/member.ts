import { brokerUrls } from '@/realtime/config';
import { deriveRouteSecrets, keyFingerprint, newBoxKeys, openShared, pairKey, randomHex, sealShared, sealTo, verificationCode, verifySealed, type RouteSecrets } from '@/realtime/crypto';
import { Budget, RecentSet, systemClock, type RouteClock } from './clock';
import { HostController } from './host';
import { LocalBus, LocalRouteLink, MqttRouteLink, type LinkStatus, type RouteLink } from './link';
import {
  brokerIndexForCode,
  compareAuthority,
  isNewerStamp,
  isRouteCode,
  openHello,
  parseDirect,
  parseSealedMessage,
  parseSnapshot,
  parseStateEnvelope,
  PROTOCOL_VERSION,
  routeTopics,
  stateSignContext,
  type AckItem,
  type ActionPayload,
  type HelloMessage,
  type JoinRequest,
  type RejectReason,
  type RouteTopics,
  type Stamp,
} from './protocol';
import { deviceMemberStore, ROUTE_RECORD_VERSION, type MemberCredentials, type MemberStore, type OutboxRecord, type OutboxState } from './storage';
import { deviceTabs, type TabClaim, type TabGuard } from './tabs';
import type { CheckinStop, PlayerAction, PublicPlayer, RouteSettings, RouteSnapshot, StationGameId } from './types';

// 'unreachable': se conoce al stand pero no responde en ningún servidor.
// 'incompatible': el stand o este teléfono usan otra versión de la app.
// 'elsewhere': la ruta sigue en otra pestaña de este navegador; esta quedó desconectada.
export type MemberStatus = 'idle' | 'connecting' | 'joining' | 'joined' | 'rejected' | 'not-found' | 'kicked' | 'conflict' | 'unreachable' | 'incompatible' | 'elsewhere';

export interface OutboxView {
  state: OutboxState;
  reason?: string;
}

export interface MemberView {
  status: MemberStatus;
  code: string | null;
  alias: string;
  avatar: number;
  snapshot: RouteSnapshot | null;
  me: PublicPlayer | null;
  offset: number;
  link: LinkStatus;
  rejection: RejectReason | null;
  solo: boolean;
  // Acciones enviadas que el stand aún no responde.
  pending: string[];
  // Estado de cada acción (clave → en cola, enviada, aceptada, rechazada o vencida).
  outbox: Record<string, OutboxView>;
  // Código de 4 caracteres del stand al que se unió (debe coincidir con el de la pantalla del stand).
  verification: string | null;
  // Apareció otro "stand" con el mismo código después de unirse.
  warning: 'impostor' | null;
  // Quién debe actualizar la app cuando las versiones no calzan.
  incompatible: 'host-old' | 'client-old' | null;
  // Hora local del último estado aceptado del stand (0 si aún no llega ninguno).
  lastStateAt: number;
  // Llegan estados recientes del stand.
  hostAlive: boolean;
  // 'failing': no se pudo guardar en el teléfono (la partida sigue, pero no se retoma al reabrir).
  storage: 'ok' | 'failing';
}

// Datos para diagnóstico: sin llaves, alias ni códigos.
export interface MemberDiagnostics {
  status: MemberStatus;
  link: LinkStatus;
  brokerIndex: number | null;
  hostAlive: boolean;
  lastStateAgeMs: number | null;
  mark: Stamp | null;
  queued: number;
  sent: number;
  accepted: number;
  rejected: number;
  expired: number;
  joinsSent: number;
  statesAccepted: number;
  statesIgnored: number;
  storage: 'ok' | 'failing';
}

export interface MemberOptions {
  clock?: RouteClock;
  // null: nada se guarda (pruebas).
  store?: MemberStore | null;
  // Coordinación entre pestañas del navegador (null: no hay otras, como en Android/iOS).
  tabs?: TabGuard | null;
}

const JOIN_RETRY_MS = 3000;
const JOIN_MIN_GAP_MS = 900;
// Cuánto se espera en un servidor antes de probar el siguiente: para lograr la conexión, y, ya
// conectado, para que llegue el saludo del stand (lo tiene guardado el servidor: llega enseguida).
const CONNECT_WAIT_MS = 9000;
const HELLO_WAIT_MS = 5000;
// Al unirse con el código escrito (sin QR) se escuchan los saludos un momento antes de confiar en uno:
// si aparecen dos stands distintos con el mismo código, no se elige ninguno.
const HELLO_SETTLE_MS = 2000;
// Con el stand ya identificado: cuánto se espera su bienvenida en un servidor antes de buscarlo en el siguiente.
const JOIN_BROKER_MS = 14_000;
// Si de él solo se vio un saludo guardado por el servidor (pudo quedar de antes de mudarse), se espera menos.
const JOIN_STALE_BROKER_MS = 6000;
const HOST_LIVE_MS = 20_000;
const STALE_MS = 20_000;
const HEARTBEAT_MS = 10_000;
const RETRY_MS = 2500;
const RETRY_MAX_MS = 8000;
// Llega un estado del stand que aún no muestra una acción enviada hace más que esto: se reenvía ya.
// El stand está vivo, así que lo más probable es que el envío se perdió (su conexión o la del teléfono
// parpadeó). Es lo que antes hacía una sesión guardada en el servidor, sin depender de él.
const RESEND_ON_STATE_MS = 1000;
// El stand se anuncia en vivo (lo hace al reconectar con un servidor): lo pendiente se reenvía enseguida.
const RESEND_ON_HELLO_MS = 300;
const REJOIN_GAP_MS = 3000;
// Un estado sellado con una llave nueva: se espera este rato el mensaje que la trae antes de pedirla.
const UNKNOWN_KEY_GRACE_MS = 1500;
const LEAVE_WAIT_MS = 1500;
// Si entre dos estados pasó más que esto, se perdió al menos un latido del stand (publica cada 5 s):
// hubo un corte, así que lo pendiente se reenvía de inmediato en vez de esperar el próximo reintento.
const STATE_GAP_MS = 7000;
// Ya dentro de la ruta: si la conexión con el servidor lleva este tiempo caída, se busca por los demás
// (el stand está en todos, así que cambiar es barato y no se pierde nada).
const OFFLINE_ROTATE_MS = 3000;
const DENIED_MOVE_MS = 1500;
const MARK_SAVE_MS = 30_000;
const SEQ_BLOCK = 64;
// Firmas del stand (saludos y estados) que se verifican por segundo.
const VERIFY_BURST = 40;
const VERIFY_PER_SECOND = 20;
// Una ruta guardada hace más de este tiempo ya terminó: no se intenta retomar.
export const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const LATE_SCORE_SLACK_MS = 3000;

interface OutboxEntry extends OutboxRecord {
  lastSentMono: number;
  attempts: number;
  // El stand pidió esperar (aún no corresponde): se reintenta solo por tiempo, sin apurar.
  deferred?: boolean;
}

function pendingKey(action: PlayerAction): string | null {
  switch (action.type) {
    case 'checkin':
      return `checkin:${action.stop}`;
    case 'score':
      return `score:${action.game}`;
    case 'answer':
      return `answer:${action.index}`;
    case 'leave':
      return 'leave';
    default:
      return null;
  }
}

// ¿El estado del anfitrión ya muestra la acción?
function isReflected(action: PlayerAction, snap: RouteSnapshot, me: PublicPlayer | null): boolean {
  if (!me) return false;
  switch (action.type) {
    case 'checkin':
      return snap.phase === 'checkin' && snap.stop === action.stop && me.checkedIn;
    case 'score':
      return me.games[action.game] !== undefined;
    case 'answer': {
      if (!snap.quiz || snap.quiz.index !== action.index) return false;
      if (snap.quiz.step === 'question') return me.answered;
      const gain = snap.quiz.reveal?.gains[me.id];
      return Boolean(gain && gain.option !== null);
    }
    default:
      return false;
  }
}

// ¿La ruta ya avanzó y la acción dejó de tener sentido?
function isMoot(action: PlayerAction, snap: RouteSnapshot, hostNow: number): boolean {
  switch (action.type) {
    case 'checkin':
      return snap.phase !== 'checkin' || snap.stop !== action.stop;
    case 'score':
      if (action.game === 'red-b215') return snap.phase !== 'play' && snap.phase !== 'results';
      if (snap.phase === 'projects' || (snap.phase === 'checkin' && snap.stop === 'hall')) return false;
      return !(snap.phase === 'quiz' && snap.projectsCloseAt !== null && hostNow <= snap.projectsCloseAt + LATE_SCORE_SLACK_MS);
    case 'answer':
      return !snap.quiz || snap.quiz.index !== action.index || snap.quiz.step !== 'question';
    default:
      return false;
  }
}

const isOpen = (entry: { state: OutboxState }) => entry.state === 'queued' || entry.state === 'sent';

// Participante de la ruta: se une con el código, mantiene la conexión y envía acciones con reintento
// hasta que el stand responde cada una.
export class MemberController {
  private clock: RouteClock;
  private store: MemberStore | null;
  private tabs: TabGuard | null;
  // Esta pestaña es la que juega la ruta (ver tabs.ts).
  private claim: TabClaim | null = null;
  private credentials: MemberCredentials | null = null;
  private link: RouteLink | null = null;
  // Enlace entregado desde fuera (ruta individual, pruebas): se reutiliza al reintentar.
  private givenLink: RouteLink | null = null;
  private secrets: RouteSecrets | null = null;
  private topics: RouteTopics | null = null;
  // Saludos vistos antes de fijar al stand: llave de firma → saludo (o qué versión no calza).
  private candidates = new Map<string, HelloMessage | 'host-old' | 'client-old'>();
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private warning: MemberView['warning'] = null;
  private listeners = new Set<() => void>();
  private view: MemberView = MemberController.emptyView();
  private status: MemberStatus = 'idle';
  private snapshot: RouteSnapshot | null = null;
  private rejection: MemberView['rejection'] = null;
  private incompatible: MemberView['incompatible'] = null;
  private outbox = new Map<string, OutboxEntry>();
  private seq = 0;
  private reserved = 0;
  private timers: ReturnType<typeof setInterval>[] = [];
  private cleanups: (() => void)[] = [];
  private soloHost: HostController | null = null;
  private restored = false;
  private restoring: Promise<void> | null = null;
  // Cambia con cada conexión o salida: lo que quedó esperando de una sesión anterior se descarta.
  private session = 0;

  // Unión
  private hello: HelloMessage | null = null;
  private joinNonces: string[] = [];
  private lastJoinMono = -Infinity;
  private joinBrokerMono = 0;
  private helloWaitMono = 0;
  private brokerAttempts = 0;
  private rejoining = false;
  private lastRejoinMono = -Infinity;
  private deniedMono = -Infinity;
  // Desde cuándo está lista la conexión con el servidor actual (null si no lo está).
  private onlineMono: number | null = null;
  private offlineMono: number | null = null;
  // Último saludo del stand recibido en vivo (no uno que el servidor tenía guardado).
  private hostLiveMono = -Infinity;

  // Estado del stand
  private mark: Stamp | null = null;
  private markSavedMono = -Infinity;
  private anchor: { host: number; mono: number } | null = null;
  private lastStateMono = 0;
  private lastStateWall = 0;
  private hostAlive = false;
  private unknownKeyMono: number | null = null;

  // Guardado en el teléfono
  private persisting: Promise<void> | null = null;
  private persistAgain = false;
  private storage: MemberView['storage'] = 'ok';
  private waiters = new Map<string, () => void>();

  private stats = { joinsSent: 0, statesAccepted: 0, statesIgnored: 0 };
  private verifications: Budget;
  // Sobres de estado ya procesados: una copia no vuelve a costar una verificación de firma.
  private seenStates = new RecentSet(2048);

  constructor(options: MemberOptions = {}) {
    this.clock = options.clock ?? systemClock;
    this.store = options.store === undefined ? deviceMemberStore : options.store;
    this.tabs = options.tabs === undefined ? deviceTabs : options.tabs;
    this.verifications = new Budget(VERIFY_BURST, VERIFY_PER_SECOND, this.clock);
  }

  static emptyView(): MemberView {
    return {
      status: 'idle',
      code: null,
      alias: '',
      avatar: 0,
      snapshot: null,
      me: null,
      offset: 0,
      link: 'idle',
      rejection: null,
      solo: false,
      pending: [],
      outbox: {},
      verification: null,
      warning: null,
      incompatible: null,
      lastStateAt: 0,
      hostAlive: false,
      storage: 'ok',
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getView(): MemberView {
    return this.view;
  }

  getDiagnostics(): MemberDiagnostics {
    const count = (state: OutboxState) => [...this.outbox.values()].filter((entry) => entry.state === state).length;
    return {
      status: this.status,
      link: this.link?.status ?? 'idle',
      brokerIndex: this.link ? this.link.brokerIndex : null,
      hostAlive: this.hostAlive,
      lastStateAgeMs: this.anchor ? Math.round(this.clock.mono() - this.lastStateMono) : null,
      mark: this.mark,
      queued: count('queued'),
      sent: count('sent'),
      accepted: count('accepted'),
      rejected: count('rejected'),
      expired: count('expired'),
      ...this.stats,
      storage: this.storage,
    };
  }

  // Reloj del anfitrión estimado en este dispositivo: la hora del último estado más el tiempo
  // transcurrido desde que llegó (medido con reloj monótono, no con la hora del teléfono).
  hostNow(): number {
    return this.anchor ? Math.round(this.anchor.host + (this.clock.mono() - this.anchor.mono)) : this.clock.now();
  }

  // Retoma la ruta guardada (al abrir la app o recargar la página). Quien llama mientras está en curso
  // espera el mismo intento: así una pantalla sabe cuándo ya se puede decidir que no hay ruta.
  restore(link?: RouteLink): Promise<void> {
    if (this.restoring) return this.restoring;
    if (this.restored || this.credentials || !this.store) return Promise.resolve();
    this.restored = true;
    const store = this.store;
    this.restoring = (async () => {
      const saved = await store.load().catch(() => null);
      if (!this.credentials) await this.resume(saved, link);
    })().finally(() => {
      this.restoring = null;
    });
    return this.restoring;
  }

  // Vuelve a jugar en esta pestaña una ruta que siguió en otra: se parte de lo guardado (la otra pudo
  // avanzar) y la otra pasa a ser la desconectada.
  async resumeHere(link?: RouteLink): Promise<void> {
    if (this.status !== 'elsewhere' || !this.store) return;
    const saved = await this.store.load().catch(() => null);
    if (this.status !== 'elsewhere') return;
    this.teardown();
    this.restored = true;
    await this.resume(saved, link);
    // Sin ruta guardada, la otra pestaña ya salió: aquí tampoco queda nada que retomar.
    this.refresh();
  }

  private async resume(saved: MemberCredentials | null, link?: RouteLink): Promise<void> {
    const store = this.store;
    if (!saved || saved.solo || !store) return;
    if (!isRouteCode(saved.code) || this.clock.now() - saved.joinedAt > SESSION_MAX_AGE_MS) {
      await store.clear().catch(() => undefined);
      return;
    }
    this.credentials = saved;
    this.seq = saved.seq;
    this.reserved = saved.seq;
    this.mark = saved.mark;
    this.outbox.clear();
    saved.outbox.forEach((item) => {
      // Lo que quedó sin respuesta vuelve a la cola: se reenvía al reconectar.
      this.outbox.set(item.key, { ...item, state: isOpen(item) ? 'queued' : item.state, lastSentMono: -Infinity, attempts: 0 });
    });
    this.status = saved.sessionKey ? 'connecting' : 'joining';
    this.connect(link);
  }

  async join(options: { code: string; alias: string; avatar: number; fingerprint?: string | null; link?: RouteLink }): Promise<void> {
    await this.leave(true);
    const code = options.code.toUpperCase();
    const fingerprint = typeof options.fingerprint === 'string' && /^[0-9a-f]{12}$/.test(options.fingerprint) ? options.fingerprint : null;
    this.credentials = {
      v: ROUTE_RECORD_VERSION,
      code,
      clientId: `stp${randomHex(9)}`,
      boxKeys: newBoxKeys(),
      alias: options.alias,
      avatar: options.avatar,
      fingerprint,
      brokerIndex: brokerIndexForCode(code, brokerUrls.length),
      hostBox: null,
      hostSign: null,
      sessionKey: null,
      keyId: null,
      joinedAt: this.clock.now(),
      solo: false,
      seq: 0,
      outbox: [],
      mark: null,
    };
    this.status = 'joining';
    this.connect(options.link);
    this.persist();
  }

  startSolo(options: { alias: string; avatar: number; settings?: Partial<RouteSettings> }): void {
    const previous = this.credentials;
    // Una ruta que sigue en otra pestaña es de esa pestaña: aquí no se toca lo guardado.
    const elsewhere = this.status === 'elsewhere';
    this.teardown();
    // Si había una ruta en grupo guardada (por ejemplo, una que no conectó), se descarta: no debe
    // reaparecer al reabrir la app.
    if (previous && !previous.solo && !elsewhere) void this.store?.clear().catch(() => undefined);
    const bus = new LocalBus();
    const host = HostController.createSolo(bus, { projectsSeconds: 60 * 60, ...options.settings });
    this.soloHost = host;
    void host.start();
    this.credentials = {
      v: ROUTE_RECORD_VERSION,
      code: host.code,
      clientId: `solo${randomHex(6)}`,
      boxKeys: newBoxKeys(),
      alias: options.alias,
      avatar: options.avatar,
      // La ruta individual vive en este mismo teléfono: se confía directamente en su llave.
      fingerprint: host.fingerprint,
      brokerIndex: 0,
      hostBox: null,
      hostSign: null,
      sessionKey: null,
      keyId: null,
      joinedAt: this.clock.now(),
      solo: true,
      seq: 0,
      outbox: [],
      mark: null,
    };
    this.status = 'joining';
    this.connect(new LocalRouteLink(bus));
  }

  // Sale de la ruta. Con `notify` avisa al stand y espera un momento su respuesta para liberar el lugar;
  // si no hay conexión, el stand lo libera solo cuando dejan de llegar señales.
  async leave(notify = true): Promise<void> {
    const credentials = this.credentials;
    if (!credentials) return;
    if (this.status === 'elsewhere') {
      // La ruta sigue en otra pestaña: aquí solo se suelta, sin borrar lo guardado ni avisar al stand.
      this.teardown();
      this.refresh();
      return;
    }
    const session = this.session;
    if (notify && credentials.sessionKey && this.status === 'joined' && this.link?.status === 'online') {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(done, LEAVE_WAIT_MS);
        const waiters = this.waiters;
        function done() {
          clearTimeout(timer);
          waiters.delete('leave');
          resolve();
        }
        waiters.set('leave', done);
        this.send({ type: 'leave' });
      });
      // Mientras esperaba, otra llamada ya cambió de ruta.
      if (this.session !== session) return;
    }
    const wasSolo = credentials.solo;
    this.teardown();
    if (!wasSolo && this.store) {
      await this.persisting?.catch(() => undefined);
      await this.store.clear().catch(() => undefined);
    }
    this.refresh();
  }

  // Detiene todo sin avisar al anfitrión ni tocar el almacenamiento (borrado de datos del dispositivo).
  reset(): void {
    this.teardown();
    this.restored = false;
    this.refresh();
  }

  nudge(): void {
    if (this.yieldIfSuperseded()) return;
    this.link?.nudge();
  }

  checkin(stop: CheckinStop): void {
    this.send({ type: 'checkin', stop });
  }

  submitScore(game: StationGameId, score: number, accuracy: number): void {
    this.send({ type: 'score', game, score, accuracy });
  }

  answer(index: number, option: number): void {
    this.send({ type: 'answer', index, option });
  }

  // Vuelve a intentar una acción rechazada o vencida (por ejemplo tras recuperar la conexión).
  retry(key: string): void {
    const entry = this.outbox.get(key);
    if (!entry || isOpen(entry) || entry.state === 'accepted') return;
    this.outbox.delete(key);
    this.send(entry.action);
  }

  retryJoin(): void {
    if (!this.credentials) return;
    if (this.status === 'elsewhere') {
      void this.resumeHere();
      return;
    }
    this.session += 1;
    this.disconnect();
    this.brokerAttempts = 0;
    this.rejoining = false;
    this.lastRejoinMono = -Infinity;
    this.unknownKeyMono = null;
    this.status = this.credentials.sessionKey ? 'connecting' : 'joining';
    this.rejection = null;
    this.incompatible = null;
    this.connect(this.givenLink ?? undefined);
  }

  private teardown() {
    this.session += 1;
    this.disconnect();
    this.soloHost?.stop();
    this.soloHost = null;
    this.credentials = null;
    this.snapshot = null;
    this.outbox.clear();
    this.waiters.forEach((done) => done());
    this.waiters.clear();
    this.seq = 0;
    this.reserved = 0;
    this.mark = null;
    this.anchor = null;
    this.hello = null;
    this.joinNonces = [];
    this.rejoining = false;
    this.unknownKeyMono = null;
    this.hostAlive = false;
    this.hostLiveMono = -Infinity;
    this.onlineMono = null;
    this.offlineMono = null;
    this.seenStates.clear();
    this.lastStateWall = 0;
    this.status = 'idle';
    this.rejection = null;
    this.incompatible = null;
    this.warning = null;
    this.brokerAttempts = 0;
  }

  private connect(localLink?: RouteLink) {
    const credentials = this.credentials;
    if (!credentials) return;
    this.session += 1;
    this.secrets = deriveRouteSecrets(credentials.code);
    this.topics = routeTopics(this.secrets.roomId);
    this.givenLink = localLink ?? null;
    // El stand está en todos los servidores: el teléfono parte por el primero que le responda.
    this.link = localLink ?? new MqttRouteLink(credentials.brokerIndex, brokerUrls, { race: true });
    const link = this.link;
    const topics = this.topics;
    const mono = this.clock.mono();
    this.helloWaitMono = mono;
    this.joinBrokerMono = mono;
    this.lastStateMono = mono;
    this.cleanups.push(
      link.onMessage((topic, text, retain) => this.onMessage(topic, text, retain)),
      link.onStatus((status) => this.onLinkStatus(status)),
      link.onBrokerChange((index) => {
        if (this.credentials) {
          this.credentials.brokerIndex = index;
          this.persist();
        }
        const at = this.clock.mono();
        this.helloWaitMono = at;
        this.joinBrokerMono = at;
        this.hostLiveMono = -Infinity;
        this.onlineMono = this.link?.status === 'online' ? at : null;
      }),
    );
    link.subscribe(topics.hello);
    link.subscribe(topics.state);
    link.subscribe(topics.dm(credentials.clientId));
    link.start();
    if (!credentials.solo && this.tabs) {
      // Desde ahora esta es la pestaña que juega; si otra toma la ruta, esta se desconecta.
      const session = this.session;
      this.claim = this.tabs.claim(() => {
        if (this.session === session) this.yieldToOtherTab();
      });
    }
    this.timers.push(setInterval(() => this.loop(), 1000));
    this.timers.push(setInterval(() => this.heartbeat(), HEARTBEAT_MS));
    this.refresh();
  }

  // ¿Otra pestaña tomó la ruta sin que llegara el aviso? (Por ejemplo, mientras esta estaba suspendida.)
  private yieldIfSuperseded(): boolean {
    if (!this.claim || this.claim.held()) return false;
    this.yieldToOtherTab();
    return true;
  }

  // La ruta sigue en otra pestaña: esta deja de enviar, de escuchar y de guardar (lo guardado ya es de
  // la otra). Conserva lo que mostraba para poder ofrecer "seguir aquí".
  private yieldToOtherTab() {
    if (!this.credentials || this.credentials.solo || this.status === 'elsewhere') return;
    this.session += 1;
    this.disconnect();
    this.waiters.forEach((done) => done());
    this.waiters.clear();
    this.status = 'elsewhere';
    this.refresh();
  }

  private disconnect() {
    this.claim?.release();
    this.claim = null;
    this.timers.forEach((timer) => clearInterval(timer));
    this.timers = [];
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.settleTimer = null;
    this.candidates.clear();
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups = [];
    this.link?.stop();
    this.link = null;
  }

  private onLinkStatus(status: LinkStatus) {
    this.onlineMono = status === 'online' ? (this.onlineMono ?? this.clock.mono()) : null;
    this.offlineMono = status === 'online' ? null : (this.offlineMono ?? this.clock.mono());
    if (status === 'online') {
      const credentials = this.credentials;
      if (credentials?.hostBox && (!credentials.sessionKey || this.rejoining)) this.sendJoin();
      // Lo pendiente sale apenas vuelve la conexión.
      this.flushOutbox();
    }
    this.refresh();
  }

  private flushOutbox() {
    this.outbox.forEach((entry) => {
      if (isOpen(entry)) this.publishEntry(entry);
    });
  }

  private loop() {
    const credentials = this.credentials;
    const link = this.link;
    if (!credentials || !link || this.yieldIfSuperseded()) return;
    const mono = this.clock.mono();
    const joined = Boolean(credentials.sessionKey);

    if (link.status === 'denied') {
      // El servidor rechazó a este teléfono: se prueba el siguiente (de a uno, sin dar vueltas en seco).
      if (mono - this.deniedMono < DENIED_MOVE_MS) return;
      this.deniedMono = mono;
      this.brokerAttempts += 1;
      if (!joined && this.brokerAttempts >= Math.max(2, link.brokerCount * 2) && (this.status === 'joining' || this.status === 'connecting')) {
        this.status = credentials.hostBox ? 'unreachable' : 'not-found';
        this.refresh();
        return;
      }
      this.helloWaitMono = mono;
      this.joinBrokerMono = mono;
      link.moveToNextBroker();
      return;
    }

    if (!joined && (this.status === 'joining' || this.status === 'connecting')) {
      const rounds = Math.max(2, link.brokerCount * 2);
      if (!credentials.hostBox) {
        // Sin saludo del anfitrión: probar otro broker; tras dar la vuelta completa, no existe la ruta.
        const waited = this.onlineMono !== null ? mono - this.onlineMono > HELLO_WAIT_MS : mono - this.helloWaitMono > CONNECT_WAIT_MS;
        if (waited) {
          this.brokerAttempts += 1;
          // El stand publica su saludo en todos los servidores: con verlos todos una vez (y uno de
          // repaso) basta para saber que esa ruta no existe.
          if (this.brokerAttempts >= Math.max(2, link.brokerCount + 1)) {
            this.status = 'not-found';
            this.refresh();
            return;
          }
          this.helloWaitMono = mono;
          if (this.onlineMono !== null) this.onlineMono = mono;
          link.moveToNextBroker();
          this.refresh();
          return;
        }
      } else if (mono - this.joinBrokerMono > (mono - this.hostLiveMono < HOST_LIVE_MS ? JOIN_BROKER_MS : JOIN_STALE_BROKER_MS)) {
        // El stand está identificado pero no responde aquí: se le busca en los otros servidores sin
        // soltar sus llaves. Tras recorrerlos todos, se informa en vez de insistir para siempre.
        this.brokerAttempts += 1;
        if (this.brokerAttempts >= rounds) {
          this.status = 'unreachable';
          this.refresh();
          return;
        }
        this.joinBrokerMono = mono;
        link.moveToNextBroker();
        return;
      } else if (mono - this.lastJoinMono > JOIN_RETRY_MS) {
        this.sendJoin();
      }
    }

    if (joined && this.status !== 'kicked') {
      if (this.snapshot?.phase !== 'podium' && link.brokerCount > 1 && this.offlineMono !== null && mono - this.offlineMono > OFFLINE_ROTATE_MS) {
        // Se cayó la conexión con este servidor y no vuelve: se sigue por el primero que responda.
        this.offlineMono = mono;
        this.lastStateMono = mono;
        if (link.reconnectAny) link.reconnectAny();
        else link.moveToNextBroker();
        return;
      }
      if (this.snapshot?.phase !== 'podium' && mono - this.lastStateMono > STALE_MS) {
        // Sin estados nuevos: el stand pudo mudarse de servidor. Los repetidos o viejos no cuentan.
        this.lastStateMono = mono;
        if (this.status === 'connecting') {
          this.brokerAttempts += 1;
          if (this.brokerAttempts >= Math.max(2, link.brokerCount * 2)) {
            this.status = 'unreachable';
            this.refresh();
            return;
          }
        }
        if (this.hostAlive) {
          this.hostAlive = false;
          this.refresh();
        }
        link.moveToNextBroker();
      }
      if (this.unknownKeyMono !== null && mono - this.unknownKeyMono > UNKNOWN_KEY_GRACE_MS) this.rejoin();
      else if (this.rejoining && mono - this.lastJoinMono > JOIN_RETRY_MS) this.sendJoin();
    }

    // Reintenta lo que el stand aún no responde, cada vez más espaciado.
    if (joined && link.status === 'online' && this.status === 'joined') {
      this.outbox.forEach((entry) => {
        if (!isOpen(entry)) return;
        const wait = Math.min(RETRY_MAX_MS, RETRY_MS * 2 ** Math.min(2, Math.max(0, entry.attempts - 1)));
        if (mono - entry.lastSentMono >= wait) this.publishEntry(entry);
      });
    }

    if (this.mark && mono - this.markSavedMono > MARK_SAVE_MS) {
      this.markSavedMono = mono;
      this.persist();
    }
  }

  private heartbeat() {
    if (this.status !== 'joined' || this.link?.status !== 'online') return;
    this.publish({ type: 'heartbeat' }, undefined, 'heartbeat');
  }

  private onMessage(topic: string, text: string, retain: boolean) {
    const topics = this.topics;
    const credentials = this.credentials;
    if (!topics || !credentials) return;
    if (topic === topics.hello) this.onHello(text, retain);
    else if (topic === topics.dm(credentials.clientId)) this.onDirect(text);
    else if (topic === topics.state) this.onState(text, retain);
  }

  private onHello(text: string, retained: boolean) {
    const credentials = this.credentials;
    const secrets = this.secrets;
    if (!credentials || !secrets || !this.verifications.take()) return;
    const result = openHello(text, secrets.helloKey);
    if (!result.ok && result.reason === 'invalid') return;
    const sign = result.ok ? result.hello.sign : result.sign;
    // Con el QR se conoce la huella del stand: solo vale ese saludo.
    if (credentials.fingerprint && keyFingerprint(sign) !== credentials.fingerprint) {
      if (credentials.hostSign) this.flagImpostor();
      return;
    }
    // Las llaves del anfitrión quedan fijadas desde el primer saludo aceptado.
    if (credentials.hostSign) {
      if (credentials.hostSign !== sign) {
        this.flagImpostor();
        return;
      }
      if (!result.ok) {
        this.setIncompatible(result.side);
        return;
      }
      this.keepHello(result.hello);
      if (!retained) {
        this.hostLiveMono = this.clock.mono();
        this.resendOpen(RESEND_ON_HELLO_MS);
      }
      if ((!credentials.sessionKey || this.rejoining) && this.clock.mono() - this.lastJoinMono > JOIN_MIN_GAP_MS) this.sendJoin();
      return;
    }
    if (credentials.fingerprint) {
      if (result.ok) {
        if (!retained) this.hostLiveMono = this.clock.mono();
        this.pin(result.hello);
      } else {
        this.setIncompatible(result.side);
      }
      return;
    }
    this.candidates.set(sign, result.ok ? result.hello : result.side);
    if (!this.settleTimer) this.settleTimer = setTimeout(() => this.settle(), HELLO_SETTLE_MS);
  }

  // Se queda con el saludo más nuevo del stand (trae la época y el desafío para unirse).
  private keepHello(hello: HelloMessage) {
    const current = this.hello;
    if (!current || hello.epoch > current.epoch || (hello.epoch === current.epoch && hello.at >= current.at)) this.hello = hello;
  }

  private setIncompatible(side: 'host-old' | 'client-old') {
    if (this.credentials?.sessionKey) return;
    this.status = 'incompatible';
    this.incompatible = side;
    this.refresh();
  }

  private settle() {
    this.settleTimer = null;
    const credentials = this.credentials;
    if (!credentials || credentials.hostSign) return;
    const options = [...this.candidates.values()];
    this.candidates.clear();
    if (options.length === 1) {
      const only = options[0];
      if (typeof only === 'string') this.setIncompatible(only);
      else this.pin(only);
      return;
    }
    if (options.length > 1) {
      this.status = 'conflict';
      this.refresh();
    }
  }

  private pin(hello: HelloMessage) {
    const credentials = this.credentials;
    if (!credentials) return;
    credentials.hostBox = hello.box;
    credentials.hostSign = hello.sign;
    this.hello = hello;
    this.brokerAttempts = 0;
    this.joinBrokerMono = this.clock.mono();
    this.persist();
    if (!credentials.sessionKey) this.sendJoin();
    this.refresh();
  }

  private flagImpostor() {
    if (this.warning === 'impostor') return;
    this.warning = 'impostor';
    this.refresh();
  }

  // Pide unirse (o recuperar el lugar) respondiendo al saludo vigente del stand.
  private sendJoin() {
    const credentials = this.credentials;
    const link = this.link;
    const topics = this.topics;
    const hello = this.hello;
    if (!credentials?.hostBox || !link || !topics || !hello || link.status !== 'online') return;
    this.lastJoinMono = this.clock.mono();
    const nonce = randomHex(8);
    this.joinNonces = [nonce, ...this.joinNonces].slice(0, 6);
    const request: JoinRequest = { v: PROTOCOL_VERSION, id: credentials.clientId, alias: credentials.alias, avatar: credentials.avatar, nonce, epoch: hello.epoch, challenge: hello.challenge };
    const sealed = sealTo(JSON.stringify(request), credentials.hostBox, credentials.boxKeys.secretKey);
    link.publish(topics.join(credentials.clientId), JSON.stringify({ pk: credentials.boxKeys.publicKey, sealed }), { qos: 1, key: 'join' });
    this.stats.joinsSent += 1;
    if (!credentials.sessionKey && this.status !== 'joining') {
      this.status = 'joining';
      this.refresh();
    }
  }

  // El stand no reconoce a este participante (perdió su registro o cambió la llave): vuelve a pedir su lugar.
  private rejoin() {
    const mono = this.clock.mono();
    if (mono - this.lastRejoinMono < REJOIN_GAP_MS) return;
    this.lastRejoinMono = mono;
    this.rejoining = true;
    this.unknownKeyMono = null;
    this.sendJoin();
  }

  private onDirect(text: string) {
    const credentials = this.credentials;
    if (!credentials?.hostBox) return;
    const sealed = parseSealedMessage(text);
    const key = pairKey(credentials.hostBox, credentials.boxKeys.secretKey);
    if (!sealed || !key) return;
    const message = parseDirect(openShared(sealed, key));
    if (!message) return;
    switch (message.type) {
      case 'welcome':
        // Solo vale la respuesta a un intento propio y vigente (una copia de una bienvenida antigua no).
        if (!this.joinNonces.includes(message.nonce) || message.id !== credentials.clientId) return;
        this.joinNonces = [];
        credentials.sessionKey = message.key;
        credentials.keyId = message.kid;
        credentials.alias = message.alias;
        this.rejoining = false;
        this.unknownKeyMono = null;
        this.status = 'joined';
        this.rejection = null;
        this.incompatible = null;
        this.lastStateMono = this.clock.mono();
        this.persist();
        this.publish({ type: 'heartbeat' }, undefined, 'heartbeat');
        this.flushOutbox();
        break;
      case 'rejected':
        if (!this.joinNonces.includes(message.nonce)) return;
        this.joinNonces = [];
        this.rejoining = false;
        this.status = message.reason === 'kicked' ? 'kicked' : 'rejected';
        this.rejection = message.reason;
        break;
      case 'acks':
        message.list.forEach((item) => this.onAck(item));
        this.persist();
        break;
      case 'rekey':
        if (message.kid > (credentials.keyId ?? 0)) {
          credentials.sessionKey = message.key;
          credentials.keyId = message.kid;
          this.unknownKeyMono = null;
          this.persist();
        }
        break;
      case 'kicked':
        this.status = 'kicked';
        this.rejection = 'kicked';
        break;
      default:
        break;
    }
    this.refresh();
  }

  private onAck(item: AckItem) {
    const entry = [...this.outbox.values()].find((candidate) => candidate.eventId === item.e);
    if (!entry || !isOpen(entry)) return;
    if (item.s === 'ok' || item.why === 'duplicate') {
      // 'duplicate': el stand ya tenía ese lugar ocupado (por ejemplo, un puntaje guardado antes).
      entry.state = 'accepted';
    } else if (item.s === 'retry') {
      // Todavía no se puede (por ejemplo, un puntaje antes del tiempo mínimo): se reintenta sin apurar.
      entry.lastSentMono = this.clock.mono();
      entry.attempts = 1;
      entry.deferred = true;
    } else if (item.why === 'kicked') {
      this.status = 'kicked';
      this.rejection = 'kicked';
      entry.state = 'rejected';
      entry.reason = 'kicked';
    } else {
      entry.state = 'rejected';
      entry.reason = item.why ?? 'invalid';
    }
    if (entry.key === 'leave' && !isOpen(entry)) this.waiters.get('leave')?.();
  }

  private onState(text: string, retained: boolean) {
    const credentials = this.credentials;
    // Quien fue quitado de la ruta ya no sigue su estado.
    if (!credentials?.sessionKey || !credentials.hostSign || this.status === 'kicked') return;
    const envelope = parseStateEnvelope(text);
    if (!envelope) return;
    // Una copia exacta de un estado ya procesado no cuesta ni una verificación de firma.
    if (this.seenStates.has(envelope.sealed.n)) {
      this.stats.statesIgnored += 1;
      return;
    }
    if (!this.verifications.take() || !verifySealed(envelope.sealed, envelope.sig, credentials.hostSign, stateSignContext(envelope.kid))) return;
    if (envelope.kid !== credentials.keyId) {
      // El stand cambió la llave (quitó a alguien). La nueva llega por mensaje directo; si no, se pide.
      if (envelope.kid > (credentials.keyId ?? 0)) {
        // Un estado que el servidor tenía guardado: el cambio ocurrió mientras este teléfono no estaba,
        // así que el mensaje con la llave ya no va a llegar. Se pide de inmediato.
        if (retained) this.rejoin();
        else if (this.unknownKeyMono === null) this.unknownKeyMono = this.clock.mono();
      }
      return;
    }
    this.seenStates.add(envelope.sealed.n);
    const snap = parseSnapshot(openShared(envelope.sealed, credentials.sessionKey));
    if (!snap || snap.code !== credentials.code) return;
    // Solo avanza: un estado repetido o más viejo (aunque esté bien firmado) no cambia nada, ni el
    // reloj ni la señal de vida del stand. La excepción es al retomar una sesión guardada, cuando aún
    // no hay nada en pantalla: el estado donde quedó (el mismo que conserva el servidor) se muestra de
    // inmediato en vez de esperar el siguiente latido del stand.
    const whereItLeft = this.snapshot === null && this.mark !== null && compareAuthority(snap, this.mark) === 0 && snap.pub === this.mark.pub;
    if (!isNewerStamp(snap, this.mark) && !whereItLeft) {
      this.stats.statesIgnored += 1;
      return;
    }
    const mono = this.clock.mono();
    // Volvió el stand tras un silencio (o cambió quién conduce): lo pendiente se reenvía ya.
    const resumed = !this.hostAlive || mono - this.lastStateMono > STATE_GAP_MS || (this.mark !== null && snap.epoch !== this.mark.epoch);
    this.stats.statesAccepted += 1;
    this.mark = { epoch: snap.epoch, owner: snap.owner, pub: snap.pub };
    this.anchor = { host: snap.now, mono };
    this.lastStateMono = mono;
    this.lastStateWall = this.clock.now();
    this.hostAlive = true;
    this.unknownKeyMono = null;
    this.snapshot = snap;
    const me = snap.players.find((player) => player.id === credentials.clientId) ?? null;
    if (snap.kicked.includes(credentials.clientId)) {
      this.status = 'kicked';
      this.rejection = 'kicked';
    } else {
      this.status = 'joined';
      // El stand no tiene a este participante (por ejemplo, retomó la ruta desde un guardado anterior).
      if (!me) this.rejoin();
    }
    let changed = false;
    this.outbox.forEach((entry, key) => {
      const moot = isMoot(entry.action, snap, snap.now);
      if (isOpen(entry)) {
        if (isReflected(entry.action, snap, me)) entry.state = 'accepted';
        else if (moot && !this.rejoining) entry.state = 'expired';
        else return;
        changed = true;
      } else if (moot) {
        this.outbox.delete(key);
        changed = true;
      }
    });
    if (changed) this.persist();
    if (this.status === 'joined' && !this.rejoining) {
      if (resumed) this.flushOutbox();
      // El stand está publicando y todavía no muestra algo enviado hace rato: se reenvía.
      else this.resendOpen(RESEND_ON_STATE_MS);
    }
    this.refresh();
  }

  // Reenvía lo que sigue sin respuesta y se envió hace al menos `minAgeMs` (hay señal de que el stand
  // está vivo). Los duplicados no hacen daño: el stand responde lo mismo sin aplicarlos otra vez.
  private resendOpen(minAgeMs: number) {
    if (this.status !== 'joined' || this.rejoining) return;
    const mono = this.clock.mono();
    this.outbox.forEach((entry) => {
      if (isOpen(entry) && !entry.deferred && mono - entry.lastSentMono >= minAgeMs) this.publishEntry(entry);
    });
  }

  private send(action: PlayerAction) {
    // Solo quien está dentro de la ruta envía acciones (quien fue quitado o rechazado, no).
    if (this.status !== 'joined') return;
    const key = pendingKey(action);
    if (!key) {
      this.publish(action);
      return;
    }
    const existing = this.outbox.get(key);
    // Un toque repetido no crea otra acción: se sigue con la que ya está en curso o resuelta.
    if (existing && (isOpen(existing) || existing.state === 'accepted')) return;
    const entry: OutboxEntry = { key, eventId: randomHex(8), action, since: this.clock.now(), state: 'queued', lastSentMono: -Infinity, attempts: 0 };
    this.outbox.set(key, entry);
    this.publishEntry(entry);
    this.persist();
    this.refresh();
  }

  private publishEntry(entry: OutboxEntry) {
    if (this.publish(entry.action, entry.eventId, entry.eventId)) {
      entry.state = 'sent';
      entry.lastSentMono = this.clock.mono();
      entry.attempts += 1;
    }
  }

  private nextSeq(): number {
    this.seq += 1;
    if (this.seq > this.reserved) {
      // Se reserva un bloque: tras cerrar la app se continúa por encima de lo ya usado.
      this.reserved = this.seq + SEQ_BLOCK;
      this.persist();
    }
    return this.seq;
  }

  private publish(action: PlayerAction, eventId?: string, key?: string): boolean {
    const credentials = this.credentials;
    const link = this.link;
    const topics = this.topics;
    if (!credentials?.sessionKey || !credentials.hostBox || !link || !topics || link.status !== 'online') return false;
    const pair = pairKey(credentials.hostBox, credentials.boxKeys.secretKey);
    if (!pair) return false;
    const payload: ActionPayload = eventId ? { k: 'act', seq: this.nextSeq(), e: eventId, action } : { k: 'act', seq: this.nextSeq(), action };
    link.publish(topics.up(credentials.clientId), JSON.stringify(sealShared(JSON.stringify(payload), pair)), { qos: 1, key });
    return true;
  }

  private exportCredentials(): MemberCredentials | null {
    const credentials = this.credentials;
    if (!credentials) return null;
    return {
      ...credentials,
      seq: this.reserved,
      mark: this.mark,
      outbox: [...this.outbox.values()].filter((entry) => entry.key !== 'leave').map(({ key, eventId, action, since, state, reason }) => ({ key, eventId, action, since, state, reason })),
    };
  }

  // Guarda credenciales, contador y acciones pendientes. Una escritura a la vez; si algo cambia
  // mientras tanto, se vuelve a guardar al terminar.
  private persist(): void {
    const store = this.store;
    if (!store || !this.credentials || this.credentials.solo || this.status === 'elsewhere') return;
    if (this.persisting) {
      this.persistAgain = true;
      return;
    }
    const record = this.exportCredentials();
    if (!record) return;
    const session = this.session;
    this.persisting = store
      .save(record)
      .then(
        () => {
          if (this.storage !== 'ok' && this.session === session) {
            this.storage = 'ok';
            this.refresh();
          }
        },
        () => {
          if (this.storage !== 'failing' && this.session === session) {
            this.storage = 'failing';
            this.refresh();
          }
        },
      )
      .finally(() => {
        this.persisting = null;
        const again = this.persistAgain;
        this.persistAgain = false;
        if (again && this.session === session) this.persist();
      });
  }

  private refresh() {
    const credentials = this.credentials;
    const snap = this.snapshot;
    const outbox: Record<string, OutboxView> = {};
    const pending: string[] = [];
    this.outbox.forEach((entry, key) => {
      if (key === 'leave') return;
      outbox[key] = entry.reason ? { state: entry.state, reason: entry.reason } : { state: entry.state };
      if (isOpen(entry)) pending.push(key);
    });
    this.view = {
      status: this.status,
      code: credentials?.code ?? null,
      alias: credentials?.alias ?? '',
      avatar: credentials?.avatar ?? 0,
      snapshot: snap,
      me: snap && credentials ? (snap.players.find((player) => player.id === credentials.clientId) ?? null) : null,
      offset: this.anchor ? this.hostNow() - this.clock.now() : 0,
      link: this.link?.status ?? 'idle',
      rejection: this.rejection,
      solo: Boolean(credentials?.solo),
      pending,
      outbox,
      verification: credentials?.hostSign && !credentials.solo ? verificationCode(credentials.hostSign) : null,
      warning: this.warning,
      incompatible: this.incompatible,
      lastStateAt: this.lastStateWall,
      hostAlive: this.hostAlive,
      storage: this.storage,
    };
    this.listeners.forEach((listener) => listener());
  }
}

export const routeMember = new MemberController();
