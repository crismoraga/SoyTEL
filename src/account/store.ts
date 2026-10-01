import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAppEvent } from '@/lib/events';
import { vaultGet, vaultSet } from '@/security/vault';
import { loadProgressSummary, loadProfile, mergeAccountProgress, updateIdentity } from '@/storage/profile';
import {
  ApiError,
  deleteMe,
  fetchMe,
  recoverAccount,
  registerPlayer,
  syncProgress,
  updateMe,
  type ProfilePayload,
  type RankInfo,
  type ServerPlayer,
} from './api';

// Cuenta opcional: registra el puntaje en el ranking global y permite recuperar el progreso en otro
// teléfono con un código. El token y el código viven cifrados en el dispositivo (security/vault).

const ACCOUNT_KEY = '@soytel/account';

export type AccountStatus = 'loading' | 'guest' | 'registered' | 'expired';

interface StoredAccount {
  token: string;
  recoveryCode: string | null;
  player: ServerPlayer;
  rank: RankInfo | null;
  lastSyncAt: string | null;
  // Alias o avatar cambiados sin conexión: se envían en la próxima sincronización.
  identityDirty?: boolean;
}

export interface AccountView {
  status: AccountStatus;
  player: ServerPlayer | null;
  rank: RankInfo | null;
  recoveryCode: string | null;
  lastSyncAt: string | null;
  syncing: boolean;
  syncError: string | null;
  // La invitación a crear cuenta ya se descartó en esta sesión.
  offerDismissed: boolean;
}

let stored: StoredAccount | null = null;
let status: AccountStatus = 'loading';
let syncing = false;
let syncError: string | null = null;
let gateDismissed = false;
let view: AccountView = buildView();
const listeners = new Set<() => void>();
let initPromise: Promise<void> | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

function buildView(): AccountView {
  return {
    status,
    player: stored?.player ?? null,
    rank: stored?.rank ?? null,
    recoveryCode: stored?.recoveryCode ?? null,
    lastSyncAt: stored?.lastSyncAt ?? null,
    syncing,
    syncError,
    offerDismissed: gateDismissed,
  };
}

function emit() {
  view = buildView();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAccount(): AccountView {
  return view;
}

export function useAccount(): AccountView {
  return useSyncExternalStore(subscribe, getAccount, getAccount);
}

export function getAccountToken(): string | null {
  return status === 'registered' ? (stored?.token ?? null) : null;
}

async function persist() {
  if (stored) await vaultSet(ACCOUNT_KEY, stored);
  else await AsyncStorage.removeItem(ACCOUNT_KEY);
}

export function initAccount(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      stored = await vaultGet<StoredAccount>(ACCOUNT_KEY);
      status = stored ? 'registered' : 'guest';
      emit();
      // Cada partida o logro nuevo se sube en segundo plano.
      onAppEvent((event) => {
        if (event.type === 'progress') scheduleSync();
      });
      if (stored) scheduleSync(800);
    })();
  }
  return initPromise;
}

function handleAuthError(error: unknown): boolean {
  if (error instanceof ApiError && error.status === 401 && stored) {
    // El token dejó de valer (la cuenta se abrió en otro teléfono o se eliminó).
    status = 'expired';
    emit();
    return true;
  }
  return false;
}

async function adopt(token: string, player: ServerPlayer, rank: RankInfo, recoveryCode: string | null) {
  stored = { token, recoveryCode, player, rank, lastSyncAt: new Date().toISOString() };
  status = 'registered';
  syncError = null;
  await persist();
  emit();
}

// Crea la cuenta con el progreso jugado hasta ahora. Devuelve el código de recuperación (se muestra una vez).
export async function createAccount(profile: ProfilePayload): Promise<string> {
  const progress = await loadProgressSummary();
  const result = await registerPlayer(profile, progress);
  await updateIdentity({ alias: result.player.alias, avatar: result.player.avatar });
  await adopt(result.token, result.player, result.rank, result.recoveryCode);
  return result.recoveryCode;
}

// Entra a una cuenta existente con su código (el teléfono anterior queda desconectado).
export async function restoreAccount(code: string): Promise<ServerPlayer> {
  const result = await recoverAccount(code);
  await mergeAccountProgress(result.player);
  await adopt(result.token, result.player, result.rank, code.toUpperCase());
  scheduleSync(300);
  return result.player;
}

export async function editAccount(patch: ProfilePayload): Promise<ServerPlayer> {
  if (!stored) throw new ApiError(401, 'unauthorized', 'No hay una cuenta en este dispositivo.');
  try {
    const result = await updateMe(stored.token, patch);
    stored = { ...stored, player: result.player, rank: result.rank, identityDirty: false };
    await persist();
    emit();
    if (patch.alias !== undefined || patch.avatar !== undefined) await updateIdentity({ alias: result.player.alias, avatar: result.player.avatar });
    return result.player;
  } catch (error) {
    handleAuthError(error);
    throw error;
  }
}

// Cambia alias/avatar en el perfil local y, si hay cuenta, también en el ranking.
export async function setIdentity(patch: { alias?: string; avatar?: number }): Promise<void> {
  await updateIdentity(patch);
  if (!stored || status !== 'registered') return;
  try {
    await editAccount(patch);
  } catch (error) {
    if (error instanceof ApiError && error.offline && stored) {
      stored = { ...stored, identityDirty: true };
      await persist();
      return;
    }
    throw error;
  }
}

// Elimina la cuenta del servidor (y sus datos de contacto) y la olvida en este dispositivo.
export async function deleteAccount(): Promise<void> {
  if (stored) {
    try {
      await deleteMe(stored.token);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error;
    }
  }
  await forgetAccount();
}

// Cierra la sesión solo en este dispositivo (la cuenta sigue y se recupera con el código).
export async function forgetAccount(): Promise<void> {
  stored = null;
  status = 'guest';
  syncError = null;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = null;
  await persist();
  emit();
}

export async function refreshAccount(): Promise<void> {
  if (!stored) return;
  try {
    const result = await fetchMe(stored.token);
    stored = { ...stored, player: result.player, rank: result.rank };
    await persist();
    emit();
  } catch (error) {
    handleAuthError(error);
  }
}

export function scheduleSync(delayMs = 2500): void {
  if (!stored || status !== 'registered') return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void syncNow();
  }, delayMs);
}

export async function syncNow(): Promise<void> {
  if (!stored || status !== 'registered' || syncing) return;
  syncing = true;
  emit();
  try {
    if (stored.identityDirty) {
      const profile = await loadProfile();
      const result = await updateMe(stored.token, { alias: profile.alias, avatar: profile.avatar });
      stored = { ...stored, player: result.player, identityDirty: false };
    }
    const progress = await loadProgressSummary();
    const result = await syncProgress(stored.token, progress);
    stored = { ...stored, player: result.player, rank: result.rank, lastSyncAt: new Date().toISOString() };
    syncError = null;
    await persist();
  } catch (error) {
    if (!handleAuthError(error)) syncError = error instanceof Error ? error.message : 'No se pudo sincronizar.';
  } finally {
    syncing = false;
    emit();
  }
}

// Ventana "crea tu cuenta antes de jugar": se muestra a quien no tiene cuenta, una vez por sesión.
export function shouldOfferAccount(): boolean {
  return status === 'guest' && !gateDismissed;
}

export function dismissAccountOffer(): void {
  gateDismissed = true;
  emit();
}

// Borrado local completo (ajustes → borrar datos): olvida la cuenta sin eliminarla del servidor.
export async function resetAccountLocal(): Promise<void> {
  gateDismissed = false;
  await forgetAccount();
}

export const ACCOUNT_KEYS = [ACCOUNT_KEY];
