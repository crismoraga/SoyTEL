import { apiBaseUrl } from '@/realtime/config';
import type { ContactKind, GradeId } from './rules';

// Cliente HTTP de la API de cuentas y ranking (api/v1 en Vercel).

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get offline(): boolean {
    return this.status === 0;
  }
}

export interface ServerPlayer {
  id: string;
  alias: string;
  avatar: number;
  grade: GradeId | null;
  school: string | null;
  contact: { kind: ContactKind; value: string } | null;
  contactConsent: boolean;
  guardianConsent: boolean;
  xp: number;
  level: number;
  games: number;
  streak: number;
  bestRoute: number;
  routes: number;
  achievements: string[];
  hidden: boolean;
  createdAt: string;
}

export interface RankInfo {
  rank: number;
  total: number;
}

export interface LeaderboardEntry {
  rank: number;
  alias: string;
  avatar: number;
  level: number;
  xp: number;
  me: boolean;
}

export interface Leaderboard {
  total: number;
  top: LeaderboardEntry[];
  me: LeaderboardEntry | null;
  updatedAt: string;
}

export interface ProfilePayload {
  alias?: string;
  avatar?: number;
  grade?: GradeId | null;
  school?: string | null;
  contact?: { kind: ContactKind; value: string } | null;
  contactConsent?: boolean;
  guardianConsent?: boolean;
}

export interface ProgressPayload {
  xp: number;
  games: number;
  streak: number;
  bestRoute: number;
  routes: number;
  achievements: string[];
}

const TIMEOUT_MS = 12_000;

async function request<T>(path: string, options: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, 'offline', 'Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.');
  } finally {
    clearTimeout(timer);
  }
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const error = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(response.status, error?.code ?? 'error', error?.message ?? 'No se pudo completar la solicitud.');
  }
  // Una respuesta que no es JSON (p. ej. la página web en vez de la API) cuenta como servidor no disponible.
  if (data === null || typeof data !== 'object') throw new ApiError(0, 'bad_response', 'El servidor no está disponible en este momento. Intenta más tarde.');
  return data as T;
}

export function registerPlayer(profile: ProfilePayload, progress: ProgressPayload) {
  return request<{ token: string; recoveryCode: string; player: ServerPlayer; rank: RankInfo }>('/players', {
    method: 'POST',
    body: { profile, progress },
  });
}

export function fetchMe(token: string) {
  return request<{ player: ServerPlayer; rank: RankInfo }>('/me', { token });
}

export function updateMe(token: string, profile: ProfilePayload) {
  return request<{ player: ServerPlayer; rank: RankInfo }>('/me', { method: 'PATCH', body: profile, token });
}

export function deleteMe(token: string) {
  return request<{ deleted: boolean }>('/me', { method: 'DELETE', token });
}

export function syncProgress(token: string, progress: ProgressPayload) {
  return request<{ player: ServerPlayer; rank: RankInfo; clamped: boolean }>('/sync', { method: 'POST', body: { progress }, token });
}

export function recoverAccount(code: string) {
  return request<{ token: string; player: ServerPlayer; rank: RankInfo }>('/recover', { method: 'POST', body: { code } });
}

export function fetchLeaderboard(token: string | null, limit = 50) {
  return request<Leaderboard>(`/leaderboard?limit=${limit}`, { token });
}
