import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { KeyPair } from '@/realtime/crypto';
import { vaultEntry, vaultGet, vaultSet } from '@/security/vault';
import type { RouteState } from './types';

// Persistencia de la ruta. Todo lo que contiene llaves o tokens va cifrado (security/vault);
// el índice de rutas del stand solo guarda datos visibles (código, fase, participantes).

export const ROUTE_STORAGE_PREFIX = '@soytel/route/';
const MEMBER_KEY = `${ROUTE_STORAGE_PREFIX}member`;
const HOST_INDEX_KEY = `${ROUTE_STORAGE_PREFIX}hosts`;
const RECORDED_KEY = `${ROUTE_STORAGE_PREFIX}recorded`;
const hostKey = (code: string) => `${ROUTE_STORAGE_PREFIX}host/${code}`;
const leaseKey = (code: string) => `${ROUTE_STORAGE_PREFIX}lease/${code}`;

export interface MemberCredentials {
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
  token: string | null;
  joinedAt: number;
  solo: boolean;
}

export interface HostRecord {
  code: string;
  clientId: string;
  brokerIndex: number;
  boxKeys: KeyPair;
  signKeys: KeyPair;
  sessionKey: string;
  state: RouteState;
  seqs: Record<string, number>;
  savedAt: number;
}

export interface HostSummary {
  code: string;
  phase: RouteState['phase'];
  stop: RouteState['stop'];
  players: number;
  savedAt: number;
}

async function readPlain<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function loadMember(): Promise<MemberCredentials | null> {
  return vaultGet<MemberCredentials>(MEMBER_KEY);
}

export async function saveMember(credentials: MemberCredentials): Promise<void> {
  await vaultSet(MEMBER_KEY, credentials);
}

export async function clearMember(): Promise<void> {
  await AsyncStorage.removeItem(MEMBER_KEY);
}

function summaryOf(record: HostRecord): HostSummary {
  return {
    code: record.code,
    phase: record.state.phase,
    stop: record.state.stop,
    players: record.state.order.filter((id) => !record.state.players[id]?.kicked).length,
    savedAt: record.savedAt,
  };
}

// El índice antiguo era una lista de códigos; se completa leyendo cada ruta guardada.
export async function listHostSummaries(): Promise<HostSummary[]> {
  const raw = await readPlain<(HostSummary | string)[]>(HOST_INDEX_KEY);
  if (!Array.isArray(raw)) return [];
  const items = await Promise.all(
    raw.map(async (item) => {
      if (typeof item !== 'string') return item;
      const record = await loadHost(item);
      return record ? summaryOf(record) : null;
    }),
  );
  return items.filter((item): item is HostSummary => Boolean(item && item.code));
}

export async function listHostCodes(): Promise<string[]> {
  return (await listHostSummaries()).map((item) => item.code);
}

export async function loadHost(code: string): Promise<HostRecord | null> {
  return vaultGet<HostRecord>(hostKey(code));
}

export async function saveHost(record: HostRecord): Promise<void> {
  const summaries = await listHostSummaries();
  const next = [summaryOf(record), ...summaries.filter((item) => item.code !== record.code)].slice(0, 12);
  await AsyncStorage.multiSet([await vaultEntry(hostKey(record.code), record), [HOST_INDEX_KEY, JSON.stringify(next)]]);
}

export async function removeHost(code: string): Promise<void> {
  const summaries = await listHostSummaries();
  await AsyncStorage.multiRemove([hostKey(code), leaseKey(code)]);
  await AsyncStorage.setItem(HOST_INDEX_KEY, JSON.stringify(summaries.filter((item) => item.code !== code)));
}

// ——— Una sola pestaña/dispositivo conduce cada ruta ———

export interface HostLock {
  release(): void;
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

// Toma el control de la ruta de forma atómica. En la web usa Web Locks (exclusivo entre pestañas);
// en Android/iOS hay un solo proceso y el administrador de rutas ya evita duplicados.
// `onLost` avisa si otra pestaña tomó el control a la fuerza.
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

  // Navegadores sin Web Locks: concesión renovada en el almacenamiento local.
  const lease = await readPlain<{ owner: string; at: number }>(leaseKey(code));
  if (!options.steal && lease && lease.owner !== owner && Date.now() - lease.at < LEASE_STALE_MS) return null;
  const write = () => AsyncStorage.setItem(leaseKey(code), JSON.stringify({ owner, at: Date.now() }));
  await write();
  const timer = setInterval(() => {
    void readPlain<{ owner: string; at: number }>(leaseKey(code)).then((current) => {
      if (current && current.owner !== owner) {
        clearInterval(timer);
        options.onLost?.();
        return;
      }
      void write();
    });
  }, LEASE_MS);
  return {
    release: () => {
      clearInterval(timer);
      void AsyncStorage.removeItem(leaseKey(code));
    },
  };
}

// ——— Resultados ya sumados al perfil ———

// Evita sumar dos veces al perfil la misma ruta (por ejemplo, al reabrir el podio).
export async function wasRouteRecorded(code: string): Promise<boolean> {
  const list = await readPlain<string[]>(RECORDED_KEY);
  return Array.isArray(list) && list.includes(code);
}

export async function markRouteRecorded(code: string): Promise<void> {
  const list = (await readPlain<string[]>(RECORDED_KEY)) ?? [];
  await AsyncStorage.setItem(RECORDED_KEY, JSON.stringify([code, ...list.filter((item) => item !== code)].slice(0, 50)));
}

// Borra todo lo de la ruta guardado en el dispositivo (credenciales, rutas del stand, concesiones).
export async function clearRouteStorage(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const routeKeys = keys.filter((key) => key.startsWith(ROUTE_STORAGE_PREFIX));
  if (routeKeys.length) await AsyncStorage.multiRemove(routeKeys);
}
