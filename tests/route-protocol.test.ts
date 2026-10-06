import AsyncStorage from '@react-native-async-storage/async-storage';
import { utf8Encode } from '@/realtime/bytes';
import { deriveRouteSecrets, newBoxKeys, newSessionKey, newSignKeys, pairKey, sealShared, signSealed, verifySealed } from '@/realtime/crypto';
import { MqttClient } from '@/realtime/mqttClient';
import { encodePublish, MAX_PACKET_BYTES, PacketReader } from '@/realtime/mqttPackets';
import { buildQr } from '@/features/route/QrCode';
import { sanitizeJourneyCode } from '@/lib/progression';
import {
  addPlayer,
  applyHostAction,
  createRoute,
  LOBBY_GHOST_MS,
  MAX_PLAYERS,
  resumeRoute,
  SEAT_TTL_MS,
  seatsTaken,
  snapshot,
  submitPlayerAction,
  tick,
} from '@/route/engine';
import { parseJoinLink, parseStandCode } from '@/route/joinLink';
import {
  isNewerStamp,
  openHello,
  parseActionPayload,
  parseDirect,
  parseJoinEnvelope,
  parseJoinRequest,
  parsePlayerAction,
  parseSealedMessage,
  parseSnapshot,
  parseStateEnvelope,
  PROTOCOL_VERSION,
  sealHello,
  stateSignContext,
  type HelloMessage,
} from '@/route/protocol';
import { acquireLease } from '@/route/storage';
import type { RouteState } from '@/route/types';

const T0 = 2_000_000;

function lobby(ids: string[] = ['ana111', 'beto22']): RouteState {
  let state = createRoute('ABC234', T0, 7);
  ids.forEach((id) => {
    const joined = addPlayer(state, { id, alias: id, avatar: 1, boxKey: `pk-${id}` }, T0);
    state = joined.state;
  });
  return state;
}

describe('protocolo · lectura de mensajes de la red (RT-12)', () => {
  it('reconstruye un estado válido y rechaza cualquier campo fuera de contrato', () => {
    const state = applyHostAction(lobby(), { type: 'start' }, T0 + 10);
    const good = snapshot(state, T0 + 20, { epoch: 3, owner: 'a00000000001', pub: 9 });
    expect(parseSnapshot(JSON.stringify(good))).toEqual(good);

    const broken: [string, unknown][] = [
      ['version', 1],
      ['code', 'abc'],
      ['epoch', 0],
      ['epoch', 1.5],
      ['pub', -1],
      ['pub', 9e99],
      ['owner', '<script>'],
      ['rev', '4'],
      ['now', null],
      ['phase', 'hack'],
      ['stop', 'baño'],
      ['players', {}],
      ['players', [{ id: 'x' }]],
      ['players', [{ ...good.players[0], total: Number.NaN }]],
      ['players', [{ ...good.players[0], games: { 'red-b215': 'mil' } }]],
      ['players', [good.players[0], good.players[0]]],
      ['kicked', ['__proto__']],
      ['settings', { ...good.settings, quizQuestions: 0 }],
      ['quiz', { index: 0 }],
      ['deadline', 'mañana'],
    ];
    broken.forEach(([key, value]) => expect({ key, parsed: parseSnapshot(JSON.stringify({ ...good, [key]: value })) }).toEqual({ key, parsed: null }));
    expect(parseSnapshot('[]')).toBeNull();
    expect(parseSnapshot('null')).toBeNull();
    expect(parseSnapshot('x'.repeat(400_000))).toBeNull();
    expect(parseSnapshot(null)).toBeNull();
  });

  it('descarta juegos y claves ajenas dentro de un estado', () => {
    const state = applyHostAction(lobby(), { type: 'start' }, T0 + 10);
    const good = snapshot(state, T0 + 20);
    const raw = JSON.parse(JSON.stringify(good));
    raw.players[0].games = { 'red-b215': 500, inventado: 1000, __proto__: { x: 1 }, constructor: 5 };
    raw.extra = { admin: true };
    const parsed = parseSnapshot(JSON.stringify(raw))!;
    expect(parsed.players[0].games).toEqual({ 'red-b215': 500 });
    expect(Object.keys(parsed)).not.toContain('extra');
    expect(({} as { x?: number }).x).toBeUndefined();
  });

  it('valida acciones: lista cerrada de tipos, paradas y juegos; números finitos y enteros donde corresponde', () => {
    expect(parsePlayerAction({ type: 'score', game: 'datos', score: 700, accuracy: 0.5 })).toEqual({ type: 'score', game: 'datos', score: 700, accuracy: 0.5 });
    expect(parsePlayerAction({ type: 'checkin', stop: 'hall' })).toEqual({ type: 'checkin', stop: 'hall' });
    expect(parsePlayerAction({ type: 'answer', index: 2, option: 3 })).toEqual({ type: 'answer', index: 2, option: 3 });
    const invalid = [
      null,
      [],
      'score',
      { type: 'score', game: 'inventado', score: 1, accuracy: 1 },
      { type: 'score', game: 'constructor', score: 1, accuracy: 1 },
      { type: 'score', game: 'datos', score: -1, accuracy: 1 },
      { type: 'score', game: 'datos', score: '700', accuracy: 1 },
      { type: 'score', game: 'datos', score: 700 },
      { type: 'checkin', stop: 'stand' },
      { type: 'checkin', stop: ['b215'] },
      { type: 'answer', index: 0.5, option: 0 },
      { type: 'answer', index: -1, option: 0 },
      { type: 'answer', index: 0, option: 99 },
      { type: 'kick', id: 'x' },
      { type: '__proto__' },
    ];
    invalid.forEach((value) => expect({ value, parsed: parsePlayerAction(value) }).toEqual({ value, parsed: null }));

    expect(parseActionPayload('{"k":"act","seq":5,"e":"abcdefgh","action":{"type":"heartbeat"}}')).toEqual({ k: 'act', seq: 5, e: 'abcdefgh', action: { type: 'heartbeat' } });
    ['{"k":"act","seq":0,"action":{"type":"heartbeat"}}', '{"k":"act","seq":1.2,"action":{"type":"heartbeat"}}', '{"k":"act","seq":9007199254740993,"action":{"type":"heartbeat"}}', '{"k":"act","seq":"3","action":{"type":"heartbeat"}}', '{"k":"dm","seq":3,"action":{"type":"heartbeat"}}', '{"k":"act","seq":3,"e":"x","action":{"type":"heartbeat"}}', 'null'].forEach((text) =>
      expect({ text, parsed: parseActionPayload(text) }).toEqual({ text, parsed: null }),
    );
  });

  it('valida uniones, mensajes directos y sobres', () => {
    const keys = newBoxKeys();
    const request = { v: PROTOCOL_VERSION, id: 'stpabcdef0123', alias: 'Ana', avatar: 2, nonce: 'a1b2c3d4e5f60718', epoch: 2, challenge: '0011223344556677' };
    expect(parseJoinRequest(JSON.stringify(request))).toEqual({ kind: 'request', request });
    expect(parseJoinRequest(JSON.stringify({ alias: 'Viejo', avatar: 1 }))).toEqual({ kind: 'legacy' });
    [{ ...request, id: '__proto__' }, { ...request, id: 'AB' }, { ...request, epoch: 0 }, { ...request, nonce: 'corto' }, { ...request, alias: 5 }, { ...request, v: 9 }, { ...request, challenge: null }].forEach((bad) =>
      expect(parseJoinRequest(JSON.stringify(bad))).toEqual({ kind: 'invalid' }),
    );
    expect(parseJoinEnvelope(JSON.stringify({ pk: keys.publicKey, sealed: sealShared('x', newSessionKey()) }))).not.toBeNull();
    expect(parseJoinEnvelope(JSON.stringify({ pk: 'corta', sealed: sealShared('x', newSessionKey()) }))).toBeNull();
    expect(parseJoinEnvelope('{"pk":{},"sealed":[]}')).toBeNull();

    const key = newSessionKey();
    expect(parseDirect(JSON.stringify({ k: 'dm', type: 'welcome', nonce: request.nonce, key, kid: 1, id: request.id, alias: 'Ana', epoch: 2 }))?.type).toBe('welcome');
    expect(parseDirect(JSON.stringify({ k: 'dm', type: 'welcome', nonce: request.nonce, key: 'corta', kid: 1, id: request.id, alias: 'Ana', epoch: 2 }))).toBeNull();
    expect(parseDirect(JSON.stringify({ k: 'dm', type: 'rejected', nonce: request.nonce, reason: 'full' }))?.type).toBe('rejected');
    expect(parseDirect(JSON.stringify({ k: 'dm', type: 'rejected', nonce: request.nonce, reason: 'porque sí' }))).toBeNull();
    expect(parseDirect(JSON.stringify({ k: 'dm', type: 'acks', list: [{ e: 'abcdefgh', s: 'ok' }, { e: 'abcdefgi', s: 'no', why: 'closed' }] }))).toEqual({ k: 'dm', type: 'acks', list: [{ e: 'abcdefgh', s: 'ok' }, { e: 'abcdefgi', s: 'no', why: 'closed' }] });
    expect(parseDirect(JSON.stringify({ k: 'dm', type: 'acks', list: [] }))).toBeNull();
    expect(parseDirect(JSON.stringify({ k: 'dm', type: 'acks', list: Array.from({ length: 200 }, () => ({ e: 'abcdefgh', s: 'ok' })) }))).toBeNull();
    expect(parseDirect(JSON.stringify({ k: 'act', type: 'welcome' }))).toBeNull();
    expect(parseSealedMessage('{"n":"AAAA","c":"BBBB"}')).toBeNull();
    expect(parseStateEnvelope('{"kid":0,"sealed":{},"sig":""}')).toBeNull();
  });

  it('el saludo dice quién debe actualizar cuando las versiones no calzan', () => {
    const secrets = deriveRouteSecrets('ABC234');
    const sign = newSignKeys();
    const base = { v: 2, kind: 'soytel-route', box: newBoxKeys().publicKey, sign: sign.publicKey, at: T0, epoch: 1, owner: 'a00000000001', challenge: '0011223344556677' };
    const seal = (hello: object) => JSON.stringify(sealHello(hello as HelloMessage, secrets.helloKey, sign.secretKey));
    expect(openHello(seal({ ...base, proto: PROTOCOL_VERSION }), secrets.helloKey)).toMatchObject({ ok: true });
    expect(openHello(seal(base), secrets.helloKey)).toEqual({ ok: false, reason: 'incompatible', side: 'host-old', sign: sign.publicKey });
    expect(openHello(seal({ ...base, proto: PROTOCOL_VERSION + 1 }), secrets.helloKey)).toEqual({ ok: false, reason: 'incompatible', side: 'client-old', sign: sign.publicKey });
    expect(openHello(seal({ ...base, proto: PROTOCOL_VERSION, epoch: -3 }), secrets.helloKey)).toEqual({ ok: false, reason: 'invalid' });
    // Otra llave (otro código) o una firma que no corresponde.
    expect(openHello(seal({ ...base, proto: PROTOCOL_VERSION }), deriveRouteSecrets('ABC235').helloKey)).toEqual({ ok: false, reason: 'invalid' });
    const forged = JSON.parse(seal({ ...base, proto: PROTOCOL_VERSION }));
    forged.sig = signSealed(forged.sealed, newSignKeys().secretKey);
    expect(openHello(JSON.stringify(forged), secrets.helloKey)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('la firma del estado cubre el número de llave y el orden de publicaciones no usa relojes', () => {
    const sign = newSignKeys();
    const sealed = sealShared('estado', newSessionKey());
    const signature = signSealed(sealed, sign.secretKey, stateSignContext(4));
    expect(verifySealed(sealed, signature, sign.publicKey, stateSignContext(4))).toBe(true);
    expect(verifySealed(sealed, signature, sign.publicKey, stateSignContext(5))).toBe(false);
    expect(verifySealed(sealed, signature, sign.publicKey)).toBe(false);

    const current = { epoch: 2, owner: 'bbbbbbbbbbbb', pub: 10 };
    expect(isNewerStamp({ epoch: 2, owner: 'bbbbbbbbbbbb', pub: 11 }, current)).toBe(true);
    expect(isNewerStamp({ epoch: 2, owner: 'bbbbbbbbbbbb', pub: 10 }, current)).toBe(false);
    expect(isNewerStamp({ epoch: 2, owner: 'bbbbbbbbbbbb', pub: 9 }, current)).toBe(false);
    expect(isNewerStamp({ epoch: 3, owner: 'aaaaaaaaaaaa', pub: 1 }, current)).toBe(true);
    expect(isNewerStamp({ epoch: 1, owner: 'cccccccccccc', pub: 99 }, current)).toBe(false);
    // Misma época tomada por dos pantallas a la vez: gana siempre la misma.
    expect(isNewerStamp({ epoch: 2, owner: 'cccccccccccc', pub: 1 }, current)).toBe(true);
    expect(isNewerStamp({ epoch: 2, owner: 'aaaaaaaaaaaa', pub: 99 }, current)).toBe(false);
    expect(isNewerStamp(current, null)).toBe(true);
  });

  it('la llave del par es la misma desde ambos lados y distinta para cada participante', () => {
    const host = newBoxKeys();
    const ana = newBoxKeys();
    const beto = newBoxKeys();
    expect(pairKey(ana.publicKey, host.secretKey)).toBe(pairKey(host.publicKey, ana.secretKey));
    expect(pairKey(ana.publicKey, host.secretKey)).not.toBe(pairKey(beto.publicKey, host.secretKey));
    expect(pairKey('no-es-llave', host.secretKey)).toBeNull();
  });
});

describe('motor · respuestas, cupos y pausas del stand', () => {
  it('responde cada acción con su resultado y no se puede resolver un id heredado de Object', () => {
    let state = applyHostAction(lobby(), { type: 'start' }, T0 + 10);
    const first = submitPlayerAction(state, 'ana111', { type: 'checkin', stop: 'b215' }, T0 + 20);
    expect(first.verdict).toEqual({ status: 'accepted' });
    state = first.state;
    // Repetirla es inofensivo.
    expect(submitPlayerAction(state, 'ana111', { type: 'checkin', stop: 'b215' }, T0 + 30).verdict).toEqual({ status: 'accepted' });
    expect(submitPlayerAction(state, 'ana111', { type: 'checkin', stop: 'hall' }, T0 + 30).verdict).toEqual({ status: 'rejected', reason: 'phase' });
    expect(submitPlayerAction(state, 'ana111', { type: 'score', game: 'red-b215', score: 10, accuracy: 1 }, T0 + 30).verdict).toEqual({ status: 'rejected', reason: 'phase' });
    expect(submitPlayerAction(state, 'nadie', { type: 'heartbeat' }, T0 + 30).verdict).toEqual({ status: 'rejected', reason: 'unknown' });
    for (const id of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      const result = submitPlayerAction(state, id, { type: 'heartbeat' }, T0 + 30);
      expect(result.verdict).toEqual({ status: 'rejected', reason: 'unknown' });
      expect(result.state).toBe(state);
      expect(addPlayer(state, { id, alias: 'x', avatar: 0, boxKey: 'k' }, T0 + 30).ok).toBe(true);
    }
    const kicked = applyHostAction(state, { type: 'kick', id: 'beto22' }, T0 + 40);
    expect(submitPlayerAction(kicked, 'beto22', { type: 'checkin', stop: 'b215' }, T0 + 50).verdict).toEqual({ status: 'rejected', reason: 'kicked' });
    expect(applyHostAction(state, { type: 'kick', id: 'constructor' }, T0 + 40)).toBe(state);
  });

  it('en el lobby libera el lugar de quien dejó de dar señales, y el cupo cuenta solo a quienes siguen', () => {
    let state = lobby(['ana111', 'beto22', 'caro33']);
    state = submitPlayerAction(state, 'ana111', { type: 'heartbeat' }, T0 + LOBBY_GHOST_MS).state;
    const pruned = tick(state, T0 + LOBBY_GHOST_MS + 1000);
    expect(pruned.order).toEqual(['ana111']);
    expect(pruned.rev).toBeGreaterThan(state.rev);
    // Con la ruta en marcha nadie se borra (conserva su puntaje), pero deja de ocupar cupo.
    let started = applyHostAction(lobby(['ana111', 'beto22']), { type: 'start' }, T0 + 10);
    started = tick(started, T0 + LOBBY_GHOST_MS * 10);
    expect(started.order).toEqual(['ana111', 'beto22']);
    expect(seatsTaken(started, T0 + 1000)).toBe(2);
    expect(seatsTaken(started, T0 + SEAT_TTL_MS + 1000)).toBe(0);

    let full = createRoute('ABC234', T0, 1);
    for (let index = 0; index < MAX_PLAYERS; index += 1) full = addPlayer(full, { id: `jugador${index}`, alias: `J${index}`, avatar: 0, boxKey: `k${index}` }, T0).state;
    full = applyHostAction(full, { type: 'start' }, T0 + 5);
    expect(addPlayer(full, { id: 'nuevo01', alias: 'N', avatar: 0, boxKey: 'kn' }, T0 + 10)).toMatchObject({ ok: false, reason: 'full' });
    // Pasado el plazo sin señales, los ausentes ya no bloquean a alguien nuevo...
    const later = addPlayer(full, { id: 'nuevo01', alias: 'N', avatar: 0, boxKey: 'kn' }, T0 + SEAT_TTL_MS + 20_000);
    expect(later.ok).toBe(true);
    // ...y quien vuelve conserva su registro.
    expect(addPlayer(later.state, { id: 'jugador3', alias: 'J3', avatar: 0, boxKey: 'k3' }, T0 + SEAT_TTL_MS + 30_000).ok).toBe(true);
  });

  it('al retomar tras una pausa del stand corre los plazos y da señal fresca a todos', () => {
    let state = applyHostAction(lobby(), { type: 'start' }, T0 + 10);
    state = applyHostAction(state, { type: 'advance' }, T0 + 20);
    expect(state.phase).toBe('play');
    const resumed = resumeRoute(state, 90_000, T0 + 90_020);
    expect(resumed.deadline).toBe(state.deadline! + 90_000);
    expect(resumed.startsAt).toBe(state.startsAt! + 90_000);
    expect(resumed.rev).toBeGreaterThan(state.rev);
    expect(Object.values(resumed.players).every((player) => player.lastSeen === T0 + 90_020)).toBe(true);
    // Sin pausa no cambia plazos ni revisión.
    const same = resumeRoute(state, 0, T0 + 30);
    expect(same.deadline).toBe(state.deadline);
    expect(same.rev).toBe(state.rev);
  });
});

describe('enlaces para unirse (RT-10)', () => {
  it('lee el código y la huella tal cual, sin corregir enlaces mal formados', () => {
    expect(parseJoinLink('abc234', 'A1B2C3D4E5F6')).toEqual({ code: 'ABC234', fingerprint: 'a1b2c3d4e5f6', problem: null });
    expect(parseJoinLink('ABC234', undefined)).toEqual({ code: 'ABC234', fingerprint: null, problem: null });
    expect(parseJoinLink(undefined, 'a1b2c3d4e5f6')).toEqual({ code: null, fingerprint: null, problem: null });
    // Un código con relleno o caracteres no permitidos NO se convierte en uno válido.
    expect(parseJoinLink('AB-C2-34x9999', undefined)).toEqual({ code: null, fingerprint: null, problem: 'code' });
    expect(parseJoinLink('ABC2341', undefined).problem).toBe('code');
    expect(parseJoinLink('ABC10O', undefined).problem).toBe('code');
    expect(parseJoinLink(['ABC234', 'XYZ789'], undefined).problem).toBe('code');
    expect(parseJoinLink(['ABC234'], ['a1b2c3d4e5f6'])).toEqual({ code: 'ABC234', fingerprint: 'a1b2c3d4e5f6', problem: null });
    expect(parseJoinLink('ABC234', 'zzz')).toEqual({ code: 'ABC234', fingerprint: null, problem: 'key' });
    expect(parseJoinLink('ABC234', ['a1b2c3d4e5f6', 'ffffffffffff'])).toEqual({ code: 'ABC234', fingerprint: null, problem: 'key' });
    expect(parseStandCode(undefined)).toEqual({ code: null, invalid: false });
    expect(parseStandCode('xyz789')).toEqual({ code: 'XYZ789', invalid: false });
    expect(parseStandCode(['XYZ789', 'ABC234'])).toEqual({ code: null, invalid: true });
    expect(parseStandCode('../../etc')).toEqual({ code: null, invalid: true });
  });

  it('el campo del código acepta solo texto', () => {
    expect(sanitizeJourneyCode('ab c-234')).toBe('ABC234');
    expect(sanitizeJourneyCode(['ABC234'] as unknown)).toBe('');
    expect(sanitizeJourneyCode(undefined)).toBe('');
    expect(sanitizeJourneyCode({ toUpperCase: () => 'X' })).toBe('');
  });
});

describe('QR del stand (RT-14)', () => {
  it('deja el margen en blanco de 4 módulos que pide el estándar', () => {
    const qr = buildQr('https://soytel.vercel.app/ruta?codigo=ABC234&k=a1b2c3d4e5f6');
    expect(qr.count).toBe(qr.modules + 8);
    const xs = [...qr.path.matchAll(/M(\d+) (\d+)/g)].flatMap((match) => [Number(match[1]), Number(match[2])]);
    expect(Math.min(...xs)).toBe(4);
    expect(Math.max(...xs)).toBe(qr.modules + 3);
  });
});

// Socket falso para el cliente MQTT.
class FakeSocket {
  binaryType = '';
  readyState = 0;
  onopen: ((event: unknown) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  sent: Uint8Array[] = [];
  send(data: Uint8Array | ArrayBuffer) {
    this.sent.push(data instanceof Uint8Array ? data : new Uint8Array(data));
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  receive(bytes: number[] | Uint8Array) {
    this.onmessage?.({ data: Uint8Array.from(bytes).buffer });
  }
  // Id del último SUBSCRIBE enviado.
  lastSubscribeId(): number {
    const packet = [...this.sent].reverse().find((bytes) => bytes[0] === 0x82)!;
    return (packet[2] << 8) | packet[3];
  }
}

function client(options: { clientId?: string } = {}) {
  const sockets: FakeSocket[] = [];
  const statuses: string[] = [];
  const mqtt = new MqttClient({
    url: 'ws://prueba',
    clientId: options.clientId ?? 'c1',
    socketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
  });
  mqtt.onStatus = (status) => statuses.push(status);
  return { mqtt, sockets, statuses };
}

describe('transporte MQTT (RT-12, RT-15)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('solo queda "en línea" cuando el broker confirma la suscripción', () => {
    const { mqtt, sockets, statuses } = client();
    mqtt.subscribe('sala/state');
    mqtt.connect();
    sockets[0].open();
    sockets[0].receive([0x20, 0x02, 0x00, 0x00]);
    expect(mqtt.status).toBe('connecting');
    const id = sockets[0].lastSubscribeId();
    sockets[0].receive([0x90, 0x03, id >> 8, id & 0xff, 0x01]);
    expect(mqtt.status).toBe('online');
    expect(statuses).toEqual(['connecting', 'online']);
    mqtt.close();
  });

  it('si el broker niega un filtro, lo informa y no reintenta en el mismo', () => {
    const { mqtt, sockets } = client();
    mqtt.subscribe('sala/state');
    mqtt.subscribe('sala/dm/x');
    mqtt.connect();
    sockets[0].open();
    sockets[0].receive([0x20, 0x02, 0x00, 0x00]);
    const id = sockets[0].lastSubscribeId();
    sockets[0].receive([0x90, 0x04, id >> 8, id & 0xff, 0x01, 0x80]);
    expect(mqtt.status).toBe('denied');
    jest.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
    mqtt.close();
  });

  it('si la confirmación de suscripción nunca llega, corta y vuelve a conectar', () => {
    const { mqtt, sockets } = client();
    mqtt.subscribe('sala/state');
    mqtt.connect();
    sockets[0].open();
    sockets[0].receive([0x20, 0x02, 0x00, 0x00]);
    jest.advanceTimersByTime(6100);
    expect(mqtt.status).toBe('offline');
    jest.advanceTimersByTime(2000);
    expect(sockets.length).toBeGreaterThan(1);
    mqtt.close();
  });

  it('credenciales rechazadas se informan como denegación', () => {
    const { mqtt, sockets } = client();
    mqtt.connect();
    sockets[0].open();
    sockets[0].receive([0x20, 0x02, 0x00, 0x05]);
    expect(mqtt.status).toBe('denied');
    mqtt.close();
  });

  it('descarta paquetes demasiado grandes o con longitud mal formada', () => {
    const reader = new PacketReader();
    expect(reader.push(Uint8Array.of(0x30, 0xff, 0xff, 0xff, 0xff, 0x01))).toEqual([{ type: 'malformed', reason: 'length' }]);
    reader.reset();
    // 300 kB anunciados: se rechaza al leer la cabecera, sin acumular el cuerpo.
    expect(reader.push(Uint8Array.of(0x30, 0xe0, 0xa7, 0x12))).toEqual([{ type: 'malformed', reason: 'size' }]);
    expect(reader.push(Uint8Array.of(0xd0, 0x00))).toEqual([]);
    reader.reset();
    // Tópico más largo que el paquete.
    expect(reader.push(Uint8Array.of(0x30, 0x03, 0x00, 0x09, 0x41))).toEqual([{ type: 'malformed', reason: 'body' }]);
    reader.reset();
    expect(reader.push(encodePublish('t', utf8Encode('hola'), { qos: 0, retain: false }))).toHaveLength(1);
    expect(MAX_PACKET_BYTES).toBeGreaterThan(200_000);

    const { mqtt, sockets } = client();
    mqtt.connect();
    sockets[0].open();
    sockets[0].receive([0x20, 0x02, 0x00, 0x00]);
    expect(mqtt.status).toBe('online');
    sockets[0].receive([0x30, 0xff, 0xff, 0xff, 0xff, 0x01]);
    expect(mqtt.status).toBe('offline');
    // Tampoco encola hacia afuera algo que no cabe en un paquete.
    expect(mqtt.publish('t', 'x'.repeat(MAX_PACKET_BYTES))).toBe(false);
    mqtt.close();
  });

  it('al volver al primer plano comprueba que la conexión siga viva', () => {
    const { mqtt, sockets } = client();
    mqtt.connect();
    sockets[0].open();
    sockets[0].receive([0x20, 0x02, 0x00, 0x00]);
    mqtt.nudge();
    jest.advanceTimersByTime(4100);
    // Sin respuesta al ping: el socket estaba muerto.
    expect(mqtt.status).toBe('offline');
    jest.advanceTimersByTime(1500);
    sockets[1].open();
    sockets[1].receive([0x20, 0x02, 0x00, 0x00]);
    mqtt.nudge();
    jest.advanceTimersByTime(100);
    sockets[1].receive([0xd0, 0x00]);
    jest.advanceTimersByTime(4500);
    expect(mqtt.status).toBe('online');
    mqtt.close();
  });
});

describe('concesión del stand sin Web Locks (RT-07)', () => {
  beforeEach(async () => {
    jest.useRealTimers();
    await AsyncStorage.clear();
  });

  it('de dos pestañas que la piden a la vez, solo una la obtiene', async () => {
    const [first, second] = await Promise.all([acquireLease('ABC234', 'pestaña-1'), acquireLease('ABC234', 'pestaña-2')]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
    (first ?? second)?.release();
  });

  it('no se entrega mientras otra la mantiene, y soltarla no borra la de otra pestaña', async () => {
    const mine = await acquireLease('XYZ789', 'pestaña-1');
    expect(mine).not.toBeNull();
    expect(await acquireLease('XYZ789', 'pestaña-2')).toBeNull();
    // La otra pestaña la toma a la fuerza.
    let lost = false;
    const taken = await acquireLease('XYZ789', 'pestaña-2', { steal: true, onLost: () => (lost = true) });
    expect(taken).not.toBeNull();
    // La primera suelta "la suya": no puede borrar la que ahora es de la segunda.
    mine?.release();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await AsyncStorage.getItem('@soytel/route/lease/XYZ789')).toContain('pestaña-2');
    expect(lost).toBe(false);
    taken?.release();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await AsyncStorage.getItem('@soytel/route/lease/XYZ789')).toBeNull();
  });
});
