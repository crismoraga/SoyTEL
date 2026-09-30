import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyPair } from '@/realtime/crypto';
import type { RouteState } from './types';

const MEMBER_KEY = '@soytel/route/member';
const HOST_INDEX_KEY = '@soytel/route/hosts';
const hostKey = (code: string) => `@soytel/route/host/${code}`;
const leaseKey = (code: string) => `@soytel/route/lease/${code}`;

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

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function loadMember(): Promise<MemberCredentials | null> {
  return readJson<MemberCredentials>(MEMBER_KEY);
}

export async function saveMember(credentials: MemberCredentials): Promise<void> {
  await AsyncStorage.setItem(MEMBER_KEY, JSON.stringify(credentials));
}

export async function clearMember(): Promise<void> {
  await AsyncStorage.removeItem(MEMBER_KEY);
}

export async function listHostCodes(): Promise<string[]> {
  const codes = await readJson<string[]>(HOST_INDEX_KEY);
  return Array.isArray(codes) ? codes : [];
}

export async function loadHost(code: string): Promise<HostRecord | null> {
  return readJson<HostRecord>(hostKey(code));
}

export async function saveHost(record: HostRecord): Promise<void> {
  const codes = await listHostCodes();
  const next = [record.code, ...codes.filter((code) => code !== record.code)].slice(0, 12);
  await AsyncStorage.multiSet([
    [hostKey(record.code), JSON.stringify(record)],
    [HOST_INDEX_KEY, JSON.stringify(next)],
  ]);
}

export async function removeHost(code: string): Promise<void> {
  const codes = await listHostCodes();
  await AsyncStorage.multiRemove([hostKey(code), leaseKey(code)]);
  await AsyncStorage.setItem(HOST_INDEX_KEY, JSON.stringify(codes.filter((item) => item !== code)));
}

// Evita que dos pestañas del navegador conduzcan la misma ruta a la vez.
export async function readLease(code: string): Promise<{ owner: string; at: number } | null> {
  return readJson<{ owner: string; at: number }>(leaseKey(code));
}

export async function writeLease(code: string, owner: string, at: number): Promise<void> {
  await AsyncStorage.setItem(leaseKey(code), JSON.stringify({ owner, at }));
}

const RECORDED_KEY = '@soytel/route/recorded';

// Evita sumar dos veces al perfil la misma ruta (por ejemplo, al reabrir el podio).
export async function wasRouteRecorded(code: string): Promise<boolean> {
  const list = await readJson<string[]>(RECORDED_KEY);
  return Array.isArray(list) && list.includes(code);
}

export async function markRouteRecorded(code: string): Promise<void> {
  const list = (await readJson<string[]>(RECORDED_KEY)) ?? [];
  await AsyncStorage.setItem(RECORDED_KEY, JSON.stringify([code, ...list.filter((item) => item !== code)].slice(0, 50)));
}

export const ROUTE_STORAGE_PREFIX = '@soytel/route/';
