import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAchievement } from '@/data/achievements';
import { evaluateAchievements, type AchievementContext } from '@/lib/achievements';
import { emitAppEvent } from '@/lib/events';
import { calculateGameXp, levelFromXp, levelTitle } from '@/lib/progression';
import type { AchievementId, GameOutcome, GameResult, UserProfile } from '@/types/game';
import { loadCareerProgress, masteredAreas, recordAreaPractice } from './career';
import { pushInbox, type NewInboxItem } from './inbox';
import { loadMascotDays } from './story';

const PROFILE_KEY = '@soytel/profile';
const RESULTS_KEY = '@soytel/results';

export const DEFAULT_ALIAS = 'Explorador TEL';

export const defaultProfile: UserProfile = {
  alias: DEFAULT_ALIAS,
  avatar: 0,
  createdAt: new Date().toISOString(),
  xp: 0,
  level: 1,
  streakDays: 0,
  lastPlayedAt: null,
  mascotMood: 72,
  unlockedAchievements: [],
  gamesPlayed: 0,
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
  const [profile, results, mascotDays, career] = await Promise.all([
    profileOverride ? Promise.resolve(profileOverride) : loadProfile(),
    resultsOverride ? Promise.resolve(resultsOverride) : loadResults(),
    loadMascotDays(),
    loadCareerProgress(),
  ]);
  return { profile, results, mascotDays: mascotDays.length, careerAreas: masteredAreas(career).length };
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

// Área de la carrera que practica cada resultado (la historia de Rutix es la práctica de Innovación).
function practicedArea(result: GameResult): string | null {
  if (result.gameId === 'practice' && typeof result.metadata?.area === 'string') return result.metadata.area;
  if (result.gameId === 'story') return 'innovacion';
  return null;
}

export async function recordGameResult(result: GameResult): Promise<GameOutcome> {
  const area = practicedArea(result);
  if (area) await recordAreaPractice(area, result.accuracy, result.completedAt);

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
    gamesPlayed: Math.max(profile.gamesPlayed, results.length) + 1,
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
  emitAppEvent({ type: 'progress' });

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
  emitAppEvent({ type: 'progress' });
  return newAchievements;
}

export async function updateAlias(alias: string): Promise<UserProfile> {
  return updateIdentity({ alias });
}

// Alias y avatar visibles (perfil, ruta y ranking).
export async function updateIdentity(patch: { alias?: string; avatar?: number }): Promise<UserProfile> {
  const profile = await loadProfile();
  const updated: UserProfile = {
    ...profile,
    alias: patch.alias !== undefined ? patch.alias.trim().slice(0, 24) || DEFAULT_ALIAS : profile.alias,
    avatar: patch.avatar !== undefined ? Math.max(0, Math.floor(patch.avatar)) : profile.avatar,
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

export interface ProgressSummary {
  xp: number;
  games: number;
  streak: number;
  bestRoute: number;
  routes: number;
  achievements: string[];
}

// Resumen del progreso local que se sincroniza con la cuenta.
export async function loadProgressSummary(): Promise<ProgressSummary> {
  const [profile, results] = await Promise.all([loadProfile(), loadResults()]);
  const routes = results.filter((result) => result.gameId === 'route');
  return {
    xp: profile.xp,
    games: Math.max(profile.gamesPlayed, results.length),
    streak: profile.streakDays,
    bestRoute: routes.reduce((best, result) => Math.max(best, result.score), 0),
    routes: routes.filter((result) => result.metadata?.completed === true).length,
    achievements: profile.unlockedAchievements,
  };
}

// Al entrar a una cuenta existente se conserva lo mejor de ambos lados (nunca se pierde XP ni logros).
export async function mergeAccountProgress(server: { alias: string; avatar: number; xp: number; games: number; achievements: string[] }): Promise<UserProfile> {
  const profile = await loadProfile();
  const xp = Math.max(profile.xp, server.xp);
  const updated: UserProfile = {
    ...profile,
    alias: server.alias || profile.alias,
    avatar: server.avatar,
    xp,
    level: levelFromXp(xp),
    gamesPlayed: Math.max(profile.gamesPlayed, server.games),
    unlockedAchievements: [...new Set([...profile.unlockedAchievements, ...server.achievements.filter((id) => Boolean(getAchievement(id)))])],
  };
  await saveProfile(updated);
  emitAppEvent({ type: 'progress' });
  return updated;
}

export const PROFILE_KEYS = [PROFILE_KEY, RESULTS_KEY];
