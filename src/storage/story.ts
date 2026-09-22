import AsyncStorage from '@react-native-async-storage/async-storage';

const STORY_KEY = '@soytel/story';
const ONBOARDING_KEY = '@soytel/onboarded';
const MASCOT_DAYS_KEY = '@soytel/mascot-days';

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
      completedChapters: Array.isArray(parsed.completedChapters) ? parsed.completedChapters : [],
    };
  } catch {
    return defaultStoryProgress;
  }
}

export async function completeChapter(chapterId: string): Promise<StoryProgress> {
  const progress = await loadStoryProgress();
  const updated: StoryProgress = {
    completedChapters: [...new Set([...progress.completedChapters, chapterId])],
  };
  await AsyncStorage.setItem(STORY_KEY, JSON.stringify(updated));
  return updated;
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
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function logMascotDay(isoDate: string): Promise<string[]> {
  const days = await loadMascotDays();
  const day = isoDate.slice(0, 10);
  if (days.includes(day)) {
    return days;
  }

  const updated = [...days, day];
  await AsyncStorage.setItem(MASCOT_DAYS_KEY, JSON.stringify(updated));
  return updated;
}

const MASCOT_LOG_KEY = '@soytel/mascot-log';

export interface MascotLog {
  date: string;
  count: number;
}

export async function loadMascotLog(): Promise<MascotLog> {
  const today = new Date().toISOString().slice(0, 10);
  const raw = await AsyncStorage.getItem(MASCOT_LOG_KEY);
  if (!raw) {
    return { date: today, count: 0 };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<MascotLog>;
    if (parsed.date !== today || typeof parsed.count !== 'number') {
      return { date: today, count: 0 };
    }
    return { date: parsed.date, count: parsed.count };
  } catch {
    return { date: today, count: 0 };
  }
}

export async function saveMascotLog(log: MascotLog): Promise<void> {
  await AsyncStorage.setItem(MASCOT_LOG_KEY, JSON.stringify(log));
}
