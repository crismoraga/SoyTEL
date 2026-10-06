import type { MedallionGlyph } from '@/graphics/medallions';
import type { Tier } from '@/theme/colors';

export type KnowledgeArea = 'redes' | 'software' | 'hardware' | 'teleco' | 'seguridad';

export type GameId =
  | 'burst'
  | 'millionaire'
  | 'practice'
  | 'journey'
  | 'story'
  | 'mascot'
  | 'route'
  | 'station'
  | 'puzzle';

export type MicroGameId =
  | 'connect-network'
  | 'clean-signal'
  | 'ping-check'
  | 'color-code'
  | 'firewall'
  | 'signal-timing'
  | 'sequence-memory'
  | 'packet-rush'
  | 'cable-connect'
  | 'packet-catch'
  | 'wifi-boost'
  | 'password-strong'
  | 'binary-bits'
  | 'layer-order'
  | 'ip-valid'
  | 'fast-route'
  | 'safe-url'
  | 'unit-order';

export type AchievementId =
  | 'first-signal'
  | 'burst-starter'
  | 'quiz-bronze'
  | 'route-complete'
  | 'route-podium'
  | 'route-champion'
  | 'temple-restored'
  | 'station-explorer'
  | 'perfect-run'
  | 'level-five'
  | 'signal-restored'
  | 'rutix-friend'
  | 'career-explorer'
  | 'burst-collector'
  | 'quiz-master'
  | 'streak-three'
  | 'security-guard'
  | 'level-ten'
  | 'net-architect'
  | 'binary-brain'
  | 'code-breaker'
  | 'daily-three'
  | 'burst-master';

export interface Achievement {
  id: AchievementId;
  title: string;
  description: string;
  hint: string;
  area: KnowledgeArea | 'general';
  tier: Tier;
  threshold: number;
  glyph: MedallionGlyph;
}

export interface UserProfile {
  alias: string;
  // Índice del avatar elegido (ver data/avatars).
  avatar: number;
  createdAt: string;
  xp: number;
  level: number;
  streakDays: number;
  lastPlayedAt: string | null;
  mascotMood: number;
  unlockedAchievements: string[];
  // Partidas completadas en total (el historial guarda solo las últimas 200).
  gamesPlayed: number;
}

export interface GameResult {
  gameId: GameId | MicroGameId;
  score: number;
  accuracy: number;
  durationSeconds: number;
  completedAt: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface GameOutcome {
  profile: UserProfile;
  xpGained: number;
  leveledUp: boolean;
  newAchievements: AchievementId[];
}

