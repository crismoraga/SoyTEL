import { seededShuffle } from '@/route/random';

// Lógica de "Llamada IP": marcado, señalización SIP y jitter buffer de paquetes RTP.

export const EXTENSION = '213';

export interface SipMessage {
  id: string;
  label: string;
  direction: 'out' | 'in';
  meaning: string;
}

// El orden real de una llamada SIP: INVITE → 100 Trying → 180 Ringing → 200 OK → ACK (y luego fluye el audio RTP).
export const sipFlow: SipMessage[] = [
  { id: 'invite', label: 'INVITE', direction: 'out', meaning: 'Tu teléfono pide iniciar la llamada.' },
  { id: 'trying', label: '100 Trying', direction: 'in', meaning: 'La central recibió la invitación y la está procesando.' },
  { id: 'ringing', label: '180 Ringing', direction: 'in', meaning: `El anexo ${EXTENSION} está sonando.` },
  { id: 'ok', label: '200 OK', direction: 'in', meaning: 'Contestaron: la llamada fue aceptada.' },
  { id: 'ack', label: 'ACK', direction: 'out', meaning: 'Confirmas y comienza el audio (RTP).' },
];

export const sipDecoys: SipMessage[] = [
  { id: 'bye', label: 'BYE', direction: 'out', meaning: 'BYE termina la llamada: ¡todavía no!' },
  { id: 'notfound', label: '404 Not Found', direction: 'in', meaning: '404 significa que el número no existe.' },
];

export interface SipStep {
  // El mensaje correcto de este paso.
  message: SipMessage;
  // La pregunta del paso: cuenta qué pasó, así hay una sola respuesta posible.
  prompt: string;
  // Las dos respuestas incorrectas y, en una línea, por qué no (y cuál era).
  wrong: { id: string; why: string }[];
}

export const sipSteps: SipStep[] = [
  {
    message: sipFlow[0],
    prompt: `Quieres llamar al anexo ${EXTENSION}. ¿Qué mensaje manda tu teléfono primero?`,
    wrong: [
      { id: 'ok', why: '200 OK lo manda quien contesta. Tú empiezas con INVITE.' },
      { id: 'bye', why: 'BYE cuelga la llamada. Para empezar se usa INVITE.' },
    ],
  },
  {
    message: sipFlow[1],
    prompt: 'La central recibió tu pedido y lo está procesando. ¿Qué te responde?',
    wrong: [
      { id: 'ack', why: 'ACK lo manda tu teléfono al final. Aquí va 100 Trying.' },
      { id: 'notfound', why: '404 diría que el anexo no existe, y sí existe: va 100 Trying.' },
    ],
  },
  {
    message: sipFlow[2],
    prompt: `El teléfono del anexo ${EXTENSION} empezó a sonar. ¿Qué te avisa la central?`,
    wrong: [
      { id: 'invite', why: 'INVITE ya lo enviaste. Aquí va 180 Ringing: está sonando.' },
      { id: 'bye', why: 'BYE cuelga la llamada. Aquí va 180 Ringing: está sonando.' },
    ],
  },
  {
    message: sipFlow[3],
    prompt: 'Alguien levantó el teléfono. ¿Qué mensaje confirma que contestaron?',
    wrong: [
      { id: 'ringing', why: '180 Ringing solo avisa que suena. Contestar es 200 OK.' },
      { id: 'notfound', why: '404 es "no existe". Contestar es 200 OK.' },
    ],
  },
  {
    message: sipFlow[4],
    prompt: 'Tu teléfono recibió el 200 OK. ¿Qué envía para empezar a hablar?',
    wrong: [
      { id: 'trying', why: '100 Trying lo manda la central, no tú. Tú confirmas con ACK.' },
      { id: 'bye', why: 'BYE cuelga la llamada. Tú confirmas con ACK y se abre el audio.' },
    ],
  },
];

export interface SipOption {
  id: string;
  label: string;
  correct: boolean;
  // Correcta: qué significa. Incorrecta: por qué no y cuál era.
  why: string;
}

const allMessages = [...sipFlow, ...sipDecoys];

// Las tres opciones de un paso (la correcta y dos incorrectas), en un orden que depende de la semilla.
export function sipOptions(step: SipStep, random: () => number): SipOption[] {
  const options: SipOption[] = [
    { id: step.message.id, label: step.message.label, correct: true, why: step.message.meaning },
    ...step.wrong.map((wrong) => ({ id: wrong.id, label: allMessages.find((message) => message.id === wrong.id)?.label ?? wrong.id, correct: false, why: wrong.why })),
  ];
  return seededShuffle(options, random);
}

export const PHRASE = ['Hola,', 'te', 'llamo', 'desde', 'la', 'sala', 'B213', 'usando', 'voz', 'IP'];

export interface VoicePacket {
  seq: number;
  word: string;
  arrivesAt: number;
  expiresAt: number;
}

export const PACKET_LIFETIME_MS = 5600;

// Llegadas con retardo variable (jitter): los paquetes se desordenan.
// `pace` estira la llegada y la vida de los paquetes (1 = ritmo original).
export function schedulePackets(random: () => number, startAt: number, pace = 1): VoicePacket[] {
  return PHRASE.map((word, index) => {
    const arrivesAt = startAt + Math.round((index * 1000 + (random() * 1.7 - 0.6) * 1000) * pace);
    return { seq: index + 1, word, arrivesAt, expiresAt: arrivesAt + Math.round(PACKET_LIFETIME_MS * pace) };
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

// Puntos de la señalización con lo avanzado hasta ahora: `steps` de los 5 pasos están resueltos.
export function sipProgressScore(steps: number, mistakes: number): number {
  return Math.round((sipScore(mistakes) * Math.min(steps, sipSteps.length)) / sipSteps.length);
}

export function jitterScore(delivered: number, wrongTaps: number): number {
  return Math.max(0, Math.round((JITTER_MAX * delivered) / PHRASE.length) - wrongTaps * 15);
}

// Calidad percibida de la voz (MOS, 1 a 4,5) según los paquetes que llegaron a tiempo.
export function mosScore(delivered: number): number {
  return Math.round((1 + 3.5 * (delivered / PHRASE.length)) * 10) / 10;
}

export interface DialLayout {
  // Medidas exactas (px) del teléfono: pantalla y botones arriba, teclado de 3 × 4 abajo.
  width: number;
  height: number;
  gap: number;
  lcdH: number;
  keyW: number;
  keyH: number;
}

// El teclado crece con el espacio disponible, pero cada tecla mide siempre 44 px o más.
export function dialLayout(size: { width: number; height: number }): DialLayout {
  const gap = 6;
  const keyW = Math.max(44, Math.floor((Math.min(size.width, 340) - 2 * gap) / 3));
  const lcdH = 52;
  const keyH = Math.max(44, Math.min(60, Math.floor((size.height - lcdH - 4 * gap) / 4)));
  return { width: 3 * keyW + 2 * gap, height: lcdH + gap + 4 * keyH + 3 * gap, gap, lcdH, keyW, keyH };
}
