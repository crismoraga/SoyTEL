import { utf8Decode } from '@/realtime/bytes';
import { MqttClient } from '@/realtime/mqttClient';
import { PacketReader } from '@/realtime/mqttPackets';
import { addPlayer, applyHostAction, applyPlayerAction, createRoute, playerTotal, snapshot } from '@/route/engine';
import { HostController } from '@/route/host';
import { LocalBus, LocalRouteLink } from '@/route/link';
import { MemberController } from '@/route/member';
import type { PlayerAction, RouteState } from '@/route/types';

// Regresiones de los tres defectos reproducidos en la auditoría de 9eeda63 (RT-01, RT-02 y RT-05).
// Cada prueba exige el comportamiento corregido: en el baseline fallaban las tres.

const T0 = 1_000_000;

function projectsState(): RouteState {
  let state = createRoute('ABC234', T0, 99);
  const joined = addPlayer(state, { id: 'ana1', alias: 'Ana', avatar: 1, boxKey: 'pk-ana' }, T0);
  expect(joined.ok).toBe(true);
  state = joined.state;
  state = applyHostAction(state, { type: 'start' }, T0 + 1000);
  state = applyHostAction(state, { type: 'advance' }, T0 + 2000);
  state = applyHostAction(state, { type: 'advance' }, T0 + 3000);
  state = applyHostAction(state, { type: 'advance' }, T0 + 4000);
  state = applyHostAction(state, { type: 'advance' }, T0 + 5000);
  expect(state.phase).toBe('projects');
  return state;
}

describe('RT-01 · juegos inventados', () => {
  it('rechaza puntajes de identificadores que no son juegos de la ruta', () => {
    let state = projectsState();
    const later = T0 + 120_000;
    for (const game of ['inventado-1', 'inventado-2', '__proto__', 'constructor', 'toString']) {
      state = applyPlayerAction(state, 'ana1', { type: 'score', game, score: 1000, accuracy: 1 } as unknown as PlayerAction, later);
    }
    const player = state.players.ana1;
    expect(playerTotal(player)).toBe(0);
    expect(Object.keys(player.games)).toEqual([]);
    expect(snapshot(state, later).players[0].total).toBe(0);
    expect(snapshot(state, later).players[0].games).toEqual({});
  });

  it('no suma claves ajenas aunque ya estén guardadas en el registro del jugador', () => {
    const state = projectsState();
    const player = { ...state.players.ana1, games: { ...state.players.ana1.games, inventado: { score: 1000, accuracy: 1, at: T0 } } as never };
    expect(playerTotal(player)).toBe(0);
  });
});

describe('RT-02 · repetición de estados firmados', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('un estado auténtico repetido no retrocede el reloj ni renueva la señal de vida', async () => {
    const bus = new LocalBus();
    const states: { topic: string; text: string }[] = [];
    const publish = bus.publish.bind(bus);
    bus.publish = (topic: string, text: string, retain: boolean) => {
      if (topic.endsWith('/state')) states.push({ topic, text });
      publish(topic, text, retain);
    };
    const host = HostController.createWithLink(new LocalRouteLink(bus), {}, { solo: true });
    await host.start();
    const member = new MemberController();
    await member.join({ code: host.code, alias: 'Ana', avatar: 1, link: new LocalRouteLink(bus), fingerprint: host.fingerprint });
    await jest.advanceTimersByTimeAsync(1500);
    expect(member.getView().status).toBe('joined');
    const old = states[states.length - 1];

    // Pasan 7 s: el anfitrión publicó un latido nuevo con la misma revisión (el siguiente llega a los 10 s).
    await jest.advanceTimersByTimeAsync(7000);
    const before = member.hostNow();
    const liveBefore = member.getView().lastStateAt;
    expect(states[states.length - 1].text).not.toBe(old.text);

    // Alguien reinyecta el estado viejo (mismo broker público, mensaje firmado de verdad).
    bus.publish(old.topic, old.text, false);
    await jest.advanceTimersByTimeAsync(50);

    expect(member.hostNow() - before).toBeGreaterThanOrEqual(0);
    expect(member.hostNow() - before).toBeLessThan(200);
    expect(member.getView().lastStateAt).toBe(liveBefore);

    await member.leave(false);
    host.stop();
  }, 60_000);
});

// Socket falso: guarda lo enviado y deja inyectar paquetes del broker.
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
  receive(bytes: number[]) {
    this.onmessage?.({ data: Uint8Array.from(bytes).buffer });
  }
  publishes(topic: string): string[] {
    const reader = new PacketReader();
    return this.sent
      .flatMap((bytes) => reader.push(bytes))
      .flatMap((packet) => (packet.type === 'publish' && packet.topic === topic ? [utf8Decode(packet.payload)] : []));
  }
}

const CONNACK = [0x20, 0x02, 0x00, 0x00];

describe('RT-05 · orden de publicación al reconectar', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('el último retenido es el más nuevo y no se publica dos veces', () => {
    const sockets: FakeSocket[] = [];
    const client = new MqttClient({
      url: 'ws://prueba',
      clientId: 'c1',
      socketFactory: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
    });
    client.onStatus = (status) => {
      // Igual que el anfitrión: al volver la conexión publica su estado fresco.
      if (status === 'online') client.publish('sala/state', 'NEW', { retain: true });
    };
    client.connect();
    client.publish('sala/state', 'OLD', { retain: true });
    sockets[0].open();
    sockets[0].receive(CONNACK);

    const sent = sockets[0].publishes('sala/state');
    expect(sent[sent.length - 1]).toBe('NEW');
    expect(sent.filter((payload) => payload === 'NEW')).toHaveLength(1);
    expect(sent.lastIndexOf('OLD')).toBeLessThan(sent.indexOf('NEW'));
    // La cola sin conexión se compacta por tópico retenido: el estado viejo ya no viaja.
    expect(sent).toEqual(['NEW']);
    client.close();
  });

  it('un retenido sin confirmar no se reenvía después del estado nuevo', () => {
    const sockets: FakeSocket[] = [];
    const client = new MqttClient({
      url: 'ws://prueba',
      clientId: 'c2',
      socketFactory: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
    });
    let fresh = 'OLD';
    client.onStatus = (status) => {
      if (status === 'online') client.publish('sala/state', fresh, { retain: true });
    };
    client.connect();
    sockets[0].open();
    sockets[0].receive(CONNACK);
    expect(sockets[0].publishes('sala/state')).toEqual(['OLD']);

    // Se cae la conexión antes del PUBACK; al volver hay un estado más nuevo.
    fresh = 'NEW';
    sockets[0].onclose?.({});
    jest.advanceTimersByTime(2000);
    expect(sockets).toHaveLength(2);
    sockets[1].open();
    sockets[1].receive(CONNACK);

    expect(sockets[1].publishes('sala/state')).toEqual(['NEW']);
    client.close();
  });

  it('mantiene el orden de los mensajes no retenidos y no los duplica', () => {
    const sockets: FakeSocket[] = [];
    const client = new MqttClient({
      url: 'ws://prueba',
      clientId: 'c3',
      socketFactory: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
    });
    client.connect();
    client.publish('sala/dm/a', 'uno');
    client.publish('sala/dm/a', 'dos');
    client.publish('sala/dm/a', 'tres');
    sockets[0].open();
    sockets[0].receive(CONNACK);
    expect(sockets[0].publishes('sala/dm/a')).toEqual(['uno', 'dos', 'tres']);
    client.close();
  });
});
