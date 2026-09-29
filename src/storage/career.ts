import AsyncStorage from '@react-native-async-storage/async-storage';

const CAREER_KEY = '@soytel/career-areas';

export async function loadViewedAreas(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(CAREER_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function markAreaViewed(id: string): Promise<string[]> {
  const viewed = await loadViewedAreas();
  if (viewed.includes(id)) return viewed;
  const updated = [...viewed, id];
  await AsyncStorage.setItem(CAREER_KEY, JSON.stringify(updated));
  return updated;
}

export const CAREER_KEYS = [CAREER_KEY];
