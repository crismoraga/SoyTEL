import { brokerAuth, brokerUrls } from '@/realtime/config';
import { utf8Decode } from '@/realtime/bytes';
import { randomHex } from '@/realtime/crypto';
import { MqttClient, type LinkStatus, type MqttClientOptions } from '@/realtime/mqttClient';
import { topicMatches } from '@/realtime/mqttPackets';

export type { LinkStatus };

type MessageListener = (topic: string, text: string, retain: boolean) => void;
type StatusListener = (status: LinkStatus) => void;

// Estado de la conexión con un servidor.
export interface BrokerState {
  index: number;
  status: LinkStatus;
}

// Canal publicar/suscribir que usan el anfitrión y los participantes.
export interface RouteLink {
  readonly status: LinkStatus;
  readonly brokerIndex: number;
  readonly brokerCount: number;
  // Servidores con los que este enlace mantiene conexión (uno solo, salvo el del stand).
  readonly brokers?: BrokerState[];
  start(): void;
  stop(): void;
  nudge(): void;
  moveToNextBroker(): void;
  // La conexión se cayó: reconectar por cualquier servidor (los enlaces que saben, prueban todos a la vez).
  reconnectAny?(): void;
  subscribe(filter: string): void;
  // `key`: mientras no haya conexión, un mensaje nuevo con la misma clave reemplaza al anterior en la cola.
  publish(topic: string, text: string, options?: { retain?: boolean; qos?: 0 | 1; key?: string }): void;
  onMessage(listener: MessageListener): () => void;
  onStatus(listener: StatusListener): () => void;
  onBrokerChange(listener: (index: number) => void): () => void;
}

class Emitter<T extends unknown[]> {
  private listeners = new Set<(...args: T) => void>();
  add(listener: (...args: T) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emit(...args: T) {
    this.listeners.forEach((listener) => listener(...args));
  }
}

const DENIED_RETRY_MS = 20_000;
// En la carrera entre servidores: cuánto se espera, desde que conecta el primero, a que alguno traiga
// mensajes de la ruta antes de seguir con ese primero.
const RACE_QUIET_MS = 2500;

// Identificador de una conexión MQTT (23 caracteres, lo que todo servidor acepta). Es de la conexión,
// no de la ruta ni del participante: un servidor MQTT cierra la conexión anterior cuando entra otra con
// el mismo identificador, así que dos pantallas (o dos pestañas) que lo compartieran se echarían una a
// otra sin parar. Quién es quién lo dicen las llaves y los tópicos, no este valor.
export function connectionId(prefix: string): string {
  return `${prefix}${randomHex(10)}`.slice(0, 23);
}

export interface MqttLinkOptions {
  // Al iniciar, conecta a todos los servidores a la vez y se queda con el primero que responde.
  // El stand está en todos, así que el teléfono entra por el que su red alcance más rápido.
  race?: boolean;
  // Comienzo del identificador de conexión (para reconocerla en el servidor al diagnosticar).
  idPrefix?: string;
  socketFactory?: MqttClientOptions['socketFactory'];
}

// Enlace MQTT de un participante: una conexión a la vez, con cambio de servidor si el suyo deja de responder.
// La sesión es limpia: al reconectar, el servidor entrega el último estado (retenido) y lo demás lo
// recupera el protocolo (reintentos con confirmación). Así no quedan sesiones ni mensajes acumulados
// en servidores que este teléfono dejó de usar.
export class MqttRouteLink implements RouteLink {
  readonly connectionId: string;
  private client: MqttClient | null = null;
  // Conexiones en carrera al iniciar (ver `race`).
  private racers: MqttClient[] = [];
  private filters = new Set<string>();
  private messages = new Emitter<[string, string, boolean]>();
  private statuses = new Emitter<[LinkStatus]>();
  private brokerChanges = new Emitter<[number]>();
  private index: number;
  private running = false;
  private deniedTimer: ReturnType<typeof setTimeout> | null = null;
  private raceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastStatus: LinkStatus = 'idle';

  constructor(
    initialIndex: number,
    private readonly urls: string[] = brokerUrls,
    private readonly options: MqttLinkOptions = {},
  ) {
    this.index = ((initialIndex % urls.length) + urls.length) % urls.length;
    this.connectionId = connectionId(options.idPrefix ?? 'stp');
  }

  get status(): LinkStatus {
    if (this.client) return this.client.status;
    if (this.racers.length > 0) return this.raceStatus();
    return this.running ? 'connecting' : this.lastStatus === 'closed' ? 'closed' : 'idle';
  }

  get brokerIndex(): number {
    return this.index;
  }

  get brokerCount(): number {
    return this.urls.length;
  }

  get brokers(): BrokerState[] {
    return [{ index: this.index, status: this.status }];
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    if (this.options.race && this.urls.length > 1) this.openRace();
    else this.open();
  }

  stop(): void {
    this.running = false;
    if (this.deniedTimer) clearTimeout(this.deniedTimer);
    this.deniedTimer = null;
    this.closeAll();
    this.report('closed');
  }

  private closeAll() {
    if (this.raceTimer) clearTimeout(this.raceTimer);
    this.raceTimer = null;
    const racers = this.racers;
    this.racers = [];
    racers.forEach((racer) => racer.close());
    const client = this.client;
    this.client = null;
    client?.close();
  }

  nudge(): void {
    this.client?.nudge();
    this.racers.forEach((racer) => racer.nudge());
  }

  moveToNextBroker(): void {
    if (this.deniedTimer) clearTimeout(this.deniedTimer);
    this.deniedTimer = null;
    if (this.urls.length < 2) {
      // Con un solo broker no hay a dónde mudarse: se reintenta en el mismo.
      if (this.client?.status === 'denied' && this.running) {
        this.client.close();
        this.client = null;
        this.open();
      } else {
        this.nudge();
      }
      return;
    }
    this.index = (this.index + 1) % this.urls.length;
    this.closeAll();
    if (this.running) this.open();
    this.brokerChanges.emit(this.index);
  }

  // Se perdió la conexión y no vuelve: en vez de probar los servidores de a uno (y pagar la espera de
  // cada uno que no responda), se intenta con todos a la vez. Mientras la carrera sigue, cada conexión
  // reintenta sola; pedirlo de nuevo no la reinicia.
  reconnectAny(): void {
    if (!this.running) return;
    if (!this.options.race || this.urls.length < 2) {
      this.moveToNextBroker();
      return;
    }
    if (this.racers.length > 0) return;
    if (this.deniedTimer) clearTimeout(this.deniedTimer);
    this.deniedTimer = null;
    this.closeAll();
    this.openRace();
  }

  subscribe(filter: string): void {
    this.filters.add(filter);
    this.client?.subscribe(filter, 1);
    this.racers.forEach((racer) => racer.subscribe(filter, 1));
  }

  publish(topic: string, text: string, options: { retain?: boolean; qos?: 0 | 1; key?: string } = {}): void {
    this.client?.publish(topic, text, { retain: options.retain ?? false, qos: options.qos ?? 1, key: options.key });
  }

  onMessage(listener: MessageListener): () => void {
    return this.messages.add(listener);
  }

  onStatus(listener: StatusListener): () => void {
    return this.statuses.add(listener);
  }

  onBrokerChange(listener: (index: number) => void): () => void {
    return this.brokerChanges.add(listener);
  }

  private report(status: LinkStatus) {
    if (this.lastStatus === status) return;
    this.lastStatus = status;
    this.statuses.emit(status);
  }

  private raceStatus(): LinkStatus {
    const states = this.racers.map((racer) => racer.status);
    // Una que ya conectó pero aún no gana la carrera cuenta como "conectando".
    if (states.some((state) => state === 'connecting' || state === 'idle' || state === 'online')) return 'connecting';
    return states.every((state) => state === 'denied') ? 'denied' : 'offline';
  }

  private create(index: number): MqttClient {
    const client = new MqttClient({
      url: this.urls[index],
      clientId: this.connectionId,
      cleanSession: true,
      keepAlive: 30,
      username: brokerAuth.username,
      password: brokerAuth.password,
      ...(this.options.socketFactory ? { socketFactory: this.options.socketFactory } : {}),
    });
    this.filters.forEach((filter) => client.subscribe(filter, 1));
    return client;
  }

  private adopt(client: MqttClient) {
    this.client = client;
    client.onStatus = (status) => {
      if (this.client !== client) return;
      // Rechazo del único broker configurado: se vuelve a intentar más tarde (pudo ser un permiso temporal).
      if (status === 'denied' && this.urls.length < 2 && !this.deniedTimer) {
        this.deniedTimer = setTimeout(() => {
          this.deniedTimer = null;
          if (this.running && this.client?.status === 'denied') this.moveToNextBroker();
        }, DENIED_RETRY_MS);
      }
      this.report(status);
    };
    client.onMessage = (topic, payload, retain) => {
      if (this.client === client) this.messages.emit(topic, utf8Decode(payload), retain);
    };
  }

  private open() {
    const client = this.create(this.index);
    this.adopt(client);
    client.connect();
  }

  // Carrera entre servidores: gana la primera conexión por la que llega algo de la ruta (el stand deja
  // su saludo y su estado guardados en cada servidor donde está), no la primera que conecta: así no se
  // elige un servidor rápido donde el stand no está. Si ninguna trae nada en un momento, se sigue con
  // la primera que conectó, y una ruta que no existe se informa igual. Las demás se cierran.
  private openRace() {
    const racers = this.urls.map((_, index) => this.create(index));
    this.racers = racers;
    const early = new Map<MqttClient, [string, Uint8Array, boolean][]>();
    const win = (racer: MqttClient) => {
      if (!this.racers.includes(racer)) return;
      if (this.raceTimer) clearTimeout(this.raceTimer);
      this.raceTimer = null;
      const others = this.racers.filter((item) => item !== racer);
      this.racers = [];
      others.forEach((other) => other.close());
      const index = racers.indexOf(racer);
      const moved = index !== this.index;
      this.index = index;
      this.adopt(racer);
      if (moved) this.brokerChanges.emit(index);
      this.report(racer.status);
      // Lo que llegó durante la carrera se entrega ahora, en orden.
      (early.get(racer) ?? []).forEach(([topic, payload, retain]) => {
        if (this.client === racer) this.messages.emit(topic, utf8Decode(payload), retain);
      });
    };
    racers.forEach((racer) => {
      racer.onStatus = (status) => {
        if (!this.racers.includes(racer)) return;
        if (status === 'online' && !this.raceTimer) {
          this.raceTimer = setTimeout(() => {
            this.raceTimer = null;
            const first = this.racers.find((item) => item.status === 'online');
            if (first) win(first);
          }, RACE_QUIET_MS);
        }
        this.report(this.raceStatus());
      };
      racer.onMessage = (topic, payload, retain) => {
        const list = early.get(racer) ?? [];
        list.push([topic, payload, retain]);
        early.set(racer, list);
        win(racer);
      };
      racer.connect();
    });
    this.report('connecting');
  }
}

// Enlace del stand: conectado a TODOS los servidores a la vez. Publica en todos y escucha en todos,
// así cada teléfono puede entrar y jugar por el servidor que su red alcance, y la caída de uno no
// detiene la ruta. Los mensajes repetidos entre servidores no hacen daño: el protocolo los reconoce.
export class MultiRouteLink implements RouteLink {
  readonly connectionId: string;
  private clients: MqttClient[] = [];
  private filters = new Set<string>();
  private messages = new Emitter<[string, string, boolean]>();
  private statuses = new Emitter<[LinkStatus]>();
  private running = false;
  private lastStatus: LinkStatus = 'idle';
  private primary: number;

  constructor(
    primaryIndex: number,
    private readonly urls: string[] = brokerUrls,
    private readonly options: Pick<MqttLinkOptions, 'socketFactory' | 'idPrefix'> = {},
  ) {
    this.primary = ((primaryIndex % urls.length) + urls.length) % urls.length;
    this.connectionId = connectionId(options.idPrefix ?? 'sth');
  }

  // En línea si al menos un servidor está listo.
  get status(): LinkStatus {
    if (this.clients.length === 0) return this.lastStatus === 'closed' ? 'closed' : 'idle';
    const states = this.clients.map((client) => client.status);
    if (states.includes('online')) return 'online';
    if (states.some((state) => state === 'connecting' || state === 'idle')) return 'connecting';
    return states.every((state) => state === 'denied') ? 'denied' : 'offline';
  }

  get brokerIndex(): number {
    return this.primary;
  }

  get brokerCount(): number {
    return this.urls.length;
  }

  get brokers(): BrokerState[] {
    return this.urls.map((_, index) => ({ index, status: this.clients[index]?.status ?? 'idle' }));
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clients = this.urls.map((url) => {
      const client = new MqttClient({
        url,
        clientId: this.connectionId,
        cleanSession: true,
        keepAlive: 30,
        username: brokerAuth.username,
        password: brokerAuth.password,
        ...(this.options.socketFactory ? { socketFactory: this.options.socketFactory } : {}),
      });
      this.filters.forEach((filter) => client.subscribe(filter, 1));
      client.onStatus = () => this.report();
      client.onMessage = (topic, payload, retain) => {
        if (this.clients.includes(client)) this.messages.emit(topic, utf8Decode(payload), retain);
      };
      return client;
    });
    this.clients.forEach((client) => client.connect());
    this.report();
  }

  stop(): void {
    this.running = false;
    const clients = this.clients;
    this.clients = [];
    clients.forEach((client) => client.close());
    this.lastStatus = 'closed';
    this.statuses.emit('closed');
  }

  nudge(): void {
    this.clients.forEach((client) => client.nudge());
  }

  // El stand ya está en todos los servidores: no hay a dónde mudarse. Se reintentan los que no responden
  // (uno rechazado se vuelve a abrir: pudo ser un permiso temporal).
  moveToNextBroker(): void {
    this.clients.forEach((client) => {
      if (client.status === 'denied') client.connect();
      else client.nudge();
    });
  }

  subscribe(filter: string): void {
    this.filters.add(filter);
    this.clients.forEach((client) => client.subscribe(filter, 1));
  }

  publish(topic: string, text: string, options: { retain?: boolean; qos?: 0 | 1; key?: string } = {}): void {
    this.clients.forEach((client) => {
      // A un servidor que rechazó al stand no se le encola nada.
      if (client.status !== 'denied') client.publish(topic, text, { retain: options.retain ?? false, qos: options.qos ?? 1, key: options.key });
    });
  }

  onMessage(listener: MessageListener): () => void {
    return this.messages.add(listener);
  }

  onStatus(listener: StatusListener): () => void {
    return this.statuses.add(listener);
  }

  onBrokerChange(): () => void {
    return () => undefined;
  }

  private report() {
    if (!this.running) return;
    const status = this.status;
    // Un servidor más que se conecta también es un cambio que interesa (se publica el estado en él).
    this.lastStatus = status;
    this.statuses.emit(status);
  }
}

// Bus en memoria para el modo individual (sin Internet) y las pruebas: misma semántica que MQTT.
export class LocalBus {
  private retained = new Map<string, string>();
  private links = new Set<LocalRouteLink>();

  attach(link: LocalRouteLink) {
    this.links.add(link);
    return () => this.links.delete(link);
  }

  publish(topic: string, text: string, retain: boolean) {
    if (retain) this.retained.set(topic, text);
    this.links.forEach((link) => link.deliver(topic, text, false));
  }

  replay(link: LocalRouteLink, filter: string) {
    this.retained.forEach((text, topic) => {
      if (topicMatches(filter, topic)) link.deliver(topic, text, true);
    });
  }
}

export class LocalRouteLink implements RouteLink {
  status: LinkStatus = 'idle';
  readonly brokerIndex = 0;
  readonly brokerCount = 1;
  private filters = new Set<string>();
  private messages = new Emitter<[string, string, boolean]>();
  private statuses = new Emitter<[LinkStatus]>();
  private detach: (() => void) | null = null;

  constructor(private readonly bus: LocalBus) {}

  start(): void {
    if (this.detach) return;
    this.detach = this.bus.attach(this);
    this.status = 'online';
    this.statuses.emit('online');
    this.filters.forEach((filter) => this.bus.replay(this, filter));
  }

  stop(): void {
    this.detach?.();
    this.detach = null;
    this.status = 'closed';
    this.statuses.emit('closed');
  }

  nudge(): void {}

  moveToNextBroker(): void {}

  subscribe(filter: string): void {
    this.filters.add(filter);
    if (this.detach) this.bus.replay(this, filter);
  }

  publish(topic: string, text: string, options: { retain?: boolean } = {}): void {
    // Entrega asíncrona, como en la red real.
    setTimeout(() => this.bus.publish(topic, text, options.retain ?? false), 0);
  }

  deliver(topic: string, text: string, retain: boolean) {
    if (![...this.filters].some((filter) => topicMatches(filter, topic))) return;
    setTimeout(() => this.messages.emit(topic, text, retain), 0);
  }

  onMessage(listener: MessageListener): () => void {
    return this.messages.add(listener);
  }

  onStatus(listener: StatusListener): () => void {
    return this.statuses.add(listener);
  }

  onBrokerChange(): () => void {
    return () => undefined;
  }
}
