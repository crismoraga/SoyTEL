import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { KeyPair } from '@/realtime/crypto';
import { randomHex } from '@/realtime/crypto';
import { vaultEntry, vaultGet, vaultSet } from '@/security/vault';
import { compareAuthority, type AckItem, type Stamp } from './protocol';
import type { PlayerAction, RouteState } from './types';

// Persistencia de la ruta. Todo lo que contiene llaves va cifrado (security/vault);
// el índice de rutas del stand solo guarda datos visibles (código, fase, participantes).

export const ROUTE_STORAGE_PREFIX = '@soytel/route/';
// Versión del formato guardado. Lo de versiones anteriores no se puede retomar (otro protocolo).
export const ROUTE_RECORD_VERSION = 3;
const MEMBER_KEY = `${ROUTE_STORAGE_PREFIX}member`;
const HOST_INDEX_KEY = `${ROUTE_STORAGE_PREFIX}hosts`;
const RECORDED_KEY = `${ROUTE_STORAGE_PREFIX}recorded`;
const hostKey = (code: string) => `${ROUTE_STORAGE_PREFIX}host/${code}`;
const leaseKey = (code: string) => `${ROUTE_STORAGE_PREFIX}lease/${code}`;
const fenceKey = (code: string) => `${ROUTE_STORAGE_PREFIX}fence/${code}`;

// Estado de una acción del participante: en cola (sin conexión), enviada (el broker la tiene),
// aceptada (el stand la guardó), rechazada (con motivo) o vencida (la fase ya pasó).
export type OutboxState = 'queued' | 'sent' | 'accepted' | 'rejected' | 'expired';

export interface OutboxRecord {
  key: string;
  eventId: string;
  action: PlayerAction;
  since: number;
  state: OutboxState;
  reason?: string;
}

export interface MemberCredentials {
  v: typeof ROUTE_RECORD_VERSION;
  code: string;
  clientId: string;
  boxKeys: KeyPair;
  alias: string;
  avatar: number;
  fingerprint: string | null;
  brokerIndex: number;
  hostBox: string | null;
  hostSign: string | null;
  sessionKey: string | null;
  keyId: number | null;
  joinedAt: number;
  solo: boolean;
  // Contador de envíos ya reservado: tras reiniciar la app se continúa por encima de él.
  seq: number;
  // Acciones que el stand aún no confirma (sobreviven a cerrar la app).
  outbox: OutboxRecord[];
  // Último estado aceptado: tras reiniciar no se aceptan publicaciones anteriores a él.
  mark: Stamp | null;
}

export interface HostRecord {
  v: typeof ROUTE_RECORD_VERSION;
  code: string;
  brokerIndex: number;
  boxKeys: KeyPair;
  signKeys: KeyPair;
  sessionKey: string;
  // Número de la llave de sesión vigente (sube cada vez que se quita a un participante).
  keyId: number;
  // Época de conducción y la instancia que la tomó: quien guarda con una época menor ya no conduce.
  epoch: number;
  owner: string;
  state: RouteState;
  seqs: Record<string, number>;
  // Respuestas ya dadas a cada acción (por participante e id de evento): un reintento recibe la misma.
  verdicts: Record<string, Record<string, AckItem>>;
  savedAt: number;
}

export interface HostSummary {
  code: string;
  phase: RouteState['phase'];
  stop: RouteState['stop'];
  players: number;
  savedAt: number;
  // Guardada por una versión anterior de la app: se puede borrar, no retomar.
  legacy?: boolean;
}

// Otra pestaña o proceso tomó la conducción con una época mayor: esta ya no puede guardar.
export class FencedError extends Error {
  constructor() {
    super('route-fenced');
    this.name = 'FencedError';
  }
}

export interface HostStore {
  load(code: string): Promise<HostRecord | null>;
  save(record: HostRecord): Promise<void>;
  remove(code: string): Promise<void>;
}

export interface MemberStore {
  load(): Promise<MemberCredentials | null>;
  save(credentials: MemberCredentials): Promise<void>;
  clear(): Promise<void>;
}

async function readPlain<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

// Las escrituras del stand se hacen de a una: el índice y la marca de época se leen y reescriben,
// y dos guardados cruzados podrían perder una ruta del índice.
let hostWrites: Promise<unknown> = Promise.resolve();

function serialHostWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = hostWrites.then(task, task);
  hostWrites = run.catch(() => undefined);
  return run;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function loadMember(): Promise<MemberCredentials | null> {
  const saved = await vaultGet<MemberCredentials>(MEMBER_KEY);
  if (!isObject(saved) || saved.v !== ROUTE_RECORD_VERSION || typeof saved.code !== 'string' || typeof saved.clientId !== 'string') return null;
  return { ...saved, outbox: Array.isArray(saved.outbox) ? saved.outbox : [], seq: Number.isSafeInteger(saved.seq) ? saved.seq : 0, mark: saved.mark ?? null };
}

export async function saveMember(credentials: MemberCredentials): Promise<void> {
  await vaultSet(MEMBER_KEY, credentials);
}

export async function clearMember(): Promise<void> {
  await AsyncStorage.removeItem(MEMBER_KEY);
}

export const deviceMemberStore: MemberStore = { load: loadMember, save: saveMember, clear: clearMember };

function summaryOf(record: HostRecord): HostSummary {
  return {
    code: record.code,
    phase: record.state.phase,
    stop: record.state.stop,
    players: record.state.order.filter((id) => !record.state.players[id]?.kicked).length,
    savedAt: record.savedAt,
  };
}

function isSummary(item: unknown): item is HostSummary {
  return isObject(item) && typeof item.code === 'string' && typeof item.phase === 'string';
}

// El índice más antiguo era una lista de códigos; se completa leyendo cada ruta guardada.
export async function listHostSummaries(): Promise<HostSummary[]> {
  const raw = await readPlain<unknown[]>(HOST_INDEX_KEY);
  if (!Array.isArray(raw)) return [];
  const items = await Promise.all(
    raw.map(async (item): Promise<HostSummary | null> => {
      if (isSummary(item)) return item;
      if (typeof item !== 'string') return null;
      const record = await loadHost(item);
      return record ? summaryOf(record) : { code: item, phase: 'podium', stop: 'hall', players: 0, savedAt: 0, legacy: true };
    }),
  );
  const summaries = items.filter((item): item is HostSummary => Boolean(item));
  // Marca las que no se pueden abrir con esta versión.
  return Promise.all(summaries.map(async (item) => (item.legacy || (await loadHost(item.code)) ? item : { ...item, legacy: true })));
}

export async function listHostCodes(): Promise<string[]> {
  return (await listHostSummaries()).map((item) => item.code);
}

export async function loadHost(code: string): Promise<HostRecord | null> {
  const record = await vaultGet<HostRecord>(hostKey(code));
  if (!isObject(record) || record.v !== ROUTE_RECORD_VERSION || record.code !== code || !isObject(record.state)) return null;
  return { ...record, seqs: isObject(record.seqs) ? record.seqs : {}, verdicts: isObject(record.verdicts) ? record.verdicts : {} };
}

export function saveHost(record: HostRecord): Promise<void> {
  return serialHostWrite(async () => {
    const fence = await readPlain<{ epoch: number; owner: string }>(fenceKey(record.code));
    if (isObject(fence) && typeof fence.epoch === 'number' && typeof fence.owner === 'string' && compareAuthority(fence, record) > 0) throw new FencedError();
    const raw = await readPlain<unknown[]>(HOST_INDEX_KEY);
    const summaries = Array.isArray(raw) ? raw.filter(isSummary) : [];
    const next = [summaryOf(record), ...summaries.filter((item) => item.code !== record.code)].slice(0, 12);
    await AsyncStorage.multiSet([
      await vaultEntry(hostKey(record.code), record),
      [HOST_INDEX_KEY, JSON.stringify(next)],
      [fenceKey(record.code), JSON.stringify({ epoch: record.epoch, owner: record.owner })],
    ]);
  });
}

export function removeHost(code: string): Promise<void> {
  return serialHostWrite(async () => {
    const raw = await readPlain<unknown[]>(HOST_INDEX_KEY);
    const rest = Array.isArray(raw) ? raw.filter((item) => (isSummary(item) ? item.code !== code : item !== code)) : [];
    await AsyncStorage.multiRemove([hostKey(code), leaseKey(code), fenceKey(code)]);
    await AsyncStorage.setItem(HOST_INDEX_KEY, JSON.stringify(rest));
  });
}

export const deviceHostStore: HostStore = { load: loadHost, save: saveHost, remove: removeHost };

// ——— Una sola pestaña/dispositivo conduce cada ruta ———

export interface HostLock {
  release(): void;
}

export interface HostLockProvider {
  acquire(code: string, owner: string, options?: { steal?: boolean; onLost?: () => void }): Promise<HostLock | null>;
}

interface LockManagerLike {
  request(name: string, options: { ifAvailable?: boolean; steal?: boolean }, callback: (lock: unknown) => Promise<void>): Promise<void>;
}

function webLocks(): LockManagerLike | null {
  if (Platform.OS !== 'web') return null;
  const locks = (globalThis as { navigator?: { locks?: LockManagerLike } }).navigator?.locks;
  return locks && typeof locks.request === 'function' ? locks : null;
}

const LEASE_STALE_MS = 16_000;
const LEASE_MS = 5000;
const LEASE_SETTLE_MS = 180;

interface Lease {
  owner: string;
  at: number;
  // Distingue dos intentos de la misma pestaña y permite comprobar quién escribió último.
  claim: string;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Concesión renovada en el almacenamiento local, para navegadores sin Web Locks. No hay comparar-y-
// escribir, así que tras escribir se espera un momento y se vuelve a leer: de dos pestañas que
// escriben a la vez solo sigue la que quedó guardada. Lo que esto no cubre lo cubre la época de
// conducción (quien queda atrás no puede guardar y los teléfonos ignoran lo que publique).
export async function acquireLease(code: string, owner: string, options: { steal?: boolean; onLost?: () => void } = {}): Promise<HostLock | null> {
  const key = leaseKey(code);
  const current = await readPlain<Lease>(key);
  if (!options.steal && current && current.owner !== owner && Date.now() - current.at < LEASE_STALE_MS) return null;
  const claim = randomHex(6);
  const write = () => AsyncStorage.setItem(key, JSON.stringify({ owner, at: Date.now(), claim } satisfies Lease));
  await write();
  await wait(LEASE_SETTLE_MS + Math.floor(Math.random() * 120));
  const settled = await readPlain<Lease>(key);
  if (!settled || settled.claim !== claim) return null;

  let released = false;
  const timer = setInterval(() => {
    void readPlain<Lease>(key).then((lease) => {
      if (released) return;
      if (lease && lease.claim !== claim) {
        released = true;
        clearInterval(timer);
        options.onLost?.();
        return;
      }
      void write();
    });
  }, LEASE_MS);
  return {
    release: () => {
      if (released) return;
      released = true;
      clearInterval(timer);
      // Solo borra la concesión si sigue siendo la propia.
      void readPlain<Lease>(key).then((lease) => {
        if (lease && lease.claim === claim) void AsyncStorage.removeItem(key);
      });
    },
  };
}

// Toma el control de la ruta. En la web usa Web Locks (exclusivo entre pestañas) y, si el navegador
// no los tiene, la concesión de arriba. En Android/iOS hay un solo proceso y el administrador de rutas
// ya evita duplicados. `onLost` avisa si otra pestaña tomó el control a la fuerza.
export async function acquireHostLock(code: string, owner: string, options: { steal?: boolean; onLost?: () => void } = {}): Promise<HostLock | null> {
  const locks = webLocks();
  if (locks) {
    return new Promise<HostLock | null>((resolve) => {
      let release: () => void = () => undefined;
      const held = new Promise<void>((done) => {
        release = done;
      });
      locks
        .request(`soytel-route-${code}`, options.steal ? { steal: true } : { ifAvailable: true }, async (lock) => {
          if (!lock) {
            resolve(null);
            return;
          }
          resolve({ release });
          await held;
        })
        .catch(() => {
          // La promesa se rechaza cuando otra pestaña roba el candado.
          options.onLost?.();
          resolve(null);
        });
    });
  }
  if (Platform.OS !== 'web') return { release: () => undefined };
  return acquireLease(code, owner, options);
}

export const deviceLocks: HostLockProvider = { acquire: acquireHostLock };

// ——— Resultados ya sumados al perfil ———

// Rutas cuyo resultado ya se sumó al perfil con versiones anteriores (hoy lo impide el id del resultado).
export async function wasRouteRecorded(code: string): Promise<boolean> {
  const list = await readPlain<string[]>(RECORDED_KEY);
  return Array.isArray(list) && list.includes(code);
}

// Borra todo lo de la ruta guardado en el dispositivo (credenciales, rutas del stand, concesiones).
export async function clearRouteStorage(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const routeKeys = keys.filter((key) => key.startsWith(ROUTE_STORAGE_PREFIX));
  if (routeKeys.length) await AsyncStorage.multiRemove(routeKeys);
}

export async function markRouteRecorded(code: string): Promise<void> {
  const list = (await readPlain<string[]>(RECORDED_KEY)) ?? [];
  await AsyncStorage.setItem(RECORDED_KEY, JSON.stringify([code, ...list.filter((item) => item !== code)].slice(0, 50)));
}
