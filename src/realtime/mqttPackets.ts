import { concatBytes, utf8Decode, utf8Encode } from './bytes';

// Codificación mínima de MQTT 3.1.1 (lo que usa la ruta: conexión, suscripción, publicación QoS 0/1 y ping).

export const PacketType = {
  CONNECT: 1,
  CONNACK: 2,
  PUBLISH: 3,
  PUBACK: 4,
  SUBSCRIBE: 8,
  SUBACK: 9,
  UNSUBSCRIBE: 10,
  UNSUBACK: 11,
  PINGREQ: 12,
  PINGRESP: 13,
  DISCONNECT: 14,
} as const;

export type QoS = 0 | 1;

export interface ConnectOptions {
  clientId: string;
  keepAlive: number;
  cleanSession: boolean;
  username?: string;
  password?: string;
}

export type IncomingPacket =
  | { type: 'connack'; sessionPresent: boolean; returnCode: number }
  | { type: 'publish'; topic: string; payload: Uint8Array; qos: QoS; retain: boolean; dup: boolean; packetId?: number }
  | { type: 'puback'; packetId: number }
  | { type: 'suback'; packetId: number; granted: number[] }
  | { type: 'unsuback'; packetId: number }
  | { type: 'pingresp' }
  | { type: 'unknown'; code: number };

function encodeLength(length: number): Uint8Array {
  const bytes: number[] = [];
  let value = length;
  do {
    let digit = value % 128;
    value = Math.floor(value / 128);
    if (value > 0) digit |= 0x80;
    bytes.push(digit);
  } while (value > 0);
  return Uint8Array.from(bytes);
}

function encodeString(text: string): Uint8Array {
  const body = utf8Encode(text);
  return concatBytes(Uint8Array.of(body.length >> 8, body.length & 0xff), body);
}

function u16(value: number): Uint8Array {
  return Uint8Array.of((value >> 8) & 0xff, value & 0xff);
}

function packet(firstByte: number, ...body: Uint8Array[]): Uint8Array {
  const content = concatBytes(...body);
  return concatBytes(Uint8Array.of(firstByte), encodeLength(content.length), content);
}

export function encodeConnect(options: ConnectOptions): Uint8Array {
  let flags = 0;
  if (options.cleanSession) flags |= 0x02;
  if (options.username !== undefined) flags |= 0x80;
  if (options.password !== undefined) flags |= 0x40;
  const payload = [encodeString(options.clientId)];
  if (options.username !== undefined) payload.push(encodeString(options.username));
  if (options.password !== undefined) payload.push(encodeString(options.password));
  return packet(PacketType.CONNECT << 4, encodeString('MQTT'), Uint8Array.of(4, flags), u16(options.keepAlive), ...payload);
}

export function encodePublish(topic: string, payload: Uint8Array, options: { qos: QoS; retain: boolean; packetId?: number; dup?: boolean }): Uint8Array {
  let first = PacketType.PUBLISH << 4;
  if (options.dup) first |= 0x08;
  first |= options.qos << 1;
  if (options.retain) first |= 0x01;
  const parts = [encodeString(topic)];
  if (options.qos > 0) parts.push(u16(options.packetId ?? 0));
  parts.push(payload);
  return packet(first, ...parts);
}

export function encodePuback(packetId: number): Uint8Array {
  return packet(PacketType.PUBACK << 4, u16(packetId));
}

export function encodeSubscribe(packetId: number, filters: { topic: string; qos: QoS }[]): Uint8Array {
  const parts = [u16(packetId)];
  filters.forEach((filter) => parts.push(encodeString(filter.topic), Uint8Array.of(filter.qos)));
  return packet((PacketType.SUBSCRIBE << 4) | 0x02, ...parts);
}

export function encodeUnsubscribe(packetId: number, topics: string[]): Uint8Array {
  return packet((PacketType.UNSUBSCRIBE << 4) | 0x02, u16(packetId), ...topics.map(encodeString));
}

export const PINGREQ = Uint8Array.of(PacketType.PINGREQ << 4, 0);
export const DISCONNECT = Uint8Array.of(PacketType.DISCONNECT << 4, 0);

function decodePacket(first: number, body: Uint8Array): IncomingPacket {
  const type = first >> 4;
  switch (type) {
    case PacketType.CONNACK:
      return { type: 'connack', sessionPresent: (body[0] & 1) === 1, returnCode: body[1] };
    case PacketType.PUBLISH: {
      const qos = ((first >> 1) & 3) as QoS;
      const topicLength = (body[0] << 8) | body[1];
      const topic = utf8Decode(body.subarray(2, 2 + topicLength));
      let offset = 2 + topicLength;
      let packetId: number | undefined;
      if (qos > 0) {
        packetId = (body[offset] << 8) | body[offset + 1];
        offset += 2;
      }
      return { type: 'publish', topic, payload: body.slice(offset), qos, retain: (first & 1) === 1, dup: (first & 8) === 8, packetId };
    }
    case PacketType.PUBACK:
      return { type: 'puback', packetId: (body[0] << 8) | body[1] };
    case PacketType.SUBACK:
      return { type: 'suback', packetId: (body[0] << 8) | body[1], granted: Array.from(body.subarray(2)) };
    case PacketType.UNSUBACK:
      return { type: 'unsuback', packetId: (body[0] << 8) | body[1] };
    case PacketType.PINGRESP:
      return { type: 'pingresp' };
    default:
      return { type: 'unknown', code: type };
  }
}

// Acumula bytes del WebSocket y entrega paquetes completos (un frame puede traer varios o solo una parte).
export class PacketReader {
  private buffer: Uint8Array = new Uint8Array(0);

  push(chunk: Uint8Array): IncomingPacket[] {
    this.buffer = this.buffer.length ? concatBytes(this.buffer, chunk) : chunk;
    const packets: IncomingPacket[] = [];
    for (;;) {
      if (this.buffer.length < 2) break;
      let multiplier = 1;
      let length = 0;
      let index = 1;
      let complete = false;
      while (index < this.buffer.length && index <= 4) {
        const digit = this.buffer[index];
        length += (digit & 127) * multiplier;
        multiplier *= 128;
        index += 1;
        if ((digit & 128) === 0) {
          complete = true;
          break;
        }
      }
      if (!complete || this.buffer.length < index + length) break;
      packets.push(decodePacket(this.buffer[0], this.buffer.slice(index, index + length)));
      this.buffer = this.buffer.slice(index + length);
    }
    return packets;
  }

  reset() {
    this.buffer = new Uint8Array(0);
  }
}

// Coincidencia de filtros MQTT con comodines + y #.
export function topicMatches(filter: string, topic: string): boolean {
  const f = filter.split('/');
  const t = topic.split('/');
  for (let i = 0; i < f.length; i += 1) {
    if (f[i] === '#') return true;
    if (i >= t.length) return false;
    if (f[i] !== '+' && f[i] !== t[i]) return false;
  }
  return f.length === t.length;
}
