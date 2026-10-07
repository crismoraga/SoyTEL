import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';
import { createInterface } from 'readline';
import WebSocket from 'ws';
import { systemClock } from '@/route/clock';
import { findReachableBroker, HostController, newHostRecord, probeBroker, standLink } from '@/route/host';
import { MqttRouteLink, MultiRouteLink } from '@/route/link';
import { MemberController } from '@/route/member';
import { generateRouteCode } from '@/route/protocol';
import { getRouteQuestion } from '@/route/quizBank';
import { digest, MemoryHostStore, MemoryLocks, MemoryMemberStore, percentile } from './support/routeHarness';

// MQTT de verdad: brokers locales (Aedes, cada uno en su proceso) escuchando WebSocket en 127.0.0.1 y
// el cliente MQTT de la app hablando con ellos con sus paquetes reales (CONNECT, SUBSCRIBE/SUBACK,
// PUBLISH QoS 1, retenidos). Anfitrión, participantes y una segunda pantalla del stand, con cifrado y
// firmas reales y reloj real. No toca brokers públicos ni necesita Internet.

jest.setTimeout(180_000);

interface Broker {
  process: ChildProcessWithoutNullStreams;
  lines: string[];
  url: string;
}

const brokers: Broker[] = [];
const stoppers: (() => void)[] = [];
// Un puerto local donde no escucha nadie: simula un servidor caído o bloqueado por la red.
const DEAD_URL = 'ws://127.0.0.1:9';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function until(check: () => boolean, timeoutMs: number, what: string): Promise<number> {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeoutMs) throw new Error(`no ocurrió a tiempo: ${what}`);
    await sleep(5);
  }
  return Date.now() - started;
}

async function startBroker(): Promise<Broker> {
  const child = spawn(process.execPath, [path.join(__dirname, 'support', 'mqttBroker.mjs')], { stdio: 'pipe' });
  const lines: string[] = [];
  createInterface({ input: child.stdout }).on('line', (line) => lines.push(line));
  await until(() => lines.length > 0, 15_000, 'broker local listo');
  return { process: child, lines, url: `ws://127.0.0.1:${(JSON.parse(lines[0]) as { port: number }).port}` };
}

function stopBroker(broker: Broker): Promise<void> {
  if (broker.process.exitCode !== null) return Promise.resolve();
  return new Promise<void>((resolve) => {
    // Si no termina por las buenas, se le corta.
    const timer = setTimeout(() => broker.process.kill(), 2000);
    broker.process.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    broker.process.stdin.write('quit\n');
  });
}

beforeAll(async () => {
  // El cliente de la app usa el WebSocket global (navegador, React Native, Node 22+). Aquí se fija el de `ws`.
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;
  brokers.push(await startBroker(), await startBroker());
});

afterAll(async () => {
  stoppers.splice(0).forEach((stop) => stop());
  await Promise.all(brokers.map(stopBroker));
});

// Mensajes de la ruta que pasaron por un broker.
async function brokerStats(broker: Broker): Promise<{ published: number; clients: number }> {
  const before = broker.lines.length;
  broker.process.stdin.write('stats\n');
  await until(() => broker.lines.length > before, 3000, 'estadísticas del broker');
  return JSON.parse(broker.lines[broker.lines.length - 1]) as { published: number; clients: number };
}

// `prefix` marca el comienzo del identificador de conexión, para poder cortarla desde el broker.
const link = (prefix: string) => new MqttRouteLink(0, [brokers[0].url], { idPrefix: prefix });

// Corta desde el broker la conexión de un cliente (como una caída de red del lado del servidor).
function dropClient(broker: Broker, prefix: string) {
  broker.process.stdin.write(`drop ${prefix}\n`);
}

describe('ruta sobre brokers MQTT locales reales', () => {
  it('detecta si un broker sirve de verdad y elige el más rápido que responde', async () => {
    expect(await probeBroker(brokers[0].url, 4000)).toBe(true);
    expect(await findReachableBroker(1500, [DEAD_URL, brokers[0].url])).toBe(1);
    expect(await findReachableBroker(800, [DEAD_URL])).toBeNull();
  });

  it('anfitrión, tres participantes y una segunda pantalla: unión, fases, trivia, reconexión y podio', async () => {
    const broker = brokers[0];
    const store = new MemoryHostStore();
    const locks = new MemoryLocks();
    const code = generateRouteCode(0, 1);
    const record = newHostRecord(code, 0, { quizQuestions: 2, countdownSeconds: 1, questionSeconds: 6, revealSeconds: 1 }, Date.now(), 'a0000000aaaa');
    const host = new HostController(record, link('sth'), { store, locks, clock: systemClock, owner: 'a0000000aaaa' });
    stoppers.push(() => host.stop(false));
    await host.start();
    await until(() => host.getView().link === 'online', 5000, 'stand en línea');

    const members = ['Ana', 'Beto', 'Caro'].map((alias) => ({ alias, member: new MemberController({ store: new MemoryMemberStore(), clock: systemClock }) }));
    members.forEach(({ member }) => stoppers.push(() => member.reset()));
    const joinTimes: number[] = [];
    for (const { alias, member } of members) {
      const started = Date.now();
      // Dos con la huella del QR y una con el código escrito.
      await member.join({ code, alias, avatar: 1, fingerprint: alias === 'Caro' ? null : host.fingerprint, link: link('stm') });
      await until(() => member.getView().status === 'joined' && Boolean(member.getView().me), 8000, `unión de ${alias}`);
      joinTimes.push(Date.now() - started);
    }
    expect(host.getView().snapshot.players.map((player) => player.alias).sort()).toEqual(['Ana', 'Beto', 'Caro']);
    members.forEach(({ member }) => expect(member.getView().verification).toBe(host.getView().verification));

    // Segunda pantalla del stand (misma ruta, mismo almacenamiento): solo observa.
    const second = new HostController((await store.load(code))!, link('sto'), { store, locks, clock: systemClock, owner: 'a0000000bbbb' });
    stoppers.push(() => second.stop(false));
    await second.start();
    expect(second.getView().role).toBe('observer');

    const reference = () => digest(host.getView().snapshot);
    const everyone = () => members.every(({ member }) => JSON.stringify(digest(member.getView().snapshot)) === JSON.stringify(reference())) && JSON.stringify(digest(second.getView().snapshot)) === JSON.stringify(reference());
    // Convergencia: desde una orden del stand hasta que todas las pantallas la muestran.
    const convergence: number[] = [];
    // Lo mismo, pero justo después de cortar conexiones (incluye el tiempo de reconectar).
    const recoveries: number[] = [];
    const order = async (action: Parameters<HostController['dispatch']>[0], what: string, into = convergence) => {
      host.dispatch(action);
      into.push(await until(everyone, 4000, what));
    };
    // Confirmación: desde que un teléfono envía hasta que el stand responde que lo guardó.
    const acks: number[] = [];
    const act = async (key: string, send: (member: MemberController) => void, what: string) => {
      const started = Date.now();
      const waits = members.map(({ member }) => {
        let sent = false;
        return new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            stop();
            reject(new Error(`sin confirmación: ${what}`));
          }, 4000);
          const check = () => {
            const entry = member.getView().outbox[key];
            if (entry) sent = true;
            // Confirmada, o ya retirada de la lista porque la ruta avanzó después de confirmarla.
            if (entry?.state === 'accepted' || (sent && !entry)) {
              clearTimeout(timer);
              stop();
              acks.push(Date.now() - started);
              resolve();
            }
          };
          const stop = member.subscribe(check);
          send(member);
          check();
        });
      });
      await Promise.all(waits);
      convergence.push(await until(everyone, 4000, `${what} (convergencia)`));
    };

    await order({ type: 'start' }, 'inicio');
    expect(reference()?.phase).toBe('checkin');
    await act('checkin:b215', (member) => member.checkin('b215'), 'llegada a B215');
    await until(() => host.getView().snapshot.phase === 'play', 2000, 'juego B215');
    convergence.push(await until(everyone, 4000, 'juego B215'));

    // Se cae la conexión de un teléfono (desde el broker) y luego la del stand: ambos se reconectan solos.
    dropClient(broker, 'stm');
    await order({ type: 'advance' }, 'resultados tras la caída de los teléfonos', recoveries);
    await order({ type: 'advance' }, 'rumbo a B213');
    dropClient(broker, 'sth');
    const back = Date.now();
    await until(() => host.getView().link === 'online', 5000, 'reconexión del stand');
    members.forEach(({ member }) => member.checkin('b213'));
    await until(() => host.getView().snapshot.phase === 'projects', 6000, 'proyectos tras la caída del stand');
    await until(everyone, 4000, 'convergencia tras la caída del stand');
    recoveries.push(Date.now() - back);

    await order({ type: 'advance' }, 'rumbo al pasillo');
    await act('checkin:hall', (member) => member.checkin('hall'), 'llegada al pasillo');
    await until(() => host.getView().snapshot.phase === 'quiz', 2000, 'trivia');

    for (let index = 0; index < 2; index += 1) {
      await until(() => {
        const quiz = host.getView().snapshot.quiz;
        return Boolean(quiz && quiz.index === index && quiz.step === 'question' && host.now() >= quiz.startsAt);
      }, 8000, `pregunta ${index + 1}`);
      const answer = getRouteQuestion(host.getView().snapshot.quiz!.question.id)!.answer;
      await act(`answer:${index}`, (member) => member.answer(index, answer), `respuesta ${index + 1}`);
      await until(() => host.getView().snapshot.quiz?.step === 'reveal' || host.getView().snapshot.phase === 'podium', 4000, `revelación ${index + 1}`);
    }
    await until(() => host.getView().snapshot.phase === 'podium', 8000, 'podio');
    convergence.push(await until(everyone, 4000, 'podio'));

    const final = host.getView().snapshot;
    expect(final.completed).toBe(true);
    expect(final.players.every((player) => player.quizCorrect === 2)).toBe(true);
    members.forEach(({ member }) => expect(member.getView().pending).toEqual([]));
    expect(host.getCounters().saveFailures).toBe(0);
    const stats = await brokerStats(broker);
    expect(stats.published).toBeGreaterThan(40);

    const p95Convergence = percentile(convergence, 0.95);
    const p95Ack = percentile(acks, 0.95);
    console.info(
      `[SLO medido · broker MQTT local, 3 teléfonos + 2 pantallas] unión: ${joinTimes.join('/')} ms · convergencia tras orden o acción: n=${convergence.length} p50=${percentile(convergence, 0.5)} ms p95=${p95Convergence} ms máx=${Math.max(...convergence)} ms · confirmación del stand: n=${acks.length} p50=${percentile(acks, 0.5)} ms p95=${p95Ack} ms · convergencia tras cortar conexiones (teléfonos / stand, incluye reconectar): ${recoveries.join(' / ')} ms`,
    );
    expect(p95Convergence).toBeLessThanOrEqual(500);
    expect(p95Ack).toBeLessThanOrEqual(500);
    recoveries.forEach((ms) => expect(ms).toBeLessThanOrEqual(2000));

    members.forEach(({ member }) => member.reset());
    second.stop(false);
    host.stop(false);
  });

  it('dos pantallas del stand con la misma ruta guardada siguen conectadas a la vez: el servidor no echa a una por la otra', async () => {
    const urls = [brokers[0].url, brokers[1].url];
    const store = new MemoryHostStore();
    const locks = new MemoryLocks();
    const code = generateRouteCode(0, urls.length);
    const record = newHostRecord(code, 0, {}, Date.now(), 'a0000000dddd');
    const before = await Promise.all(brokers.map(brokerStats));
    // Como en la app: cada pantalla arma su enlace a partir de la misma ruta guardada.
    const driverLink = standLink(record, urls);
    const driver = new HostController(record, driverLink, { store, locks, clock: systemClock, owner: 'a0000000dddd' });
    stoppers.push(() => driver.stop(false));
    await driver.start();
    await until(() => driver.getView().brokersOnline === 2, 8000, 'la pantalla que conduce, en línea en los dos servidores');
    const observerLink = standLink((await store.load(code))!, urls);
    const observer = new HostController((await store.load(code))!, observerLink, { store, locks, clock: systemClock, owner: 'a0000000eeee' });
    stoppers.push(() => observer.stop(false));
    await observer.start();
    expect(observer.getView().role).toBe('observer');
    await until(() => observer.getView().brokersOnline === 2, 8000, 'la segunda pantalla, en línea en los dos servidores');

    // Durante varios segundos ninguna de las dos pierde una conexión.
    const drops: string[] = [];
    const watch = (name: string, target: MultiRouteLink) =>
      target.onStatus(() => {
        const offline = target.brokers.filter((item) => item.status !== 'online').length;
        if (offline > 0) drops.push(`${name}: ${offline} sin conexión`);
      });
    const stops = [watch('conduce', driverLink), watch('observa', observerLink)];
    await sleep(4000);
    stops.forEach((stop) => stop());
    expect(drops).toEqual([]);
    const after = await Promise.all(brokers.map(brokerStats));
    after.forEach((stats, index) => expect(stats.clients - before[index].clients).toBe(2));
    // Y la que observa sigue viendo lo que publica la que conduce.
    driver.dispatch({ type: 'finish' });
    await until(() => observer.getView().snapshot.phase === driver.getView().snapshot.phase, 3000, 'la segunda pantalla ve el cambio');
    observer.stop(false);
    driver.stop(false);
  });

  it('la carrera elige el servidor donde está el stand, no el que conecta primero', async () => {
    const [empty, used] = brokers;
    const code = generateRouteCode(1, 2);
    const record = newHostRecord(code, 1, {}, Date.now(), 'a0000000ffff');
    // El stand solo alcanza el segundo servidor (el primero está bloqueado en su red).
    const host = new HostController(record, new MqttRouteLink(0, [used.url], { idPrefix: 'sth' }), { store: new MemoryHostStore(), locks: null, clock: systemClock, owner: 'a0000000ffff' });
    stoppers.push(() => host.stop(false));
    await host.start();
    await until(() => host.getView().link === 'online', 5000, 'stand en línea');
    for (const alias of ['Uno', 'Dos', 'Tres', 'Cuatro']) {
      const member = new MemberController({ store: new MemoryMemberStore(), clock: systemClock });
      stoppers.push(() => member.reset());
      const memberLink = new MqttRouteLink(0, [empty.url, used.url], { race: true });
      const started = Date.now();
      await member.join({ code, alias, avatar: 1, fingerprint: host.fingerprint, link: memberLink });
      await until(() => member.getView().status === 'joined' && Boolean(member.getView().me), 8000, `unión de ${alias}`);
      // Sin pagar la espera de un servidor donde el stand no está.
      expect(Date.now() - started).toBeLessThan(2000);
      expect(memberLink.brokerIndex).toBe(1);
    }
    expect(host.getView().snapshot.players).toHaveLength(4);
    host.stop(false);
  });

  it('el stand está en todos los servidores: cada teléfono entra por el que alcanza y la caída de uno no detiene la ruta', async () => {
    const [first, secondBroker] = brokers;
    // Tres servidores configurados: uno caído (o bloqueado por la red) y dos que funcionan.
    const urls = [DEAD_URL, first.url, secondBroker.url];
    const code = generateRouteCode(0, urls.length);
    const record = newHostRecord(code, 0, { quizQuestions: 1 }, Date.now(), 'a0000000cccc');
    const hostLink = new MultiRouteLink(0, urls);
    const host = new HostController(record, hostLink, { store: new MemoryHostStore(), locks: null, clock: systemClock, owner: 'a0000000cccc' });
    stoppers.push(() => host.stop(false));
    await host.start();
    await until(() => host.getView().brokersOnline === 2, 8000, 'stand en línea en los dos servidores que funcionan');
    expect(host.getView()).toMatchObject({ link: 'online', brokerCount: 3 });
    expect(host.getDiagnostics().brokerStates.filter((state) => state === 'online')).toHaveLength(2);

    const join = async (alias: string, memberLink: MqttRouteLink) => {
      const member = new MemberController({ store: new MemoryMemberStore(), clock: systemClock });
      stoppers.push(() => member.reset());
      const started = Date.now();
      await member.join({ code, alias, avatar: 1, fingerprint: host.fingerprint, link: memberLink });
      await until(() => member.getView().status === 'joined' && Boolean(member.getView().me), 10_000, `unión de ${alias}`);
      return { alias, member, link: memberLink, ms: Date.now() - started };
    };
    // Ana parte por el servidor del código (el caído): la carrera la lleva al primero que responde.
    const ana = await join('Ana', new MqttRouteLink(0, urls, { race: true }));
    // Beto solo alcanza el servidor 1 y Caro solo el 2 (como dos redes con bloqueos distintos).
    const beto = await join('Beto', new MqttRouteLink(0, [first.url]));
    const caro = await join('Caro', new MqttRouteLink(0, [secondBroker.url]));
    expect(ana.link.brokerIndex).not.toBe(0);
    // Con la carrera no se paga la espera del servidor caído.
    expect(ana.ms).toBeLessThan(4000);
    expect(host.getView().snapshot.players.map((player) => player.alias).sort()).toEqual(['Ana', 'Beto', 'Caro']);

    const all = [ana, beto, caro];
    const reference = () => JSON.stringify(digest(host.getView().snapshot));
    const everyone = (group = all) => group.every(({ member }) => JSON.stringify(digest(member.getView().snapshot)) === reference());
    host.dispatch({ type: 'start' });
    await until(() => everyone(), 4000, 'inicio visto por los tres, cada uno por su servidor');
    // Acciones de teléfonos en servidores distintos llegan al mismo stand y todos ven lo mismo.
    all.forEach(({ member }) => member.checkin('b215'));
    await until(() => host.getView().snapshot.phase === 'play' && everyone(), 5000, 'juego B215 visto por los tres');

    // Se cae por completo el servidor donde está Ana (y Beto, que no tiene otro).
    const anaBroker = ana.link.brokerIndex;
    const killed = anaBroker === 1 ? first : secondBroker;
    const stranded = anaBroker === 1 ? beto : caro;
    const survivor = anaBroker === 1 ? caro : beto;
    const started = Date.now();
    await stopBroker(killed);
    host.dispatch({ type: 'advance' });
    // El stand sigue en línea por el otro servidor y quien estaba en él no nota nada.
    await until(() => everyone([survivor]), 3000, 'quien está en el otro servidor sigue al día');
    expect(host.getView().link).toBe('online');
    expect(host.getView().brokersOnline).toBe(1);
    // Ana se pasa sola al servidor que queda y se pone al día.
    await until(() => ana.link.brokerIndex !== anaBroker && everyone([ana]), 15_000, 'Ana sigue por el otro servidor');
    const failover = Date.now() - started;
    expect(ana.member.getView().status).toBe('joined');
    expect(ana.member.getView().snapshot?.phase).toBe('results');
    // Quien solo alcanzaba el servidor caído queda sin señal, y lo sabe (no ve un estado falso como vigente).
    expect(stranded.member.getView().link).not.toBe('online');

    console.info(`[multiservidor · brokers locales] unión con un servidor caído: ${ana.ms} ms (carrera) · cambio de servidor tras la caída del suyo: ${failover} ms`);
    expect(failover).toBeLessThan(12_000);
    all.forEach(({ member }) => member.reset());
    host.stop(false);
  });
});
