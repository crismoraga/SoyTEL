import { topicMatches } from '@/realtime/mqttPackets';
import type { LinkStatus } from '@/realtime/mqttClient';
import type { RouteClock } from '@/route/clock';
import { pillarIds } from '@/route/content';
import { DEFAULT_SETTINGS, MIN_B215_MS, MIN_PROJECT_MS } from '@/route/engine';
import { HostController, newHostRecord, type HostOptions } from '@/route/host';
import type { RouteLink } from '@/route/link';
import { MemberController } from '@/route/member';
import { compareAuthority, generateRouteCode } from '@/route/protocol';
import { getRouteQuestion } from '@/route/quizBank';
import { FencedError, type HostLock, type HostLockProvider, type HostRecord, type HostStore, type MemberCredentials, type MemberStore } from '@/route/storage';
import type { RouteSettings, RouteSnapshot } from '@/route/types';

// Banco de pruebas determinista del multijugador: anfitrión y participantes REALES (mismo código que
// la app, con su cifrado y firmas), sobre una red simulada que permite perder, demorar, duplicar y
// reordenar mensajes por destinatario, cortar conexiones, caer brokers y negar suscripciones.
// El tiempo es el reloj virtual de Jest; el almacenamiento es en memoria y admite fallos inyectados.

export type Kind = 'hello' | 'state' | 'join' | 'up' | 'dm' | 'other';

export interface Packet {
  id: number;
  kind: Kind;
  topic: string;
  text: string;
  retain: boolean;
  from: string;
  broker: number;
  sentAt: number;
}

export interface Fate {
  drop?: boolean;
  // Demora adicional en ms.
  delay?: number;
  // Copias extra del mismo mensaje.
  copies?: number;
}

// Decide qué pasa con un mensaje camino a un destinatario. `replay` indica entrega de un retenido al suscribirse.
export type Rule = (packet: Packet, to: string, replay: boolean) => Fate | undefined | void;

// Traza sin contenido: quién publicó qué tipo de mensaje y qué le pasó en el camino.
export interface TraceEvent {
  at: number;
  event: 'pub' | 'recv' | 'drop' | 'status' | 'move';
  kind?: Kind;
  from?: string;
  to?: string;
  broker?: number;
  retain?: boolean;
  size?: number;
  detail?: string;
}

function kindOf(topic: string): Kind {
  const parts = topic.split('/');
  const tail = parts[parts.length - 1];
  if (tail === 'hello' || tail === 'state') return tail;
  const group = parts[parts.length - 2];
  return group === 'join' || group === 'up' || group === 'dm' ? group : 'other';
}

class SimBroker {
  up = true;
  retained = new Map<string, Packet>();
  links = new Set<SimLink>();
}

export class SimNet {
  readonly brokers: SimBroker[];
  readonly trace: TraceEvent[] = [];
  // Todo lo publicado, con contenido (solo para que las pruebas inspeccionen o reinyecten mensajes).
  readonly sent: Packet[] = [];
  // Demora base de cada entrega (ms).
  latency = 8;
  private rules: Rule[] = [];
  private nextPacket = 1;
  private denied = new Set<string>();

  constructor(brokerCount = 1) {
    this.brokers = Array.from({ length: brokerCount }, () => new SimBroker());
  }

  link(name: string, brokerIndex = 0): SimLink {
    return new SimLink(this, name, brokerIndex);
  }

  // Agrega una regla de fallos; devuelve cómo quitarla.
  rule(rule: Rule): () => void {
    this.rules.push(rule);
    return () => {
      this.rules = this.rules.filter((item) => item !== rule);
    };
  }

  clearRules() {
    this.rules = [];
  }

  setBrokerUp(index: number, up: boolean) {
    const broker = this.brokers[index];
    broker.up = up;
    if (!up) {
      [...broker.links].forEach((link) => link.dropFromBroker());
    } else {
      this.allLinks.forEach((link) => link.retry());
    }
  }

  denySubscriptions(index: number, name: string, denied = true) {
    const key = `${index}:${name}`;
    if (denied) this.denied.add(key);
    else this.denied.delete(key);
  }

  isDenied(index: number, name: string): boolean {
    return this.denied.has(`${index}:${name}`);
  }

  readonly allLinks = new Set<SimLink>();

  note(event: TraceEvent) {
    this.trace.push(event);
  }

  // Publica un mensaje ya formado en un broker (para reinyectar copias capturadas).
  inject(brokerIndex: number, topic: string, text: string, retain = false, from = 'intruso') {
    this.route(brokerIndex, from, topic, text, retain);
  }

  route(brokerIndex: number, from: string, topic: string, text: string, retain: boolean) {
    const broker = this.brokers[brokerIndex];
    if (!broker.up) return;
    const packet: Packet = { id: this.nextPacket++, kind: kindOf(topic), topic, text, retain, from, broker: brokerIndex, sentAt: Date.now() };
    this.note({ at: packet.sentAt, event: 'pub', kind: packet.kind, from, broker: brokerIndex, retain, size: text.length });
    this.sent.push(packet);
    if (retain) broker.retained.set(topic, packet);
    broker.links.forEach((link) => {
      if (link.matches(topic)) this.dispatch(packet, link, false);
    });
  }

  dispatch(packet: Packet, link: SimLink, replay: boolean) {
    const fate: Fate = {};
    for (const rule of this.rules) Object.assign(fate, rule(packet, link.name, replay) ?? {});
    if (fate.drop) {
      this.note({ at: Date.now(), event: 'drop', kind: packet.kind, from: packet.from, to: link.name, broker: packet.broker });
      return;
    }
    const copies = 1 + (fate.copies ?? 0);
    for (let copy = 0; copy < copies; copy += 1) {
      setTimeout(
        () => {
          if (!link.isAttachedTo(packet.broker)) return;
          this.note({ at: Date.now(), event: 'recv', kind: packet.kind, from: packet.from, to: link.name, broker: packet.broker, retain: replay });
          link.receive(packet.topic, packet.text, replay);
        },
        this.latency + (fate.delay ?? 0) + copy * 3,
      );
    }
  }

  // Últimos mensajes capturados de un tipo (para pruebas de repetición).
  captured: Packet[] = [];
  capture(kind: Kind): () => void {
    return this.rule((packet) => {
      if (packet.kind === kind && !this.captured.includes(packet)) this.captured.push(packet);
    });
  }
}

interface Queued {
  topic: string;
  text: string;
  retain: boolean;
  key: string | null;
}

// Enlace de un dispositivo con la red simulada. Sigue la semántica del cliente MQTT de la app:
// 'online' solo con la suscripción concedida, cola sin conexión compactada por clave/tópico retenido
// y, al reconectar, primero se avisa el cambio de estado y después sale lo pendiente.
export class SimLink implements RouteLink {
  status: LinkStatus = 'idle';
  private index: number;
  private filters = new Set<string>();
  private queue: Queued[] = [];
  private running = false;
  private connected = true;
  private dead = false;
  private corked = false;
  private attached = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private messageListeners = new Set<(topic: string, text: string, retain: boolean) => void>();
  private statusListeners = new Set<(status: LinkStatus) => void>();
  private brokerListeners = new Set<(index: number) => void>();

  constructor(
    private readonly net: SimNet,
    readonly name: string,
    brokerIndex: number,
  ) {
    this.index = brokerIndex % net.brokers.length;
    net.allLinks.add(this);
  }

  get brokerIndex(): number {
    return this.index;
  }

  get brokerCount(): number {
    return this.net.brokers.length;
  }

  get queued(): number {
    return this.queue.length;
  }

  matches(topic: string): boolean {
    return [...this.filters].some((filter) => topicMatches(filter, topic));
  }

  isAttachedTo(brokerIndex: number): boolean {
    return !this.dead && this.attached && this.index === brokerIndex && this.status === 'online';
  }

  start(): void {
    if (this.running || this.dead) return;
    this.running = true;
    this.attach();
  }

  stop(): void {
    if (this.dead) return;
    this.running = false;
    this.detach();
    this.queue = [];
    this.setStatus('closed');
  }

  // Corte abrupto: el proceso muere sin avisar a nadie (ni siquiera a quien usaba el enlace).
  kill(): void {
    this.dead = true;
    this.running = false;
    this.detach();
    this.messageListeners.clear();
    this.statusListeners.clear();
    this.brokerListeners.clear();
  }

  nudge(): void {
    this.retry();
  }

  retry(): void {
    if (this.running && !this.dead && (this.status === 'offline' || this.status === 'denied')) this.attach();
  }

  moveToNextBroker(): void {
    if (this.dead) return;
    if (this.net.brokers.length < 2) {
      this.retry();
      return;
    }
    this.detach();
    this.index = (this.index + 1) % this.net.brokers.length;
    this.net.note({ at: Date.now(), event: 'move', from: this.name, broker: this.index });
    if (this.running) this.attach();
    this.brokerListeners.forEach((listener) => listener(this.index));
  }

  // Conectividad del dispositivo (Wi-Fi/datos). Sin ella el enlace queda fuera de línea hasta que vuelva.
  setConnected(connected: boolean): void {
    if (this.connected === connected || this.dead) return;
    this.connected = connected;
    if (!connected) this.dropFromBroker();
    else this.retry();
  }

  dropFromBroker(): void {
    if (this.dead || !this.running) return;
    this.detach();
    this.setStatus('offline');
  }

  subscribe(filter: string): void {
    this.filters.add(filter);
    if (this.status === 'online') this.replay(filter);
  }

  publish(topic: string, text: string, options: { retain?: boolean; qos?: 0 | 1; key?: string } = {}): void {
    if (this.dead) return;
    const retain = options.retain ?? false;
    const item: Queued = { topic, text, retain, key: options.key ?? (retain ? `retain:${topic}` : null) };
    if (this.status !== 'online' || this.corked) {
      const index = item.key === null ? -1 : this.queue.findIndex((queued) => queued.key === item.key);
      if (index >= 0) this.queue[index] = item;
      else this.queue.push(item);
      return;
    }
    this.net.route(this.index, this.name, topic, text, retain);
  }

  receive(topic: string, text: string, retain: boolean): void {
    if (this.dead || this.status !== 'online') return;
    this.messageListeners.forEach((listener) => listener(topic, text, retain));
  }

  onMessage(listener: (topic: string, text: string, retain: boolean) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onStatus(listener: (status: LinkStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onBrokerChange(listener: (index: number) => void): () => void {
    this.brokerListeners.add(listener);
    return () => this.brokerListeners.delete(listener);
  }

  private setStatus(status: LinkStatus) {
    if (this.status === status) return;
    this.status = status;
    this.net.note({ at: Date.now(), event: 'status', from: this.name, broker: this.index, detail: status });
    this.statusListeners.forEach((listener) => listener(status));
  }

  private detach() {
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.connectTimer = null;
    this.attached = false;
    this.net.brokers[this.index].links.delete(this);
  }

  private attach() {
    if (this.dead || !this.running) return;
    const broker = this.net.brokers[this.index];
    if (!this.connected || !broker.up) {
      this.setStatus('offline');
      return;
    }
    this.setStatus('connecting');
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.connectTimer = setTimeout(() => {
      this.connectTimer = null;
      if (this.dead || !this.running || !this.connected || !broker.up) return;
      // El broker acepta la conexión pero niega los filtros: no sirve.
      if (this.net.isDenied(this.index, this.name)) {
        this.setStatus('denied');
        return;
      }
      broker.links.add(this);
      this.attached = true;
      this.corked = true;
      this.setStatus('online');
      this.corked = false;
      if (this.status !== 'online') return;
      const pending = this.queue.splice(0);
      const lastByKey = new Map<string, number>();
      pending.forEach((item, position) => {
        if (item.key !== null) lastByKey.set(item.key, position);
      });
      pending.forEach((item, position) => {
        if (item.key !== null && lastByKey.get(item.key) !== position) return;
        this.net.route(this.index, this.name, item.topic, item.text, item.retain);
      });
      this.filters.forEach((filter) => this.replay(filter));
    }, 10);
  }

  private replay(filter: string) {
    const broker = this.net.brokers[this.index];
    broker.retained.forEach((packet, topic) => {
      if (topicMatches(filter, topic)) this.net.dispatch(packet, this, true);
    });
  }
}

// ——— Almacenamiento en memoria con fallos ———

export class MemoryHostStore implements HostStore {
  records = new Map<string, HostRecord>();
  saves = 0;
  // Cantidad de guardados que deben fallar a continuación.
  failNext = 0;
  failAlways = false;
  delayMs = 0;
  private generation = 0;

  // El proceso que guardaba murió: lo que tenía a medio escribir no llega al disco.
  abortPending() {
    this.generation += 1;
  }

  async load(code: string): Promise<HostRecord | null> {
    const record = this.records.get(code);
    return record ? (JSON.parse(JSON.stringify(record)) as HostRecord) : null;
  }

  async save(record: HostRecord): Promise<void> {
    const generation = this.generation;
    if (this.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    if (generation !== this.generation) throw new Error('proceso terminado');
    if (this.failAlways || this.failNext > 0) {
      if (this.failNext > 0) this.failNext -= 1;
      throw new Error('disco lleno');
    }
    const current = this.records.get(record.code);
    if (current && compareAuthority(current, record) > 0) throw new FencedError();
    this.saves += 1;
    this.records.set(record.code, JSON.parse(JSON.stringify(record)) as HostRecord);
  }

  async remove(code: string): Promise<void> {
    this.records.delete(code);
  }
}

export class MemoryMemberStore implements MemberStore {
  record: MemberCredentials | null = null;
  saves = 0;
  failNext = 0;
  failAlways = false;

  async load(): Promise<MemberCredentials | null> {
    return this.record ? (JSON.parse(JSON.stringify(this.record)) as MemberCredentials) : null;
  }

  async save(credentials: MemberCredentials): Promise<void> {
    if (this.failAlways || this.failNext > 0) {
      if (this.failNext > 0) this.failNext -= 1;
      throw new Error('sin espacio');
    }
    this.saves += 1;
    this.record = JSON.parse(JSON.stringify(credentials)) as MemberCredentials;
  }

  async clear(): Promise<void> {
    this.record = null;
  }
}

// Candado exclusivo entre "pestañas" (equivale a Web Locks, con robo).
export class MemoryLocks implements HostLockProvider {
  private holders = new Map<string, { owner: string; onLost?: () => void }>();

  async acquire(code: string, owner: string, options: { steal?: boolean; onLost?: () => void } = {}): Promise<HostLock | null> {
    const current = this.holders.get(code);
    if (current && current.owner !== owner) {
      if (!options.steal) return null;
      current.onLost?.();
    }
    const entry = { owner, onLost: options.onLost };
    this.holders.set(code, entry);
    return {
      release: () => {
        if (this.holders.get(code) === entry) this.holders.delete(code);
      },
    };
  }
}

// Navegador sin Web Locks y con una concesión que no alcanza a ver a la otra pestaña: todas "ganan".
// Lo que evita dos autoridades aquí es la época de conducción.
export class NoLocks implements HostLockProvider {
  async acquire(): Promise<HostLock | null> {
    return { release: () => undefined };
  }
}

// ——— Mundo de prueba ———

export function skewedClock(skewMs = 0): RouteClock {
  return { now: () => Date.now() + skewMs, mono: () => performance.now() };
}

export interface Player {
  name: string;
  member: MemberController;
  link: SimLink;
  store: MemoryMemberStore;
  clock: RouteClock;
}

export interface World {
  net: SimNet;
  code: string;
  hostStore: MemoryHostStore;
  locks: HostLockProvider;
  host: HostController;
  hostLink: SimLink;
  players: Player[];
}

export const advance = (ms: number) => jest.advanceTimersByTimeAsync(ms);

let hostSerial = 0;

export function openHost(world: Pick<World, 'net' | 'hostStore' | 'locks'>, record: HostRecord, options: Partial<HostOptions> & { name?: string; brokerIndex?: number } = {}): { host: HostController; link: SimLink } {
  hostSerial += 1;
  const link = world.net.link(options.name ?? `stand${hostSerial}`, options.brokerIndex ?? record.brokerIndex);
  const host = new HostController(record, link, {
    store: world.hostStore,
    locks: world.locks,
    clock: skewedClock(0),
    owner: (0xa00000000000 + hostSerial).toString(16),
    ...options,
  });
  return { host, link };
}

export async function createWorld(
  options: { brokers?: number; settings?: Partial<RouteSettings>; locks?: HostLockProvider; hostOptions?: Partial<HostOptions>; hostBroker?: number } = {},
): Promise<World> {
  const net = new SimNet(options.brokers ?? 1);
  const hostStore = new MemoryHostStore();
  const locks = options.locks ?? new MemoryLocks();
  const brokerIndex = options.hostBroker ?? 0;
  const code = generateRouteCode(brokerIndex, net.brokers.length);
  const record = newHostRecord(code, `sth${code.toLowerCase()}`, brokerIndex, { quizQuestions: 3, ...options.settings }, Date.now(), 'a00000000000');
  const { host, link } = openHost({ net, hostStore, locks }, record, options.hostOptions);
  await host.start();
  await advance(50);
  return { net, code, hostStore, locks, host, hostLink: link, players: [] };
}

export async function addPlayer(
  world: World,
  name: string,
  options: { qr?: boolean; skewMs?: number; brokerIndex?: number; avatar?: number; wait?: number } = {},
): Promise<Player> {
  const clock = skewedClock(options.skewMs ?? 0);
  const store = new MemoryMemberStore();
  const member = new MemberController({ store, clock });
  const link = world.net.link(name, options.brokerIndex ?? world.hostLink.brokerIndex);
  const player: Player = { name, member, link, store, clock };
  world.players.push(player);
  await member.join({ code: world.code, alias: name, avatar: options.avatar ?? 1, fingerprint: options.qr === false ? null : world.host.fingerprint, link });
  await advance(options.wait ?? (options.qr === false ? 2600 : 400));
  return player;
}

export function byName(world: World, name: string): Player {
  const player = world.players.find((item) => item.name === name);
  if (!player) throw new Error(`sin jugador ${name}`);
  return player;
}

// Lo que ve cada pantalla, reducido a lo comparable: fase, parada, revisión y puntajes por alias.
export function digest(snapshot: RouteSnapshot | null) {
  if (!snapshot) return null;
  return {
    phase: snapshot.phase,
    stop: snapshot.stop,
    rev: snapshot.rev,
    quiz: snapshot.quiz ? `${snapshot.quiz.index}:${snapshot.quiz.step}` : null,
    players: snapshot.players.map((player) => `${player.alias}=${player.total}`).sort(),
  };
}

// Convergencia: todas las pantallas indicadas muestran exactamente el estado del anfitrión.
export function expectConverged(world: World, players: Player[] = world.players) {
  const reference = digest(world.host.getView().snapshot);
  players.forEach((player) => {
    expect({ who: player.name, ...digest(player.member.getView().snapshot) }).toEqual({ who: player.name, ...reference });
  });
}

export function phaseOf(player: Player) {
  return player.member.getView().snapshot?.phase;
}

// Etapas de la ruta. Cada una deja al grupo en la fase indicada.

// lobby → jugando en B215
export async function reachB215(world: World, players: Player[] = world.players) {
  world.host.dispatch({ type: 'start' });
  await advance(300);
  players.forEach((player) => player.member.checkin('b215'));
  await advance(400);
}

// jugando en B215 → resultados
export async function finishB215(world: World, players: Player[] = world.players) {
  await advance(DEFAULT_SETTINGS.countdownSeconds * 1000 + MIN_B215_MS + 200);
  players.forEach((player, index) => player.member.submitScore('red-b215', 600 + index * 50, 0.8));
  await advance(500);
}

// resultados → proyectos de B213
export async function reachProjects(world: World, players: Player[] = world.players) {
  await advance(DEFAULT_SETTINGS.resultsSeconds * 1000 + 600);
  players.forEach((player) => player.member.checkin('b213'));
  await advance(400);
}

// proyectos → rumbo al pasillo
export async function finishProjects(world: World, players: Player[] = world.players) {
  for (const game of pillarIds) {
    await advance(MIN_PROJECT_MS + 300);
    players.forEach((player, index) => player.member.submitScore(game, 500 + index * 40, 0.7));
    await advance(300);
  }
  await advance(400);
}

// rumbo al pasillo → trivia
export async function reachQuiz(world: World, players: Player[] = world.players) {
  players.forEach((player) => player.member.checkin('hall'));
  await advance(400);
}

// trivia → podio (todos responden bien)
export async function finishQuiz(world: World, players: Player[] = world.players) {
  for (let guard = 0; guard < 60 && world.host.getView().snapshot.phase === 'quiz'; guard += 1) {
    const quiz = world.host.getView().snapshot.quiz;
    if (!quiz) break;
    if (quiz.step === 'question' && world.host.now() >= quiz.startsAt) {
      const answer = getRouteQuestion(quiz.question.id)!.answer;
      players.forEach((player) => player.member.answer(quiz.index, answer));
      await advance(500);
    } else {
      await advance(1000);
    }
  }
  await advance(600);
}

const STAGES = ['play', 'results', 'projects', 'hall', 'quiz', 'podium'] as const;

// Juega la ruta con los participantes indicados hasta la fase pedida.
export async function playRoute(world: World, players: Player[] = world.players, upTo: (typeof STAGES)[number] = 'podium') {
  const steps = [reachB215, finishB215, reachProjects, finishProjects, reachQuiz, finishQuiz];
  for (let index = 0; index <= STAGES.indexOf(upTo); index += 1) await steps[index](world, players);
}

// Corte abrupto del stand: el proceso muere sin guardar ni avisar.
export function crashHost(world: World) {
  world.hostLink.kill();
  world.hostStore.abortPending();
  world.host.stop(false);
}

// Vuelve a abrir la ruta desde lo guardado (otra pestaña, o la misma tras reiniciar).
export async function reopenHost(world: World, options: Partial<HostOptions> & { name?: string; brokerIndex?: number; force?: boolean } = {}): Promise<HostController> {
  const record = await world.hostStore.load(world.code);
  if (!record) throw new Error('la ruta no quedó guardada');
  const { host, link } = openHost(world, record, options);
  await host.start(options.force);
  await advance(60);
  world.host = host;
  world.hostLink = link;
  return host;
}

// Registra, por pantalla, la secuencia de fases que fue mostrando.
export function trackPhases(world: World, extra: Record<string, HostController> = {}): Record<string, string[]> {
  const seen: Record<string, string[]> = {};
  const push = (name: string, snapshot: RouteSnapshot | null) => {
    if (!snapshot) return;
    const label = `${snapshot.phase}:${snapshot.stop}`;
    const list = (seen[name] ??= []);
    if (list[list.length - 1] !== label) list.push(label);
  };
  world.players.forEach((player) => {
    push(player.name, player.member.getView().snapshot);
    player.member.subscribe(() => push(player.name, player.member.getView().snapshot));
  });
  Object.entries({ stand: world.host, ...extra }).forEach(([name, host]) => {
    push(name, host.getView().snapshot);
    host.subscribe(() => push(name, host.getView().snapshot));
  });
  return seen;
}

export function stopWorld(world: World) {
  world.players.forEach((player) => player.member.reset());
  world.host.stop(false);
}

// Percentil de una lista de tiempos (ms).
export function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}
