import { achievements } from '@/data/achievements';
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
    case 'journey-host':
      return results.filter((result) => result.gameId === 'journey').length;
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
      return new Set(wonMicroGames(results)).size;
    case 'telix-friend':
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
