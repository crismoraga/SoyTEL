import { getRandomBytes } from 'expo-crypto';
import nacl from 'tweetnacl';
import { concatBytes, fromBase64, toBase64, toHex, utf8Decode, utf8Encode } from './bytes';

// Cifrado de la ruta: los mensajes viajan por un broker MQTT público, así que todo va sellado.
// - box (X25519 + XSalsa20-Poly1305) para el saludo participante ↔ anfitrión.
// - secretbox con la llave de sesión para acciones y estado.
// - firma Ed25519 del anfitrión sobre cada estado publicado.

let prngReady = false;

export function ensurePrng(): void {
  if (prngReady) return;
  const webCrypto = (globalThis as { crypto?: { getRandomValues?: unknown } }).crypto;
  if (!webCrypto || typeof webCrypto.getRandomValues !== 'function') {
    nacl.setPRNG((target, length) => {
      const bytes = getRandomBytes(length);
      for (let i = 0; i < length; i += 1) target[i] = bytes[i];
    });
  }
  prngReady = true;
}

export interface KeyPair {
  publicKey: string;
  secretKey: string;
}

export interface Sealed {
  n: string;
  c: string;
}

export function randomBytes(length: number): Uint8Array {
  ensurePrng();
  return nacl.randomBytes(length);
}

export function randomHex(bytes: number): string {
  return toHex(randomBytes(bytes));
}

export function newBoxKeys(): KeyPair {
  ensurePrng();
  const pair = nacl.box.keyPair();
  return { publicKey: toBase64(pair.publicKey), secretKey: toBase64(pair.secretKey) };
}

export function newSignKeys(): KeyPair {
  ensurePrng();
  const pair = nacl.sign.keyPair();
  return { publicKey: toBase64(pair.publicKey), secretKey: toBase64(pair.secretKey) };
}

export function newSessionKey(): string {
  return toBase64(randomBytes(nacl.secretbox.keyLength));
}

export function sealTo(message: string, recipientPublicKey: string, senderSecretKey: string): Sealed {
  const nonce = randomBytes(nacl.box.nonceLength);
  const cipher = nacl.box(utf8Encode(message), nonce, fromBase64(recipientPublicKey), fromBase64(senderSecretKey));
  return { n: toBase64(nonce), c: toBase64(cipher) };
}

export function openFrom(sealed: Sealed, senderPublicKey: string, recipientSecretKey: string): string | null {
  try {
    const plain = nacl.box.open(fromBase64(sealed.c), fromBase64(sealed.n), fromBase64(senderPublicKey), fromBase64(recipientSecretKey));
    return plain ? utf8Decode(plain) : null;
  } catch {
    return null;
  }
}

// Llave compartida entre dos pares de llaves (X25519). Calcularla es lo caro de `box`: se guarda
// para que los mensajes siguientes entre los mismos dos dispositivos solo paguen el cifrado simétrico.
const pairKeys = new Map<string, string>();
const PAIR_CACHE_LIMIT = 256;

export function pairKey(theirPublicKey: string, mySecretKey: string): string | null {
  const cacheKey = `${theirPublicKey}|${mySecretKey}`;
  const cached = pairKeys.get(cacheKey);
  if (cached) return cached;
  try {
    const theirs = fromBase64(theirPublicKey);
    const mine = fromBase64(mySecretKey);
    if (theirs.length !== nacl.box.publicKeyLength || mine.length !== nacl.box.secretKeyLength) return null;
    const key = toBase64(nacl.box.before(theirs, mine));
    if (pairKeys.size >= PAIR_CACHE_LIMIT) pairKeys.delete(pairKeys.keys().next().value as string);
    pairKeys.set(cacheKey, key);
    return key;
  } catch {
    return null;
  }
}

export function isPublicKey(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 64) return false;
  try {
    return fromBase64(value).length === nacl.box.publicKeyLength;
  } catch {
    return false;
  }
}

export function sealShared(message: string, key: string): Sealed {
  const nonce = randomBytes(nacl.secretbox.nonceLength);
  const cipher = nacl.secretbox(utf8Encode(message), nonce, fromBase64(key));
  return { n: toBase64(nonce), c: toBase64(cipher) };
}

export function openShared(sealed: Sealed, key: string): string | null {
  try {
    const plain = nacl.secretbox.open(fromBase64(sealed.c), fromBase64(sealed.n), fromBase64(key));
    return plain ? utf8Decode(plain) : null;
  } catch {
    return null;
  }
}

// `context` ata la firma a datos que viajan fuera del sobre (por ejemplo el número de llave del estado).
function signedBytes(sealed: Sealed, context?: string): Uint8Array {
  const body = concatBytes(fromBase64(sealed.n), fromBase64(sealed.c));
  return context === undefined ? body : concatBytes(utf8Encode(`${context}:`), body);
}

export function signSealed(sealed: Sealed, signSecretKey: string, context?: string): string {
  return toBase64(nacl.sign.detached(signedBytes(sealed, context), fromBase64(signSecretKey)));
}

export function verifySealed(sealed: Sealed, signature: string, signPublicKey: string, context?: string): boolean {
  try {
    return nacl.sign.detached.verify(signedBytes(sealed, context), fromBase64(signature), fromBase64(signPublicKey));
  } catch {
    return false;
  }
}

// Secretos de la sala derivados del código con un hash lento (SHA-512 encadenado): el id público
// de la sala no revela el código y el saludo del stand va sellado con una llave que exige conocerlo.
export const ROUTE_KDF_ROUNDS = 1024;

export interface RouteSecrets {
  roomId: string;
  helloKey: string;
}

const secretsCache = new Map<string, RouteSecrets>();

export function deriveRouteSecrets(code: string, rounds = ROUTE_KDF_ROUNDS): RouteSecrets {
  const cacheKey = `${rounds}:${code}`;
  const cached = secretsCache.get(cacheKey);
  if (cached) return cached;
  let digest = nacl.hash(utf8Encode(`soytel-ruta:v2:${code.toUpperCase()}`));
  for (let round = 0; round < rounds; round += 1) digest = nacl.hash(digest);
  const secrets: RouteSecrets = {
    roomId: toHex(nacl.hash(concatBytes(digest, utf8Encode('room')))).slice(0, 24),
    helloKey: toBase64(nacl.hash(concatBytes(digest, utf8Encode('hello'))).subarray(0, nacl.secretbox.keyLength)),
  };
  secretsCache.set(cacheKey, secrets);
  return secrets;
}

export function roomIdFor(code: string): string {
  return deriveRouteSecrets(code).roomId;
}

// Huella corta de la llave de firma del anfitrión (va en el QR para verificar el saludo).
export function keyFingerprint(publicKey: string): string {
  return toHex(nacl.hash(fromBase64(publicKey))).slice(0, 12);
}

// Código de verificación de 4 caracteres que muestran el stand y el teléfono (deben coincidir).
export function verificationCode(publicKey: string): string {
  return keyFingerprint(publicKey).slice(0, 4).toUpperCase();
}
