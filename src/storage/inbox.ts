import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tipForDate } from '@/data/tips';

const INBOX_KEY = '@soytel/inbox';
const DAILY_KEY = '@soytel/inbox-daily';
const MAX_ITEMS = 60;

export type InboxKind = 'logro' | 'progreso' | 'rutix' | 'dato' | 'aviso';

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

let cache: InboxItem[] = [];
let loaded = false;
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

async function persist(items: InboxItem[]): Promise<void> {
  cache = items.slice(0, MAX_ITEMS);
  emit();
  await AsyncStorage.setItem(INBOX_KEY, JSON.stringify(cache));
}

export async function loadInbox(): Promise<InboxItem[]> {
  const raw = await AsyncStorage.getItem(INBOX_KEY);
  try {
    // Los avisos antiguos de la mascota usaban el tipo 'telix' (ahora Rutix).
    const parsed = raw ? (JSON.parse(raw) as InboxItem[]).map((item) => ((item.kind as string) === 'telix' ? { ...item, kind: 'rutix' as const } : item)) : [];
    cache = Array.isArray(parsed) ? parsed : [];
  } catch {
    cache = [];
  }
  loaded = true;
  emit();
  return cache;
}

export async function pushInbox(items: NewInboxItem[]): Promise<void> {
  if (items.length === 0) return;
  if (!loaded) await loadInbox();
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
  await persist([...created, ...cache]);
}

export async function markInboxRead(id: string): Promise<void> {
  if (!loaded) await loadInbox();
  await persist(cache.map((item) => (item.id === id ? { ...item, read: true } : item)));
}

export async function markAllInboxRead(): Promise<void> {
  if (!loaded) await loadInbox();
  await persist(cache.map((item) => ({ ...item, read: true })));
}

// Un dato curioso al día y un recordatorio si Rutix tiene poca señal.
export async function ensureDailyInbox(mascotMood: number, today = new Date()): Promise<void> {
  const day = today.toISOString().slice(0, 10);
  const last = await AsyncStorage.getItem(DAILY_KEY);
  if (last === day) return;
  await AsyncStorage.setItem(DAILY_KEY, day);
  const tip = tipForDate(today);
  const items: NewInboxItem[] = [{ kind: 'dato', title: '¿Sabías que…?', body: tip.text, route: '/career' }];
  if (mascotMood < 45) {
    items.push({ kind: 'rutix', title: 'Rutix tiene poca señal', body: 'Pasa a saludarlo o juega una ráfaga corta para subirle el ánimo.', route: '/mascot' });
  }
  await pushInbox(items);
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
  loaded = false;
  emit();
}

export const INBOX_KEYS = [INBOX_KEY, DAILY_KEY];
