import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAchievement } from '@/data/achievements';
import { evaluateAchievements, type AchievementContext } from '@/lib/achievements';
import { emitAppEvent } from '@/lib/events';
import { calculateGameXp, levelFromXp, levelTitle } from '@/lib/progression';
import type { AchievementId, GameOutcome, GameResult, UserProfile } from '@/types/game';
import { loadViewedAreas } from './career';
import { pushInbox, type NewInboxItem } from './inbox';
import { loadMascotDays } from './story';

const PROFILE_KEY = '@soytel/profile';
const RESULTS_KEY = '@soytel/results';

export const defaultProfile: UserProfile = {
  alias: 'Explorador TEL',
  createdAt: new Date().toISOString(),
  xp: 0,
  level: 1,
  streakDays: 0,
  lastPlayedAt: null,
  mascotMood: 72,
  unlockedAchievements: [],
};

function isSameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function isYesterday(day: Date, reference: Date): boolean {
  const yesterday = new Date(reference);
  yesterday.setDate(reference.getDate() - 1);
  return isSameDay(day, yesterday);
}

export async function loadProfile(): Promise<UserProfile> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  let profile = defaultProfile;

  if (raw) {
    try {
      profile = { ...defaultProfile, ...JSON.parse(raw) as Partial<UserProfile> };
      // La mascota pasó a llamarse Rutix: se migra el logro guardado con el nombre anterior.
      profile = { ...profile, unlockedAchievements: profile.unlockedAchievements.map((id) => (id === 'telix-friend' ? 'rutix-friend' : id)) };
    } catch {
      profile = defaultProfile;
    }
  }

  return applyMascotDecay(profile);
}

// El ánimo de Rutix baja 6 puntos por cada día sin jugar (mínimo 10).
export function applyMascotDecay(profile: UserProfile, now = Date.now()): UserProfile {
  if (!profile.lastPlayedAt) {
    return profile;
  }

  const daysSince = Math.floor((now - new Date(profile.lastPlayedAt).getTime()) / 86_400_000);
  if (daysSince <= 0) {
    return profile;
  }

  return {
    ...profile,
    mascotMood: Math.max(10, profile.mascotMood - daysSince * 6),
  };
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function loadResults(): Promise<GameResult[]> {
  const raw = await AsyncStorage.getItem(RESULTS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as GameResult[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function loadAchievementContext(profileOverride?: UserProfile, resultsOverride?: GameResult[]): Promise<AchievementContext> {
  const [profile, results, mascotDays, careerAreas] = await Promise.all([
    profileOverride ? Promise.resolve(profileOverride) : loadProfile(),
    resultsOverride ? Promise.resolve(resultsOverride) : loadResults(),
    loadMascotDays(),
    loadViewedAreas(),
  ]);
  return { profile, results, mascotDays: mascotDays.length, careerAreas: careerAreas.length };
}

function announce(newAchievements: AchievementId[], levelUp: number | null): NewInboxItem[] {
  const items: NewInboxItem[] = [];
  newAchievements.forEach((id) => {
    const achievement = getAchievement(id);
    if (!achievement) return;
    emitAppEvent({ type: 'achievement', id });
    items.push({ kind: 'logro', title: `Logro desbloqueado: ${achievement.title}`, body: achievement.description, route: '/achievements' });
  });
  if (levelUp) {
    emitAppEvent({ type: 'levelUp', level: levelUp });
    items.push({ kind: 'progreso', title: `¡Subiste al nivel ${levelUp}!`, body: `Ahora eres ${levelTitle(levelUp)}. Sigue sumando XP para desbloquear más medallas.`, route: '/profile' });
  }
  return items;
}

export async function recordGameResult(result: GameResult): Promise<GameOutcome> {
  const [profile, results] = await Promise.all([loadProfile(), loadResults()]);
  const playedAt = new Date(result.completedAt);
  const previousPlayedAt = profile.lastPlayedAt ? new Date(profile.lastPlayedAt) : null;
  const streakDays = previousPlayedAt && isSameDay(previousPlayedAt, playedAt)
    ? Math.max(1, profile.streakDays)
    : previousPlayedAt && isYesterday(previousPlayedAt, playedAt)
      ? profile.streakDays + 1
      : 1;
  const xpGained = calculateGameXp(result.score, result.accuracy, result.durationSeconds);
  const xp = profile.xp + xpGained;
  const level = levelFromXp(xp);
  const allResults = [result, ...results].slice(0, 200);

  const draft: UserProfile = {
    ...profile,
    xp,
    level,
    streakDays,
    lastPlayedAt: result.completedAt,
    mascotMood: Math.min(100, profile.mascotMood + 4),
  };
  const context = await loadAchievementContext(draft, allResults);
  const earned = evaluateAchievements(context);
  const newAchievements = earned.filter((id) => !profile.unlockedAchievements.includes(id));
  const updated: UserProfile = {
    ...draft,
    unlockedAchievements: [...new Set([...profile.unlockedAchievements, ...earned])],
  };

  await Promise.all([
    saveProfile(updated),
    AsyncStorage.setItem(RESULTS_KEY, JSON.stringify(allResults)),
  ]);
  const leveledUp = level > profile.level;
  await pushInbox(announce(newAchievements, leveledUp ? level : null));

  return { profile: updated, xpGained, leveledUp, newAchievements };
}

// Revisa logros que dependen de acciones sin partida (Rutix, Carrera) y los desbloquea.
export async function syncAchievements(): Promise<AchievementId[]> {
  const context = await loadAchievementContext();
  const earned = evaluateAchievements(context);
  const newAchievements = earned.filter((id) => !context.profile.unlockedAchievements.includes(id));
  if (newAchievements.length === 0) {
    return [];
  }
  await saveProfile({
    ...context.profile,
    unlockedAchievements: [...new Set([...context.profile.unlockedAchievements, ...earned])],
  });
  await pushInbox(announce(newAchievements, null));
  return newAchievements;
}

export async function updateAlias(alias: string): Promise<UserProfile> {
  const profile = await loadProfile();
  const updated = {
    ...profile,
    alias: alias.trim().slice(0, 24) || defaultProfile.alias,
  };
  await saveProfile(updated);
  return updated;
}

export async function updateMascotMood(delta: number): Promise<UserProfile> {
  const profile = await loadProfile();
  const updated = { ...profile, mascotMood: Math.max(0, Math.min(100, profile.mascotMood + delta)) };
  await saveProfile(updated);
  return updated;
}

export const PROFILE_KEYS = [PROFILE_KEY, RESULTS_KEY];
