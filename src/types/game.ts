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
  | 'puzzle'
  | 'runner';

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
  | 'unit-order'
  | 'port-match'
  | 'device-role'
  | 'wifi-safe'
  | 'acronym';

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
  | 'burst-master'
  | 'runner-rookie'
  | 'runner-courier'
  | 'data-collector'
  | 'memory-ace'
  | 'puzzle-fan'
  | 'all-rounder'
  | 'burst-flawless'
  | 'daily-seven';

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
  // Desde cuándo se calcula la baja de ánimo de Rutix (cada día ya descontado mueve esta fecha).
  moodAt?: string | null;
  unlockedAchievements: string[];
  // Partidas completadas en total (el historial guarda solo las últimas 200).
  gamesPlayed: number;
  // Resultados ya sumados al perfil, por id: el mismo resultado nunca cuenta dos veces.
  appliedResults?: string[];
  // Resumen de las partidas que ya salieron del historial (ver lib/progressStats).
  archive?: unknown;
}

export interface GameResult {
  // Identificador de la partida. Con él, guardar dos veces el mismo resultado (doble toque, reintento
  // tras un error, pantalla que se vuelve a montar) suma una sola vez.
  id?: string;
  // XP que entregó (se guarda junto al resultado).
  xp?: number;
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
  // El resultado ya estaba guardado: no sumó de nuevo.
  alreadyRecorded?: boolean;
  // Se entregó el bono pedido (por ejemplo, el del desafío diario).
  bonusGranted?: boolean;
}

