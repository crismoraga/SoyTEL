import { utf8Encode } from './bytes';
import { monoNow } from './clock';
import {
  DISCONNECT,
  encodeConnect,
  encodePuback,
  encodePublish,
  encodeSubscribe,
  encodeUnsubscribe,
  MAX_PACKET_BYTES,
  PacketReader,
  PINGREQ,
  type IncomingPacket,
  type QoS,
} from './mqttPackets';

// 'online' significa que el broker aceptó la conexión Y concedió todas las suscripciones pedidas.
// 'denied' es un rechazo del broker (credenciales o permisos): reintentar en el mismo no sirve.
export type LinkStatus = 'idle' | 'connecting' | 'online' | 'offline' | 'denied' | 'closed';

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
  subscribeTimeoutMs?: number;
  socketFactory?: SocketFactory;
}

export interface PublishOptions {
  qos?: QoS;
  retain?: boolean;
  // Los mensajes en cola con la misma clave se reemplazan por el más nuevo. Los retenidos usan su
  // tópico como clave: al broker solo le sirve el último valor.
  key?: string;
}

interface PendingPublish {
  topic: string;
  payload: Uint8Array;
  qos: QoS;
  retain: boolean;
  key: string | null;
}

const OPEN = 1;
// Algunos WebSocket emiten 'error' al cerrarlos mientras conectan; sin alguien que lo reciba, lo lanzan.
const ignore = () => undefined;
const MAX_OUTBOX = 300;
const SUBACK_FAILURE = 0x80;
const NUDGE_PING_MS = 4000;

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
  // Suscripciones enviadas que aún esperan el SUBACK del broker (id de paquete → filtros).
  private awaitingSuback = new Map<number, string[]>();
  private outbox: PendingPublish[] = [];
  private inflight = new Map<number, PendingPublish>();
  private nextId = 1;
  private attempts = 0;
  private lastReceived = 0;
  // Cantidad de tramas recibidas en la conexión actual (para saber si algo llegó desde un instante dado).
  private received = 0;
  // El broker ya respondió CONNACK (el estado pasa a 'online' cuando además confirma las suscripciones).
  private connected = false;
  // Mientras se avisa el cambio a 'online', lo que se publique se junta con la cola pendiente.
  private corked = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private subscribeTimer: ReturnType<typeof setTimeout> | null = null;
  private nudgeTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(options: MqttClientOptions) {
    this.options = {
      cleanSession: true,
      keepAlive: 30,
      connectTimeoutMs: 9000,
      subscribeTimeoutMs: 6000,
      socketFactory: defaultFactory,
      ...options,
    };
  }

  get url(): string {
    return this.options.url;
  }

  // Mensajes esperando conexión o confirmación del broker (diagnóstico).
  get queued(): number {
    return this.outbox.length + this.inflight.size;
  }

  connect(): void {
    this.closed = false;
    if (this.socket || this.status === 'connecting') return;
    this.open();
  }

  // Al volver la app al primer plano: reconecta de inmediato o comprueba que la conexión siga viva.
  nudge(): void {
    if (this.closed || this.status === 'connecting' || this.status === 'denied') return;
    if (this.status === 'online') {
      // Un socket puede seguir "abierto" tras suspender el equipo: se pide un ping y, sin respuesta, se corta.
      if (this.nudgeTimer) return;
      const before = this.received;
      this.send(PINGREQ);
      this.nudgeTimer = setTimeout(() => {
        this.nudgeTimer = null;
        if (this.status === 'online' && this.received === before) this.drop();
      }, NUDGE_PING_MS);
      return;
    }
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.open();
  }

  close(): void {
    this.closed = true;
    this.clearTimers();
    if (this.socket) {
      const socket = this.socket;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = ignore;
      socket.onclose = null;
      try {
        if (socket.readyState === OPEN) socket.send(DISCONNECT);
        socket.close();
      } catch {
        // El socket ya estaba cerrado.
      }
    }
    this.socket = null;
    this.connected = false;
    this.outbox = [];
    this.inflight.clear();
    this.awaitingSuback.clear();
    this.setStatus('closed');
  }

  subscribe(topic: string, qos: QoS = 1): void {
    this.subscriptions.set(topic, qos);
    if (this.connected) this.sendSubscribe([[topic, qos]]);
  }

  unsubscribe(topic: string): void {
    this.subscriptions.delete(topic);
    if (this.connected) this.send(encodeUnsubscribe(this.packetId(), [topic]));
  }

  publish(topic: string, payload: Uint8Array | string, options: PublishOptions = {}): boolean {
    const bytes = typeof payload === 'string' ? utf8Encode(payload) : payload;
    // Lo que no cabe en un paquete tampoco lo aceptarían los demás clientes: no se encola.
    if (bytes.length > MAX_PACKET_BYTES - topic.length - 16) return false;
    const retain = options.retain ?? false;
    const item: PendingPublish = {
      topic,
      payload: bytes,
      qos: options.qos ?? 1,
      retain,
      key: options.key ?? (retain ? `retain:${topic}` : null),
    };
    if (this.status !== 'online' || this.corked) {
      this.enqueue(item);
      return true;
    }
    this.sendPublish(item);
    return true;
  }

  private enqueue(item: PendingPublish) {
    if (item.key !== null) {
      const index = this.outbox.findIndex((queued) => queued.key === item.key);
      if (index >= 0) {
        this.outbox[index] = item;
        return;
      }
    }
    this.outbox.push(item);
    if (this.outbox.length > MAX_OUTBOX) this.outbox.shift();
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

  private sendSubscribe(filters: [string, QoS][]) {
    const id = this.packetId();
    this.awaitingSuback.set(
      id,
      filters.map(([topic]) => topic),
    );
    this.send(encodeSubscribe(id, filters.map(([topic, qos]) => ({ topic, qos }))));
    if (!this.subscribeTimer) this.subscribeTimer = setTimeout(() => this.drop(), this.options.subscribeTimeoutMs);
  }

  private packetId(): number {
    // No reutiliza un id que aún espera confirmación.
    for (let tries = 0; tries < 65535; tries += 1) {
      const id = this.nextId;
      this.nextId = this.nextId >= 65535 ? 1 : this.nextId + 1;
      if (!this.inflight.has(id) && !this.awaitingSuback.has(id)) return id;
    }
    return this.nextId;
  }

  private setStatus(status: LinkStatus) {
    if (this.status === status) return;
    this.status = status;
    this.onStatus?.(status);
  }

  private open() {
    this.clearTimers();
    this.reader.reset();
    this.connected = false;
    this.awaitingSuback.clear();
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
      if (this.socket !== socket) return;
      const bytes = toBytes(event.data);
      if (!bytes) return;
      this.lastReceived = monoNow();
      this.received += 1;
      for (const incoming of this.reader.push(bytes)) {
        if (this.socket !== socket) return;
        this.handle(incoming);
      }
    };
    socket.onerror = () => this.socket === socket && this.drop();
    socket.onclose = () => this.socket === socket && this.drop();
  }

  private handle(incoming: IncomingPacket) {
    switch (incoming.type) {
      case 'connack':
        if (this.connected) return;
        if (incoming.returnCode !== 0) {
          // 4 y 5: usuario/clave incorrectos o cliente no autorizado. Insistir no cambia el resultado.
          if (incoming.returnCode === 4 || incoming.returnCode === 5) this.deny();
          else this.drop();
          return;
        }
        if (this.connectTimer) clearTimeout(this.connectTimer);
        this.connectTimer = null;
        this.connected = true;
        if (this.subscriptions.size > 0) this.sendSubscribe([...this.subscriptions]);
        else this.becomeOnline();
        break;
      case 'suback': {
        const filters = this.awaitingSuback.get(incoming.packetId);
        if (!filters) return;
        this.awaitingSuback.delete(incoming.packetId);
        // El broker puede aceptar la conexión y negar un filtro: sin él no llegan mensajes.
        if (incoming.granted.length < filters.length || incoming.granted.some((code) => code === SUBACK_FAILURE)) {
          this.deny();
          return;
        }
        if (this.awaitingSuback.size === 0) {
          if (this.subscribeTimer) clearTimeout(this.subscribeTimer);
          this.subscribeTimer = null;
          if (this.status !== 'online') this.becomeOnline();
        }
        break;
      }
      case 'publish':
        if (incoming.qos === 1 && incoming.packetId !== undefined) this.send(encodePuback(incoming.packetId));
        this.onMessage?.(incoming.topic, incoming.payload, incoming.retain);
        break;
      case 'puback':
        this.inflight.delete(incoming.packetId);
        break;
      case 'malformed':
        this.drop();
        break;
      default:
        break;
    }
  }

  // Conexión lista: avisa a quien escucha y recién entonces envía lo pendiente, compactado.
  private becomeOnline() {
    this.attempts = 0;
    this.startPing();
    this.corked = true;
    try {
      this.setStatus('online');
    } finally {
      this.corked = false;
    }
    if (this.status === 'online') this.flush();
  }

  // Reenvía lo que no alcanzó confirmación y luego la cola, en orden. De cada clave (por ejemplo un
  // tópico retenido) solo viaja el mensaje más nuevo: el estado viejo nunca queda como último valor.
  private flush() {
    const queue: { item: PendingPublish; id?: number }[] = [
      ...[...this.inflight].map(([id, item]) => ({ item, id })),
      ...this.outbox.splice(0).map((item) => ({ item })),
    ];
    const lastByKey = new Map<string, number>();
    queue.forEach((entry, index) => {
      if (entry.item.key !== null) lastByKey.set(entry.item.key, index);
    });
    queue.forEach((entry, index) => {
      const superseded = entry.item.key !== null && lastByKey.get(entry.item.key) !== index;
      if (superseded) {
        if (entry.id !== undefined) this.inflight.delete(entry.id);
        return;
      }
      if (entry.id !== undefined) this.sendPublish(entry.item, true, entry.id);
      else this.sendPublish(entry.item);
    });
  }

  private startPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    const interval = Math.max(5, this.options.keepAlive * 0.6) * 1000;
    this.pingTimer = setInterval(() => {
      if (monoNow() - this.lastReceived > this.options.keepAlive * 1600) {
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

  private detachSocket() {
    const socket = this.socket;
    this.socket = null;
    this.connected = false;
    this.awaitingSuback.clear();
    this.clearTimers();
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = ignore;
      socket.onclose = null;
      try {
        socket.close();
      } catch {
        // Ignorado: ya cerrado.
      }
    }
  }

  // Cierra el socket actual y agenda la reconexión.
  private drop() {
    this.detachSocket();
    if (this.closed) return;
    this.setStatus('offline');
    this.scheduleRetry();
  }

  // El broker rechazó a este cliente: se detiene sin reintentar (quien lo usa decide cambiar de broker).
  private deny() {
    this.detachSocket();
    if (this.closed) return;
    this.setStatus('denied');
  }

  private scheduleRetry() {
    if (this.closed) return;
    // Espera exponencial con variación completa: evita que todo el grupo reconecte al mismo tiempo.
    const ceiling = Math.min(10_000, 700 * 2 ** this.attempts);
    const delay = ceiling / 2 + Math.random() * (ceiling / 2);
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
    if (this.subscribeTimer) clearTimeout(this.subscribeTimer);
    if (this.nudgeTimer) clearTimeout(this.nudgeTimer);
    this.pingTimer = null;
    this.connectTimer = null;
    this.retryTimer = null;
    this.subscribeTimer = null;
    this.nudgeTimer = null;
  }
}
