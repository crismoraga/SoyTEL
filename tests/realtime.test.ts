import { concatBytes, fromBase64, toBase64, toBase64Url, toHex, utf8Decode, utf8Encode } from '@/realtime/bytes';
import {
  keyFingerprint,
  newBoxKeys,
  newSessionKey,
  newSignKeys,
  openFrom,
  openShared,
  roomIdFor,
  sealShared,
  sealTo,
  signSealed,
  verifySealed,
} from '@/realtime/crypto';
import {
  encodeConnect,
  encodePuback,
  encodePublish,
  encodeSubscribe,
  PacketReader,
  topicMatches,
} from '@/realtime/mqttPackets';

describe('bytes', () => {
  it('round-trips UTF-8 with accents and emoji', () => {
    const text = 'Señal ñandú · 🚀 Telemática';
    expect(utf8Decode(utf8Encode(text))).toBe(text);
    expect(Array.from(utf8Encode('é'))).toEqual([0xc3, 0xa9]);
  });

  it('round-trips base64 for every padding length', () => {
    for (let length = 0; length < 20; length += 1) {
      const bytes = Uint8Array.from({ length }, (_, index) => (index * 37 + 11) % 256);
      expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes));
      expect(Array.from(fromBase64(toBase64Url(bytes)))).toEqual(Array.from(bytes));
    }
    expect(toBase64(utf8Encode('SoyTEL'))).toBe('U295VEVM');
    expect(toHex(Uint8Array.of(0, 15, 255))).toBe('000fff');
  });
});

describe('MQTT packets', () => {
  it('encodes CONNECT with the MQTT 3.1.1 header', () => {
    const bytes = encodeConnect({ clientId: 'stp123', keepAlive: 30, cleanSession: true });
    expect(bytes[0]).toBe(0x10);
    expect(Array.from(bytes.slice(2, 10))).toEqual([0, 4, 77, 81, 84, 84, 4, 0x02]);
    expect((bytes[10] << 8) | bytes[11]).toBe(30);
  });

  it('parses a QoS 1 publish split across frames plus a second packet', () => {
    const payload = utf8Encode(JSON.stringify({ hola: 'ruta' }));
    const publish = encodePublish('soytel/r1/abc/state', payload, { qos: 1, retain: true, packetId: 42 });
    const ack = encodePuback(7);
    const stream = concatBytes(publish, ack);
    const reader = new PacketReader();
    const first = reader.push(stream.slice(0, 5));
    expect(first).toEqual([]);
    const rest = reader.push(stream.slice(5));
    expect(rest).toHaveLength(2);
    const [message, puback] = rest;
    expect(message).toMatchObject({ type: 'publish', topic: 'soytel/r1/abc/state', qos: 1, retain: true, packetId: 42 });
    if (message.type === 'publish') expect(utf8Decode(message.payload)).toBe('{"hola":"ruta"}');
    expect(puback).toEqual({ type: 'puback', packetId: 7 });
  });

  it('handles remaining lengths above 127 bytes', () => {
    const payload = new Uint8Array(5000).fill(65);
    const reader = new PacketReader();
    const [message] = reader.push(encodePublish('t', payload, { qos: 0, retain: false }));
    expect(message.type).toBe('publish');
    if (message.type === 'publish') expect(message.payload.length).toBe(5000);
  });

  it('encodes SUBSCRIBE with the reserved flags', () => {
    const bytes = encodeSubscribe(3, [{ topic: 'a/+', qos: 1 }]);
    expect(bytes[0]).toBe(0x82);
  });

  it('matches topic filters with wildcards', () => {
    expect(topicMatches('soytel/r1/x/up/+', 'soytel/r1/x/up/abc')).toBe(true);
    expect(topicMatches('soytel/r1/x/up/+', 'soytel/r1/x/up/abc/def')).toBe(false);
    expect(topicMatches('soytel/#', 'soytel/r1/x/state')).toBe(true);
    expect(topicMatches('soytel/r1/x/state', 'soytel/r1/y/state')).toBe(false);
  });
});

describe('route crypto', () => {
  it('seals join messages between participant and host', () => {
    const host = newBoxKeys();
    const guest = newBoxKeys();
    const sealed = sealTo('{"alias":"Cris"}', host.publicKey, guest.secretKey);
    expect(openFrom(sealed, guest.publicKey, host.secretKey)).toBe('{"alias":"Cris"}');
    expect(openFrom(sealed, newBoxKeys().publicKey, host.secretKey)).toBeNull();
  });

  it('seals and signs the shared state', () => {
    const key = newSessionKey();
    const signer = newSignKeys();
    const sealed = sealShared('estado', key);
    const signature = signSealed(sealed, signer.secretKey);
    expect(openShared(sealed, key)).toBe('estado');
    expect(openShared(sealed, newSessionKey())).toBeNull();
    expect(verifySealed(sealed, signature, signer.publicKey)).toBe(true);
    expect(verifySealed({ ...sealed, c: sealShared('otro', key).c }, signature, signer.publicKey)).toBe(false);
  });

  it('derives stable, private room ids and fingerprints', () => {
    expect(roomIdFor('ABC234')).toBe(roomIdFor('ABC234'));
    expect(roomIdFor('ABC234')).not.toBe(roomIdFor('ABC235'));
    expect(roomIdFor('ABC234')).not.toContain('ABC234');
    expect(keyFingerprint(newSignKeys().publicKey)).toHaveLength(12);
  });
});
