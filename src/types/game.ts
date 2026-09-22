export type KnowledgeArea = 'redes' | 'software' | 'hardware' | 'teleco' | 'seguridad';

export type GameId =
  | 'burst'
  | 'millionaire'
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
  | 'packet-rush';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  area: KnowledgeArea | 'general';
  tier: 'bronce' | 'plata' | 'oro' | 'platino';
  threshold: number;
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
