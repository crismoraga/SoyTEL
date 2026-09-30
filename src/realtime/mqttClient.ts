import { utf8Encode } from './bytes';
import {
  DISCONNECT,
  encodeConnect,
  encodePuback,
  encodePublish,
  encodeSubscribe,
  encodeUnsubscribe,
  PacketReader,
  PINGREQ,
  type IncomingPacket,
  type QoS,
} from './mqttPackets';

export type LinkStatus = 'idle' | 'connecting' | 'online' | 'offline' | 'closed';

type SocketLike = {
  binaryType: string;
  readyState: number;
  onopen: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  send(data: Uint8Array | ArrayBuffer): void;
  close(): void;
};

type SocketFactory = (url: string, protocols: string[]) => SocketLike;

export interface MqttClientOptions {
  url: string;
  clientId: string;
  cleanSession?: boolean;
  keepAlive?: number;
  username?: string;
  password?: string;
  connectTimeoutMs?: number;
  socketFactory?: SocketFactory;
}

interface PendingPublish {
  topic: string;
  payload: Uint8Array;
  qos: QoS;
  retain: boolean;
}

const OPEN = 1;
const MAX_OUTBOX = 300;

function defaultFactory(url: string, protocols: string[]): SocketLike {
  const Socket = (globalThis as unknown as { WebSocket: new (url: string, protocols: string[]) => SocketLike }).WebSocket;
  return new Socket(url, protocols);
}

function toBytes(data: unknown): Uint8Array | null {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return null;
}

// Cliente MQTT 3.1.1 sobre WebSocket con reconexión, keepalive y cola de publicaciones.
export class MqttClient {
  status: LinkStatus = 'idle';
  onStatus?: (status: LinkStatus) => void;
  onMessage?: (topic: string, payload: Uint8Array, retain: boolean) => void;

  private readonly options: Required<Omit<MqttClientOptions, 'username' | 'password'>> & Pick<MqttClientOptions, 'username' | 'password'>;
  private socket: SocketLike | null = null;
  private reader = new PacketReader();
  private subscriptions = new Map<string, QoS>();
  private outbox: PendingPublish[] = [];
  private inflight = new Map<number, PendingPublish>();
  private nextId = 1;
  private attempts = 0;
  private lastReceived = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(options: MqttClientOptions) {
    this.options = {
      cleanSession: true,
      keepAlive: 30,
      connectTimeoutMs: 9000,
      socketFactory: defaultFactory,
      ...options,
    };
  }

  get url(): string {
    return this.options.url;
  }

  connect(): void {
    this.closed = false;
    if (this.socket || this.status === 'connecting') return;
    this.open();
  }

  // Reintenta de inmediato si está desconectado (al volver la app al primer plano).
  nudge(): void {
    if (this.closed || this.status === 'online' || this.status === 'connecting') return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.open();
  }

  close(): void {
    this.closed = true;
    this.clearTimers();
    if (this.socket) {
      try {
        if (this.socket.readyState === OPEN) this.socket.send(DISCONNECT);
        this.socket.close();
      } catch {
        // El socket ya estaba cerrado.
      }
    }
    this.socket = null;
    this.setStatus('closed');
  }

  subscribe(topic: string, qos: QoS = 1): void {
    this.subscriptions.set(topic, qos);
    if (this.status === 'online') this.send(encodeSubscribe(this.packetId(), [{ topic, qos }]));
  }

  unsubscribe(topic: string): void {
    this.subscriptions.delete(topic);
    if (this.status === 'online') this.send(encodeUnsubscribe(this.packetId(), [topic]));
  }

  publish(topic: string, payload: Uint8Array | string, options: { qos?: QoS; retain?: boolean } = {}): void {
    const item: PendingPublish = {
      topic,
      payload: typeof payload === 'string' ? utf8Encode(payload) : payload,
      qos: options.qos ?? 1,
      retain: options.retain ?? false,
    };
    if (this.status !== 'online') {
      this.outbox.push(item);
      if (this.outbox.length > MAX_OUTBOX) this.outbox.shift();
      return;
    }
    this.sendPublish(item);
  }

  private sendPublish(item: PendingPublish, dup = false, reuseId?: number) {
    if (item.qos === 0) {
      this.send(encodePublish(item.topic, item.payload, { qos: 0, retain: item.retain }));
      return;
    }
    const id = reuseId ?? this.packetId();
    this.inflight.set(id, item);
    this.send(encodePublish(item.topic, item.payload, { qos: 1, retain: item.retain, packetId: id, dup }));
  }

  private packetId(): number {
    const id = this.nextId;
    this.nextId = this.nextId >= 65535 ? 1 : this.nextId + 1;
    return id;
  }

  private setStatus(status: LinkStatus) {
    if (this.status === status) return;
    this.status = status;
    this.onStatus?.(status);
  }

  private open() {
    this.clearTimers();
    this.reader.reset();
    this.setStatus('connecting');
    let socket: SocketLike;
    try {
      socket = this.options.socketFactory(this.options.url, ['mqtt']);
    } catch {
      this.scheduleRetry();
      return;
    }
    socket.binaryType = 'arraybuffer';
    this.socket = socket;
    this.connectTimer = setTimeout(() => this.drop(), this.options.connectTimeoutMs);

    socket.onopen = () => {
      socket.send(
        encodeConnect({
          clientId: this.options.clientId,
          keepAlive: this.options.keepAlive,
          cleanSession: this.options.cleanSession,
          username: this.options.username,
          password: this.options.password,
        }),
      );
    };
    socket.onmessage = (event) => {
      const bytes = toBytes(event.data);
      if (!bytes) return;
      this.lastReceived = Date.now();
      this.reader.push(bytes).forEach((incoming) => this.handle(incoming));
    };
    socket.onerror = () => this.drop();
    socket.onclose = () => this.drop();
  }

  private handle(incoming: IncomingPacket) {
    switch (incoming.type) {
      case 'connack':
        if (incoming.returnCode !== 0) {
          this.drop();
          return;
        }
        if (this.connectTimer) clearTimeout(this.connectTimer);
        this.connectTimer = null;
        this.attempts = 0;
        this.setStatus('online');
        this.startPing();
        if (this.subscriptions.size > 0) {
          this.send(encodeSubscribe(this.packetId(), [...this.subscriptions].map(([topic, qos]) => ({ topic, qos }))));
        }
        // Reenvía lo pendiente: primero lo que no alcanzó confirmación, luego la cola.
        [...this.inflight].forEach(([id, item]) => this.sendPublish(item, true, id));
        this.outbox.splice(0).forEach((item) => this.sendPublish(item));
        break;
      case 'publish':
        if (incoming.qos === 1 && incoming.packetId !== undefined) this.send(encodePuback(incoming.packetId));
        this.onMessage?.(incoming.topic, incoming.payload, incoming.retain);
        break;
      case 'puback':
        this.inflight.delete(incoming.packetId);
        break;
      default:
        break;
    }
  }

  private startPing() {
    const interval = Math.max(5, this.options.keepAlive * 0.6) * 1000;
    this.pingTimer = setInterval(() => {
      if (Date.now() - this.lastReceived > this.options.keepAlive * 1600) {
        this.drop();
        return;
      }
      this.send(PINGREQ);
    }, interval);
  }

  private send(bytes: Uint8Array) {
    if (!this.socket || this.socket.readyState !== OPEN) return;
    try {
      this.socket.send(bytes);
    } catch {
      this.drop();
    }
  }

  // Cierra el socket actual y agenda la reconexión.
  private drop() {
    const socket = this.socket;
    this.socket = null;
    this.clearTimers();
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      try {
        socket.close();
      } catch {
        // Ignorado: ya cerrado.
      }
    }
    if (this.closed) return;
    this.setStatus('offline');
    this.scheduleRetry();
  }

  private scheduleRetry() {
    if (this.closed) return;
    const delay = Math.min(10_000, 700 * 2 ** this.attempts) + Math.random() * 400;
    this.attempts = Math.min(this.attempts + 1, 6);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.open();
    }, delay);
  }

  private clearTimers() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.connectTimer) clearTimeout(this.connectTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.pingTimer = null;
    this.connectTimer = null;
    this.retryTimer = null;
  }
}
