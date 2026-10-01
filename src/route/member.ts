import { brokerUrls } from '@/realtime/config';
import {
  deriveRouteSecrets,
  keyFingerprint,
  newBoxKeys,
  openFrom,
  openShared,
  randomHex,
  sealShared,
  sealTo,
  verificationCode,
  verifySealed,
  type RouteSecrets,
} from '@/realtime/crypto';
import { HostController } from './host';
import { LocalBus, LocalRouteLink, MqttRouteLink, type LinkStatus, type RouteLink } from './link';
import {
  brokerIndexForCode,
  openHello,
  parseJson,
  routeTopics,
  type ActionPayload,
  type DirectMessage,
  type HelloMessage,
  type JoinRequest,
  type RouteTopics,
  type StateEnvelope,
} from './protocol';
import { clearMember, loadMember, saveMember, type MemberCredentials } from './storage';
import type { CheckinStop, PlayerAction, PublicPlayer, RouteSettings, RouteSnapshot, StationGameId } from './types';

export type MemberStatus = 'idle' | 'connecting' | 'joining' | 'joined' | 'rejected' | 'not-found' | 'kicked' | 'conflict';

export type RejectReason = 'full' | 'finished' | 'taken' | 'kicked';

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
  pending: string[];
  // Código de 4 caracteres del stand al que se unió (debe coincidir con el de la pantalla del stand).
  verification: string | null;
  // Apareció otro "stand" con el mismo código después de unirse.
  warning: 'impostor' | null;
}

const JOIN_RETRY_MS = 3000;
const HELLO_WAIT_MS = 9000;
// Al unirse con el código escrito (sin QR) se escuchan los saludos un momento antes de confiar en uno:
// si aparecen dos stands distintos con el mismo código, no se elige ninguno.
const HELLO_SETTLE_MS = 2000;
const STALE_MS = 30_000;
const HEARTBEAT_MS = 10_000;
const RETRY_MS = 2500;
const GIVE_UP_MS = 90_000;

interface PendingAction {
  action: PlayerAction;
  since: number;
  lastSent: number;
}

function pendingKey(action: PlayerAction): string | null {
  switch (action.type) {
    case 'checkin':
      return `checkin:${action.stop}`;
    case 'score':
      return `score:${action.game}`;
    case 'answer':
      return `answer:${action.index}`;
    default:
      return null;
  }
}

const SCORE_PHASES: Record<string, boolean> = { play: true, results: true, projects: true };

// ¿El estado del anfitrión ya refleja la acción enviada?
function isResolved(action: PlayerAction, snap: RouteSnapshot, me: PublicPlayer | null): boolean {
  if (!me) return false;
  switch (action.type) {
    case 'checkin':
      return snap.phase !== 'checkin' || snap.stop !== action.stop || me.checkedIn;
    case 'score': {
      if (me.games[action.game] !== undefined) return true;
      const late = snap.phase === 'checkin' && snap.stop === 'hall' && action.game !== 'red-b215';
      return !SCORE_PHASES[snap.phase] && !late;
    }
    case 'answer':
      return !snap.quiz || snap.quiz.index !== action.index || snap.quiz.step !== 'question' || me.answered;
    default:
      return true;
  }
}

// Participante de la ruta: se une con el código, mantiene la conexión y envía acciones con reintento.
export class MemberController {
  private credentials: MemberCredentials | null = null;
  private link: RouteLink | null = null;
  private secrets: RouteSecrets | null = null;
  private topics: RouteTopics | null = null;
  private candidates = new Map<string, HelloMessage>();
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private warning: MemberView['warning'] = null;
  private listeners = new Set<() => void>();
  private view: MemberView = MemberController.emptyView();
  private status: MemberStatus = 'idle';
  private snapshot: RouteSnapshot | null = null;
  private offset = 0;
  private rejection: MemberView['rejection'] = null;
  private seq = 0;
  private pending = new Map<string, PendingAction>();
  private timers: ReturnType<typeof setInterval>[] = [];
  private cleanups: (() => void)[] = [];
  private helloWaitStartedAt = 0;
  private brokerAttempts = 0;
  private lastStateAt = 0;
  private lastJoinAt = 0;
  private soloHost: HostController | null = null;
  private restored = false;

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
      verification: null,
      warning: null,
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getView(): MemberView {
    return this.view;
  }

  // Reloj del anfitrión estimado en este dispositivo.
  hostNow(): number {
    return Date.now() + this.offset;
  }

  async restore(): Promise<void> {
    if (this.restored || this.credentials) return;
    this.restored = true;
    const saved = await loadMember();
    if (!saved || saved.solo || this.credentials) return;
    this.credentials = saved;
    this.status = saved.sessionKey ? 'connecting' : 'joining';
    this.connect();
  }

  async join(options: { code: string; alias: string; avatar: number; fingerprint?: string | null; link?: RouteLink }): Promise<void> {
    await this.leave(false);
    const code = options.code.toUpperCase();
    this.credentials = {
      code,
      clientId: `stp${randomHex(9)}`,
      boxKeys: newBoxKeys(),
      alias: options.alias,
      avatar: options.avatar,
      fingerprint: options.fingerprint ?? null,
      brokerIndex: brokerIndexForCode(code, brokerUrls.length),
      hostBox: null,
      hostSign: null,
      sessionKey: null,
      token: null,
      joinedAt: Date.now(),
      solo: false,
    };
    this.rejection = null;
    this.warning = null;
    this.status = 'joining';
    await saveMember(this.credentials);
    this.connect(options.link);
  }

  startSolo(options: { alias: string; avatar: number; settings?: Partial<RouteSettings> }): void {
    void this.leave(false);
    const bus = new LocalBus();
    const host = HostController.createSolo(bus, { projectsSeconds: 60 * 60, ...options.settings });
    this.soloHost = host;
    void host.start();
    this.credentials = {
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
      token: null,
      joinedAt: Date.now(),
      solo: true,
    };
    this.rejection = null;
    this.status = 'joining';
    this.connect(new LocalRouteLink(bus));
  }

  async leave(notify = true): Promise<void> {
    if (notify && this.credentials?.sessionKey && this.status === 'joined') this.send({ type: 'leave' });
    this.disconnect();
    this.soloHost?.stop();
    this.soloHost = null;
    const wasSolo = this.credentials?.solo;
    this.credentials = null;
    this.snapshot = null;
    this.pending.clear();
    this.status = 'idle';
    this.rejection = null;
    this.warning = null;
    if (!wasSolo) await clearMember();
    this.refresh();
  }

  // Detiene todo sin avisar al anfitrión ni tocar el almacenamiento (borrado de datos del dispositivo).
  reset(): void {
    this.disconnect();
    this.soloHost?.stop();
    this.soloHost = null;
    this.credentials = null;
    this.snapshot = null;
    this.pending.clear();
    this.status = 'idle';
    this.rejection = null;
    this.warning = null;
    this.restored = false;
    this.refresh();
  }

  nudge(): void {
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

  retryJoin(): void {
    if (!this.credentials) return;
    this.brokerAttempts = 0;
    this.status = 'joining';
    this.rejection = null;
    this.disconnect();
    this.connect();
  }

  private connect(localLink?: RouteLink) {
    const credentials = this.credentials;
    if (!credentials) return;
    this.secrets = deriveRouteSecrets(credentials.code);
    this.topics = routeTopics(this.secrets.roomId);
    this.link = localLink ?? new MqttRouteLink(credentials.clientId, credentials.brokerIndex, false);
    const link = this.link;
    const topics = this.topics;
    this.cleanups.push(
      link.onMessage((topic, text) => this.onMessage(topic, text)),
      link.onStatus(() => this.refresh()),
      link.onBrokerChange((index) => {
        if (this.credentials) {
          this.credentials.brokerIndex = index;
          void this.persist();
        }
        this.helloWaitStartedAt = Date.now();
      }),
    );
    link.subscribe(topics.hello);
    link.subscribe(topics.state);
    link.subscribe(topics.dm(credentials.clientId));
    this.helloWaitStartedAt = Date.now();
    this.lastStateAt = Date.now();
    link.start();
    this.timers.push(setInterval(() => this.loop(), 1000));
    this.timers.push(setInterval(() => this.status === 'joined' && this.send({ type: 'heartbeat' }), HEARTBEAT_MS));
    this.refresh();
  }

  private disconnect() {
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

  private loop() {
    const credentials = this.credentials;
    const link = this.link;
    if (!credentials || !link) return;
    const now = Date.now();
    const joined = Boolean(credentials.sessionKey);

    if (!joined && this.status !== 'rejected' && this.status !== 'not-found' && this.status !== 'conflict') {
      // Sin saludo del anfitrión: probar otro broker; tras dar la vuelta completa, no existe la ruta.
      if (!credentials.hostBox && now - this.helloWaitStartedAt > HELLO_WAIT_MS) {
        this.brokerAttempts += 1;
        if (this.brokerAttempts >= link.brokerCount * 2) {
          this.status = 'not-found';
          this.refresh();
          return;
        }
        link.moveToNextBroker();
        return;
      }
      if (credentials.hostBox && now - this.lastJoinAt > JOIN_RETRY_MS) this.sendJoin();
    }

    if (joined && this.snapshot?.phase !== 'podium' && now - this.lastStateAt > STALE_MS) {
      this.lastStateAt = now;
      link.moveToNextBroker();
    }

    // Reintenta las acciones que el anfitrión aún no refleja.
    this.pending.forEach((item, key) => {
      if (now - item.since > GIVE_UP_MS) {
        this.pending.delete(key);
        return;
      }
      if (now - item.lastSent > RETRY_MS) {
        item.lastSent = now;
        this.publishAction(item.action);
      }
    });
  }

  private onMessage(topic: string, text: string) {
    const topics = this.topics;
    const credentials = this.credentials;
    if (!topics || !credentials) return;
    if (topic === topics.hello) this.onHello(text);
    else if (topic === topics.dm(credentials.clientId)) this.onDirect(text);
    else if (topic === topics.state) this.onState(text);
  }

  private onHello(text: string) {
    const credentials = this.credentials;
    const secrets = this.secrets;
    if (!credentials || !secrets) return;
    const hello = openHello(text, secrets.helloKey);
    if (!hello) return;
    // Con el QR se conoce la huella del stand: solo vale ese saludo.
    if (credentials.fingerprint && keyFingerprint(hello.sign) !== credentials.fingerprint) {
      if (credentials.hostSign) this.flagImpostor();
      return;
    }
    // Las llaves del anfitrión quedan fijadas desde el primer saludo aceptado.
    if (credentials.hostSign) {
      if (credentials.hostSign !== hello.sign) this.flagImpostor();
      else if (!credentials.sessionKey) this.sendJoin();
      return;
    }
    if (credentials.fingerprint) {
      this.pin(hello);
      return;
    }
    this.candidates.set(hello.sign, hello);
    if (!this.settleTimer) this.settleTimer = setTimeout(() => this.settle(), HELLO_SETTLE_MS);
  }

  private settle() {
    this.settleTimer = null;
    const credentials = this.credentials;
    if (!credentials || credentials.hostSign) return;
    const options = [...this.candidates.values()];
    this.candidates.clear();
    if (options.length === 1) {
      this.pin(options[0]);
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
    this.brokerAttempts = 0;
    void this.persist();
    if (!credentials.sessionKey) this.sendJoin();
    this.refresh();
  }

  private flagImpostor() {
    if (this.warning === 'impostor') return;
    this.warning = 'impostor';
    this.refresh();
  }

  private sendJoin() {
    const credentials = this.credentials;
    const link = this.link;
    const topics = this.topics;
    if (!credentials?.hostBox || !link || !topics) return;
    this.lastJoinAt = Date.now();
    const request: JoinRequest = { alias: credentials.alias, avatar: credentials.avatar };
    const sealed = sealTo(JSON.stringify(request), credentials.hostBox, credentials.boxKeys.secretKey);
    link.publish(topics.join(credentials.clientId), JSON.stringify({ pk: credentials.boxKeys.publicKey, sealed }), { qos: 1 });
    if (this.status !== 'joining') {
      this.status = 'joining';
      this.refresh();
    }
  }

  private onDirect(text: string) {
    const credentials = this.credentials;
    if (!credentials?.hostBox) return;
    const sealed = parseJson<{ n: string; c: string }>(text);
    if (!sealed) return;
    const message = parseJson<DirectMessage>(openFrom(sealed, credentials.hostBox, credentials.boxKeys.secretKey));
    if (!message) return;
    if (message.type === 'welcome') {
      credentials.sessionKey = message.key;
      credentials.token = message.token;
      credentials.alias = message.alias;
      this.status = 'joined';
      this.rejection = null;
      void this.persist();
      this.send({ type: 'heartbeat' });
    } else if (!credentials.sessionKey) {
      this.status = message.reason === 'kicked' ? 'kicked' : 'rejected';
      this.rejection = message.reason;
    }
    this.refresh();
  }

  private onState(text: string) {
    const credentials = this.credentials;
    if (!credentials?.sessionKey || !credentials.hostSign) return;
    const envelope = parseJson<StateEnvelope>(text);
    if (!envelope?.sealed || !envelope.sig) return;
    if (!verifySealed(envelope.sealed, envelope.sig, credentials.hostSign)) return;
    const snap = parseJson<RouteSnapshot>(openShared(envelope.sealed, credentials.sessionKey));
    if (!snap || snap.code !== credentials.code) return;
    // Descarta estados viejos que lleguen retrasados.
    if (this.snapshot && snap.rev < this.snapshot.rev && snap.now < this.snapshot.now) return;
    this.lastStateAt = Date.now();
    this.offset = snap.now - Date.now();
    this.snapshot = snap;
    if (snap.kicked.includes(credentials.clientId)) this.status = 'kicked';
    else if (this.status !== 'kicked') this.status = 'joined';
    const me = snap.players.find((player) => player.id === credentials.clientId) ?? null;
    this.pending.forEach((item, key) => {
      if (isResolved(item.action, snap, me)) this.pending.delete(key);
    });
    this.refresh();
  }

  private send(action: PlayerAction) {
    const key = pendingKey(action);
    if (key && !this.pending.has(key)) this.pending.set(key, { action, since: Date.now(), lastSent: Date.now() });
    this.publishAction(action);
    if (key) this.refresh();
  }

  private publishAction(action: PlayerAction) {
    const credentials = this.credentials;
    const link = this.link;
    const topics = this.topics;
    if (!credentials?.sessionKey || !credentials.token || !link || !topics) return;
    // Secuencia monótona incluso tras reiniciar la app.
    this.seq = Math.max(Date.now(), this.seq + 1);
    const payload: ActionPayload = { token: credentials.token, seq: this.seq, action };
    link.publish(topics.up(credentials.clientId), JSON.stringify({ sealed: sealShared(JSON.stringify(payload), credentials.sessionKey) }), { qos: 1 });
  }

  private async persist() {
    if (this.credentials && !this.credentials.solo) await saveMember(this.credentials);
  }

  private refresh() {
    const credentials = this.credentials;
    const snap = this.snapshot;
    this.view = {
      status: this.status,
      code: credentials?.code ?? null,
      alias: credentials?.alias ?? '',
      avatar: credentials?.avatar ?? 0,
      snapshot: snap,
      me: snap && credentials ? (snap.players.find((player) => player.id === credentials.clientId) ?? null) : null,
      offset: this.offset,
      link: this.link?.status ?? 'idle',
      rejection: this.rejection,
      solo: Boolean(credentials?.solo),
      pending: [...this.pending.keys()],
      verification: credentials?.hostSign && !credentials.solo ? verificationCode(credentials.hostSign) : null,
      warning: this.warning,
    };
    this.listeners.forEach((listener) => listener());
  }
}

export const routeMember = new MemberController();
