// Cuenta en el dispositivo: sesiones, reintentos y guardado seguro (BE-04, 05, 06, 09, 15, 16, 18 y 20).
// El servidor es un `fetch` simulado que permite retener, perder y ordenar las respuestas.

type Store = typeof import('@/account/store');
type Vault = typeof import('@/security/vault');
type Storage = typeof import('@react-native-async-storage/async-storage').default;

const mockKeychain = { available: true, failing: false, values: new Map<string, string>() };

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
  isAvailableAsync: async () => mockKeychain.available,
  getItemAsync: async (key: string) => {
    if (mockKeychain.failing) throw new Error('llavero bloqueado');
    return mockKeychain.values.get(key) ?? null;
  },
  setItemAsync: async (key: string, value: string) => {
    if (mockKeychain.failing) throw new Error('llavero bloqueado');
    mockKeychain.values.set(key, value);
  },
  getItem: () => null,
  setItem: () => undefined,
}));

interface Call {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
  token: string | null;
}

type Reply = { status?: number; json?: unknown; hang?: boolean } | Promise<{ status?: number; json?: unknown }> | 'offline';

const calls: Call[] = [];
let routes: { match: (call: Call) => boolean; reply: (call: Call) => Reply }[] = [];

function on(method: string, path: string, reply: (call: Call) => Reply) {
  routes.unshift({ match: (call) => call.method === method && call.path.startsWith(path), reply });
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const player = (overrides: Record<string, unknown> = {}) => ({
  id: 'jugador-1',
  alias: 'Ana',
  avatar: 1,
  grade: null,
  school: null,
  contact: null,
  contactConsent: false,
  guardianConsent: false,
  xp: 0,
  level: 1,
  games: 0,
  streak: 0,
  bestRoute: 0,
  routes: 0,
  achievements: [],
  hidden: false,
  createdAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
});

function installFetch() {
  (globalThis as { fetch?: unknown }).fetch = jest.fn(async (url: string, init: { method?: string; body?: string; headers?: Record<string, string>; signal?: AbortSignal } = {}) => {
    const call: Call = {
      method: init.method ?? 'GET',
      path: String(url).replace(/^.*\/api\/v1/, ''),
      body: init.body ? (JSON.parse(init.body) as Record<string, unknown>) : null,
      token: init.headers?.Authorization?.replace('Bearer ', '') ?? null,
    };
    calls.push(call);
    const route = routes.find((item) => item.match(call));
    const reply = route ? route.reply(call) : { status: 404, json: { error: { code: 'not_found', message: 'sin ruta' } } };
    if (reply === 'offline') throw new Error('sin red');
    const settled = await reply;
    if ((settled as { hang?: boolean }).hang) {
      // Cabeceras recibidas, cuerpo que nunca termina de llegar.
      return { ok: true, status: 200, json: () => new Promise(() => undefined) };
    }
    const status = settled.status ?? 200;
    return { ok: status >= 200 && status < 300, status, json: async () => settled.json };
  });
}

let store: Store;
let vault: Vault;
let storage: Storage;

// La cuenta tal como la tiene el servidor simulado.
const server = { account: player() };

function patchAccount(call: Call) {
  server.account = { ...server.account, ...(call.body ?? {}) };
  return { json: { player: server.account, rank: { rank: 1, total: 1 } } };
}

function load() {
  store = require('@/account/store') as Store;
  vault = require('@/security/vault') as Vault;
  const asyncStorage = require('@react-native-async-storage/async-storage') as Storage & { default?: Storage };
  storage = asyncStorage.default ?? asyncStorage;
  // React Native instala su propio `fetch` al cargarse: el simulado va después.
  installFetch();
}

// Cierra y vuelve a abrir la app: el estado en memoria se pierde, lo guardado en el teléfono queda.
async function restart() {
  const keys = await storage.getAllKeys();
  const saved = await storage.multiGet(keys);
  jest.resetModules();
  load();
  await storage.multiSet(saved.filter((entry): entry is [string, string] => entry[1] !== null));
}

const flush = async (times = 12) => {
  for (let index = 0; index < times; index += 1) await Promise.resolve();
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.resetModules();
  mockKeychain.available = true;
  mockKeychain.failing = false;
  mockKeychain.values.clear();
  calls.length = 0;
  routes = [];
  load();
  // Un servidor sano, con memoria: lo que se edita o sincroniza queda en la cuenta.
  server.account = player();
  on('POST', '/players', (call) => {
    server.account = player({ alias: (call.body?.profile as { alias: string }).alias, avatar: (call.body?.profile as { avatar?: number }).avatar ?? 0 });
    return { status: 201, json: { ...(call.body?.credentials as object), player: server.account, rank: { rank: 1, total: 1 } } };
  });
  on('GET', '/me', () => ({ json: { player: server.account, rank: { rank: 1, total: 1 } } }));
  on('PATCH', '/me', patchAccount);
  on('POST', '/sync', (call) => {
    server.account = { ...server.account, xp: (call.body?.progress as { xp: number }).xp };
    return { json: { player: server.account, rank: { rank: 1, total: 1 }, clamped: false } };
  });
  on('POST', '/recover', (call) => {
    server.account = player({ alias: 'Recuperada', xp: 900 });
    return { json: { token: call.body?.token, player: server.account, rank: { rank: 2, total: 5 } } };
  });
  on('POST', '/recovery', () => ({ json: { rotated: true } }));
  on('DELETE', '/me', () => ({ json: { deleted: true } }));
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

async function signedIn(alias = 'Ana') {
  await store.initAccount();
  await store.createAccount({ alias, avatar: 1 });
  calls.length = 0;
}

describe('BE-06 · crear la cuenta', () => {
  it('genera las credenciales en el teléfono y las guarda antes de enviarlas', async () => {
    await store.initAccount();
    let savedBeforeSending = false;
    on('POST', '/players', (call) => {
      savedBeforeSending = mockKeychain.values.size > 0;
      return { status: 201, json: { ...(call.body?.credentials as object), player: player(), rank: null } };
    });
    const pendingBefore = await storage.getItem('@soytel/account-signup');
    expect(pendingBefore).toBeNull();
    const code = await store.createAccount({ alias: 'Ana', avatar: 1 });
    const sent = calls.find((call) => call.path === '/players')!.body!.credentials as { token: string; recoveryCode: string };
    expect(sent.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(sent.recoveryCode).toBe(code);
    expect(savedBeforeSending).toBe(true);
    expect(store.getAccount()).toMatchObject({ status: 'registered', recoveryCode: code });
    // El ranking es accesorio: que falte no impide tener la cuenta.
    expect(store.getAccount().rank).toBeNull();
    // Ya confirmada, no queda un alta pendiente; y lo guardado va cifrado.
    expect(await storage.getItem('@soytel/account-signup')).toBeNull();
    expect(await storage.getItem('@soytel/account')).not.toContain(sent.token);
  });

  it('si la respuesta se pierde, reintentar envía las mismas credenciales', async () => {
    await store.initAccount();
    on('POST', '/players', () => 'offline');
    await expect(store.createAccount({ alias: 'Ana', avatar: 1 })).rejects.toMatchObject({ offline: true });
    expect(store.getAccount().status).toBe('guest');
    const first = calls[0].body!.credentials;
    on('POST', '/players', (call) => ({ status: 200, json: { ...(call.body?.credentials as object), player: player(), rank: null } }));
    const code = await store.createAccount({ alias: 'Ana', avatar: 1 });
    expect(calls[1].body!.credentials).toEqual(first);
    expect((first as { recoveryCode: string }).recoveryCode).toBe(code);
    expect(store.getAccount().status).toBe('registered');
  });

  it('si la app se cerró con el alta a medias y el servidor sí la creó, al abrir se recupera esa cuenta', async () => {
    await store.initAccount();
    on('POST', '/players', () => 'offline');
    await expect(store.createAccount({ alias: 'Ana', avatar: 1 })).rejects.toBeTruthy();
    const sent = calls[0].body!.credentials as { token: string; recoveryCode: string };
    await restart();
    calls.length = 0;
    await store.initAccount();
    await flush(40);
    expect(calls.map((call) => `${call.method} ${call.path}`)).toContain('GET /me');
    expect(calls.find((call) => call.path === '/me')!.token).toBe(sent.token);
    expect(store.getAccount()).toMatchObject({ status: 'registered', recoveryCode: sent.recoveryCode });
    // Nunca crea una cuenta por su cuenta: solo pregunta si existe.
    expect(calls.some((call) => call.method === 'POST' && call.path === '/players')).toBe(false);
  });

  it('si el servidor nunca la creó, el intento se olvida y el usuario sigue como invitado', async () => {
    await store.initAccount();
    on('POST', '/players', () => 'offline');
    await expect(store.createAccount({ alias: 'Ana', avatar: 1 })).rejects.toBeTruthy();
    await restart();
    on('GET', '/me', () => ({ status: 401, json: { error: { code: 'session_expired', message: 'no' } } }));
    await store.initAccount();
    await flush(40);
    expect(store.getAccount().status).toBe('guest');
    expect(await storage.getItem('@soytel/account-signup')).toBeNull();
  });

  it('dos toques seguidos en "Crear cuenta" son una sola solicitud', async () => {
    await store.initAccount();
    const [first, second] = await Promise.all([store.createAccount({ alias: 'Ana', avatar: 1 }), store.createAccount({ alias: 'Ana', avatar: 1 })]);
    expect(first).toBe(second);
    expect(calls.filter((call) => call.path === '/players')).toHaveLength(1);
  });
});

describe('BE-05 · guardado seguro', () => {
  it('sin un lugar seguro donde guardarla no se crea la cuenta (ni se llama al servidor)', async () => {
    mockKeychain.available = false;
    await store.initAccount();
    await expect(store.createAccount({ alias: 'Ana', avatar: 1 })).rejects.toBeInstanceOf(store.AccountStorageError);
    await expect(store.restoreAccount('TEL-ABCD-EFGH-JKMN')).rejects.toBeInstanceOf(store.AccountStorageError);
    expect(calls).toEqual([]);
    expect(store.getAccount().status).toBe('guest');
  });

  it('con la llave de sesión no se pisa lo cifrado con el llavero, y vuelve a leerse cuando el llavero responde', async () => {
    await signedIn();
    const sealed = await storage.getItem('@soytel/account');
    expect(vault.isSealed(sealed)).toBe(true);
    // Al reabrir, el llavero no responde (por ejemplo, el teléfono aún bloqueado tras reiniciar).
    await restart();
    mockKeychain.failing = true;
    expect(await vault.vaultKind()).toBe('memory');
    expect(await vault.vaultGet('@soytel/account')).toBeNull();
    await expect(vault.vaultSet('@soytel/account', { otra: 'cosa' })).rejects.toBeInstanceOf(vault.VaultUnavailableError);
    expect(await storage.getItem('@soytel/account')).toBe(sealed);
    // Lo escrito con la llave de sesión sí se puede leer y reemplazar mientras dure la sesión.
    await vault.vaultSet('@soytel/route/member', { code: 'ABC234' });
    await vault.vaultSet('@soytel/route/member', { code: 'XYZ789' });
    expect(await vault.vaultGet('@soytel/route/member')).toEqual({ code: 'XYZ789' });
    // El llavero vuelve: tras la espera, lo guardado se lee de nuevo.
    mockKeychain.failing = false;
    jest.advanceTimersByTime(16_000);
    expect(await vault.vaultKind()).toBe('secure-store');
    expect(await vault.vaultGet<{ token: string }>('@soytel/account')).toHaveProperty('token');
  });

  it('una cuenta que no se pudo leer al abrir se retoma sola cuando el llavero responde', async () => {
    await signedIn();
    await restart();
    mockKeychain.failing = true;
    await store.initAccount();
    expect(store.getAccount().status).toBe('guest');
    mockKeychain.failing = false;
    await jest.advanceTimersByTimeAsync(17_000);
    await flush(40);
    expect(store.getAccount().status).toBe('registered');
  });
});

describe('BE-04 · respuestas que llegan tarde', () => {
  it('una respuesta que llega después de cerrar sesión no revive la cuenta', async () => {
    await signedIn();
    const late = deferred<{ json: unknown }>();
    on('GET', '/me', () => late.promise);
    const refreshing = store.refreshAccount();
    await flush();
    await store.forgetAccount();
    late.resolve({ json: { player: player({ alias: 'Fantasma' }), rank: { rank: 1, total: 1 } } });
    await refreshing;
    expect(store.getAccount()).toMatchObject({ status: 'guest', player: null });
    expect(await storage.getItem('@soytel/account')).toBeNull();
    // Y sigue como invitado después de reabrir la app.
    await restart();
    await store.initAccount();
    expect(store.getAccount().status).toBe('guest');
  });

  it('una respuesta de la cuenta anterior no reemplaza los datos ni el token de la nueva', async () => {
    await signedIn('Ana');
    const tokenA = store.getAccountToken();
    const late = deferred<{ json: unknown }>();
    on('PATCH', '/me', () => late.promise);
    const editing = store.editAccount({ alias: 'Ana editada' });
    await flush();
    // Mientras tanto, este teléfono pasa a la cuenta B.
    await store.forgetAccount();
    on('POST', '/recover', (call) => ({ json: { token: call.body?.token, player: player({ id: 'jugador-b', alias: 'Beto' }), rank: null } }));
    await store.restoreAccount('TEL-ABCD-EFGH-JKMN');
    const tokenB = store.getAccountToken();
    late.resolve({ json: { player: player({ alias: 'Ana editada' }), rank: null } });
    await editing;
    expect(tokenB).not.toBe(tokenA);
    expect(store.getAccountToken()).toBe(tokenB);
    expect(store.getAccount().player).toMatchObject({ id: 'jugador-b', alias: 'Beto' });
  });

  it('un 401 tardío de la cuenta anterior no vence la sesión nueva', async () => {
    await signedIn('Ana');
    const late = deferred<{ status: number; json: unknown }>();
    on('POST', '/sync', () => late.promise);
    const syncing = store.syncNow();
    await flush(30);
    await store.forgetAccount();
    on('POST', '/recover', (call) => ({ json: { token: call.body?.token, player: player({ id: 'jugador-b', alias: 'Beto' }), rank: null } }));
    await store.restoreAccount('TEL-ABCD-EFGH-JKMN');
    late.resolve({ status: 401, json: { error: { code: 'session_expired', message: 'vencida' } } });
    await syncing;
    expect(store.getAccount()).toMatchObject({ status: 'registered', player: { alias: 'Beto' } });
  });

  it('borrar los datos del teléfono con una escritura en curso deja el teléfono sin cuenta', async () => {
    await signedIn();
    const late = deferred<{ json: unknown }>();
    on('PATCH', '/me', () => late.promise);
    const editing = store.editAccount({ alias: 'Nueva' });
    await flush();
    const reset = store.resetAccountLocal();
    late.resolve({ json: { player: player({ alias: 'Nueva' }), rank: null } });
    await Promise.all([editing, reset]);
    await flush(30);
    expect(await storage.getItem('@soytel/account')).toBeNull();
    await restart();
    await store.initAccount();
    expect(store.getAccount().status).toBe('guest');
  });
});

describe('BE-09 · sincronización', () => {
  it('lo que cambia mientras se sincroniza se envía al terminar, sin esperar otro evento', async () => {
    await signedIn();
    const profile = require('@/storage/profile') as typeof import('@/storage/profile');
    const first = deferred<{ json: unknown }>();
    let syncs = 0;
    on('POST', '/sync', (call) => {
      syncs += 1;
      return syncs === 1 ? first.promise : { json: { player: player({ xp: (call.body?.progress as { xp: number }).xp }), rank: null, clamped: false } };
    });
    const running = store.syncNow();
    await flush(30);
    // Una partida termina mientras la primera sincronización sigue en camino.
    await profile.recordGameResult({ id: 'r-1', gameId: 'burst', score: 800, accuracy: 1, durationSeconds: 30, completedAt: new Date().toISOString() });
    first.resolve({ json: { player: player({ xp: 0 }), rank: null, clamped: false } });
    await running;
    expect(syncs).toBe(1);
    await jest.advanceTimersByTimeAsync(3000);
    await flush(40);
    expect(syncs).toBe(2);
    const sent = calls.filter((call) => call.path === '/sync').map((call) => (call.body!.progress as { xp: number }).xp);
    expect(sent[1]).toBeGreaterThan(sent[0]);
  });

  it('sin conexión reintenta solo, cada vez más espaciado, y al volver la red sube lo pendiente', async () => {
    await signedIn();
    let online = false;
    on('POST', '/sync', () => (online ? { json: { player: player({ xp: 5 }), rank: null, clamped: false } } : 'offline'));
    await store.syncNow();
    expect(store.getAccount().syncError).toBeTruthy();
    const attempts = () => calls.filter((call) => call.path === '/sync').length;
    expect(attempts()).toBe(1);
    await jest.advanceTimersByTimeAsync(5200);
    await flush(30);
    expect(attempts()).toBe(2);
    // El segundo reintento espera más que el primero.
    await jest.advanceTimersByTimeAsync(6000);
    await flush(30);
    expect(attempts()).toBe(2);
    online = true;
    await jest.advanceTimersByTimeAsync(10_000);
    await flush(30);
    expect(attempts()).toBe(3);
    expect(store.getAccount()).toMatchObject({ syncError: null, player: { xp: 5 } });
  });

  it('una sesión vencida no se reintenta en bucle', async () => {
    await signedIn();
    on('POST', '/sync', () => ({ status: 401, json: { error: { code: 'session_expired', message: 'vencida' } } }));
    await store.syncNow();
    expect(store.getAccount().status).toBe('expired');
    await jest.advanceTimersByTimeAsync(600_000);
    await flush(30);
    expect(calls.filter((call) => call.path === '/sync')).toHaveLength(1);
  });

  it('con demasiadas solicitudes espera más de un minuto antes de volver a intentar', async () => {
    await signedIn();
    on('POST', '/sync', () => ({ status: 429, json: { error: { code: 'rate_limited', message: 'espera' } } }));
    await store.syncNow();
    await jest.advanceTimersByTimeAsync(60_000);
    await flush(30);
    expect(calls.filter((call) => call.path === '/sync')).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(6000);
    await flush(30);
    expect(calls.filter((call) => call.path === '/sync')).toHaveLength(2);
  });
});

describe('BE-15 · recuperar la cuenta', () => {
  it('un doble Enter es una sola recuperación', async () => {
    await store.initAccount();
    const [first, second] = await Promise.all([store.restoreAccount('TEL-ABCD-EFGH-JKMN'), store.restoreAccount('tel-abcd-efgh-jkmn')]);
    expect(first).toBe(second);
    expect(calls.filter((call) => call.path === '/recover')).toHaveLength(1);
    expect(store.getAccount()).toMatchObject({ status: 'registered', recoveryCode: 'TEL-ABCD-EFGH-JKMN' });
  });

  it('el token lo elige el teléfono y un reintento usa el mismo', async () => {
    await store.initAccount();
    on('POST', '/recover', () => 'offline');
    await expect(store.restoreAccount('TEL-ABCD-EFGH-JKMN')).rejects.toMatchObject({ offline: true });
    on('POST', '/recover', (call) => ({ json: { token: call.body?.token, player: player(), rank: null } }));
    await store.restoreAccount('TEL-ABCD-EFGH-JKMN');
    const tokens = calls.filter((call) => call.path === '/recover').map((call) => call.body!.token);
    expect(tokens[0]).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokens[1]).toBe(tokens[0]);
    expect(store.getAccountToken()).toBe(tokens[0]);
  });

  it('la respuesta atrasada de un intento anterior no reemplaza al intento nuevo', async () => {
    await store.initAccount();
    const slow = deferred<{ json: unknown }>();
    on('POST', '/recover', (call) => (call.body?.code === 'TEL-AAAA-AAAA-AAAA' ? slow.promise : { json: { token: call.body?.token, player: player({ alias: 'Correcta' }), rank: null } }));
    const first = store.restoreAccount('TEL-AAAA-AAAA-AAAA');
    await flush(30);
    await store.restoreAccount('TEL-BBBB-BBBB-BBBB');
    const tokenNow = store.getAccountToken();
    slow.resolve({ json: { token: 'token-del-intento-viejo-que-ya-no-vale-0000000', player: player({ alias: 'Equivocada' }), rank: null } });
    await expect(first).rejects.toMatchObject({ code: 'stale' });
    expect(store.getAccountToken()).toBe(tokenNow);
    expect(store.getAccount().player).toMatchObject({ alias: 'Correcta' });
  });
});

describe('BE-16 · cambiar el código de recuperación', () => {
  it('genera un código nuevo, lo confirma con el servidor y recién entonces lo muestra como vigente', async () => {
    await signedIn();
    const before = store.getAccount().recoveryCode;
    const next = await store.regenerateRecoveryCode();
    expect(next).not.toBe(before);
    expect(next).toMatch(/^TEL-[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{4}$/);
    expect(calls.find((call) => call.path === '/recovery')!.body).toEqual({ code: next });
    expect(store.getAccount().recoveryCode).toBe(next);
  });

  it('si no se sabe si llegó, el código vigente no cambia y el reintento usa el mismo código nuevo', async () => {
    await signedIn();
    const before = store.getAccount().recoveryCode;
    on('POST', '/recovery', () => 'offline');
    await expect(store.regenerateRecoveryCode()).rejects.toMatchObject({ offline: true });
    expect(store.getAccount().recoveryCode).toBe(before);
    on('POST', '/recovery', () => ({ json: { rotated: true } }));
    const next = await store.regenerateRecoveryCode();
    const sent = calls.filter((call) => call.path === '/recovery').map((call) => call.body!.code);
    expect(sent[0]).toBe(sent[1]);
    expect(next).toBe(sent[0]);
  });
});

describe('BE-18 · alias cambiado sin conexión', () => {
  it('el alias más nuevo prevalece aunque llegue antes la respuesta de uno anterior', async () => {
    await signedIn();
    const profile = require('@/storage/profile') as typeof import('@/storage/profile');
    const slow = deferred<{ json: unknown }>();
    let patches = 0;
    on('PATCH', '/me', (call) => {
      patches += 1;
      if (patches === 1) return slow.promise;
      if (patches === 2) return 'offline';
      return patchAccount(call);
    });
    // A queda en camino; B se escribe sin conexión.
    const first = store.setIdentity({ alias: 'Alias A' });
    await flush(30);
    await store.setIdentity({ alias: 'Alias B' });
    slow.resolve({ json: { player: player({ alias: 'Alias A' }), rank: null } });
    await first;
    // La respuesta de A no borra lo pendiente ni pisa el alias local.
    expect((await profile.loadProfile()).alias).toBe('Alias B');
    // Vuelve la red: se envía B.
    await jest.advanceTimersByTimeAsync(6000);
    await flush(60);
    const sent = calls.filter((call) => call.method === 'PATCH').map((call) => call.body!.alias);
    expect(sent[sent.length - 1]).toBe('Alias B');
    expect(store.getAccount().player).toMatchObject({ alias: 'Alias B' });
    expect((await profile.loadProfile()).alias).toBe('Alias B');
  });

  it('alias y avatar cambiados a la vez sin conexión llegan juntos al volver la red', async () => {
    await signedIn();
    let online = false;
    on('PATCH', '/me', (call) => (online ? patchAccount(call) : 'offline'));
    await store.setIdentity({ alias: 'Sin red' });
    await store.setIdentity({ avatar: 4 });
    online = true;
    await jest.advanceTimersByTimeAsync(6000);
    await flush(60);
    const last = calls.filter((call) => call.method === 'PATCH').pop()!.body;
    expect(last).toMatchObject({ alias: 'Sin red', avatar: 4 });
    expect(store.getAccount().player).toMatchObject({ alias: 'Sin red', avatar: 4 });
  });
});

describe('BE-20 · plazo de las solicitudes', () => {
  it('un servidor que envía las cabeceras y no termina el cuerpo también vence', async () => {
    await signedIn();
    on('POST', '/sync', () => ({ hang: true }));
    const running = store.syncNow();
    await flush(30);
    expect(store.getAccount().syncing).toBe(true);
    await jest.advanceTimersByTimeAsync(12_100);
    await running;
    expect(store.getAccount()).toMatchObject({ syncing: false });
    expect(store.getAccount().syncError).toBeTruthy();
  });

  it('una respuesta normal no deja temporizadores pendientes', async () => {
    await signedIn();
    const before = jest.getTimerCount();
    await store.refreshAccount();
    expect(jest.getTimerCount()).toBe(before);
  });
});
