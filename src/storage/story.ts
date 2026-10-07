import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDayKey } from '@/lib/day';
import { withLock } from './locks';

const STORY_KEY = '@soytel/story';
const ONBOARDING_KEY = '@soytel/onboarded';
const MASCOT_DAYS_KEY = '@soytel/mascot-days';
const MASCOT_LOG_KEY = '@soytel/mascot-log';

export interface StoryProgress {
  completedChapters: string[];
}

export const defaultStoryProgress: StoryProgress = {
  completedChapters: [],
};

export async function loadStoryProgress(): Promise<StoryProgress> {
  const raw = await AsyncStorage.getItem(STORY_KEY);
  if (!raw) {
    return defaultStoryProgress;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoryProgress>;
    return {
      completedChapters: Array.isArray(parsed.completedChapters) ? [...new Set(parsed.completedChapters.filter((id): id is string => typeof id === 'string'))] : [],
    };
  } catch {
    return defaultStoryProgress;
  }
}

// Marcar un capítulo dos veces deja el mismo resultado.
export function completeChapter(chapterId: string): Promise<StoryProgress> {
  return withLock('story', async () => {
    const progress = await loadStoryProgress();
    const updated: StoryProgress = {
      completedChapters: [...new Set([...progress.completedChapters, chapterId])],
    };
    await AsyncStorage.setItem(STORY_KEY, JSON.stringify(updated));
    return updated;
  });
}

export async function isOnboarded(): Promise<boolean> {
  return (await AsyncStorage.getItem(ONBOARDING_KEY)) === 'yes';
}

export async function markOnboarded(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, 'yes');
}

export async function loadMascotDays(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(MASCOT_DAYS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? [...new Set(parsed.filter((day): day is string => typeof day === 'string'))] : [];
  } catch {
    return [];
  }
}

// Registra el día (local) en que se cuidó a Rutix. Dos cuidados el mismo día cuentan un solo día.
export function logMascotDay(date: Date = new Date()): Promise<string[]> {
  return withLock('story', async () => {
    const days = await loadMascotDays();
    const day = localDayKey(date);
    if (days.includes(day)) {
      return days;
    }

    const updated = [...days, day];
    await AsyncStorage.setItem(MASCOT_DAYS_KEY, JSON.stringify(updated));
    return updated;
  });
}

export interface MascotLog {
  date: string;
  count: number;
}

export async function loadMascotLog(now: Date = new Date()): Promise<MascotLog> {
  const today = localDayKey(now);
  const raw = await AsyncStorage.getItem(MASCOT_LOG_KEY);
  if (!raw) {
    return { date: today, count: 0 };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<MascotLog>;
    if (parsed.date !== today || typeof parsed.count !== 'number' || !Number.isFinite(parsed.count)) {
      return { date: today, count: 0 };
    }
    return { date: parsed.date, count: Math.max(0, Math.floor(parsed.count)) };
  } catch {
    return { date: today, count: 0 };
  }
}

export async function saveMascotLog(log: MascotLog): Promise<void> {
  await AsyncStorage.setItem(MASCOT_LOG_KEY, JSON.stringify(log));
}

// Cuenta un cuidado de hoy si quedan cupos. Devuelve el registro vigente y si este cuidado contó.
export function countMascotCare(limit: number, now: Date = new Date()): Promise<{ log: MascotLog; counted: boolean }> {
  return withLock('mascot-log', async () => {
    const log = await loadMascotLog(now);
    if (log.count >= limit) return { log, counted: false };
    const next = { date: log.date, count: log.count + 1 };
    await saveMascotLog(next);
    return { log: next, counted: true };
  });
}

export const STORY_KEYS = [STORY_KEY, ONBOARDING_KEY, MASCOT_DAYS_KEY, MASCOT_LOG_KEY];
