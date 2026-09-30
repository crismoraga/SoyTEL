import { brokerAuth, brokerUrls } from '@/realtime/config';
import { utf8Decode } from '@/realtime/bytes';
import { MqttClient, type LinkStatus } from '@/realtime/mqttClient';
import { topicMatches } from '@/realtime/mqttPackets';

export type { LinkStatus };

type MessageListener = (topic: string, text: string, retain: boolean) => void;
type StatusListener = (status: LinkStatus) => void;

// Canal publicar/suscribir que usan el anfitrión y los participantes.
export interface RouteLink {
  readonly status: LinkStatus;
  readonly brokerIndex: number;
  readonly brokerCount: number;
  start(): void;
  stop(): void;
  nudge(): void;
  moveToNextBroker(): void;
  subscribe(filter: string): void;
  publish(topic: string, text: string, options?: { retain?: boolean; qos?: 0 | 1 }): void;
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

// Enlace MQTT con cambio de broker (cada lado rota en el mismo orden si el suyo deja de responder).
export class MqttRouteLink implements RouteLink {
  private client: MqttClient | null = null;
  private filters = new Set<string>();
  private messages = new Emitter<[string, string, boolean]>();
  private statuses = new Emitter<[LinkStatus]>();
  private brokers = new Emitter<[number]>();
  private index: number;
  private running = false;

  constructor(
    private readonly clientId: string,
    initialIndex: number,
    private readonly cleanSession: boolean,
    private readonly urls: string[] = brokerUrls,
  ) {
    this.index = ((initialIndex % urls.length) + urls.length) % urls.length;
  }

  get status(): LinkStatus {
    return this.client?.status ?? 'idle';
  }

  get brokerIndex(): number {
    return this.index;
  }

  get brokerCount(): number {
    return this.urls.length;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.open();
  }

  stop(): void {
    this.running = false;
    this.client?.close();
    this.client = null;
  }

  nudge(): void {
    this.client?.nudge();
  }

  moveToNextBroker(): void {
    if (this.urls.length < 2) {
      this.nudge();
      return;
    }
    this.index = (this.index + 1) % this.urls.length;
    this.client?.close();
    this.client = null;
    if (this.running) this.open();
    this.brokers.emit(this.index);
  }

  subscribe(filter: string): void {
    this.filters.add(filter);
    this.client?.subscribe(filter, 1);
  }

  publish(topic: string, text: string, options: { retain?: boolean; qos?: 0 | 1 } = {}): void {
    this.client?.publish(topic, text, { retain: options.retain ?? false, qos: options.qos ?? 1 });
  }

  onMessage(listener: MessageListener): () => void {
    return this.messages.add(listener);
  }

  onStatus(listener: StatusListener): () => void {
    return this.statuses.add(listener);
  }

  onBrokerChange(listener: (index: number) => void): () => void {
    return this.brokers.add(listener);
  }

  private open() {
    const client = new MqttClient({
      url: this.urls[this.index],
      clientId: this.clientId,
      cleanSession: this.cleanSession,
      keepAlive: 30,
      username: brokerAuth.username,
      password: brokerAuth.password,
    });
    client.onStatus = (status) => this.statuses.emit(status);
    client.onMessage = (topic, payload, retain) => this.messages.emit(topic, utf8Decode(payload), retain);
    this.filters.forEach((filter) => client.subscribe(filter, 1));
    this.client = client;
    client.connect();
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
