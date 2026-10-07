import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { emitAppEvent, onAppEvent } from '@/lib/events';
import { toBase64 } from '@/realtime/bytes';
import { randomBytes } from '@/realtime/crypto';
import { isSealed, vaultGet, vaultIsDurable, vaultSet } from '@/security/vault';
import { loadProgressSummary, loadProfile, mergeAccountProgress, updateIdentity } from '@/storage/profile';
import {
  ApiError,
  deleteMe,
  fetchMe,
  recoverAccount,
  registerPlayer,
  rotateRecoveryCode,
  syncProgress,
  updateMe,
  type AccountCredentials,
  type ProfilePayload,
  type RankInfo,
  type ServerPlayer,
} from './api';
import { cleanAlias, formatRecoveryCode, recoveryCodeFromBytes } from './rules';

// Cuenta opcional: registra el puntaje en el ranking global y permite recuperar el progreso en otro
// teléfono con un código. El token y el código viven cifrados en el dispositivo (security/vault).
//
// Reglas de este módulo:
// - Cada operación con el servidor anota con qué sesión partió. Si mientras esperaba la respuesta el
//   usuario salió de la cuenta, la borró o entró a otra, esa respuesta se descarta: nunca revive una
//   cuenta cerrada ni mezcla datos de una cuenta con otra.
// - Lo que se guarda en el teléfono se escribe en orden, siempre con el estado del momento.
// - Las credenciales se generan aquí y se guardan antes de enviarlas: una respuesta perdida no deja
//   una cuenta sin dueño.

const ACCOUNT_KEY = '@soytel/account';
// Credenciales de un alta o de una recuperación que todavía no se confirma.
const PENDING_SIGNUP_KEY = '@soytel/account-signup';
const PENDING_RECOVER_KEY = '@soytel/account-recover';
// Cuándo se descartó por última vez la invitación a crear cuenta.
const OFFER_KEY = '@soytel/account-offer';
// Tras un "ahora no", la invitación descansa medio día (aunque la app se cierre o se reinicie).
export const OFFER_SNOOZE_MS = 12 * 60 * 60 * 1000;
const PENDING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// Espera antes de reintentar una sincronización que no llegó al servidor (cada vez más espaciada).
const RETRY_MS = [5_000, 15_000, 45_000, 120_000, 300_000];
const RATE_LIMIT_RETRY_MS = 65_000;

export type AccountStatus = 'loading' | 'guest' | 'registered' | 'expired';

interface StoredAccount {
  token: string;
  recoveryCode: string | null;
  player: ServerPlayer;
  rank: RankInfo | null;
  lastSyncAt: string | null;
  // Alias o avatar cambiados en el teléfono que el servidor todavía no tiene.
  identityDirty?: boolean;
  // Código de recuperación nuevo enviado al servidor y aún sin confirmar.
  pendingRecoveryCode?: string;
}

interface PendingSignup extends AccountCredentials {
  createdAt: number;
}

interface PendingRecover {
  code: string;
  token: string;
  createdAt: number;
}

export interface AccountView {
  status: AccountStatus;
  player: ServerPlayer | null;
  rank: RankInfo | null;
  recoveryCode: string | null;
  lastSyncAt: string | null;
  syncing: boolean;
  syncError: string | null;
  // La invitación a crear cuenta se descartó hace poco.
  offerDismissed: boolean;
}

// Este dispositivo no puede guardar la cuenta de forma que sobreviva a cerrar la app (por ejemplo, una
// ventana privada del navegador). No se crea ni se recupera una cuenta que se perdería al salir.
export class AccountStorageError extends Error {
  constructor() {
    super('Este navegador no puede guardar tu cuenta de forma segura (¿es una ventana privada?). Ábrelo en una ventana normal o usa la app, y vuelve a intentarlo. Mientras tanto puedes jugar igual.');
    this.name = 'AccountStorageError';
  }
}

let stored: StoredAccount | null = null;
let status: AccountStatus = 'loading';
let syncing = false;
let syncAgain = false;
let syncFailures = 0;
let syncError: string | null = null;
let gateDismissed = false;
let view: AccountView = buildView();
const listeners = new Set<() => void>();
let initPromise: Promise<void> | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
// Sesión vigente: cambia al entrar, salir o vencer la cuenta.
let epoch = 0;
// Versión de la identidad local (alias y avatar): sube con cada cambio hecho en este teléfono.
let identityRev = 0;
let creating: Promise<string> | null = null;
let restoring: { code: string; promise: Promise<ServerPlayer> } | null = null;
let restoreAttempt = 0;

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

// Escrituras en orden: cada una guarda (o borra) lo que la cuenta sea en ese momento, así una
// escritura pedida antes nunca llega después de un borrado.
let writes: Promise<void> = Promise.resolve();

function persist(): Promise<void> {
  const run = async () => {
    if (stored) await vaultSet(ACCOUNT_KEY, stored);
    else await AsyncStorage.removeItem(ACCOUNT_KEY);
  };
  writes = writes.then(run, run);
  return writes;
}

interface Session {
  epoch: number;
  token: string;
}

function session(): Session | null {
  return stored && status === 'registered' ? { epoch, token: stored.token } : null;
}

const isCurrent = (given: Session) => given.epoch === epoch && stored !== null;

function newToken(): string {
  return toBase64(randomBytes(32)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function newRecoveryCode(): string {
  return recoveryCodeFromBytes(randomBytes(12));
}

async function assertDurable(): Promise<void> {
  if (!(await vaultIsDurable())) throw new AccountStorageError();
}

export function initAccount(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      stored = await vaultGet<StoredAccount>(ACCOUNT_KEY);
      if (!stored) {
        const dismissedAt = Number(await AsyncStorage.getItem(OFFER_KEY).catch(() => null));
        gateDismissed = gateDismissed || isOfferSnoozed(dismissedAt);
      }
      status = stored ? 'registered' : 'guest';
      emit();
      // Cada partida o logro nuevo se sube en segundo plano.
      onAppEvent((event) => {
        if (event.type === 'progress') scheduleSync();
      });
      watchConnectivity();
      if (stored) {
        scheduleSync(800);
      } else {
        void recoverLockedAccount();
        void resumePendingSignup();
      }
    })();
  }
  return initPromise;
}

// Hay una cuenta guardada que ahora no se pudo leer (el llavero del sistema no respondió): se vuelve a
// intentar un rato en vez de tratar al usuario como invitado para siempre.
async function recoverLockedAccount(attempt = 0): Promise<void> {
  const raw = await AsyncStorage.getItem(ACCOUNT_KEY).catch(() => null);
  if (!raw || !isSealed(raw) || attempt >= 4) return;
  const mine = epoch;
  await new Promise((resolve) => setTimeout(resolve, 16_000));
  if (epoch !== mine || stored) return;
  const found = await vaultGet<StoredAccount>(ACCOUNT_KEY);
  if (epoch !== mine || stored) return;
  if (!found) {
    void recoverLockedAccount(attempt + 1);
    return;
  }
  stored = found;
  status = 'registered';
  epoch += 1;
  emit();
  scheduleSync(800);
}

// Al volver la red (o la app al primer plano), lo que quedó sin subir se envía.
function watchConnectivity(): void {
  const retry = () => {
    if (stored && status === 'registered' && (syncError !== null || stored.identityDirty)) scheduleSync(500);
  };
  AppState.addEventListener('change', (state) => {
    if (state === 'active') retry();
  });
  if (Platform.OS === 'web') (globalThis as { addEventListener?: (type: string, listener: () => void) => void }).addEventListener?.('online', retry);
}

// El token dejó de valer (la cuenta se abrió en otro teléfono o se eliminó). Solo cuenta si la
// respuesta es de la sesión vigente: un 401 tardío de una cuenta anterior no vence la actual.
function handleAuthError(error: unknown, given: Session): boolean {
  if (!(error instanceof ApiError) || error.status !== 401) return false;
  if (isCurrent(given)) {
    status = 'expired';
    epoch += 1;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = null;
    emit();
  }
  return true;
}

async function adopt(token: string, player: ServerPlayer, rank: RankInfo | null, recoveryCode: string | null) {
  epoch += 1;
  stored = { token, recoveryCode, player, rank, lastSyncAt: new Date().toISOString() };
  status = 'registered';
  syncError = null;
  syncFailures = 0;
  emit();
  await persist();
}

// ¿El perfil que quedó en el servidor es el que se pidió? (Tras repetir un alta cuya respuesta se
// perdió, el servidor devuelve la cuenta de la primera vez, con los datos de entonces.)
function profileDiffers(player: ServerPlayer, profile: ProfilePayload): boolean {
  return (
    (profile.alias !== undefined && cleanAlias(profile.alias) !== player.alias) ||
    (profile.avatar !== undefined && profile.avatar !== player.avatar) ||
    (profile.grade !== undefined && (profile.grade ?? null) !== player.grade) ||
    (profile.contactConsent !== undefined && profile.contactConsent !== player.contactConsent)
  );
}

async function readPending<T extends { createdAt: number }>(key: string): Promise<T | null> {
  const pending = await vaultGet<T>(key);
  if (!pending || typeof pending.createdAt !== 'number' || Date.now() - pending.createdAt > PENDING_MAX_AGE_MS) return null;
  return pending;
}

// Crea la cuenta con el progreso jugado hasta ahora. Devuelve el código de recuperación.
export function createAccount(profile: ProfilePayload): Promise<string> {
  // Un segundo toque mientras se crea espera el mismo intento.
  if (creating) return creating;
  creating = (async () => {
    await assertDurable();
    const mine = epoch;
    let pending = await readPending<PendingSignup>(PENDING_SIGNUP_KEY);
    for (let attempt = 0; ; attempt += 1) {
      if (!pending) {
        pending = { token: newToken(), recoveryCode: newRecoveryCode(), createdAt: Date.now() };
        // Guardadas antes de enviarlas: si la respuesta se pierde, se repite con las mismas.
        await vaultSet(PENDING_SIGNUP_KEY, pending);
      }
      try {
        const progress = await loadProgressSummary();
        const result = await registerPlayer(profile, progress, { token: pending.token, recoveryCode: pending.recoveryCode });
        if (epoch !== mine) throw new ApiError(0, 'stale', 'La cuenta de este dispositivo cambió mientras se creaba. Intenta de nuevo.');
        await adopt(pending.token, result.player, result.rank, pending.recoveryCode);
        await AsyncStorage.removeItem(PENDING_SIGNUP_KEY).catch(() => undefined);
        // Tareas que pueden fallar sin poner en riesgo la cuenta ya guardada.
        let player = result.player;
        if (profileDiffers(player, profile)) player = await editAccount(profile).catch(() => player);
        await updateIdentity({ alias: player.alias, avatar: player.avatar }).catch(() => undefined);
        return pending.recoveryCode;
      } catch (error) {
        // Otra cuenta ya usa esas credenciales (casi imposible): se generan otras y se reintenta una vez.
        if (error instanceof ApiError && error.code === 'credentials_conflict' && attempt === 0) {
          pending = null;
          continue;
        }
        throw error;
      }
    }
  })().finally(() => {
    creating = null;
  });
  return creating;
}

// Un alta quedó a medias (se cerró la app o se perdió la respuesta). Si el servidor alcanzó a crear la
// cuenta, este teléfono la toma; si no, se olvida el intento. Nunca crea una cuenta por su cuenta.
async function resumePendingSignup(): Promise<void> {
  const pending = await readPending<PendingSignup>(PENDING_SIGNUP_KEY);
  if (!pending) {
    await AsyncStorage.removeItem(PENDING_SIGNUP_KEY).catch(() => undefined);
    return;
  }
  const mine = epoch;
  try {
    const result = await fetchMe(pending.token);
    if (epoch !== mine || stored) return;
    await adopt(pending.token, result.player, result.rank, pending.recoveryCode);
    await AsyncStorage.removeItem(PENDING_SIGNUP_KEY).catch(() => undefined);
    emitAppEvent({ type: 'toast', title: 'Tu cuenta quedó creada', body: 'Recuperamos la cuenta que estabas creando. Guarda tu código en Perfil.' });
    scheduleSync(800);
  } catch (error) {
    // 401: el servidor nunca la creó. Sin conexión: se revisa la próxima vez que se abra la app.
    if (error instanceof ApiError && error.status === 401) await AsyncStorage.removeItem(PENDING_SIGNUP_KEY).catch(() => undefined);
  }
}

// Entra a una cuenta existente con su código (el teléfono anterior queda desconectado).
export function restoreAccount(rawCode: string): Promise<ServerPlayer> {
  const code = formatRecoveryCode(rawCode);
  // El mismo código enviado dos veces (doble Enter) es un solo intento.
  if (restoring && restoring.code === code) return restoring.promise;
  restoreAttempt += 1;
  const attempt = restoreAttempt;
  const promise = (async () => {
    await assertDurable();
    let pending = await readPending<PendingRecover>(PENDING_RECOVER_KEY);
    if (!pending || pending.code !== code) {
      pending = { code, token: newToken(), createdAt: Date.now() };
      await vaultSet(PENDING_RECOVER_KEY, pending);
    }
    const result = await recoverAccount(code, pending.token);
    // Un intento más nuevo (con otro código) ya tomó su lugar: esta respuesta no se usa.
    if (attempt !== restoreAttempt) throw new ApiError(0, 'stale', 'Se inició otro intento de recuperación.');
    await mergeAccountProgress(result.player);
    await adopt(result.token, result.player, result.rank, code);
    await AsyncStorage.removeItem(PENDING_RECOVER_KEY).catch(() => undefined);
    scheduleSync(300);
    return result.player;
  })().finally(() => {
    if (restoring?.promise === promise) restoring = null;
  });
  restoring = { code, promise };
  return promise;
}

export async function editAccount(patch: ProfilePayload): Promise<ServerPlayer> {
  const given = session();
  if (!given) throw new ApiError(401, 'unauthorized', 'No hay una cuenta en este dispositivo.');
  const sentRev = identityRev;
  try {
    const result = await updateMe(given.token, patch);
    // La cuenta cambió mientras llegaba la respuesta: no se aplica sobre la cuenta nueva.
    if (!isCurrent(given) || !stored) return result.player;
    const touchesIdentity = patch.alias !== undefined || patch.avatar !== undefined;
    // Solo deja de estar pendiente si nadie cambió la identidad después de enviar esta.
    const identityDirty = touchesIdentity && sentRev === identityRev ? false : stored.identityDirty;
    stored = { ...stored, player: result.player, rank: result.rank ?? stored.rank, identityDirty };
    emit();
    await persist();
    if (touchesIdentity && sentRev === identityRev) await updateIdentity({ alias: result.player.alias, avatar: result.player.avatar });
    return result.player;
  } catch (error) {
    handleAuthError(error, given);
    throw error;
  }
}

// Cambia alias/avatar en el perfil local y, si hay cuenta, también en el ranking.
export async function setIdentity(patch: { alias?: string; avatar?: number }): Promise<void> {
  await updateIdentity(patch);
  if (!stored || status !== 'registered') return;
  identityRev += 1;
  // Queda anotado como pendiente antes de enviarlo: si no hay red (o llega otra respuesta antes), no se pierde.
  stored = { ...stored, identityDirty: true };
  await persist();
  try {
    await editAccount(patch);
  } catch (error) {
    if (error instanceof ApiError && error.offline) {
      scheduleSync(RETRY_MS[0]);
      return;
    }
    // El servidor lo rechazó (no es un problema de red): no se reintenta solo.
    if (stored) {
      stored = { ...stored, identityDirty: false };
      await persist();
    }
    throw error;
  }
}

// Cambia el código de recuperación (por si el anterior quedó a la vista de alguien). El anterior deja
// de servir. Devuelve el nuevo.
export async function regenerateRecoveryCode(): Promise<string> {
  const given = session();
  if (!given || !stored) throw new ApiError(401, 'unauthorized', 'No hay una cuenta en este dispositivo.');
  await assertDurable();
  // Si un intento anterior no supo si llegó, se repite con el mismo código.
  const code = stored.pendingRecoveryCode ?? newRecoveryCode();
  stored = { ...stored, pendingRecoveryCode: code };
  await persist();
  try {
    await rotateRecoveryCode(given.token, code);
  } catch (error) {
    if (handleAuthError(error, given)) throw error;
    if (error instanceof ApiError && !error.offline && isCurrent(given) && stored) {
      // Rechazado por el servidor: ese código no quedó vigente.
      stored = { ...stored, pendingRecoveryCode: undefined };
      await persist();
    }
    throw error;
  }
  if (isCurrent(given) && stored) {
    stored = { ...stored, recoveryCode: code, pendingRecoveryCode: undefined };
    emit();
    await persist();
  }
  return code;
}

// Elimina la cuenta del servidor (y sus datos de contacto) y la olvida en este dispositivo.
export async function deleteAccount(): Promise<void> {
  const given = session() ?? (stored ? { epoch, token: stored.token } : null);
  if (given) {
    try {
      await deleteMe(given.token);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error;
    }
    // Mientras se eliminaba, este dispositivo ya pasó a otra cuenta: esa no se toca.
    if (!isCurrent(given)) return;
  }
  await forgetAccount();
}

// Cierra la sesión solo en este dispositivo (la cuenta sigue y se recupera con el código).
export async function forgetAccount(): Promise<void> {
  epoch += 1;
  stored = null;
  status = 'guest';
  syncError = null;
  syncFailures = 0;
  syncAgain = false;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = null;
  emit();
  await persist();
  await AsyncStorage.multiRemove([PENDING_SIGNUP_KEY, PENDING_RECOVER_KEY]).catch(() => undefined);
}

export async function refreshAccount(): Promise<void> {
  const given = session();
  if (!given) return;
  try {
    const result = await fetchMe(given.token);
    if (!isCurrent(given) || !stored) return;
    stored = { ...stored, player: result.player, rank: result.rank ?? stored.rank };
    emit();
    await persist();
  } catch (error) {
    handleAuthError(error, given);
  }
}

export function scheduleSync(delayMs = 2500): void {
  if (!stored || status !== 'registered') return;
  // Algo cambió mientras se sincronizaba: al terminar se sincroniza otra vez.
  if (syncing) syncAgain = true;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void syncNow();
  }, delayMs);
}

export async function syncNow(): Promise<void> {
  const given = session();
  if (!given) return;
  if (syncing) {
    syncAgain = true;
    return;
  }
  syncing = true;
  syncAgain = false;
  emit();
  let retryIn: number | null = null;
  try {
    if (stored?.identityDirty) {
      const sentRev = identityRev;
      const profile = await loadProfile();
      const result = await updateMe(given.token, { alias: profile.alias, avatar: profile.avatar });
      if (!isCurrent(given) || !stored) return;
      stored = { ...stored, player: result.player, identityDirty: sentRev === identityRev ? false : stored.identityDirty };
    }
    const progress = await loadProgressSummary();
    const result = await syncProgress(given.token, progress);
    if (!isCurrent(given) || !stored) return;
    stored = { ...stored, player: result.player, rank: result.rank ?? stored.rank, lastSyncAt: new Date().toISOString() };
    syncError = null;
    syncFailures = 0;
    await persist();
  } catch (error) {
    if (!isCurrent(given)) return;
    if (handleAuthError(error, given)) return;
    syncError = error instanceof Error ? error.message : 'No se pudo sincronizar.';
    const status429 = error instanceof ApiError && error.status === 429;
    const retryable = status429 || (error instanceof ApiError && (error.offline || error.status >= 500));
    if (retryable) {
      retryIn = status429 ? RATE_LIMIT_RETRY_MS : RETRY_MS[Math.min(syncFailures, RETRY_MS.length - 1)];
      syncFailures += 1;
    }
  } finally {
    syncing = false;
    if (isCurrent(given) && status === 'registered') {
      if (retryIn !== null) scheduleSync(retryIn);
      else if (syncAgain) scheduleSync(600);
    }
    syncAgain = false;
    emit();
  }
}

// Ventana "crea tu cuenta antes de jugar": se muestra a quien no tiene cuenta; si responde
// "ahora no", no vuelve a aparecer hasta medio día después.
export function isOfferSnoozed(dismissedAt: number, at = Date.now()): boolean {
  return dismissedAt > 0 && at - dismissedAt < OFFER_SNOOZE_MS;
}

export function shouldOfferAccount(): boolean {
  return status === 'guest' && !gateDismissed;
}

export function dismissAccountOffer(): void {
  gateDismissed = true;
  void AsyncStorage.setItem(OFFER_KEY, String(Date.now())).catch(() => undefined);
  emit();
}

// Borrado local completo (ajustes → borrar datos): olvida la cuenta sin eliminarla del servidor.
export async function resetAccountLocal(): Promise<void> {
  gateDismissed = false;
  await forgetAccount();
}

export const ACCOUNT_KEYS = [ACCOUNT_KEY, OFFER_KEY, PENDING_SIGNUP_KEY, PENDING_RECOVER_KEY];
