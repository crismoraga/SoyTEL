import type { MedallionGlyph } from '@/graphics/medallions';
import type { Tier } from '@/theme/colors';

export type KnowledgeArea = 'redes' | 'software' | 'hardware' | 'teleco' | 'seguridad';

export type GameId =
  | 'burst'
  | 'millionaire'
  | 'practice'
  | 'journey'
  | 'story'
  | 'mascot';

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
  | 'password-strong';

export type AchievementId =
  | 'first-signal'
  | 'burst-starter'
  | 'quiz-bronze'
  | 'journey-host'
  | 'perfect-run'
  | 'level-five'
  | 'signal-restored'
  | 'telix-friend'
  | 'career-explorer'
  | 'burst-collector'
  | 'quiz-master'
  | 'streak-three'
  | 'security-guard'
  | 'level-ten';

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
  createdAt: string;
  xp: number;
  level: number;
  streakDays: number;
  lastPlayedAt: string | null;
  mascotMood: number;
  unlockedAchievements: string[];
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

export interface JourneyParticipant {
  id: string;
  alias: string;
  score: number;
  checkpoint: number;
}

export interface JourneySession {
  id: string;
  code: string;
  createdAt: string;
  status: 'lobby' | 'running' | 'finished';
  participants: JourneyParticipant[];
}
