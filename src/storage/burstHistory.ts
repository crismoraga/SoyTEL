import AsyncStorage from '@react-native-async-storage/async-storage';
import { withLock } from './locks';

// Microjuegos jugados hace poco en la Ráfaga TEL (del más nuevo al más viejo): la próxima ráfaga
// prefiere los que no salieron, para que no se repitan siempre los mismos.
const RECENT_KEY = '@soytel/burst-recent';
export const BURST_HISTORY_KEYS = [RECENT_KEY];
export const RECENT_LIMIT = 24;

export function parseRecentGames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const unique: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item.length > 0 && item.length <= 40 && !unique.includes(item)) unique.push(item);
    if (unique.length >= RECENT_LIMIT) break;
  }
  return unique;
}

export async function getRecentBurstGames(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    return raw ? parseRecentGames(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

// Anota los juegos de una ráfaga recién armada (los más nuevos primero).
export async function rememberBurstGames(ids: readonly string[]): Promise<void> {
  await withLock(RECENT_KEY, async () => {
    const current = await getRecentBurstGames();
    const next = parseRecentGames([...ids, ...current.filter((id) => !ids.includes(id))]);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
  });
}
