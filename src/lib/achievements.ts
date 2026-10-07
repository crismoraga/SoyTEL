import { achievements } from '@/data/achievements';
import { combineStats, parseStats, summarize, type ProgressStats } from '@/lib/progressStats';
import type { AchievementId, GameResult, MicroGameId, UserProfile } from '@/types/game';

export interface AchievementContext {
  profile: UserProfile;
  results: GameResult[];
  mascotDays: number;
  careerAreas: number;
}

const SECURITY_GAMES: MicroGameId[] = ['firewall', 'password-strong'];

export function wonMicroGames(results: GameResult[]): MicroGameId[] {
  return results
    .filter((result) => result.gameId === 'burst' && typeof result.metadata?.won === 'string')
    .flatMap((result) => String(result.metadata?.won).split(',').filter(Boolean)) as MicroGameId[];
}

export function playedStations(results: GameResult[]): string[] {
  const games = new Set<string>();
  results.forEach((result) => {
    if (result.gameId === 'station' && typeof result.metadata?.game === 'string') games.add(result.metadata.game);
    if (result.gameId === 'route') {
      if (Number(result.metadata?.pillars ?? 0) >= 5) ['datos', 'software', 'redes', 'teleco', 'hardware'].forEach((id) => games.add(id));
      games.add('red-b215');
    }
  });
  return [...games];
}

// Niveles distintos resueltos de un desafío sin reloj.
export function puzzleLevels(results: GameResult[], game: string): number {
  return new Set(results.filter((result) => result.gameId === 'puzzle' && result.metadata?.game === game).map((result) => Number(result.metadata?.level ?? 0))).size;
}

// Modos que cuentan para "Prueba de todo".
const PLAY_MODES: string[] = ['burst', 'runner', 'puzzle', 'station', 'route', 'millionaire', 'story', 'practice'];

const statsCache = new WeakMap<AchievementContext, ProgressStats>();

// Progreso acumulado: lo que ya salió del historial (guardado en el perfil) más las partidas recientes.
export function contextStats(context: AchievementContext): ProgressStats {
  const cached = statsCache.get(context);
  if (cached) return cached;
  const stats = combineStats(parseStats(context.profile.archive), summarize(context.results));
  statsCache.set(context, stats);
  return stats;
}

const own = <T,>(map: Record<string, T>, key: string): T | undefined => (Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined);

// Valor actual de cada logro (se compara con su umbral). Función pura y testeable.
export function achievementProgress(id: AchievementId, context: AchievementContext): number {
  const { profile, mascotDays, careerAreas } = context;
  const stats = contextStats(context);
  const levels = (game: string) => own(stats.puzzleLevels, game)?.length ?? 0;
  switch (id) {
    case 'first-signal':
      return Math.min(1, stats.total);
    case 'burst-starter':
      return own(stats.byMode, 'burst') ?? 0;
    case 'quiz-bronze':
      return stats.millionaireCorrect;
    case 'career-explorer':
      return careerAreas;
    case 'route-complete':
      return stats.routesCompleted;
    case 'temple-restored':
      return stats.templeRestored ? 1 : 0;
    case 'route-podium':
      return stats.liveBestRank !== null && stats.liveBestRank <= 3 ? 1 : 0;
    case 'route-champion':
      return stats.liveBestRank === 1 ? 1 : 0;
    case 'station-explorer':
      return stats.stations.length;
    case 'streak-three':
      return profile.streakDays;
    case 'security-guard':
      return SECURITY_GAMES.reduce((sum, game) => sum + (own(stats.microWins, game) ?? 0), 0);
    case 'perfect-run':
      return stats.perfectRun ? 1 : 0;
    case 'level-five':
    case 'level-ten':
      return profile.level;
    case 'signal-restored':
      return stats.storyChapter;
    case 'burst-collector':
    case 'burst-master':
      return Object.keys(stats.microWins).length;
    case 'net-architect':
      return levels('red');
    case 'binary-brain':
      return levels('binario');
    case 'code-breaker':
      return levels('cifrado');
    case 'daily-three':
    case 'daily-seven':
      return stats.dailyDays.length;
    case 'memory-ace':
      return levels('memoria');
    case 'puzzle-fan':
      return Object.values(stats.puzzleLevels).reduce((sum, list) => sum + list.length, 0);
    case 'all-rounder':
      return PLAY_MODES.filter((mode) => (own(stats.byMode, mode) ?? 0) > 0).length;
    case 'burst-flawless':
      return stats.burstFlawless ? 1 : 0;
    case 'runner-rookie':
    case 'runner-courier':
      return stats.runnerDistance;
    case 'data-collector':
      return stats.runnerData;
    case 'rutix-friend':
      return mascotDays;
    case 'quiz-master':
      return stats.millionaireBest >= 10 ? 1 : 0;
    default:
      return 0;
  }
}

export function achievementRatio(id: AchievementId, context: AchievementContext): number {
  const achievement = achievements.find((item) => item.id === id);
  if (!achievement) return 0;
  return Math.min(1, achievementProgress(id, context) / achievement.threshold);
}

export function evaluateAchievements(context: AchievementContext): AchievementId[] {
  return achievements
    .filter((achievement) => achievementProgress(achievement.id, context) >= achievement.threshold)
    .map((achievement) => achievement.id);
}
