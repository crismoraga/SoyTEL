import {
  addPlayer,
  advance,
  byName,
  crashHost,
  createWorld,
  digest,
  expectConverged,
  finishB215,
  finishProjects,
  finishQuiz,
  openHost,
  playRoute,
  reachB215,
  reachProjects,
  reachQuiz,
  reopenHost,
  stopWorld,
  trackPhases,
  type World,
} from './support/routeHarness';

// Multijugador bajo fallos (escenarios 1 a 10 del encargo). Anfitrión y participantes reales con su
// cifrado y firmas; red, reloj y almacenamiento simulados (ver tests/support/routeHarness.ts).

jest.setTimeout(120_000);

let worlds: World[] = [];

async function world(options?: Parameters<typeof createWorld>[0]): Promise<World> {
  const created = await createWorld(options);
  worlds.push(created);
  return created;
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  worlds.forEach(stopWorld);
  worlds = [];
  jest.useRealTimers();
});

describe('multijugador · convergencia', () => {
  it('1 · ruta completa: tres teléfonos y una segunda pantalla del stand ven lo mismo en cada fase', async () => {
    const w = await world();
    const ana = await addPlayer(w, 'Ana');
    const beto = await addPlayer(w, 'Beto');
    const caro = await addPlayer(w, 'Caro', { qr: false });
    const second = openHost(w, (await w.hostStore.load(w.code))!, { name: 'pantalla2' });
    await second.host.start();
    await advance(300);
    expect(second.host.getView().role).toBe('observer');
    expect(second.host.getView().readOnly).toBe(true);
    const seen = trackPhases(w, { pantalla2: second.host });
    const sameEverywhere = () => {
      expectConverged(w);
      expect(digest(second.host.getView().snapshot)).toEqual(digest(w.host.getView().snapshot));
    };
    sameEverywhere();

    await reachB215(w);
    expect(w.host.getView().snapshot.phase).toBe('play');
    sameEverywhere();
    await finishB215(w);
    expect(w.host.getView().snapshot.phase).toBe('results');
    sameEverywhere();
    await reachProjects(w);
    expect(w.host.getView().snapshot.phase).toBe('projects');
    sameEverywhere();
    await finishProjects(w);
    expect(w.host.getView().snapshot.stop).toBe('hall');
    sameEverywhere();
    await reachQuiz(w);
    expect(w.host.getView().snapshot.phase).toBe('quiz');
    sameEverywhere();
    await finishQuiz(w);
    await advance(5200);

    const final = w.host.getView().snapshot;
    expect(final.phase).toBe('podium');
    expect(final.completed).toBe(true);
    sameEverywhere();
    // Todas las pantallas pasaron por las mismas fases, en el mismo orden.
    Object.entries(seen).forEach(([name, phases]) => expect({ name, phases }).toEqual({ name, phases: seen.stand }));
    // Nada quedó sin respuesta del stand y cada puntaje se contó una vez.
    [ana, beto, caro].forEach((player) => expect(player.member.getView().pending).toEqual([]));
    const totals = final.players.map((player) => player.total);
    expect(Math.min(...totals)).toBeGreaterThan(3000);
    expect(final.players.map((player) => player.alias).sort()).toEqual(['Ana', 'Beto', 'Caro']);
    // La segunda pantalla nunca condujo: no se ofrecen sus controles y sus órdenes no hacen nada.
    second.host.dispatch({ type: 'finish' });
    await advance(300);
    expect(w.host.getView().snapshot.completed).toBe(true);
    second.host.stop(false);
  });

  it('2 · código escrito, QR con huella, ingreso tardío y bienvenida duplicada', async () => {
    const w = await world();
    // Toda bienvenida y confirmación llega tres veces.
    w.net.rule((packet) => (packet.kind === 'dm' ? { copies: 2 } : undefined));
    const typed = await addPlayer(w, 'Ana', { qr: false, wait: 1200 });
    // Con el código escrito se escuchan los saludos antes de confiar: todavía no entra.
    expect(typed.member.getView().status).toBe('joining');
    await advance(1500);
    expect(typed.member.getView().status).toBe('joined');
    expect(typed.member.getView().verification).toBe(w.host.getView().verification);
    const scanned = await addPlayer(w, 'Beto', { wait: 250 });
    expect(scanned.member.getView().status).toBe('joined');
    expect(w.host.getView().snapshot.players).toHaveLength(2);
    expect(w.host.getCounters().joinsAccepted).toBe(2);

    await reachB215(w);
    const late = await addPlayer(w, 'Caro');
    expect(late.member.getView().status).toBe('joined');
    expect(late.member.getView().snapshot?.phase).toBe('play');
    expect(w.host.getView().snapshot.players).toHaveLength(3);
    await finishB215(w);
    expect(byName(w, 'Caro').member.getView().me?.games['red-b215']).toBe(700);
    expectConverged(w);
  });

  it('3 · confirmaciones perdidas, duplicadas y acciones desordenadas se aplican una sola vez', async () => {
    const w = await world();
    const ana = await addPlayer(w, 'Ana');
    const beto = await addPlayer(w, 'Beto');
    w.host.dispatch({ type: 'start' });
    await advance(300);

    // Ana no recibe ni confirmaciones ni estados: su llegada queda "enviada", no "confirmada".
    const lost = w.net.rule((packet, to) => (to === 'Ana' && (packet.kind === 'dm' || packet.kind === 'state') ? { drop: true } : undefined));
    ana.member.checkin('b215');
    await advance(9000);
    expect(ana.member.getView().outbox['checkin:b215']).toEqual({ state: 'sent' });
    expect(ana.member.getView().pending).toEqual(['checkin:b215']);
    // El stand la aplicó una vez aunque Ana la reenvió varias.
    expect(w.host.getView().state.players[ana.member.getView().snapshot!.players.find((p) => p.alias === 'Ana')!.id].checkins.b215).toBeGreaterThan(0);
    expect(w.host.getCounters().actionsAccepted).toBe(1);

    lost();
    w.net.rule((packet) => (packet.kind === 'dm' ? { copies: 3 } : undefined));
    await advance(9000);
    expect(ana.member.getView().outbox['checkin:b215']).toEqual({ state: 'accepted' });
    expect(ana.member.getView().pending).toEqual([]);
    expect(w.host.getCounters().actionsAccepted).toBe(1);

    // La llegada de Beto se demora y un envío posterior suyo llega antes: el stand descarta el viejo
    // (sin efecto) y Beto lo reintenta con un contador nuevo.
    let held = false;
    w.net.rule((packet) => {
      if (packet.kind === 'up' && packet.from === 'Beto' && !held) {
        held = true;
        return { delay: 1500 };
      }
      return undefined;
    });
    const replayed = w.host.getCounters().actionsReplayed;
    beto.member.checkin('b215');
    await advance(100);
    beto.member.answer(0, 0);
    await advance(1700);
    expect(w.host.getCounters().actionsReplayed).toBeGreaterThan(replayed);
    await advance(4000);
    expect(w.host.getView().snapshot.phase).toBe('play');
    expect(w.host.getCounters().actionsAccepted).toBe(2);
    expectConverged(w);
  });

  it('4 · estados que llegan desordenados nunca hacen retroceder una pantalla', async () => {
    const w = await world();
    const ana = await addPlayer(w, 'Ana');
    const others = [await addPlayer(w, 'Beto'), await addPlayer(w, 'Caro'), await addPlayer(w, 'Dani')];
    w.host.dispatch({ type: 'start' });
    await advance(300);
    const delays = [900, 0, 600, 0, 300];
    let turn = 0;
    w.net.rule((packet, to) => (packet.kind === 'state' && to === 'Ana' ? { delay: delays[turn++ % delays.length] } : undefined));
    const pubs: number[] = [];
    const revs: number[] = [];
    ana.member.subscribe(() => {
      const snapshot = ana.member.getView().snapshot;
      if (snapshot && pubs[pubs.length - 1] !== snapshot.pub) {
        pubs.push(snapshot.pub);
        revs.push(snapshot.rev);
      }
    });
    for (const player of others) {
      player.member.checkin('b215');
      await advance(150);
    }
    await advance(3000);
    expect(pubs.length).toBeGreaterThan(1);
    pubs.forEach((pub, index) => index > 0 && expect(pub).toBeGreaterThan(pubs[index - 1]));
    revs.forEach((rev, index) => index > 0 && expect(rev).toBeGreaterThanOrEqual(revs[index - 1]));
    expect(ana.member.getDiagnostics().statesIgnored).toBeGreaterThan(0);
    expectConverged(w);
  });

  it('5 · copias de mensajes auténticos (estado, acción, unión, bienvenida) no tienen efecto', async () => {
    const w = await world();
    (['state', 'up', 'join', 'dm'] as const).forEach((kind) => w.net.capture(kind));
    const ana = await addPlayer(w, 'Ana');
    await addPlayer(w, 'Beto');
    w.host.dispatch({ type: 'start' });
    await advance(300);
    ana.member.checkin('b215');
    await advance(500);
    const captured = [...w.net.captured];
    expect(captured.map((packet) => packet.kind)).toEqual(expect.arrayContaining(['state', 'up', 'join', 'dm']));

    await advance(7000);
    const before = digest(w.host.getView().snapshot);
    const clockBefore = ana.member.hostNow();
    const liveBefore = ana.member.getView().lastStateAt;
    const counters = w.host.getCounters();
    const ignored = ana.member.getDiagnostics().statesIgnored;
    captured.forEach((packet) => w.net.inject(0, packet.topic, packet.text));
    await advance(200);

    expect(digest(w.host.getView().snapshot)).toEqual(before);
    expect(w.host.getView().snapshot.players).toHaveLength(2);
    // El reloj del stand que estima Ana solo avanzó lo que pasó de verdad.
    expect(ana.member.hostNow() - clockBefore).toBeGreaterThanOrEqual(190);
    expect(ana.member.hostNow() - clockBefore).toBeLessThan(260);
    expect(ana.member.getView().lastStateAt).toBe(liveBefore);
    expect(ana.member.getDiagnostics().statesIgnored).toBeGreaterThan(ignored);
    const after = w.host.getCounters();
    expect(after.actionsReplayed).toBeGreaterThan(counters.actionsReplayed);
    expect(after.joinsReplayed).toBeGreaterThan(counters.joinsReplayed);
    expect(after.actionsAccepted).toBe(counters.actionsAccepted);
    expect(after.joinsAccepted).toBe(counters.joinsAccepted);

    // La unión de Ana copiada al tópico de otro participante: no crea a nadie.
    const join = captured.find((packet) => packet.kind === 'join' && packet.from === 'Ana')!;
    w.net.inject(0, join.topic.replace(/[^/]+$/, 'stpfalso000000000001'), join.text);
    // Y pasado el plazo del desafío, la misma unión ya es vieja.
    await advance(70_000);
    const stale = w.host.getCounters().joinsStale;
    w.net.inject(0, join.topic, join.text);
    await advance(200);
    expect(w.host.getCounters().joinsStale).toBeGreaterThan(stale);
    expect(w.host.getView().snapshot.players).toHaveLength(2);
    expectConverged(w);
  });
});

describe('multijugador · cortes y recuperación', () => {
  it('6 · stand sin conexión: su cola se compacta y al volver todos convergen en menos de 2 s', async () => {
    const w = await world();
    const ana = await addPlayer(w, 'Ana');
    const beto = await addPlayer(w, 'Beto');
    w.host.dispatch({ type: 'start' });
    await advance(300);

    w.hostLink.setConnected(false);
    ana.member.checkin('b215');
    beto.member.checkin('b215');
    await advance(16_000);
    // Sin conexión el stand no acumula estados viejos: a lo más su saludo y su último estado.
    expect(w.hostLink.queued).toBeLessThanOrEqual(2);
    expect(ana.member.getView().outbox['checkin:b215']).toEqual({ state: 'sent' });
    expect(w.host.getView().snapshot.phase).toBe('checkin');

    const statesBefore = w.net.trace.filter((event) => event.event === 'pub' && event.kind === 'state').length;
    w.hostLink.setConnected(true);
    await advance(2000);
    expect(w.host.getView().snapshot.phase).toBe('play');
    expect(ana.member.getView().pending).toEqual([]);
    expectConverged(w);
    // Al reconectar publicó su estado vigente, no una ráfaga de los que quedaron atrás.
    const burst = w.net.trace.filter((event) => event.event === 'pub' && event.kind === 'state').length - statesBefore;
    expect(burst).toBeLessThanOrEqual(4);
  });

  it('7 · teléfono sin conexión: lo pendiente queda en cola y al volver se pone al día en menos de 2 s', async () => {
    const w = await world();
    const ana = await addPlayer(w, 'Ana');
    const beto = await addPlayer(w, 'Beto');
    const caro = await addPlayer(w, 'Caro');
    w.host.dispatch({ type: 'start' });
    await advance(300);

    ana.link.setConnected(false);
    ana.member.checkin('b215');
    expect(ana.member.getView().outbox['checkin:b215']).toEqual({ state: 'queued' });
    beto.member.checkin('b215');
    caro.member.checkin('b215');
    await advance(1000);
    // El stand no espera a quien no está: parte el juego.
    w.host.dispatch({ type: 'advance' });
    await advance(3000);
    expect(w.host.getView().snapshot.phase).toBe('play');
    expect(ana.member.getView().snapshot?.phase).toBe('checkin');
    expect(ana.member.getView().link).toBe('offline');

    ana.link.setConnected(true);
    await advance(2000);
    expect(ana.member.getView().snapshot?.phase).toBe('play');
    // Su llegada ya no aplica (el grupo avanzó): no queda como pendiente eterno.
    expect(ana.member.getView().pending).toEqual([]);
    expectConverged(w);
    await finishB215(w);
    expect(ana.member.getView().me?.games['red-b215']).toBe(600);
    expectConverged(w);
  });

  it('8 · el stand cambia de servidor antes de dar la bienvenida: el teléfono lo sigue sin soltar sus llaves', async () => {
    const w = await world({ brokers: 3 });
    // Ana alcanza a ver el saludo, pero sus solicitudes no llegan mientras el stand está en el servidor 0.
    w.net.rule((packet) => (packet.kind === 'join' && packet.broker === 0 ? { drop: true } : undefined));
    const ana = await addPlayer(w, 'Ana', { wait: 1500 });
    expect(ana.member.getView().status).toBe('joining');
    expect(ana.member.getView().verification).toBe(w.host.getView().verification);

    w.net.setBrokerUp(0, false);
    await advance(40_000);
    expect(w.hostLink.brokerIndex).toBe(1);
    expect(ana.link.brokerIndex).toBe(1);
    expect(ana.member.getView().status).toBe('joined');
    expect(ana.member.getView().verification).toBe(w.host.getView().verification);
    expectConverged(w);
  });

  it('8b · si el stand no responde en ningún servidor, el intento termina con un error recuperable', async () => {
    const w = await world();
    const blocked = w.net.rule((packet) => (packet.kind === 'join' ? { drop: true } : undefined));
    const ana = await addPlayer(w, 'Ana', { wait: 1000 });
    expect(ana.member.getView().status).toBe('joining');
    await advance(40_000);
    expect(ana.member.getView().status).toBe('unreachable');
    expect(w.host.getView().snapshot.players).toHaveLength(0);
    blocked();
    ana.member.retryJoin();
    await advance(1500);
    expect(ana.member.getView().status).toBe('joined');
    expectConverged(w);
  });

  it('9 · el servidor acepta la conexión pero niega la suscripción', async () => {
    // Al teléfono: busca en los demás, y si no encuentra la ruta lo dice (no queda "conectado" a ciegas).
    const w = await world({ brokers: 2 });
    w.net.denySubscriptions(0, 'Ana');
    const ana = await addPlayer(w, 'Ana', { wait: 800 });
    expect(ana.link.status).not.toBe('online');
    await advance(60_000);
    expect(ana.member.getView().status).toBe('not-found');
    w.net.denySubscriptions(0, 'Ana', false);
    ana.member.retryJoin();
    await advance(14_000);
    expect(ana.member.getView().status).toBe('joined');

    // Al stand: se muda al siguiente servidor y los teléfonos lo encuentran ahí.
    const w2 = await world({ brokers: 2 });
    w2.net.denySubscriptions(0, w2.hostLink.name);
    w2.hostLink.dropFromBroker();
    w2.hostLink.retry();
    await advance(200);
    expect(w2.host.getView().link).toBe('denied');
    await advance(5000);
    expect(w2.hostLink.brokerIndex).toBe(1);
    expect(w2.host.getView().link).toBe('online');
    // En el servidor 0 quedó guardado el saludo viejo del stand: Beto lo ve, no recibe respuesta y lo
    // busca en el siguiente, sin soltar la llave que ya verificó con el QR.
    const beto = await addPlayer(w2, 'Beto', { wait: 9000, brokerIndex: 0 });
    expect(beto.link.brokerIndex).toBe(1);
    expect(beto.member.getView().status).toBe('joined');
    expectConverged(w2);
  });

  it('10 · el stand muere después de dar la bienvenida, aceptar un puntaje y una respuesta: nada confirmado se pierde', async () => {
    const w = await world();
    const ana = await addPlayer(w, 'Ana');
    const beto = await addPlayer(w, 'Beto');
    const epoch = w.host.epoch;

    // Tras la bienvenida.
    crashHost(w);
    await advance(3000);
    await reopenHost(w);
    expect(w.host.epoch).toBeGreaterThan(epoch);
    expect(w.host.getView().snapshot.players.map((player) => player.alias).sort()).toEqual(['Ana', 'Beto']);
    await advance(1500);
    expectConverged(w);

    await reachB215(w);
    await advance(26_000);
    // Tras aceptar un puntaje (Ana ya tiene la confirmación).
    ana.member.submitScore('red-b215', 810, 0.9);
    await advance(300);
    expect(ana.member.getView().outbox['score:red-b215']).toEqual({ state: 'accepted' });
    crashHost(w);
    await advance(2000);
    await reopenHost(w);
    await advance(1500);
    expect(w.host.getView().snapshot.players.find((player) => player.alias === 'Ana')?.games['red-b215']).toBe(810);
    expectConverged(w);

    // El stand muere ANTES de terminar de guardar el puntaje de Beto: Beto no recibió confirmación,
    // así que lo conserva y lo reenvía; termina contado exactamente una vez.
    w.hostStore.delayMs = 800;
    beto.member.submitScore('red-b215', 640, 0.7);
    await advance(300);
    expect(beto.member.getView().outbox['score:red-b215']).toEqual({ state: 'sent' });
    crashHost(w);
    w.hostStore.delayMs = 0;
    await advance(2000);
    const stored = (await w.hostStore.load(w.code))!;
    expect(stored.state.phase).toBe('play');
    expect(Object.values(stored.state.players).find((player) => player.alias === 'Beto')?.games['red-b215']).toBeUndefined();
    await reopenHost(w);
    await advance(2000);
    expect(w.host.getView().snapshot.players.find((player) => player.alias === 'Beto')?.games['red-b215']).toBe(640);
    expect(beto.member.getView().pending).toEqual([]);
    expectConverged(w);

    // Tras aceptar una respuesta de la trivia.
    await reachProjects(w);
    await finishProjects(w);
    await reachQuiz(w);
    await advance(6000);
    const quiz = w.host.getView().snapshot.quiz!;
    expect(quiz.step).toBe('question');
    ana.member.answer(quiz.index, 1);
    await advance(300);
    expect(ana.member.getView().outbox[`answer:${quiz.index}`]).toEqual({ state: 'accepted' });
    crashHost(w);
    await advance(1000);
    await reopenHost(w);
    await advance(1500);
    expect(w.host.getView().snapshot.players.find((player) => player.alias === 'Ana')?.answered).toBe(true);
    expect(w.host.getView().snapshot.players.find((player) => player.alias === 'Beto')?.answered).toBe(false);
    expectConverged(w);
    // La trivia sigue: Beto todavía alcanza a responder la misma pregunta.
    beto.member.answer(quiz.index, 2);
    await advance(600);
    expect(w.host.getView().snapshot.quiz?.step).toBe('reveal');
    await playRouteToEnd(w);
    expect(w.host.getView().snapshot.phase).toBe('podium');
    expectConverged(w);
  });
});

async function playRouteToEnd(w: World) {
  await finishQuiz(w);
  await advance(5200);
}

// Mantiene referenciada la utilidad completa del banco (se usa en la segunda mitad de escenarios).
void playRoute;
