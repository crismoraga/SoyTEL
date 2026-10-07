import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAchievement } from '@/data/achievements';
import { evaluateAchievements, type AchievementContext } from '@/lib/achievements';
import { emitAppEvent } from '@/lib/events';
import { combineStats, parseStats, summarize, type ProgressStats } from '@/lib/progressStats';
import { calculateGameXp, levelFromXp, levelTitle } from '@/lib/progression';
import type { AchievementId, GameOutcome, GameResult, UserProfile } from '@/types/game';
import { loadCareerProgress, masteredAreas, recordAreaPractice } from './career';
import { pushInbox, type NewInboxItem } from './inbox';
import { withLock } from './locks';
import { loadMascotDays } from './story';

const PROFILE_KEY = '@soytel/profile';
const RESULTS_KEY = '@soytel/results';

export const DEFAULT_ALIAS = 'Explorador TEL';
// Partidas que conserva el historial. Las más antiguas se pliegan en `profile.archive`.
export const RESULTS_LIMIT = 200;
const APPLIED_RESULTS_LIMIT = 400;
const DAY_MS = 86_400_000;

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

const finite = (value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

const isoDate = (value: unknown): string | null => (typeof value === 'string' && Number.isFinite(new Date(value).getTime()) ? value : null);

const strings = (value: unknown, limit: number): string[] => (Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length <= 120))].slice(0, limit) : []);

// Lee un perfil guardado campo por campo. Un JSON válido con la forma equivocada (un texto donde va
// un número, una fecha imposible) no rompe la app: cada campo dañado vuelve a su valor por defecto.
export function parseProfile(raw: unknown): UserProfile {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return defaultProfile;
  const source = raw as Record<string, unknown>;
  const xp = Math.floor(finite(source.xp, 0));
  const profile: UserProfile = {
    alias: typeof source.alias === 'string' && source.alias.trim() ? source.alias.trim().slice(0, 24) : DEFAULT_ALIAS,
    avatar: Math.floor(finite(source.avatar, 0, 0, 999)),
    createdAt: isoDate(source.createdAt) ?? defaultProfile.createdAt,
    xp,
    // El nivel siempre sale del XP: nunca queda desalineado.
    level: levelFromXp(xp),
    streakDays: Math.floor(finite(source.streakDays, 0, 0, 100_000)),
    lastPlayedAt: isoDate(source.lastPlayedAt),
    mascotMood: finite(source.mascotMood, defaultProfile.mascotMood, 0, 100),
    moodAt: isoDate(source.moodAt),
    // La mascota pasó a llamarse Rutix: se migra el logro guardado con el nombre anterior.
    unlockedAchievements: strings(source.unlockedAchievements, 200).map((id) => (id === 'telix-friend' ? 'rutix-friend' : id)),
    gamesPlayed: Math.floor(finite(source.gamesPlayed, 0)),
    appliedResults: strings(source.appliedResults, APPLIED_RESULTS_LIMIT),
  };
  if (source.archive !== undefined) profile.archive = parseStats(source.archive);
  return profile;
}

export async function loadProfile(): Promise<UserProfile> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  if (!raw) return applyMascotDecay(defaultProfile);
  try {
    return applyMascotDecay(parseProfile(JSON.parse(raw)));
  } catch {
    return applyMascotDecay(defaultProfile);
  }
}

// El ánimo de Rutix baja 6 puntos por cada día sin jugar (mínimo 10). Cada día descontado adelanta
// `moodAt`, así guardar el perfil (cambiar el alias, cuidar a Rutix) no vuelve a descontar los mismos días.
export function applyMascotDecay(profile: UserProfile, now = Date.now()): UserProfile {
  const since = profile.moodAt ?? profile.lastPlayedAt;
  if (!since) {
    return profile;
  }

  const base = new Date(since).getTime();
  const daysSince = Number.isFinite(base) ? Math.floor((now - base) / DAY_MS) : 0;
  if (daysSince <= 0) {
    return profile;
  }

  return {
    ...profile,
    mascotMood: Math.max(10, profile.mascotMood - daysSince * 6),
    moodAt: new Date(base + daysSince * DAY_MS).toISOString(),
  };
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function isResult(value: unknown): value is GameResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.gameId === 'string' && typeof item.score === 'number' && Number.isFinite(item.score) && typeof item.accuracy === 'number' && Number.isFinite(item.accuracy) && typeof item.completedAt === 'string';
}

// Historial reciente. Las entradas que no son un resultado válido se ignoran (no se borran del disco
// hasta la próxima partida, que reescribe la lista ya limpia).
export async function loadResults(): Promise<GameResult[]> {
  const raw = await AsyncStorage.getItem(RESULTS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isResult) : [];
  } catch {
    return [];
  }
}

// Progreso acumulado: lo archivado en el perfil más el historial reciente.
export function progressStatsOf(profile: UserProfile, results: GameResult[]): ProgressStats {
  return combineStats(parseStats(profile.archive), summarize(results));
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

export interface RecordOptions {
  // Puntos extra que se entregan una sola vez por `id` (por ejemplo, el bono del desafío de cada día).
  bonus?: { id: string; score: number };
}

// Suma una partida al perfil. Las llamadas se atienden de a una (dos resultados seguidos no se pisan)
// y, si el resultado trae `id`, repetirlo no vuelve a sumar: devuelve lo que entregó la primera vez.
export function recordGameResult(result: GameResult, options: RecordOptions = {}): Promise<GameOutcome> {
  return withLock('profile', () => applyGameResult(result, options));
}

async function applyGameResult(result: GameResult, options: RecordOptions): Promise<GameOutcome> {
  const [profile, results] = await Promise.all([loadProfile(), loadResults()]);
  const applied = profile.appliedResults ?? [];
  if (result.id && applied.includes(result.id)) {
    const stored = results.find((item) => item.id === result.id);
    return { profile, xpGained: stored?.xp ?? 0, leveledUp: false, newAchievements: [], alreadyRecorded: true, bonusGranted: false };
  }

  const area = practicedArea(result);
  if (area) await recordAreaPractice(area, result.accuracy, result.completedAt);

  const bonus = options.bonus && !applied.includes(options.bonus.id) ? options.bonus : null;
  const score = result.score + (bonus ? bonus.score : 0);
  const playedAt = new Date(result.completedAt);
  const previousPlayedAt = profile.lastPlayedAt ? new Date(profile.lastPlayedAt) : null;
  const streakDays = previousPlayedAt && isSameDay(previousPlayedAt, playedAt)
    ? Math.max(1, profile.streakDays)
    : previousPlayedAt && isYesterday(previousPlayedAt, playedAt)
      ? profile.streakDays + 1
      : 1;
  const xpGained = calculateGameXp(score, result.accuracy, result.durationSeconds);
  const xp = profile.xp + xpGained;
  const level = levelFromXp(xp);
  const merged = [{ ...result, score, xp: xpGained }, ...results];
  const allResults = merged.slice(0, RESULTS_LIMIT);
  const dropped = merged.slice(RESULTS_LIMIT);
  const ids = [result.id, bonus?.id].filter((id): id is string => Boolean(id));

  const draft: UserProfile = {
    ...profile,
    xp,
    level,
    streakDays,
    lastPlayedAt: result.completedAt,
    mascotMood: Math.min(100, profile.mascotMood + 4),
    moodAt: result.completedAt,
    gamesPlayed: Math.max(profile.gamesPlayed, results.length) + 1,
    appliedResults: ids.length ? [...ids, ...applied].slice(0, APPLIED_RESULTS_LIMIT) : applied,
    // Lo que sale del historial se pliega en el resumen acumulado: los logros no dependen de la ventana.
    archive: dropped.length ? combineStats(parseStats(profile.archive), summarize(dropped)) : profile.archive,
  };
  const context = await loadAchievementContext(draft, allResults);
  const earned = evaluateAchievements(context);
  const newAchievements = earned.filter((id) => !profile.unlockedAchievements.includes(id));
  const updated: UserProfile = {
    ...draft,
    unlockedAchievements: [...new Set([...profile.unlockedAchievements, ...earned])],
  };

  // Perfil e historial en una sola escritura: o quedan ambos o ninguno (y el reintento no duplica).
  await AsyncStorage.multiSet([
    [PROFILE_KEY, JSON.stringify(updated)],
    [RESULTS_KEY, JSON.stringify(allResults)],
  ]);
  const leveledUp = level > profile.level;
  // Los avisos son secundarios: si no se pueden guardar, la partida ya quedó registrada.
  await pushInbox(announce(newAchievements, leveledUp ? level : null)).catch(() => undefined);
  emitAppEvent({ type: 'progress' });

  return { profile: updated, xpGained, leveledUp, newAchievements, bonusGranted: Boolean(bonus) };
}

// Revisa logros que dependen de acciones sin partida (Rutix, Carrera) y los desbloquea.
export function syncAchievements(): Promise<AchievementId[]> {
  return withLock('profile', applyAchievements);
}

async function applyAchievements(): Promise<AchievementId[]> {
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
  await pushInbox(announce(newAchievements, null)).catch(() => undefined);
  emitAppEvent({ type: 'progress' });
  return newAchievements;
}

export async function updateAlias(alias: string): Promise<UserProfile> {
  return updateIdentity({ alias });
}

// Alias y avatar visibles (perfil, ruta y ranking).
export function updateIdentity(patch: { alias?: string; avatar?: number }): Promise<UserProfile> {
  return withLock('profile', async () => {
    const profile = await loadProfile();
    const updated: UserProfile = {
      ...profile,
      alias: patch.alias !== undefined ? patch.alias.trim().slice(0, 24) || DEFAULT_ALIAS : profile.alias,
      avatar: patch.avatar !== undefined ? Math.max(0, Math.floor(patch.avatar)) : profile.avatar,
    };
    await saveProfile(updated);
    return updated;
  });
}

// Cambia el ánimo de Rutix sobre el perfil vigente (nunca sobre una copia vieja en pantalla).
// Con `grantId`, el mismo regalo se entrega una sola vez aunque se pida de nuevo.
export function updateMascotMood(delta: number, grantId?: string): Promise<UserProfile> {
  return withLock('profile', async () => {
    const profile = await loadProfile();
    const applied = profile.appliedResults ?? [];
    if (grantId && applied.includes(grantId)) return profile;
    const updated: UserProfile = {
      ...profile,
      mascotMood: Math.max(0, Math.min(100, profile.mascotMood + delta)),
      appliedResults: grantId ? [grantId, ...applied].slice(0, APPLIED_RESULTS_LIMIT) : applied,
    };
    await saveProfile(updated);
    return updated;
  });
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
  const stats = progressStatsOf(profile, results);
  return {
    xp: profile.xp,
    games: Math.max(profile.gamesPlayed, stats.total),
    streak: profile.streakDays,
    bestRoute: stats.bestRoute,
    routes: stats.routesCompleted,
    achievements: profile.unlockedAchievements,
  };
}

export interface ServerProgress {
  alias: string;
  avatar: number;
  xp: number;
  games: number;
  achievements: string[];
  streak?: number;
  routes?: number;
  bestRoute?: number;
  // Última vez que la cuenta registró actividad (para saber si la racha sigue viva).
  lastActiveAt?: string | null;
}

// Al entrar a una cuenta existente se conserva lo mejor de ambos lados (nunca se pierde XP ni logros).
export function mergeAccountProgress(server: ServerProgress): Promise<UserProfile> {
  return withLock('profile', () => applyAccountProgress(server));
}

async function applyAccountProgress(server: ServerProgress): Promise<UserProfile> {
  const [profile, results] = await Promise.all([loadProfile(), loadResults()]);
  const xp = Math.max(profile.xp, server.xp);
  // Rutas y mejor ruta de la cuenta: se suman al resumen acumulado lo que el historial local no tiene.
  const recent = summarize(results);
  const archive = parseStats(profile.archive);
  const routes = Math.max(0, Math.floor(server.routes ?? 0));
  const merged: ProgressStats = {
    ...archive,
    routesCompleted: Math.max(archive.routesCompleted, routes - recent.routesCompleted),
    bestRoute: Math.max(archive.bestRoute, Math.floor(server.bestRoute ?? 0)),
  };
  // La racha de la cuenta solo se adopta si sigue viva (hubo actividad ayer u hoy) y supera la local.
  const lastActive = server.lastActiveAt ? new Date(server.lastActiveAt) : null;
  const today = new Date();
  const alive = lastActive !== null && Number.isFinite(lastActive.getTime()) && (isSameDay(lastActive, today) || isYesterday(lastActive, today));
  const streak = Math.max(0, Math.floor(server.streak ?? 0));
  const adoptStreak = alive && streak > profile.streakDays;
  const updated: UserProfile = {
    ...profile,
    alias: server.alias || profile.alias,
    avatar: server.avatar,
    xp,
    level: levelFromXp(xp),
    gamesPlayed: Math.max(profile.gamesPlayed, server.games),
    streakDays: adoptStreak ? streak : profile.streakDays,
    lastPlayedAt: adoptStreak && lastActive ? lastActive.toISOString() : profile.lastPlayedAt,
    unlockedAchievements: [...new Set([...profile.unlockedAchievements, ...server.achievements.filter((id) => Boolean(getAchievement(id)))])],
    archive: merged,
  };
  await saveProfile(updated);
  emitAppEvent({ type: 'progress' });
  return updated;
}

export const PROFILE_KEYS = [PROFILE_KEY, RESULTS_KEY];
