import { connectionId, MqttRouteLink, MultiRouteLink } from '@/route/link';
import { MemberController } from '@/route/member';
import { MEMBER_TAB_KEY, storageTabGuard, type TabClaim, type TabGuard, type TabWindow } from '@/route/tabs';
import { addPlayer, advance, createWorld, expectConverged, MemoryMemberStore, reachB215, skewedClock, stopWorld, type World } from './support/routeHarness';

// Multijugador: casos que aparecieron al probar en navegadores reales (scripts/e2e-web.js).
// Dos pantallas o pestañas con la misma ruta, y la recuperación sin depender de sesiones del servidor.

jest.setTimeout(120_000);

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

// Varias "pestañas" del mismo navegador: comparten el almacenamiento y reciben el aviso de cambio.
class FakeBrowser {
  private values = new Map<string, string>();
  private tabs: { listeners: Set<(event: { key: string | null; newValue: string | null }) => void> }[] = [];

  tab(options: { storage?: 'ok' | 'blocked' } = {}): TabWindow {
    const self = { listeners: new Set<(event: { key: string | null; newValue: string | null }) => void>() };
    this.tabs.push(self);
    return {
      localStorage: {
        getItem: (key) => this.values.get(key) ?? null,
        setItem: (key, value) => {
          if (options.storage === 'blocked') throw new Error('almacenamiento bloqueado');
          this.values.set(key, value);
          // El navegador avisa a las demás pestañas, no a la que escribió.
          this.tabs.filter((other) => other !== self).forEach((other) => other.listeners.forEach((listener) => listener({ key, newValue: value })));
        },
      },
      addEventListener: (_type, listener) => self.listeners.add(listener),
      removeEventListener: (_type, listener) => self.listeners.delete(listener),
    };
  }

  clear() {
    this.values.clear();
  }

  get listenerCount(): number {
    return this.tabs.reduce((total, tab) => total + tab.listeners.size, 0);
  }
}

describe('identificador de conexión', () => {
  it('cada enlace tiene el suyo, con el largo que todo servidor MQTT acepta', () => {
    const ids = new Set([connectionId('sth'), connectionId('sth'), new MqttRouteLink(0, ['ws://127.0.0.1:9']).connectionId, new MqttRouteLink(0, ['ws://127.0.0.1:9']).connectionId, new MultiRouteLink(0, ['ws://127.0.0.1:9']).connectionId]);
    expect(ids.size).toBe(5);
    ids.forEach((id) => expect(id).toMatch(/^st[hp][0-9a-f]{20}$/));
    expect(connectionId('pantalla-del-stand')).toHaveLength(23);
  });
});

describe('una sola pestaña juega la ruta', () => {
  it('la última pestaña que toma la ruta manda y la anterior se entera una sola vez', () => {
    const browser = new FakeBrowser();
    const first = storageTabGuard(browser.tab(), 'aaaaaaaaaaaa');
    const second = storageTabGuard(browser.tab(), 'bbbbbbbbbbbb');
    const lost: string[] = [];
    const a = first.claim(() => lost.push('a'));
    expect(a.held()).toBe(true);
    const b = second.claim(() => lost.push('b'));
    expect(lost).toEqual(['a']);
    expect(a.held()).toBe(false);
    expect(b.held()).toBe(true);
    // La primera vuelve a tomarla: ahora cede la segunda.
    const again = first.claim(() => lost.push('a2'));
    expect(lost).toEqual(['a', 'b']);
    expect(again.held()).toBe(true);
    expect(b.held()).toBe(false);
    again.release();
    expect(again.held()).toBe(false);
    expect(browser.listenerCount).toBe(0);
  });

  it('si el aviso del navegador no llega, la pestaña igual nota al revisar que ya no es la que juega', () => {
    const browser = new FakeBrowser();
    const tab = browser.tab();
    const claim = storageTabGuard(tab, 'aaaaaaaaaaaa').claim(() => undefined);
    tab.localStorage.setItem(MEMBER_TAB_KEY, 'otra:pestaña');
    expect(claim.held()).toBe(false);
  });

  it('sin almacenamiento, o tras borrar los datos, la pestaña sigue jugando', () => {
    const browser = new FakeBrowser();
    const blocked = storageTabGuard(browser.tab({ storage: 'blocked' })).claim(() => undefined);
    expect(blocked.held()).toBe(true);
    const normal = storageTabGuard(browser.tab()).claim(() => undefined);
    browser.clear();
    expect(normal.held()).toBe(true);
  });

  it('abrir la ruta en otra pestaña: la nueva sigue jugando, la anterior se desconecta sin tocar lo guardado y puede retomarla', async () => {
    const w = await world();
    const browser = new FakeBrowser();
    const store = new MemoryMemberStore();
    const openTab = (name: string) => {
      const member = new MemberController({ store, clock: skewedClock(0), tabs: storageTabGuard(browser.tab()) });
      const link = w.net.link(name);
      extras.push(() => member.reset());
      return { member, link };
    };
    const first = openTab('Ana');
    await first.member.join({ code: w.code, alias: 'Ana', avatar: 1, fingerprint: w.host.fingerprint, link: first.link });
    await advance(400);
    const beto = await addPlayer(w, 'Beto');
    w.host.dispatch({ type: 'start' });
    await advance(300);
    expect(first.member.getView()).toMatchObject({ status: 'joined', link: 'online' });

    // Ana escanea el QR otra vez: se abre otra pestaña con la misma ruta guardada.
    const second = openTab('Ana-2');
    await second.member.restore(second.link);
    await advance(400);
    expect(first.member.getView().status).toBe('elsewhere');
    expect(first.link.status).toBe('closed');
    expect(second.member.getView()).toMatchObject({ status: 'joined', link: 'online' });
    expect(second.member.getView().snapshot?.phase).toBe('checkin');
    // El stand sigue viendo a una sola Ana.
    expect(w.host.getView().snapshot.players.map((player) => player.alias).sort()).toEqual(['Ana', 'Beto']);

    // La pestaña que cedió no envía ni guarda nada (lo guardado ahora es de la otra).
    const sent = w.net.sent.length;
    first.member.checkin('b215');
    await advance(11_000);
    expect(w.net.sent.slice(sent).filter((packet) => packet.from === 'Ana')).toEqual([]);
    expect(first.member.getView().pending).toEqual([]);
    expect(JSON.stringify(store.record?.outbox ?? [])).not.toContain('b215');

    // La nueva juega normalmente.
    second.member.checkin('b215');
    beto.member.checkin('b215');
    await advance(500);
    expect(w.host.getView().snapshot.phase).toBe('play');
    expect(second.member.getView().snapshot?.phase).toBe('play');
    expect(second.member.getView().pending).toEqual([]);

    // Ana vuelve a la primera pestaña y sigue ahí: se pone al día y la otra cede.
    await first.member.resumeHere(w.net.link('Ana-3'));
    await advance(500);
    expect(first.member.getView()).toMatchObject({ status: 'joined', link: 'online' });
    expect(first.member.getView().snapshot?.phase).toBe('play');
    expect(second.member.getView().status).toBe('elsewhere');
    w.host.dispatch({ type: 'advance' });
    await advance(300);
    expect(first.member.getView().snapshot?.phase).toBe('results');
    expect(second.member.getView().snapshot?.phase).not.toBe('results');

    // Salir desde la pestaña que cedió no borra la ruta de la que sigue jugando.
    await second.member.leave();
    expect(second.member.getView().status).toBe('idle');
    expect(store.record?.code).toBe(w.code);
    expect(first.member.getView().status).toBe('joined');
  });

  it('si la otra pestaña salió de la ruta, retomarla aquí vuelve al inicio en vez de revivirla', async () => {
    const w = await world();
    const browser = new FakeBrowser();
    const store = new MemoryMemberStore();
    const guards: TabGuard[] = [storageTabGuard(browser.tab()), storageTabGuard(browser.tab())];
    const first = new MemberController({ store, clock: skewedClock(0), tabs: guards[0] });
    const second = new MemberController({ store, clock: skewedClock(0), tabs: guards[1] });
    extras.push(() => first.reset(), () => second.reset());
    await first.join({ code: w.code, alias: 'Ana', avatar: 1, fingerprint: w.host.fingerprint, link: w.net.link('Ana') });
    await advance(400);
    await second.restore(w.net.link('Ana-2'));
    await advance(400);
    expect(first.getView().status).toBe('elsewhere');
    const leaving = second.leave();
    await advance(1800);
    await leaving;
    expect(store.record).toBeNull();
    await first.resumeHere(w.net.link('Ana-3'));
    await advance(200);
    expect(first.getView().status).toBe('idle');
    expect(w.host.getView().snapshot.players).toHaveLength(0);
  });

  it('la ruta individual no compite por la pestaña', async () => {
    const browser = new FakeBrowser();
    const lost: string[] = [];
    const guard: TabGuard = {
      claim: (onLost): TabClaim => {
        lost.push('claim');
        return storageTabGuard(browser.tab()).claim(onLost);
      },
    };
    const member = new MemberController({ store: new MemoryMemberStore(), clock: skewedClock(0), tabs: guard });
    extras.push(() => member.reset());
    member.startSolo({ alias: 'Sola', avatar: 1 });
    await advance(600);
    expect(member.getView().status).toBe('joined');
    expect(lost).toEqual([]);
  });
});

describe('recuperación sin sesiones guardadas en el servidor', () => {
  it('si el stand sigue publicando y no muestra una acción enviada, el teléfono la reenvía sin esperar el reintento por tiempo', async () => {
    const w = await world();
    const ana = await addPlayer(w, 'Ana');
    const beto = await addPlayer(w, 'Beto');
    w.host.dispatch({ type: 'start' });
    await advance(300);
    // La llegada de Ana se pierde camino al stand (su conexión parpadeó justo entonces).
    let dropped = 0;
    const stop = w.net.rule((packet, to) => {
      if (packet.kind === 'up' && packet.from === 'Ana' && to === w.hostLink.name && dropped === 0) {
        dropped += 1;
        return { drop: true };
      }
      return undefined;
    });
    ana.member.checkin('b215');
    await advance(1100);
    stop();
    expect(dropped).toBe(1);
    expect(w.host.getView().snapshot.players.find((player) => player.alias === 'Ana')?.checkedIn).toBe(false);
    // Beto llega: el stand publica un estado nuevo donde Ana aún no aparece → Ana reenvía en el acto.
    beto.member.checkin('b215');
    await advance(200);
    expect(w.host.getView().snapshot.phase).toBe('play');
    expect(ana.member.getView().pending).toEqual([]);
    expectConverged(w);
  });

  it('una acción recién enviada no se repite con cada estado que llega', async () => {
    const w = await world();
    const ana = await addPlayer(w, 'Ana');
    const beto = await addPlayer(w, 'Beto');
    const caro = await addPlayer(w, 'Caro');
    w.host.dispatch({ type: 'start' });
    await advance(300);
    // El stand demora en guardar: mientras tanto llegan varios estados (latidos de presencia).
    w.hostStore.delayMs = 600;
    const before = w.net.sent.length;
    ana.member.checkin('b215');
    await advance(20);
    beto.member.checkin('b215');
    await advance(20);
    caro.member.checkin('b215');
    await advance(500);
    const ups = w.net.sent.slice(before).filter((packet) => packet.kind === 'up' && packet.from === 'Ana');
    expect(ups).toHaveLength(1);
    w.hostStore.delayMs = 0;
    await advance(1500);
    expect(w.host.getView().snapshot.phase).toBe('play');
    expectConverged(w);
  });

  it('un reintento que llega mientras la respuesta aún se guarda no se confirma antes de guardar', async () => {
    const w = await world();
    const ana = await addPlayer(w, 'Ana');
    await addPlayer(w, 'Beto');
    w.host.dispatch({ type: 'start' });
    await advance(300);
    w.hostStore.delayMs = 900;
    const saves = w.hostStore.saves;
    const before = w.net.sent.length;
    ana.member.checkin('b215');
    await advance(100);
    // La conexión de Ana parpadea: al volver reenvía lo pendiente (mismo evento, envío nuevo).
    ana.link.setConnected(false);
    await advance(20);
    ana.link.setConnected(true);
    await advance(200);
    const sentByAna = w.net.sent.slice(before).filter((packet) => packet.kind === 'up' && packet.from === 'Ana');
    expect(sentByAna.length).toBeGreaterThanOrEqual(2);
    // Nada guardado todavía: ninguna confirmación puede haber salido.
    expect(w.hostStore.saves).toBe(saves);
    expect(w.net.sent.slice(before).filter((packet) => packet.kind === 'dm')).toEqual([]);
    expect(ana.member.getView().outbox['checkin:b215']?.state).not.toBe('accepted');
    await advance(2500);
    expect(w.hostStore.saves).toBeGreaterThan(saves);
    expect(ana.member.getView().pending).toEqual([]);
    expect(w.host.getView().snapshot.players.find((player) => player.alias === 'Ana')?.checkedIn).toBe(true);
    w.hostStore.delayMs = 0;
  });

  it('con un tercio de los mensajes perdidos en ambos sentidos el grupo igual converge en segundos', async () => {
    const w = await world();
    await addPlayer(w, 'Ana');
    await addPlayer(w, 'Beto');
    await addPlayer(w, 'Caro');
    // Se pierde uno de cada tres mensajes de los teléfonos al stand y una de cada tres confirmaciones.
    let count = 0;
    w.net.rule((packet) => {
      if (packet.kind !== 'up' && packet.kind !== 'dm') return undefined;
      count += 1;
      return count % 3 === 0 ? { drop: true } : undefined;
    });
    await reachB215(w);
    // Peor caso: el mismo envío se pierde dos veces seguidas; el siguiente latido del stand lo destraba.
    await advance(10_000);
    expect(w.host.getView().snapshot.phase).toBe('play');
    expectConverged(w);
    w.players.forEach((player) => expect(player.member.getView().pending).toEqual([]));
  });
});
