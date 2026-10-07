import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';
import { concatBytes, fromBase64, toBase64, utf8Decode, utf8Encode } from '@/realtime/bytes';
import { randomBytes } from '@/realtime/crypto';

// Almacén cifrado para secretos (llaves de la ruta, credenciales de la cuenta).
// Los datos viven en AsyncStorage solo como texto cifrado; la llave maestra queda fuera de él:
// - Android/iOS: en el llavero del sistema (expo-secure-store, Keystore / Keychain).
// - Web: CryptoKey AES-GCM no exportable guardada en IndexedDB (ningún script puede leerla).
// - Sin ninguno de los dos (o si fallan): llave en memoria, válida solo durante la sesión. En ese modo
//   lo guardado NO sobrevive a cerrar la app: quien necesita durabilidad (la cuenta) lo consulta antes
//   con `vaultIsDurable()` y no promete nada que no pueda cumplir.

const MASTER_KEY_NAME = 'soytel.vault.v1';
const SEALED_PREFIX = 'sv1:';
const IDB_NAME = 'soytel-vault';
const IDB_STORE = 'keys';
const IDB_KEY = 'master';

interface Cipher {
  kind: 'secure-store' | 'webcrypto' | 'memory';
  seal(plain: Uint8Array): Promise<Uint8Array>;
  open(sealed: Uint8Array): Promise<Uint8Array | null>;
}

function secretboxCipher(key: Uint8Array, kind: Cipher['kind']): Cipher {
  return {
    kind,
    async seal(plain) {
      const nonce = randomBytes(nacl.secretbox.nonceLength);
      return concatBytes(nonce, nacl.secretbox(plain, nonce, key));
    },
    async open(sealed) {
      const nonceLength = nacl.secretbox.nonceLength;
      if (sealed.length <= nonceLength + nacl.secretbox.overheadLength) return null;
      return nacl.secretbox.open(sealed.subarray(nonceLength), sealed.subarray(0, nonceLength), key);
    },
  };
}

async function secureStoreCipher(): Promise<Cipher | null> {
  if (Platform.OS === 'web' || !(await SecureStore.isAvailableAsync().catch(() => false))) return null;
  let stored = await SecureStore.getItemAsync(MASTER_KEY_NAME);
  if (!stored) {
    stored = toBase64(randomBytes(nacl.secretbox.keyLength));
    await SecureStore.setItemAsync(MASTER_KEY_NAME, stored, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
  }
  const key = fromBase64(stored);
  return key.length === nacl.secretbox.keyLength ? secretboxCipher(key, 'secure-store') : null;
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openVaultDb(factory: IDBFactory): Promise<IDBDatabase> {
  const request = factory.open(IDB_NAME, 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(IDB_STORE)) request.result.createObjectStore(IDB_STORE);
  };
  return idbRequest(request);
}

async function webCryptoKey(subtle: SubtleCrypto, factory: IDBFactory): Promise<CryptoKey> {
  const db = await openVaultDb(factory);
  try {
    const read = () => idbRequest<CryptoKey | undefined>(db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(IDB_KEY));
    const existing = await read();
    if (existing) return existing;
    const created = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    try {
      // add() falla si otra pestaña ganó la carrera: en ese caso se usa la llave que ya quedó guardada.
      await idbRequest(db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).add(created, IDB_KEY));
      return created;
    } catch {
      const winner = await read();
      if (winner) return winner;
      throw new Error('vault-key-unavailable');
    }
  } finally {
    db.close();
  }
}

async function webCipher(): Promise<Cipher | null> {
  const scope = globalThis as { crypto?: Crypto; indexedDB?: IDBFactory };
  const subtle = scope.crypto?.subtle;
  const factory = scope.indexedDB;
  if (Platform.OS !== 'web' || !subtle || !factory) return null;
  const key = await webCryptoKey(subtle, factory);
  return {
    kind: 'webcrypto',
    async seal(plain) {
      const iv = randomBytes(12);
      const cipher = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plain as BufferSource));
      return concatBytes(iv, cipher);
    },
    async open(sealed) {
      if (sealed.length <= 12 + 16) return null;
      try {
        const plain = await subtle.decrypt({ name: 'AES-GCM', iv: sealed.subarray(0, 12) as BufferSource }, key, sealed.subarray(12) as BufferSource);
        return new Uint8Array(plain);
      } catch {
        return null;
      }
    },
  };
}

// No se puede guardar sin destruir algo que quizá se pueda recuperar: hay datos cifrados con la llave
// del sistema y en este momento esa llave no está disponible.
export class VaultUnavailableError extends Error {
  constructor() {
    super('vault-unavailable');
    this.name = 'VaultUnavailableError';
  }
}

// Cuánto se espera antes de volver a probar el llavero del sistema cuando falló (pudo ser temporal:
// el teléfono aún bloqueado tras reiniciar, el navegador negando el acceso un momento).
const PROVIDER_RETRY_MS = 15_000;

let cipherPromise: Promise<Cipher> | null = null;
// La llave de sesión es una sola mientras dure el proceso: lo escrito con ella se puede volver a leer.
let memoryCipher: Cipher | null = null;
let retryAt = 0;

function sessionCipher(): Cipher {
  if (!memoryCipher) memoryCipher = secretboxCipher(randomBytes(nacl.secretbox.keyLength), 'memory');
  return memoryCipher;
}

function getCipher(): Promise<Cipher> {
  if (cipherPromise && retryAt > 0 && Date.now() >= retryAt) cipherPromise = null;
  if (!cipherPromise) {
    cipherPromise = (async () => {
      try {
        const cipher = (await secureStoreCipher()) ?? (await webCipher());
        retryAt = 0;
        if (cipher) return cipher;
      } catch {
        // Llavero no disponible ahora (equipo sin bloqueo, modo privado del navegador…): se usa la
        // llave de sesión y se vuelve a probar más tarde.
        retryAt = Date.now() + PROVIDER_RETRY_MS;
      }
      return sessionCipher();
    })();
  }
  return cipherPromise;
}

export async function vaultKind(): Promise<Cipher['kind']> {
  return (await getCipher()).kind;
}

// ¿Lo que se guarde ahora seguirá ahí al reabrir la app?
export async function vaultIsDurable(): Promise<boolean> {
  return (await vaultKind()) !== 'memory';
}

export function isSealed(raw: string | null): boolean {
  return Boolean(raw && raw.startsWith(SEALED_PREFIX));
}

export async function sealText(text: string): Promise<string> {
  const cipher = await getCipher();
  return SEALED_PREFIX + toBase64(await cipher.seal(utf8Encode(text)));
}

export async function openText(raw: string): Promise<string | null> {
  if (!isSealed(raw)) return null;
  try {
    const plain = await (await getCipher()).open(fromBase64(raw.slice(SEALED_PREFIX.length)));
    return plain ? utf8Decode(plain) : null;
  } catch {
    return null;
  }
}

// Con la llave de sesión no se pisa un valor cifrado con otra llave: puede ser lo guardado con el
// llavero del sistema, que volverá a leerse cuando el llavero responda.
async function assertReplaceable(key: string): Promise<void> {
  if ((await getCipher()).kind !== 'memory') return;
  const current = await AsyncStorage.getItem(key).catch(() => null);
  if (current && isSealed(current) && (await openText(current)) === null) throw new VaultUnavailableError();
}

// Guarda un valor JSON cifrado.
export async function vaultSet(key: string, value: unknown): Promise<void> {
  await assertReplaceable(key);
  await AsyncStorage.setItem(key, await sealText(JSON.stringify(value)));
}

// Lee un valor cifrado. Si encuentra el formato antiguo (JSON en claro), lo cifra en el acto.
export async function vaultGet<T>(key: string): Promise<T | null> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  if (isSealed(raw)) {
    const text = await openText(raw);
    if (text === null) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }
  try {
    const legacy = JSON.parse(raw) as T;
    await vaultSet(key, legacy);
    return legacy;
  } catch {
    return null;
  }
}

export async function vaultRemove(...keys: string[]): Promise<void> {
  if (keys.length) await AsyncStorage.multiRemove(keys);
}

// Prepara pares [clave, valor cifrado] para escribirlos junto a otros en un multiSet.
export async function vaultEntry(key: string, value: unknown): Promise<[string, string]> {
  await assertReplaceable(key);
  return [key, await sealText(JSON.stringify(value))];
}

// Solo para pruebas: olvida la llave en memoria (como al cerrar y volver a abrir la app).
export function resetVaultForTests(): void {
  cipherPromise = null;
  memoryCipher = null;
  retryAt = 0;
}
