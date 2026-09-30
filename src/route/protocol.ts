import { isValidJourneyCode } from '@/lib/progression';
import { randomBytes, type Sealed } from '@/realtime/crypto';
import type { PlayerAction, RouteSnapshot } from './types';

// Mensajes y temas MQTT de la ruta. Todo lo sensible viaja sellado (ver realtime/crypto).

export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const PROTOCOL_VERSION = 1;
const ROOT = 'soytel/r1';

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

export interface HelloMessage {
  v: number;
  kind: 'soytel-route';
  box: string;
  sign: string;
  at: number;
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

export function parseJson<T>(text: string | null): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
