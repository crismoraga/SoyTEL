import { achievements } from '@/data/achievements';
import { dailyDays } from '@/features/burst/daily';
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

// Rutas jugadas hasta el final de la trivia (cerrar la ruta antes de tiempo no cuenta).
function completedRoutes(results: GameResult[]): GameResult[] {
  return results.filter((result) => result.gameId === 'route' && result.metadata?.completed === true);
}

// Rutas en vivo con grupo (el modo individual no cuenta para el podio).
function liveRoutes(results: GameResult[]): GameResult[] {
  return completedRoutes(results).filter((result) => result.metadata?.solo !== true && Number(result.metadata?.players ?? 0) >= 3);
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

function runnerRuns(results: GameResult[]): GameResult[] {
  return results.filter((result) => result.gameId === 'runner');
}

// Valor actual de cada logro (se compara con su umbral). Función pura y testeable.
export function achievementProgress(id: AchievementId, context: AchievementContext): number {
  const { profile, results, mascotDays, careerAreas } = context;
  switch (id) {
    case 'first-signal':
      return Math.min(1, results.length);
    case 'burst-starter':
      return results.filter((result) => result.gameId === 'burst').length;
    case 'quiz-bronze':
      return results
        .filter((result) => result.gameId === 'millionaire')
        .reduce((total, result) => total + Number(result.metadata?.correctAnswers ?? 0), 0);
    case 'career-explorer':
      return careerAreas;
    case 'route-complete':
      return completedRoutes(results).length;
    case 'temple-restored':
      return completedRoutes(results).some((result) => Number(result.metadata?.pillars ?? 0) >= 5) ? 1 : 0;
    case 'route-podium':
      return liveRoutes(results).some((result) => Number(result.metadata?.rank ?? 99) <= 3) ? 1 : 0;
    case 'route-champion':
      return liveRoutes(results).some((result) => Number(result.metadata?.rank ?? 99) === 1) ? 1 : 0;
    case 'station-explorer':
      return playedStations(results).length;
    case 'streak-three':
      return profile.streakDays;
    case 'security-guard':
      return wonMicroGames(results).filter((game) => SECURITY_GAMES.includes(game)).length;
    case 'perfect-run':
      return results.some((result) => (result.gameId === 'burst' || result.gameId === 'millionaire') && result.accuracy >= 1) ? 1 : 0;
    case 'level-five':
    case 'level-ten':
      return profile.level;
    case 'signal-restored':
      return results
        .filter((result) => result.gameId === 'story')
        .reduce((max, result) => Math.max(max, Number(result.metadata?.chapter ?? 0)), 0);
    case 'burst-collector':
    case 'burst-master':
      return new Set(wonMicroGames(results)).size;
    case 'net-architect':
      return puzzleLevels(results, 'red');
    case 'binary-brain':
      return puzzleLevels(results, 'binario');
    case 'code-breaker':
      return puzzleLevels(results, 'cifrado');
    case 'daily-three':
      return dailyDays(results);
    case 'runner-rookie':
    case 'runner-courier':
      return runnerRuns(results).reduce((max, result) => Math.max(max, Number(result.metadata?.distance ?? 0)), 0);
    case 'data-collector':
      return runnerRuns(results).reduce((total, result) => total + Number(result.metadata?.data ?? 0), 0);
    case 'rutix-friend':
      return mascotDays;
    case 'quiz-master':
      return results.some((result) => result.gameId === 'millionaire' && Number(result.metadata?.correctAnswers ?? 0) >= 10) ? 1 : 0;
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
