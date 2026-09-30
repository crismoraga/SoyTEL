import { brokerAuth, brokerUrls, webAppUrl } from '@/realtime/config';
import {
  keyFingerprint,
  newBoxKeys,
  newSessionKey,
  newSignKeys,
  openFrom,
  openShared,
  randomHex,
  roomIdFor,
  sealShared,
  sealTo,
  signSealed,
} from '@/realtime/crypto';
import { MqttClient } from '@/realtime/mqttClient';
import { addPlayer, applyHostAction, applyPlayerAction, createRoute, DEFAULT_SETTINGS, snapshot, tick } from './engine';
import { LocalRouteLink, MqttRouteLink, type LinkStatus, type LocalBus, type RouteLink } from './link';
import {
  generateRouteCode,
  parseJson,
  PROTOCOL_VERSION,
  routeTopics,
  topicTail,
  type ActionEnvelope,
  type ActionPayload,
  type DirectMessage,
  type HelloMessage,
  type JoinEnvelope,
  type JoinRequest,
  type RouteTopics,
  type StateEnvelope,
} from './protocol';
import { readLease, saveHost, writeLease, type HostRecord } from './storage';
import type { HostAction, RouteSettings, RouteSnapshot, RouteState } from './types';

export interface HostView {
  code: string;
  state: RouteState;
  snapshot: RouteSnapshot;
  link: LinkStatus;
  joinUrl: string;
  readOnly: boolean;
  solo: boolean;
}

const TICK_MS = 500;
const HEARTBEAT_MS = 5000;
const HELLO_MS = 30_000;
const LEASE_MS = 5000;
const LEASE_STALE_MS = 16_000;
const FAILOVER_MS = 25_000;

// Identificador de esta pestaña/proceso para la concesión de la ruta.
const OWNER = randomHex(6);

// Prueba los brokers en orden y devuelve el primero que acepta conexión.
export async function findReachableBroker(timeoutMs = 7000): Promise<number> {
  for (let index = 0; index < brokerUrls.length; index += 1) {
    const reachable = await new Promise<boolean>((resolve) => {
      const client = new MqttClient({
        url: brokerUrls[index],
        clientId: `stp${randomHex(8)}`,
        username: brokerAuth.username,
        password: brokerAuth.password,
        connectTimeoutMs: timeoutMs,
      });
      const timer = setTimeout(() => {
        client.close();
        resolve(false);
      }, timeoutMs);
      client.onStatus = (status) => {
        if (status === 'online') {
          clearTimeout(timer);
          client.close();
          resolve(true);
        }
      };
      client.connect();
    });
    if (reachable) return index;
  }
  return 0;
}

export class HostController {
  readonly code: string;
  readonly solo: boolean;
  private record: HostRecord;
  private link: RouteLink;
  private topics: RouteTopics;
  private listeners = new Set<() => void>();
  private view: HostView;
  private timers: ReturnType<typeof setInterval>[] = [];
  private publishTimer: ReturnType<typeof setTimeout> | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPublishedRev = 0;
  private lastHelloAt = 0;
  private offlineSince: number | null = null;
  private running = false;
  private readOnly = false;
  private autoStart: boolean;
  private cleanups: (() => void)[] = [];

  constructor(record: HostRecord, link: RouteLink, options: { solo?: boolean; autoStart?: boolean } = {}) {
    this.record = record;
    this.code = record.code;
    this.link = link;
    this.solo = Boolean(options.solo);
    this.autoStart = Boolean(options.autoStart);
    this.topics = routeTopics(roomIdFor(record.code));
    this.view = this.buildView();
  }

  static async create(settings: Partial<RouteSettings> = {}): Promise<HostController> {
    const brokerIndex = await findReachableBroker();
    const code = generateRouteCode(brokerIndex, brokerUrls.length);
    const now = Date.now();
    const record: HostRecord = {
      code,
      clientId: `sth${randomHex(9)}`,
      brokerIndex,
      boxKeys: newBoxKeys(),
      signKeys: newSignKeys(),
      sessionKey: newSessionKey(),
      state: createRoute(code, now, parseInt(randomHex(4), 16), { ...DEFAULT_SETTINGS, ...settings }),
      seqs: {},
      savedAt: now,
    };
    await saveHost(record);
    return new HostController(record, new MqttRouteLink(record.clientId, brokerIndex, false));
  }

  static fromRecord(record: HostRecord): HostController {
    return new HostController(record, new MqttRouteLink(record.clientId, record.brokerIndex, false));
  }

  // Ruta sobre un enlace dado (bus local del modo individual y pruebas).
  static createWithLink(link: RouteLink, settings: Partial<RouteSettings> = {}, options: { solo?: boolean; autoStart?: boolean } = {}): HostController {
    const now = Date.now();
    const code = generateRouteCode(link.brokerIndex, link.brokerCount);
    const record: HostRecord = {
      code,
      clientId: `loc${randomHex(6)}`,
      brokerIndex: link.brokerIndex,
      boxKeys: newBoxKeys(),
      signKeys: newSignKeys(),
      sessionKey: newSessionKey(),
      state: createRoute(code, now, parseInt(randomHex(4), 16), { ...DEFAULT_SETTINGS, ...settings }),
      seqs: {},
      savedAt: now,
    };
    return new HostController(record, link, options);
  }

  // Ruta local en memoria para jugar sin conexión (un solo participante, se inicia sola).
  static createSolo(bus: LocalBus, settings: Partial<RouteSettings> = {}): HostController {
    return HostController.createWithLink(new LocalRouteLink(bus), settings, { solo: true, autoStart: true });
  }

  get joinUrl(): string {
    return `${webAppUrl}/ruta?codigo=${this.code}&k=${keyFingerprint(this.record.signKeys.publicKey)}`;
  }

  async start(force = false): Promise<void> {
    if (this.running) return;
    if (!this.solo) {
      const lease = await readLease(this.code);
      if (!force && lease && lease.owner !== OWNER && Date.now() - lease.at < LEASE_STALE_MS) {
        this.readOnly = true;
        this.refresh();
        return;
      }
      this.readOnly = false;
      await writeLease(this.code, OWNER, Date.now());
    }
    this.running = true;
    this.cleanups.push(
      this.link.onMessage((topic, text) => this.onMessage(topic, text)),
      this.link.onStatus((status) => this.onLinkStatus(status)),
      this.link.onBrokerChange((index) => {
        this.record.brokerIndex = index;
        this.lastPublishedRev = 0;
        this.schedulePersist();
      }),
    );
    this.link.subscribe(this.topics.joinAll);
    this.link.subscribe(this.topics.upAll);
    this.link.start();
    this.timers.push(
      setInterval(() => {
        this.checkFailover();
        this.setState(tick(this.record.state, Date.now()));
      }, TICK_MS),
    );
    this.timers.push(setInterval(() => this.publishState(true), HEARTBEAT_MS));
    if (!this.solo) this.timers.push(setInterval(() => void writeLease(this.code, OWNER, Date.now()), LEASE_MS));
    this.publishHello();
    this.publishState(true);
    this.refresh();
  }

  stop(): void {
    this.running = false;
    this.timers.forEach((timer) => clearInterval(timer));
    this.timers = [];
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups = [];
    if (this.publishTimer) clearTimeout(this.publishTimer);
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.publishTimer = null;
    this.persistTimer = null;
    if (!this.solo) void saveHost({ ...this.record, savedAt: Date.now() });
    this.link.stop();
  }

  nudge(): void {
    this.link.nudge();
  }

  dispatch(action: HostAction): void {
    if (!this.running) return;
    this.setState(applyHostAction(this.record.state, action, Date.now()));
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getView(): HostView {
    return this.view;
  }

  private buildView(): HostView {
    const state = this.record.state;
    return {
      code: this.code,
      state,
      snapshot: snapshot(state, Date.now()),
      link: this.link.status,
      joinUrl: this.joinUrl,
      readOnly: this.readOnly,
      solo: this.solo,
    };
  }

  private refresh() {
    this.view = this.buildView();
    this.listeners.forEach((listener) => listener());
  }

  private setState(next: RouteState) {
    const previous = this.record.state;
    if (next === previous) return;
    this.record.state = next;
    if (next.rev !== previous.rev) {
      this.schedulePublish();
      this.schedulePersist();
    }
    // Presencia y señales de vida también cambian la vista del stand.
    this.refresh();
  }

  // Si el broker no responde por un rato, la ruta se muda al siguiente (los participantes lo siguen).
  private checkFailover() {
    if (this.solo || this.link.status === 'online') return;
    const now = Date.now();
    if (this.offlineSince === null) this.offlineSince = now;
    else if (now - this.offlineSince > FAILOVER_MS) {
      this.offlineSince = now;
      this.link.moveToNextBroker();
    }
  }

  private onLinkStatus(status: LinkStatus) {
    if (status === 'online') {
      this.offlineSince = null;
      this.publishHello();
      this.publishState(true);
    } else if (this.offlineSince === null) {
      this.offlineSince = Date.now();
    }
    this.refresh();
  }

  private publishHello() {
    const hello: HelloMessage = {
      v: PROTOCOL_VERSION,
      kind: 'soytel-route',
      box: this.record.boxKeys.publicKey,
      sign: this.record.signKeys.publicKey,
      at: Date.now(),
    };
    this.lastHelloAt = hello.at;
    this.link.publish(this.topics.hello, JSON.stringify(hello), { retain: true });
  }

  private schedulePublish() {
    if (this.publishTimer) return;
    this.publishTimer = setTimeout(() => {
      this.publishTimer = null;
      this.publishState(false);
    }, 120);
  }

  private publishState(force: boolean) {
    if (!this.running) return;
    const state = this.record.state;
    if (!force && state.rev === this.lastPublishedRev) return;
    const now = Date.now();
    if (now - this.lastHelloAt > HELLO_MS) this.publishHello();
    const sealed = sealShared(JSON.stringify(snapshot(state, now)), this.record.sessionKey);
    const envelope: StateEnvelope = { sealed, sig: signSealed(sealed, this.record.signKeys.secretKey) };
    this.link.publish(this.topics.state, JSON.stringify(envelope), { retain: true });
    this.lastPublishedRev = state.rev;
  }

  private schedulePersist() {
    if (this.solo || this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void saveHost({ ...this.record, savedAt: Date.now() });
    }, 800);
  }

  private onMessage(topic: string, text: string) {
    const clientId = topicTail(topic);
    if (!/^[a-z0-9-]{4,40}$/i.test(clientId)) return;
    if (topic.startsWith(this.topics.joinAll.slice(0, -1))) this.onJoin(clientId, text);
    else if (topic.startsWith(this.topics.upAll.slice(0, -1))) this.onAction(clientId, text);
  }

  private onJoin(clientId: string, text: string) {
    const envelope = parseJson<JoinEnvelope>(text);
    if (!envelope?.pk || !envelope.sealed) return;
    const request = parseJson<JoinRequest>(openFrom(envelope.sealed, envelope.pk, this.record.boxKeys.secretKey));
    if (!request || typeof request.alias !== 'string') return;
    const now = Date.now();
    const current = this.record.state;
    const token = current.players[clientId]?.token ?? randomHex(16);
    let result = addPlayer(current, { id: clientId, alias: request.alias, avatar: Number(request.avatar) || 0, boxKey: envelope.pk, token }, now);
    if (result.ok && this.autoStart && result.state.phase === 'lobby') {
      result = { ...result, state: applyHostAction(result.state, { type: 'start' }, now) };
    }
    this.setState(result.state);
    const message: DirectMessage = result.ok
      ? { type: 'welcome', key: this.record.sessionKey, token, id: clientId, alias: result.state.players[clientId].alias }
      : { type: 'rejected', reason: result.reason };
    const sealed = sealTo(JSON.stringify(message), envelope.pk, this.record.boxKeys.secretKey);
    this.link.publish(this.topics.dm(clientId), JSON.stringify(sealed), { qos: 1 });
    this.publishState(true);
  }

  private onAction(clientId: string, text: string) {
    const player = this.record.state.players[clientId];
    if (!player) return;
    const envelope = parseJson<ActionEnvelope>(text);
    if (!envelope?.sealed) return;
    const payload = parseJson<ActionPayload>(openShared(envelope.sealed, this.record.sessionKey));
    if (!payload || payload.token !== player.token || typeof payload.seq !== 'number' || !payload.action) return;
    const last = this.record.seqs[clientId] ?? 0;
    if (payload.seq <= last) return;
    this.record.seqs = { ...this.record.seqs, [clientId]: payload.seq };
    this.setState(applyPlayerAction(this.record.state, clientId, payload.action, Date.now()));
  }
}
