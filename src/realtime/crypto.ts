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

function signedBytes(sealed: Sealed): Uint8Array {
  return concatBytes(fromBase64(sealed.n), fromBase64(sealed.c));
}

export function signSealed(sealed: Sealed, signSecretKey: string): string {
  return toBase64(nacl.sign.detached(signedBytes(sealed), fromBase64(signSecretKey)));
}

export function verifySealed(sealed: Sealed, signature: string, signPublicKey: string): boolean {
  try {
    return nacl.sign.detached.verify(signedBytes(sealed), fromBase64(signature), fromBase64(signPublicKey));
  } catch {
    return false;
  }
}

// Identificador público de la sala MQTT: no revela el código de la ruta.
export function roomIdFor(code: string): string {
  return toHex(nacl.hash(utf8Encode(`soytel-ruta:v1:${code}`))).slice(0, 24);
}

// Huella corta de la llave de firma del anfitrión (va en el QR para verificar el saludo).
export function keyFingerprint(publicKey: string): string {
  return toHex(nacl.hash(fromBase64(publicKey))).slice(0, 12);
}
