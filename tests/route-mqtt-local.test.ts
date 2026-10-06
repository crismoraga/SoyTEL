import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';
import { createInterface } from 'readline';
import WebSocket from 'ws';
import { systemClock } from '@/route/clock';
import { findReachableBroker, HostController, newHostRecord, probeBroker } from '@/route/host';
import { MqttRouteLink } from '@/route/link';
import { MemberController } from '@/route/member';
import { generateRouteCode } from '@/route/protocol';
import { getRouteQuestion } from '@/route/quizBank';
import { digest, MemoryHostStore, MemoryLocks, MemoryMemberStore, percentile } from './support/routeHarness';

// MQTT de verdad: un broker local (Aedes, en un proceso aparte) escuchando WebSocket en 127.0.0.1 y el
// cliente MQTT de la app hablando con él con sus paquetes reales (CONNECT, SUBSCRIBE/SUBACK, PUBLISH
// QoS 1, retenidos).
// Anfitrión, tres participantes y una segunda pantalla del stand, con cifrado y firmas reales y reloj
// real. No toca brokers públicos ni necesita Internet.

jest.setTimeout(120_000);

let broker: ChildProcessWithoutNullStreams;
let url = '';
const lines: string[] = [];
const stoppers: (() => void)[] = [];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function until(check: () => boolean, timeoutMs: number, what: string): Promise<number> {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeoutMs) throw new Error(`no ocurrió a tiempo: ${what}`);
    await sleep(5);
  }
  return Date.now() - started;
}

beforeAll(async () => {
  // El cliente de la app usa el WebSocket global (navegador, React Native, Node 22+). Aquí se fija el de `ws`.
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;
  broker = spawn(process.execPath, [path.join(__dirname, 'support', 'mqttBroker.mjs')], { stdio: 'pipe' });
  createInterface({ input: broker.stdout }).on('line', (line) => lines.push(line));
  await until(() => lines.length > 0, 15_000, 'broker local listo');
  url = `ws://127.0.0.1:${(JSON.parse(lines[0]) as { port: number }).port}`;
});

afterAll(async () => {
  stoppers.splice(0).forEach((stop) => stop());
  await new Promise<void>((resolve) => {
    // Si no termina por las buenas, se le corta.
    const timer = setTimeout(() => broker.kill(), 2000);
    broker.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    broker.stdin.write('quit\n');
  });
});

// Mensajes de la ruta que pasaron por el broker.
async function brokerStats(): Promise<{ published: number; clients: number }> {
  const before = lines.length;
  broker.stdin.write('stats\n');
  await until(() => lines.length > before, 3000, 'estadísticas del broker');
  return JSON.parse(lines[lines.length - 1]) as { published: number; clients: number };
}

let serial = 0;
const link = (prefix: string) => new MqttRouteLink(`${prefix}${Date.now().toString(36)}${(serial++).toString(36)}`, 0, false, [url]);

// Corta desde el broker la conexión de un cliente (como una caída de red del lado del servidor).
function dropClient(prefix: string) {
  broker.stdin.write(`drop ${prefix}\n`);
}

describe('ruta sobre un broker MQTT local real', () => {
  it('detecta si un broker sirve de verdad (conexión, suscripción y eco)', async () => {
    expect(await probeBroker(url, 4000)).toBe(true);
    expect(await findReachableBroker(1500, ['ws://127.0.0.1:9', url])).toBe(1);
    expect(await findReachableBroker(800, ['ws://127.0.0.1:9'])).toBeNull();
  });

  it('anfitrión, tres participantes y una segunda pantalla: unión, fases, trivia, reconexión y podio', async () => {
    const store = new MemoryHostStore();
    const locks = new MemoryLocks();
    const code = generateRouteCode(0, 1);
    const record = newHostRecord(code, 'sthlocal', 0, { quizQuestions: 2, countdownSeconds: 1, questionSeconds: 6, revealSeconds: 1 }, Date.now(), 'a0000000aaaa');
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
    dropClient('stm');
    await order({ type: 'advance' }, 'resultados tras la caída de los teléfonos', recoveries);
    await order({ type: 'advance' }, 'rumbo a B213');
    dropClient('sth');
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
    const stats = await brokerStats();
    expect(stats.published).toBeGreaterThan(40);
    expect(stats.clients).toBe(5);

    const p95Convergence = percentile(convergence, 0.95);
    const p95Ack = percentile(acks, 0.95);
    console.info(
      `[SLO medido · broker MQTT local, 3 teléfonos + 2 pantallas] unión: ${joinTimes.join('/')} ms · convergencia tras orden o acción: n=${convergence.length} p50=${percentile(convergence, 0.5)} ms p95=${p95Convergence} ms máx=${Math.max(...convergence)} ms · confirmación del stand: n=${acks.length} p50=${percentile(acks, 0.5)} ms p95=${p95Ack} ms · convergencia tras cortar conexiones (teléfonos / stand, incluye reconectar): ${recoveries.join(' / ')} ms`,
    );
    expect(p95Convergence).toBeLessThanOrEqual(500);
    expect(p95Ack).toBeLessThanOrEqual(500);
    recoveries.forEach((ms) => expect(ms).toBeLessThanOrEqual(2000));
  });
});
