import { isValidJourneyCode } from '@/lib/progression';
import { openShared, randomBytes, sealShared, signSealed, verifySealed, type Sealed } from '@/realtime/crypto';
import type { PlayerAction, RouteSnapshot } from './types';

// Mensajes y temas MQTT de la ruta. Todo lo sensible viaja sellado (ver realtime/crypto).

export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
// v2: saludo sellado y firmado, sala derivada con hash lento (incompatible con la v1).
export const PROTOCOL_VERSION = 2;
const ROOT = 'soytel/r2';

export function routeTopics(room: string) {
  const base = `${ROOT}/${room}`;
  return {
    hello: `${base}/hello`,
    state: `${base}/state`,
    joinAll: `${base}/join/+`,
    upAll: `${base}/up/+`,
    join: (clientId: string) => `${base}/join/${clientId}`,
    up: (clientId: string) => `${base}/up/${clientId}`,
    dm: (clientId: string) => `${base}/dm/${clientId}`,
  };
}

export type RouteTopics = ReturnType<typeof routeTopics>;

// Último segmento del tema (id del participante en join/up/dm).
export function topicTail(topic: string): string {
  return topic.slice(topic.lastIndexOf('/') + 1);
}

export function isRouteCode(code: string): boolean {
  return isValidJourneyCode(code);
}

// El primer carácter del código elige el broker, así todos los dispositivos llegan al mismo.
export function brokerIndexForCode(code: string, brokerCount: number): number {
  const index = CODE_ALPHABET.indexOf(code.charAt(0).toUpperCase());
  return brokerCount > 0 && index >= 0 ? index % brokerCount : 0;
}

export function generateRouteCode(brokerIndex: number, brokerCount: number): string {
  for (;;) {
    const bytes = randomBytes(6);
    const code = Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
    if (brokerIndexForCode(code, brokerCount) === brokerIndex) return code;
  }
}

// Saludo del stand: va sellado con la llave derivada del código y firmado con la llave del stand.
export interface HelloMessage {
  v: number;
  kind: 'soytel-route';
  box: string;
  sign: string;
  at: number;
}

export interface HelloEnvelope {
  v: number;
  sealed: Sealed;
  sig: string;
}

// Participante → anfitrión: sellado con box hacia la llave del anfitrión.
export interface JoinEnvelope {
  pk: string;
  sealed: Sealed;
}

export interface JoinRequest {
  alias: string;
  avatar: number;
}

export type DirectMessage =
  | { type: 'welcome'; key: string; token: string; id: string; alias: string }
  | { type: 'rejected'; reason: 'full' | 'finished' | 'taken' | 'kicked' };

// Participante → anfitrión: acción sellada con la llave de sesión.
export interface ActionEnvelope {
  sealed: Sealed;
}

export interface ActionPayload {
  token: string;
  seq: number;
  action: PlayerAction;
}

// Anfitrión → todos: estado sellado y firmado.
export interface StateEnvelope {
  sealed: Sealed;
  sig: string;
}

export type SnapshotMessage = RouteSnapshot;

export function sealHello(hello: HelloMessage, helloKey: string, signSecretKey: string): HelloEnvelope {
  const sealed = sealShared(JSON.stringify(hello), helloKey);
  return { v: PROTOCOL_VERSION, sealed, sig: signSealed(sealed, signSecretKey) };
}

// Abre y verifica un saludo; devuelve null si no es de esta sala, está alterado o es de otra versión.
export function openHello(text: string, helloKey: string): HelloMessage | null {
  const envelope = parseJson<HelloEnvelope>(text);
  if (!envelope || envelope.v !== PROTOCOL_VERSION || !envelope.sealed || typeof envelope.sig !== 'string') return null;
  const hello = parseJson<HelloMessage>(openShared(envelope.sealed, helloKey));
  if (!hello || hello.kind !== 'soytel-route' || typeof hello.box !== 'string' || typeof hello.sign !== 'string') return null;
  return verifySealed(envelope.sealed, envelope.sig, hello.sign) ? hello : null;
}

export function parseJson<T>(text: string | null): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
