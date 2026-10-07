import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tipForDate } from '@/data/tips';
import { localDayKey } from '@/lib/day';
import { storageGeneration, withLock } from './locks';

const INBOX_KEY = '@soytel/inbox';
const DAILY_KEY = '@soytel/inbox-daily';
const MAX_ITEMS = 60;

export type InboxKind = 'logro' | 'progreso' | 'rutix' | 'dato' | 'aviso';
const KINDS: readonly InboxKind[] = ['logro', 'progreso', 'rutix', 'dato', 'aviso'];

export interface InboxItem {
  id: string;
  kind: InboxKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  route?: string;
}

export type NewInboxItem = Omit<InboxItem, 'id' | 'createdAt' | 'read'> & { createdAt?: string };

// La lista en memoria es la referencia mientras la app está abierta: se lee del disco una sola vez
// (por generación de datos) y todo cambio se guarda antes de mostrarse. Así una lectura que termina
// tarde no puede pisar un aviso recién llegado.
let cache: InboxItem[] = [];
let hydration: Promise<void> | null = null;
let hydratedFor = -1;
let hydrationToken = 0;
const listeners = new Set<() => void>();
let counter = 0;

function emit(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Acepta solo avisos bien formados; un tipo desconocido se muestra como aviso general.
export function parseInbox(raw: unknown): InboxItem[] {
  if (!Array.isArray(raw)) return [];
  const items: InboxItem[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const item = entry as Record<string, unknown>;
    if (typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.body !== 'string') continue;
    // Los avisos antiguos de la mascota usaban el tipo 'telix' (ahora Rutix).
    const kind = item.kind === 'telix' ? 'rutix' : KINDS.includes(item.kind as InboxKind) ? (item.kind as InboxKind) : 'aviso';
    const parsed: InboxItem = {
      id: item.id,
      kind,
      title: item.title,
      body: item.body,
      createdAt: typeof item.createdAt === 'string' && Number.isFinite(new Date(item.createdAt).getTime()) ? item.createdAt : new Date(0).toISOString(),
      read: item.read === true,
    };
    if (typeof item.route === 'string') parsed.route = item.route;
    items.push(parsed);
  }
  return items.slice(0, MAX_ITEMS);
}

function hydrate(): Promise<void> {
  const generation = storageGeneration();
  if (hydration && hydratedFor === generation) return hydration;
  hydratedFor = generation;
  hydrationToken += 1;
  const token = hydrationToken;
  hydration = (async () => {
    let items: InboxItem[] = [];
    try {
      const raw = await AsyncStorage.getItem(INBOX_KEY);
      items = raw ? parseInbox(JSON.parse(raw)) : [];
    } catch {
      items = [];
    }
    // Si mientras se leía hubo un borrado total (u otra carga), esta lectura ya no vale.
    if (token === hydrationToken && generation === storageGeneration()) {
      cache = items;
      emit();
    }
  })();
  return hydration;
}

// Avisos vigentes (lee del disco solo la primera vez).
export async function loadInbox(): Promise<InboxItem[]> {
  await hydrate();
  return cache;
}

// Cambia la lista: lee la versión vigente, guarda en disco y recién entonces la muestra.
function mutate(change: (items: InboxItem[]) => InboxItem[]): Promise<void> {
  return withLock('inbox', async () => {
    await hydrate();
    const next = change(cache).slice(0, MAX_ITEMS);
    await AsyncStorage.setItem(INBOX_KEY, JSON.stringify(next));
    cache = next;
    emit();
  });
}

export async function pushInbox(items: NewInboxItem[]): Promise<void> {
  if (items.length === 0) return;
  const now = new Date().toISOString();
  const created: InboxItem[] = items.map((item) => {
    counter += 1;
    return {
      ...item,
      id: `${Date.now().toString(36)}-${counter}`,
      createdAt: item.createdAt ?? now,
      read: false,
    };
  });
  await mutate((current) => [...created, ...current]);
}

export function markInboxRead(id: string): Promise<void> {
  return mutate((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
}

export function markAllInboxRead(): Promise<void> {
  return mutate((current) => current.map((item) => ({ ...item, read: true })));
}

// Un dato curioso al día y un recordatorio si Rutix tiene poca señal.
export function ensureDailyInbox(mascotMood: number, today = new Date()): Promise<void> {
  return withLock('inbox-daily', async () => {
    const day = localDayKey(today);
    const last = await AsyncStorage.getItem(DAILY_KEY);
    if (last === day) return;
    const tip = tipForDate(today);
    const items: NewInboxItem[] = [{ kind: 'dato', title: '¿Sabías que…?', body: tip.text, route: '/career' }];
    if (mascotMood < 45) {
      items.push({ kind: 'rutix', title: 'Rutix tiene poca señal', body: 'Pasa a saludarlo o juega una ráfaga corta para subirle el ánimo.', route: '/mascot' });
    }
    await pushInbox(items);
    // El día se marca cuando el aviso ya quedó guardado.
    await AsyncStorage.setItem(DAILY_KEY, day);
  });
}

export function getInboxSnapshot(): InboxItem[] {
  return cache;
}

export function useInbox(): InboxItem[] {
  return useSyncExternalStore(subscribe, getInboxSnapshot, getInboxSnapshot);
}

export function useUnreadCount(): number {
  const items = useInbox();
  return items.filter((item) => !item.read).length;
}

export function resetInboxCache(): void {
  cache = [];
  hydration = null;
  hydratedFor = -1;
  hydrationToken += 1;
  emit();
}

export const INBOX_KEYS = [INBOX_KEY, DAILY_KEY];
