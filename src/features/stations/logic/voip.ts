// Lógica de "Llamada IP": marcado, señalización SIP y jitter buffer de paquetes RTP.

export const EXTENSION = '213';

export interface SipMessage {
  id: string;
  label: string;
  direction: 'out' | 'in';
  meaning: string;
}

export const sipFlow: SipMessage[] = [
  { id: 'invite', label: 'INVITE', direction: 'out', meaning: 'Tu teléfono pide iniciar la llamada.' },
  { id: 'trying', label: '100 Trying', direction: 'in', meaning: 'La central recibió la invitación y la está procesando.' },
  { id: 'ringing', label: '180 Ringing', direction: 'in', meaning: 'El anexo 213 está sonando.' },
  { id: 'ok', label: '200 OK', direction: 'in', meaning: 'Contestaron: la llamada fue aceptada.' },
  { id: 'ack', label: 'ACK', direction: 'out', meaning: 'Confirmas y comienza el audio (RTP).' },
];

export const sipDecoys: SipMessage[] = [
  { id: 'bye', label: 'BYE', direction: 'out', meaning: 'BYE termina la llamada: ¡todavía no!' },
  { id: 'notfound', label: '404 Not Found', direction: 'in', meaning: '404 significa que el número no existe.' },
];

export const PHRASE = ['Hola,', 'te', 'llamo', 'desde', 'la', 'sala', 'B213', 'usando', 'voz', 'IP'];

export interface VoicePacket {
  seq: number;
  word: string;
  arrivesAt: number;
  expiresAt: number;
}

export const PACKET_LIFETIME_MS = 5600;

// Llegadas con retardo variable (jitter): los paquetes se desordenan.
export function schedulePackets(random: () => number, startAt: number): VoicePacket[] {
  return PHRASE.map((word, index) => {
    const arrivesAt = startAt + index * 1000 + Math.round((random() * 1.7 - 0.6) * 1000);
    return { seq: index + 1, word, arrivesAt, expiresAt: arrivesAt + PACKET_LIFETIME_MS };
  });
}

export const DIAL_MAX = 150;
export const SIP_MAX = 300;
export const JITTER_MAX = 550;

export function dialScore(elapsedMs: number, wrongCalls: number): number {
  const speed = Math.max(0, 1 - elapsedMs / 12_000);
  return Math.max(30, Math.round(DIAL_MAX * (0.5 + 0.5 * speed)) - wrongCalls * 20);
}

export function sipScore(mistakes: number): number {
  return Math.max(60, SIP_MAX - mistakes * 45);
}

export function jitterScore(delivered: number, wrongTaps: number): number {
  return Math.max(0, Math.round((JITTER_MAX * delivered) / PHRASE.length) - wrongTaps * 15);
}

// Calidad percibida de la voz (MOS, 1 a 4,5) según los paquetes que llegaron a tiempo.
export function mosScore(delivered: number): number {
  return Math.round((1 + 3.5 * (delivered / PHRASE.length)) * 10) / 10;
}
