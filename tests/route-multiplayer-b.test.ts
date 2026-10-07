import { deriveRouteSecrets, newBoxKeys, newSignKeys, openFrom, openShared, pairKey, sealShared, sealTo } from '@/realtime/crypto';
import { pillarIds } from '@/route/content';
import { MIN_PROJECT_MS } from '@/route/engine';
import { MemberController, SESSION_MAX_AGE_MS } from '@/route/member';
import { generateRouteCode, parseStateEnvelope, routeTopics, sealHello, type HelloMessage } from '@/route/protocol';
import {
  addPlayer,
  advance,
  createWorld,
  digest,
  expectConverged,
  finishB215,
  finishProjects,
  finishQuiz,
  MemoryMemberStore,
  NoLocks,
  openHost,
  percentile,
  playRoute,
  reachB215,
  reachProjects,
  reachQuiz,
  skewedClock,
  SimNet,
  stopWorld,
  type Packet,
  type World,
} from './support/routeHarness';

// Multijugador bajo fallos (escenarios 11 a 20 del encargo). Ver tests/support/routeHarness.ts.

jest.setTimeout(180_000);

let worlds: World[] = [];
const extras: (() => void)[] = [];

async function world(options?: Parameters<typeof createWorld>[0]): Promise<World> {
  const created = await createWorld(options);
  worlds.push(created);
  return created;
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  extras.splice(0).forEach((stop) => stop());
  worlds.forEach(stopWorld);
  worlds = [];
  jest.useRealTimers();
});

const aliases = (w: World) => w.host.getView().snapshot.players.map((player) => player.alias).sort();
const idOf = (w: World, alias: string) => w.host.getView().snapshot.players.find((player) => player.alias === alias)!.id;

describe('multijugador · participantes y autoridad', () => {
  it('11 · la app se cierra con un puntaje sin confirmar: al reabrir se reenvía y cuenta una vez', async () => {
    const w = await world();
    const ana = await addPlayer(w, 'Ana');
    const beto = await addPlayer(w, 'Beto');
    await reachB215(w);
    await advance(26_000);
    const id = idOf(w, 'Ana');

    ana.link.setConnected(false);
    ana.member.submitScore('red-b215', 777, 0.9);
    await advance(50);
    expect(ana.member.getView().outbox['score:red-b215']).toEqual({ state: 'queued' });
    // Lo pendiente ya quedó en el teléfono.
    expect(ana.store.record?.outbox.map((item) => item.key)).toEqual(['score:red-b215']);
    const seqBefore = ana.store.record!.seq;

    // El sistema cierra la app (no hay despedida ni guardado final).
    ana.link.kill();
    ana.member.reset();

    const reopened = new MemberController({ store: ana.store, clock: ana.clock });
    extras.push(() => reopened.reset());
    await reopened.restore(w.net.link('Ana-reabierta'));
    await advance(1500);
    expect(reopened.getView().status).toBe('joined');
    expect(reopened.getView().me?.id).toBe(id);
    expect(reopened.getView().me?.games['red-b215']).toBe(777);
    expect(reopened.getView().pending).toEqual([]);
    // El contador de envíos siguió por encima del reservado: nada se confundió con una copia vieja.
    expect(ana.store.record!.seq).toBeGreaterThan(seqBefore);
    expect(w.host.getView().snapshot.players.find((player) => player.alias === 'Ana')?.games['red-b215']).toBe(777);
    expect(aliases(w)).toEqual(['Ana', 'Beto']);
    beto.member.submitScore('red-b215', 500, 0.5);
    await advance(600);
    expect(w.host.getView().snapshot.phase).toBe('results');
  });

  it('12 · dos pantallas abren la misma ruta sin candado: solo conduce la de época mayor', async () => {
    const w = await world({ locks: new NoLocks() });
    const ana = await addPlayer(w, 'Ana');
    const beto = await addPlayer(w, 'Beto');
    await reachB215(w);
    const first = w.host;
    const firstEpoch = first.epoch;

    // Otra pestaña abre la ruta. Sin Web Locks nadie la detiene: también toma la conducción.
    const second = openHost(w, (await w.hostStore.load(w.code))!, { name: 'pestaña2' });
    extras.push(() => second.host.stop(false));
    await second.host.start();
    await advance(600);
    expect(second.host.getView().role).toBe('driver');
    expect(second.host.epoch).toBeGreaterThan(firstEpoch);
    // La primera vio una época mayor con sus mismas llaves y dejó de conducir.
    expect(first.getView().role).toBe('observer');
    expect(first.getCounters().fenced).toBe(1);

    // Las órdenes de la pantalla que quedó atrás no mueven la ruta.
    first.dispatch({ type: 'finish' });
    await advance(600);
    expect(second.host.getView().snapshot.phase).toBe('play');
    [ana, beto].forEach((player) => {
      expect(player.member.getView().snapshot?.phase).toBe('play');
      expect(player.member.getDiagnostics().mark?.epoch).toBe(second.host.epoch);
    });

    // La nueva conduce y todos la siguen, incluida la primera pantalla (ahora en solo lectura).
    second.host.dispatch({ type: 'advance' });
    await advance(600);
    expect(second.host.getView().snapshot.phase).toBe('results');
    [ana, beto].forEach((player) => expect(digest(player.member.getView().snapshot)).toEqual(digest(second.host.getView().snapshot)));
    expect(digest(first.getView().snapshot)).toEqual(digest(second.host.getView().snapshot));
  });

  it('12b · una pantalla que quedó suspendida vuelve creyéndose dueña: no puede guardar ni publicar con efecto', async () => {
    const w = await world({ locks: new NoLocks() });
    const ana = await addPlayer(w, 'Ana');
    await reachB215(w);
    const stale = w.host;
    w.hostLink.setConnected(false);

    const second = openHost(w, (await w.hostStore.load(w.code))!, { name: 'pestaña2' });
    extras.push(() => second.host.stop(false));
    await second.host.start();
    await advance(600);
    expect(second.host.getView().role).toBe('driver');
    expect(stale.getView().role).toBe('driver');

    // Vuelve la red de la pantalla vieja: publica su estado (época menor) y lo ignoran.
    const ignored = ana.member.getDiagnostics().statesIgnored;
    w.hostLink.setConnected(true);
    await advance(100);
    expect(ana.member.getDiagnostics().statesIgnored).toBeGreaterThan(ignored);
    expect(ana.member.getDiagnostics().mark?.epoch).toBe(second.host.epoch);
    await advance(600);
    expect(stale.getView().role).toBe('observer');

    // Y si alcanzara a dar una orden antes de enterarse, el guardado la frena.
    const w2 = await world({ locks: new NoLocks() });
    const beto = await addPlayer(w2, 'Beto');
    await reachB215(w2);
    const old = w2.host;
    w2.hostLink.setConnected(false);
    const taker = openHost(w2, (await w2.hostStore.load(w2.code))!, { name: 'pestaña2' });
    extras.push(() => taker.host.stop(false));
    await taker.host.start();
    await advance(600);
    old.dispatch({ type: 'finish' });
    await advance(300);
    expect(old.getView().role).toBe('observer');
    expect((await w2.hostStore.load(w2.code))!.state.phase).toBe('play');
    expect(beto.member.getView().snapshot?.phase).toBe('play');
  });

  it('12c · "Tomar el control" con candado: la pantalla anterior pasa a solo lectura', async () => {
    const w = await world();
    const ana = await addPlayer(w, 'Ana');
    const first = w.host;
    const second = openHost(w, (await w.hostStore.load(w.code))!, { name: 'pestaña2' });
    extras.push(() => second.host.stop(false));
    await second.host.start();
    await advance(300);
    expect(second.host.getView().role).toBe('observer');
    second.host.stop(false);

    const taker = openHost(w, (await w.hostStore.load(w.code))!, { name: 'pestaña3' });
    extras.push(() => taker.host.stop(false));
    await taker.host.start(true);
    await advance(600);
    expect(taker.host.getView().role).toBe('driver');
    expect(first.getView().role).toBe('observer');
    taker.host.dispatch({ type: 'start' });
    await advance(600);
    expect(ana.member.getView().snapshot?.phase).toBe('checkin');
    expect(digest(first.getView().snapshot)).toEqual(digest(taker.host.getView().snapshot));
  });

  it('13 · salir con y sin conexión, y cambiarse de sala', async () => {
    const w = await world();
    const ana = await addPlayer(w, 'Ana');
    const beto = await addPlayer(w, 'Beto');
    const caro = await addPlayer(w, 'Caro');

    // Con conexión: el stand confirma la salida y libera el lugar de inmediato.
    const leaving = caro.member.leave();
    await advance(300);
    await leaving;
    expect(caro.member.getView().status).toBe('idle');
    expect(caro.store.record).toBeNull();
    expect(aliases(w)).toEqual(['Ana', 'Beto']);

    // Sin conexión: el aviso no puede llegar. El teléfono sale igual y el stand libera el lugar solo.
    ana.link.setConnected(false);
    const offline = ana.member.leave();
    await advance(100);
    await offline;
    expect(ana.member.getView().status).toBe('idle');
    expect(ana.store.record).toBeNull();
    expect(aliases(w)).toEqual(['Ana', 'Beto']);
    await advance(50_000);
    expect(w.host.getView().snapshot.players.find((player) => player.alias === 'Ana')?.online).toBe(false);
    await advance(80_000);
    expect(aliases(w)).toEqual(['Beto']);

    // Cambio de sala: al unirse a otra ruta se despide de la anterior.
    const w2 = await world();
    const joining = beto.member.join({ code: w2.code, alias: 'Beto', avatar: 1, fingerprint: w2.host.fingerprint, link: w2.net.link('Beto') });
    await advance(600);
    await joining;
    await advance(600);
    expect(aliases(w)).toEqual([]);
    expect(w2.host.getView().snapshot.players.map((player) => player.alias)).toEqual(['Beto']);
    expect(beto.member.getView().code).toBe(w2.code);
  });

  it('14 · basura, inundación de uniones y acciones inválidas de un participante real', async () => {
    const w = await world();
    const ana = await addPlayer(w, 'Ana');
    await reachB215(w);
    await advance(26_000);
    const anaId = idOf(w, 'Ana');
    const topics = routeTopics(deriveRouteSecrets(w.code).roomId);
    const before = digest(w.host.getView().snapshot);

    const garbage = [
      'null',
      '[]',
      '{}',
      '"texto"',
      '{"__proto__":{"admin":true},"constructor":{"prototype":{"x":1}}}',
      '{"pk":123,"sealed":{}}',
      '{"sealed":{"n":"__proto__","c":"constructor"}}',
      '{"kid":1e999,"sealed":[],"sig":{}}',
      '{"v":2,"sealed":{"n":"AAAA","c":"BBBB"},"sig":"CCCC"}',
      'x'.repeat(300_000),
      `{"a":${'['.repeat(2000)}${']'.repeat(2000)}}`,
    ];
    const targets = [topics.hello, topics.state, topics.join('stpaaaaaaaaaaaaaaaaaa'), topics.join(anaId), topics.up(anaId), topics.dm(anaId), topics.join('__proto__'), topics.up('constructor'), topics.join('constructor')];
    targets.forEach((topic) => garbage.forEach((text) => w.net.inject(0, topic, text)));
    await advance(500);
    expect(digest(w.host.getView().snapshot)).toEqual(before);
    expect(ana.member.getView().status).toBe('joined');

    // 150 "participantes" con llaves de verdad pero solicitudes que no cumplen el protocolo.
    const hostBox = w.host.exportRecord().boxKeys.publicKey;
    for (let index = 0; index < 150; index += 1) {
      const keys = newBoxKeys();
      const id = `stp${index.toString(16).padStart(18, '0')}`;
      const body = index % 3 === 0 ? 'basura' : JSON.stringify(index % 3 === 1 ? { v: 3, id, alias: 'Bot', avatar: 1, nonce: 'aaaaaaaaaaaaaaaa', epoch: 999, challenge: 'bbbbbbbbbbbbbbbb' } : { v: 3, id: anaId, alias: ['x'], avatar: {} });
      w.net.inject(0, topics.join(id), JSON.stringify({ pk: keys.publicKey, sealed: sealTo(body, hostBox, keys.secretKey) }));
    }
    await advance(1000);
    expect(aliases(w)).toEqual(['Ana']);
    expect(w.host.getCounters().joinsAccepted).toBe(1);

    // Ana (con sus llaves reales) envía acciones fuera de contrato. Ninguna suma ni gasta su contador.
    const record = ana.store.record!;
    const pair = pairKey(record.hostBox!, record.boxKeys.secretKey)!;
    const raw = [
      '{"k":"act","seq":9000000000000000,"e":"aaaaaaaa1","action":{"type":"score","game":"inventado","score":1000,"accuracy":1}}',
      '{"k":"act","seq":9000000000000001,"e":"aaaaaaaa2","action":{"type":"score","game":"__proto__","score":1000,"accuracy":1}}',
      '{"k":"act","seq":9000000000000002,"e":"aaaaaaaa3","action":{"type":"score","game":"red-b215","score":"1000","accuracy":1}}',
      '{"k":"act","seq":9000000000000003,"e":"aaaaaaaa4","action":{"type":"score","game":"red-b215","score":null,"accuracy":1}}',
      '{"k":"act","seq":9000000000000004,"e":"aaaaaaaa5","action":{"type":"answer","index":-1,"option":0}}',
      '{"k":"act","seq":9000000000000005,"e":"aaaaaaaa6","action":{"type":"answer","index":0.5,"option":0}}',
      '{"k":"act","seq":1.5,"e":"aaaaaaaa7","action":{"type":"heartbeat"}}',
      '{"k":"act","seq":-4,"e":"aaaaaaaa8","action":{"type":"heartbeat"}}',
      '{"k":"act","seq":1e400,"e":"aaaaaaaa9","action":{"type":"heartbeat"}}',
      '{"k":"act","seq":"12","action":{"type":"heartbeat"}}',
      '{"k":"act","seq":9000000000000006,"action":["score"]}',
      '{"k":"act","seq":9000000000000007,"action":{"type":"kick","id":"x"}}',
      '{"k":"dm","type":"acks","list":[{"e":"aaaaaaaa1","s":"ok"}]}',
    ];
    raw.forEach((text) => w.net.inject(0, topics.up(anaId), JSON.stringify(sealShared(text, pair))));
    await advance(500);
    expect(w.host.getCounters().actionsInvalid).toBe(raw.length);
    expect(w.host.getCounters().actionsAccepted).toBe(1);
    expect(w.host.getView().snapshot.players[0].total).toBe(0);
    expect(Object.keys(w.host.getView().state.players[anaId].games)).toEqual([]);
    // Su puntaje legítimo entra normalmente.
    ana.member.submitScore('red-b215', 720, 0.8);
    await advance(400);
    expect(ana.member.getView().outbox['score:red-b215']).toEqual({ state: 'accepted' });
    expect(w.host.getView().snapshot.players[0].total).toBe(720);
    expectConverged(w);
  });

  it('15 · relojes de los teléfonos desfasados ±5 minutos y un salto de hora en el stand', async () => {
    const w = await world();
    const early = await addPlayer(w, 'Ana', { skewMs: -5 * 60_000 });
    const late = await addPlayer(w, 'Beto', { skewMs: 5 * 60_000 });
    const normal = await addPlayer(w, 'Caro');
    const inSync = () => [early, late, normal].forEach((player) => expect(Math.abs(player.member.hostNow() - w.host.now())).toBeLessThan(150));
    inSync();
    expect(Math.round(early.member.getView().offset / 60_000)).toBe(5);
    expect(Math.round(late.member.getView().offset / 60_000)).toBe(-5);

    await reachB215(w);
    inSync();
    // Alguien cambia la hora del equipo del stand (+1 hora): los plazos no se vencen de golpe.
    const deadline = w.host.getView().snapshot.deadline!;
    jest.setSystemTime(Date.now() + 3_600_000);
    await advance(3000);
    expect(w.host.getView().snapshot.phase).toBe('play');
    expect(w.host.getView().snapshot.deadline).toBe(deadline);
    inSync();

    await finishB215(w);
    expect(w.host.getView().snapshot.phase).toBe('results');
    await playRouteFrom(w, 'results');
    expect(w.host.getView().snapshot.phase).toBe('podium');
    expect(w.host.getView().snapshot.completed).toBe(true);
    inSync();
    expectConverged(w);
  });

  it('16 · teléfono suspendido tres minutos y stand sin red 40 segundos', async () => {
    const w = await world();
    const ana = await addPlayer(w, 'Ana');
    const beto = await addPlayer(w, 'Beto');
    const caro = await addPlayer(w, 'Caro');
    w.host.dispatch({ type: 'start' });
    await advance(300);

    // El teléfono de Ana se suspende; el grupo sigue.
    ana.link.setConnected(false);
    beto.member.checkin('b215');
    caro.member.checkin('b215');
    await advance(60_000);
    expect(w.host.getView().snapshot.phase).toBe('play');
    await advance(120_000);
    expect(ana.member.getView().snapshot?.phase).toBe('checkin');
    expect(ana.member.getView().hostAlive).toBe(false);

    ana.link.setConnected(true);
    ana.member.nudge();
    await advance(2000);
    expect(ana.member.getView().hostAlive).toBe(true);
    expect(ana.member.getView().snapshot?.phase).toBe(w.host.getView().snapshot.phase);
    expectConverged(w);

    // El stand pierde la red 40 s: los teléfonos lo notan (sin perder su lugar) y se recuperan al volver.
    w.hostLink.setConnected(false);
    await advance(40_000);
    expect(beto.member.getView().hostAlive).toBe(false);
    expect(beto.member.getView().status).toBe('joined');
    beto.member.submitScore('red-b215', 610, 0.7);
    await advance(100);
    expect(beto.member.getView().outbox['score:red-b215']).toEqual({ state: 'sent' });
    w.hostLink.setConnected(true);
    await advance(2000);
    expect(beto.member.getView().hostAlive).toBe(true);
    expect(beto.member.getView().outbox['score:red-b215']).toEqual({ state: 'accepted' });
    expectConverged(w);
  });

  it('17 · el grupo avanza B213 → pasillo → trivia con un proyecto todavía abierto', async () => {
    const w = await world();
    const ana = await addPlayer(w, 'Ana');
    const beto = await addPlayer(w, 'Beto');
    const caro = await addPlayer(w, 'Caro');
    await playRoute(w, w.players, 'projects');
    expect(w.host.getView().snapshot.phase).toBe('projects');
    for (const game of pillarIds.slice(0, 4)) {
      await advance(MIN_PROJECT_MS + 300);
      w.players.forEach((player) => player.member.submitScore(game, 500, 0.7));
      await advance(300);
    }
    await advance(MIN_PROJECT_MS + 300);
    beto.member.submitScore('hardware', 500, 0.7);
    await advance(300);

    // El stand saca al grupo al pasillo: el puntaje tardío de Ana todavía entra.
    w.host.dispatch({ type: 'advance' });
    await advance(300);
    expect(w.host.getView().snapshot.stop).toBe('hall');
    beto.member.checkin('hall');
    await advance(300);
    // Y parte la trivia con Ana y Caro aún en su último proyecto.
    w.host.dispatch({ type: 'advance' });
    await advance(300);
    expect(w.host.getView().snapshot.phase).toBe('quiz');
    expect(ana.member.getView().snapshot?.projectsCloseAt).not.toBeNull();

    // El juego de Ana se cierra solo y envía lo logrado dentro del margen: cuenta, una vez.
    ana.member.submitScore('hardware', 430, 0.6);
    ana.member.submitScore('hardware', 430, 0.6);
    await advance(400);
    expect(ana.member.getView().outbox['score:hardware']).toEqual({ state: 'accepted' });
    expect(ana.member.getView().me?.games.hardware).toBe(430);

    // Caro lo envía pasado el margen: el stand lo rechaza con motivo y su total no cambia.
    await advance(w.host.getView().snapshot.settings.graceSeconds * 1000 + 1000);
    const total = caro.member.getView().me!.total;
    caro.member.submitScore('hardware', 999, 1);
    await advance(600);
    expect(caro.member.getView().me?.games.hardware).toBeUndefined();
    expect(caro.member.getView().me?.total).toBe(total);
    expect(caro.member.getView().pending).toEqual([]);
    expect(w.host.getCounters().actionsRejected).toBeGreaterThan(0);
    expectConverged(w);
  });
});

// Desde los resultados de B215 hasta el podio.
async function playRouteFrom(w: World, from: 'results') {
  if (from !== 'results') return;
  await reachProjects(w);
  await finishProjects(w);
  await reachQuiz(w);
  await finishQuiz(w);
  await advance(5200);
}

describe('multijugador · capacidad, versiones y expulsión', () => {
  it('19 · doce teléfonos: ruta completa, convergencia y latencias dentro del objetivo', async () => {
    const w = await world();
    // Red móvil simulada: cada entrega demora entre 20 y 180 ms (pseudoaleatorio por mensaje y destino).
    w.net.rule((packet, to) => ({ delay: 20 + ((packet.id * 37 + to.length * 101) % 161) }));
    const names = ['Ana', 'Beto', 'Caro', 'Dani', 'Eli', 'Fran', 'Gabi', 'Hugo', 'Ines', 'Javi', 'Kari', 'Leo'];
    for (const name of names) await addPlayer(w, name, { wait: 600 });
    expect(aliases(w)).toEqual([...names].sort());

    // Propagación de cada estado: desde que el stand lo publica hasta que cada teléfono lo muestra.
    const publishedAt = new Map<number, number>();
    let pub = w.host.getCounters().published;
    const seenPackets = new Set<number>();
    w.net.rule((packet: Packet) => {
      if (packet.kind === 'state' && packet.from === w.hostLink.name && !seenPackets.has(packet.id)) {
        seenPackets.add(packet.id);
        pub += 1;
        publishedAt.set(pub, packet.sentAt);
      }
    });
    const propagation: number[] = [];
    const acks: number[] = [];
    w.players.forEach((player) => {
      let last = player.member.getView().snapshot?.pub ?? 0;
      const sentAt = new Map<string, number>();
      player.member.subscribe(() => {
        const view = player.member.getView();
        if (view.snapshot && view.snapshot.pub !== last) {
          last = view.snapshot.pub;
          const at = publishedAt.get(last);
          if (at !== undefined) propagation.push(Date.now() - at);
        }
        Object.entries(view.outbox).forEach(([key, entry]) => {
          if ((entry.state === 'queued' || entry.state === 'sent') && !sentAt.has(key)) sentAt.set(key, Date.now());
          if (entry.state === 'accepted' && sentAt.has(key)) {
            acks.push(Date.now() - sentAt.get(key)!);
            sentAt.delete(key);
          }
        });
      });
    });

    await playRoute(w);
    await advance(5200);
    expect(w.host.getView().snapshot.phase).toBe('podium');
    expect(w.host.getView().snapshot.completed).toBe(true);
    expectConverged(w);
    w.players.forEach((player) => expect(player.member.getView().pending).toEqual([]));
    // Nadie quedó con un puntaje contado dos veces: 6 juegos por persona como máximo.
    Object.values(w.host.getView().state.players).forEach((player) => expect(Object.keys(player.games)).toHaveLength(6));

    const p95State = percentile(propagation, 0.95);
    const p95Ack = percentile(acks, 0.95);
    console.info(`[SLO simulado · 12 teléfonos, red 20–180 ms] estados: n=${propagation.length} p50=${percentile(propagation, 0.5)} ms p95=${p95State} ms · confirmaciones: n=${acks.length} p50=${percentile(acks, 0.5)} ms p95=${p95Ack} ms`);
    expect(propagation.length).toBeGreaterThan(200);
    expect(acks.length).toBeGreaterThan(100);
    expect(p95State).toBeLessThanOrEqual(500);
    expect(p95Ack).toBeLessThanOrEqual(500);
  });

  it('20a · versiones que no calzan se informan con claridad (stand antiguo, app antigua, teléfono antiguo)', async () => {
    // Un stand con el protocolo anterior (su saludo no anuncia versión) y otro más nuevo que esta app.
    for (const [proto, side] of [
      [undefined, 'host-old'],
      [9, 'client-old'],
    ] as const) {
      const net = new SimNet(1);
      const code = generateRouteCode(0, 1);
      const secrets = deriveRouteSecrets(code);
      const sign = newSignKeys();
      const hello = { v: 2, kind: 'soytel-route', box: newBoxKeys().publicKey, sign: sign.publicKey, at: Date.now(), epoch: 1, owner: 'a00000000001', challenge: 'aaaaaaaaaaaaaaaa', ...(proto ? { proto } : {}) } as HelloMessage;
      net.inject(0, routeTopics(secrets.roomId).hello, JSON.stringify(sealHello(hello, secrets.helloKey, sign.secretKey)), true, 'stand-otra-version');
      const member = new MemberController({ store: new MemoryMemberStore(), clock: skewedClock() });
      extras.push(() => member.reset());
      await member.join({ code, alias: 'Ana', avatar: 1, link: net.link('Ana') });
      await advance(3000);
      expect(member.getView().status).toBe('incompatible');
      expect(member.getView().incompatible).toBe(side);
    }

    // Un teléfono con la app anterior intenta unirse a este stand: recibe un rechazo (no queda buscando)
    // y el stand lo avisa en pantalla.
    const w = await world();
    const keys = newBoxKeys();
    const hostBox = w.host.exportRecord().boxKeys.publicKey;
    const topics = routeTopics(deriveRouteSecrets(w.code).roomId);
    w.net.inject(0, topics.join('stpviejo00000000000001'), JSON.stringify({ pk: keys.publicKey, sealed: sealTo(JSON.stringify({ alias: 'Viejo', avatar: 2 }), hostBox, keys.secretKey) }), false, 'app-antigua');
    await advance(300);
    expect(w.host.getView().legacyClient).toBe(true);
    expect(w.host.getView().snapshot.players).toHaveLength(0);
    const reply = w.net.sent.find((packet) => packet.topic === topics.dm('stpviejo00000000000001'))!;
    expect(JSON.parse(openFrom(JSON.parse(reply.text), hostBox, keys.secretKey)!)).toEqual({ type: 'rejected', reason: 'version' });
    await advance(100_000);
    expect(w.host.getView().legacyClient).toBe(false);
  });

  it('20b · una sesión guardada de una ruta que ya terminó no se retoma', async () => {
    const w = await world();
    const ana = await addPlayer(w, 'Ana');
    await advance(100);
    expect(ana.store.record).not.toBeNull();
    ana.link.kill();
    ana.member.reset();
    jest.setSystemTime(Date.now() + SESSION_MAX_AGE_MS + 60_000);
    const reopened = new MemberController({ store: ana.store, clock: skewedClock() });
    extras.push(() => reopened.reset());
    await reopened.restore(w.net.link('Ana-tarde'));
    await advance(500);
    expect(reopened.getView().status).toBe('idle');
    expect(ana.store.record).toBeNull();
  });

  it('20c · quitar a un participante: deja de actuar y de leer; el resto sigue con una llave nueva', async () => {
    const w = await world();
    const states: Packet[] = [];
    w.net.rule((packet) => {
      if (packet.kind === 'state' && !states.includes(packet)) states.push(packet);
    });
    const ana = await addPlayer(w, 'Ana');
    const beto = await addPlayer(w, 'Beto');
    const caro = await addPlayer(w, 'Caro');
    w.host.dispatch({ type: 'start' });
    await advance(300);
    const oldKey = beto.store.record!.sessionKey!;
    expect(ana.store.record!.keyId).toBe(1);

    w.host.dispatch({ type: 'kick', id: idOf(w, 'Beto') });
    await advance(600);
    expect(beto.member.getView().status).toBe('kicked');
    expect(aliases(w)).toEqual(['Ana', 'Caro']);
    // Los demás recibieron la llave nueva y siguen sincronizados.
    expect(ana.store.record!.keyId).toBe(2);
    expect(caro.store.record!.keyId).toBe(2);
    expectConverged(w, [ana, caro]);

    // Lo que publica el stand desde ahora no se abre con la llave que conserva el quitado.
    const accepted = beto.member.getDiagnostics().statesAccepted;
    ana.member.checkin('b215');
    caro.member.checkin('b215');
    await advance(6000);
    const latest = parseStateEnvelope(states[states.length - 1].text)!;
    expect(latest.kid).toBe(2);
    expect(openShared(latest.sealed, oldKey)).toBeNull();
    expect(openShared(latest.sealed, ana.store.record!.sessionKey!)).not.toBeNull();
    expect(beto.member.getDiagnostics().statesAccepted).toBe(accepted);
    expect(w.host.getView().snapshot.phase).toBe('play');
    expectConverged(w, [ana, caro]);

    // Su app ya no envía acciones...
    const sentBefore = w.net.sent.filter((packet) => packet.kind === 'up' && packet.from === 'Beto').length;
    beto.member.checkin('b215');
    await advance(600);
    expect(w.net.sent.filter((packet) => packet.kind === 'up' && packet.from === 'Beto').length).toBe(sentBefore);
    // ...y si una app modificada las enviara igual con sus llaves, el stand las rechaza sin aplicarlas.
    const rejected = w.host.getCounters().actionsRejected;
    const record = beto.store.record!;
    const forged = sealShared('{"k":"act","seq":8000000000000000,"e":"forjado0001","action":{"type":"score","game":"red-b215","score":1000,"accuracy":1}}', pairKey(record.hostBox!, record.boxKeys.secretKey)!);
    w.net.inject(0, routeTopics(deriveRouteSecrets(w.code).roomId).up(record.clientId), JSON.stringify(forged));
    await advance(300);
    expect(w.host.getCounters().actionsRejected).toBe(rejected + 1);
    expect(aliases(w)).toEqual(['Ana', 'Caro']);
    // Tampoco puede volver a entrar con la misma identidad.
    beto.member.retryJoin();
    await advance(3000);
    expect(beto.member.getView().status).toBe('kicked');
    expect(aliases(w)).toEqual(['Ana', 'Caro']);

    // Un participante que estaba sin conexión durante el cambio de llave la recupera solo.
    const dani = await addPlayer(w, 'Dani');
    dani.link.setConnected(false);
    w.host.dispatch({ type: 'kick', id: idOf(w, 'Caro') });
    await advance(600);
    dani.link.setConnected(true);
    await advance(2000);
    expect(dani.store.record!.keyId).toBe(3);
    expect(dani.member.getView().status).toBe('joined');
    expectConverged(w, [ana, dani]);
  });

  it('la traza de la red no contiene contenido, llaves ni alias', async () => {
    const w = await world();
    const ana = await addPlayer(w, 'Participante-Secreto');
    w.host.dispatch({ type: 'start' });
    await advance(600);
    const trace = JSON.stringify(w.net.trace);
    expect(w.net.trace.length).toBeGreaterThan(10);
    expect(trace).not.toContain(ana.store.record!.sessionKey!);
    expect(trace).not.toContain(ana.store.record!.boxKeys.secretKey);
    expect(trace).not.toContain(w.code);
    w.net.trace.forEach((event) => expect(Object.keys(event).every((key) => ['at', 'event', 'kind', 'from', 'to', 'broker', 'retain', 'size', 'detail'].includes(key))).toBe(true));
  });
});
