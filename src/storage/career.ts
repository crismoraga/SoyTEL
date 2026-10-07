import AsyncStorage from '@react-native-async-storage/async-storage';
import { withLock } from './locks';

// Avance real en las áreas de la carrera: se registra al terminar una práctica (no al leer el área).
// Un área queda "dominada" con al menos 3 de 5 respuestas correctas (60 %) en una práctica.

const PROGRESS_KEY = '@soytel/career-progress';
// Versión anterior: marcaba un área solo por abrirla. Se descarta al cargar.
const LEGACY_VIEWED_KEY = '@soytel/career-areas';

export const AREA_MASTERY = 0.6;

export interface AreaProgress {
  sessions: number;
  best: number;
  lastAt: string;
}

export type CareerProgress = Record<string, AreaProgress | undefined>;

export async function loadCareerProgress(): Promise<CareerProgress> {
  try {
    const [raw, legacy] = await Promise.all([AsyncStorage.getItem(PROGRESS_KEY), AsyncStorage.getItem(LEGACY_VIEWED_KEY)]);
    if (legacy !== null) await AsyncStorage.removeItem(LEGACY_VIEWED_KEY);
    return parseCareerProgress(raw ? JSON.parse(raw) : {});
  } catch {
    return {};
  }
}

// Conserva solo las áreas con datos bien formados.
export function parseCareerProgress(raw: unknown): CareerProgress {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const progress: CareerProgress = {};
  Object.entries(raw as Record<string, unknown>).forEach(([area, value]) => {
    if (typeof value !== 'object' || value === null) return;
    const item = value as Record<string, unknown>;
    const sessions = typeof item.sessions === 'number' && Number.isFinite(item.sessions) ? Math.max(0, Math.floor(item.sessions)) : 0;
    const best = typeof item.best === 'number' && Number.isFinite(item.best) ? Math.min(1, Math.max(0, item.best)) : 0;
    progress[area] = { sessions, best, lastAt: typeof item.lastAt === 'string' ? item.lastAt : '' };
  });
  return progress;
}

export function recordAreaPractice(area: string, accuracy: number, at: string): Promise<CareerProgress> {
  return withLock('career', async () => {
    const progress = await loadCareerProgress();
    const previous = progress[area];
    const updated: CareerProgress = {
      ...progress,
      [area]: {
        sessions: (previous?.sessions ?? 0) + 1,
        best: Math.max(previous?.best ?? 0, Math.min(1, Math.max(0, Number.isFinite(accuracy) ? accuracy : 0))),
        lastAt: at,
      },
    };
    await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(updated));
    return updated;
  });
}

export function isAreaMastered(progress: CareerProgress | null | undefined, area: string): boolean {
  return (progress?.[area]?.best ?? 0) >= AREA_MASTERY;
}

export function masteredAreas(progress: CareerProgress | null | undefined): string[] {
  return Object.keys(progress ?? {}).filter((area) => isAreaMastered(progress, area));
}

export const CAREER_KEYS = [PROGRESS_KEY, LEGACY_VIEWED_KEY];
