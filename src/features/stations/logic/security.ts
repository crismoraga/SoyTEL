import type { IconName } from '@/graphics/icons';

// Lógica de "Escudo digital" (proyecto Shielded): mensajes reales y falsos para decidir en segundos.
// Cada mensaje se muestra en filas cortas (remitente + líneas): el jugador toca las que le dan desconfianza.
// Todas las filas se ven iguales, así que nada delata cuáles son las señales de alerta reales.

export type Channel = 'sms' | 'correo' | 'whatsapp' | 'wifi' | 'permiso' | 'usb' | 'web' | 'aviso';

export interface SecurityCard {
  id: string;
  channel: Channel;
  from: string;
  // El mensaje en líneas cortas: cada una es una fila tocable.
  lines: string[];
  // El mismo mensaje en un solo texto (las líneas unidas).
  body: string;
  threat: boolean;
  // Cada señal de alerta es un trozo de `from` o de una sola línea.
  flags: { text: string; why: string }[];
  explanation: string;
}

export const channelInfo: Record<Channel, { label: string; icon: IconName }> = {
  sms: { label: 'SMS', icon: 'mail' },
  correo: { label: 'Correo', icon: 'mail' },
  whatsapp: { label: 'Mensaje', icon: 'send' },
  wifi: { label: 'Red Wi-Fi', icon: 'wifi' },
  permiso: { label: 'Permisos de app', icon: 'shieldLock' },
  usb: { label: 'Dispositivo USB', icon: 'plug' },
  web: { label: 'Aviso en el navegador', icon: 'globe' },
  aviso: { label: 'Aviso de la app', icon: 'bell' },
};

function card(input: Omit<SecurityCard, 'body'>): SecurityCard {
  return { ...input, body: input.lines.join(' ') };
}

export const securityCards: SecurityCard[] = [
  card({
    id: 't-banco',
    channel: 'sms',
    from: '+56 9 4521 8890',
    lines: ['BancoSur: su cuenta será BLOQUEADA hoy.', 'Verifique sus datos en bancosur-seguro.xyz/login'],
    threat: true,
    flags: [
      { text: 'BLOQUEADA hoy', why: 'Urgencia para que no pienses.' },
      { text: 'bancosur-seguro.xyz', why: 'Dominio que no es del banco.' },
    ],
    explanation: 'Phishing: los bancos no piden tus datos por SMS con enlaces raros.',
  }),
  card({
    id: 't-streaming',
    channel: 'correo',
    from: 'soporte@netfIix-pagos.com',
    lines: ['Tu pago fue rechazado.', 'Actualiza tu tarjeta en 24 horas o perderás tu cuenta.'],
    threat: true,
    flags: [
      { text: 'netfIix-pagos.com', why: 'Remitente falso: lleva una I mayúscula en vez de l.' },
      { text: 'en 24 horas', why: 'Presión de tiempo.' },
    ],
    explanation: 'Correo falso que imita a un servicio conocido para robar tu tarjeta.',
  }),
  card({
    id: 't-premio',
    channel: 'whatsapp',
    from: 'Número desconocido',
    lines: ['¡Felicidades! Ganaste un iPhone 17.', 'Solo paga el envío de $2.990 en premios-chile.top'],
    threat: true,
    flags: [
      { text: 'Ganaste un iPhone 17', why: 'Premio de un concurso en que no participaste.' },
      { text: 'premios-chile.top', why: 'Enlace sospechoso para cobrarte.' },
    ],
    explanation: 'Estafa de premio falso: nadie regala celulares por WhatsApp.',
  }),
  card({
    id: 't-wifi',
    channel: 'wifi',
    from: 'WiFi_Gratis_Aeropuerto',
    lines: ['Red abierta, sin contraseña.', 'Para navegar, ingresa el correo y la contraseña de tu Instagram.'],
    threat: true,
    flags: [
      { text: 'sin contraseña', why: 'La red no cifra: HTTPS protege lo que envías a cada sitio, la red no.' },
      { text: 'la contraseña de tu Instagram', why: 'Una red Wi-Fi nunca necesita tus claves de redes sociales.' },
    ],
    explanation: 'Portal falso para robar cuentas: una red Wi-Fi nunca te pide tus claves.',
  }),
  card({
    id: 't-linterna',
    channel: 'permiso',
    from: 'Linterna Pro',
    lines: ['Esta app solicita acceso a tus contactos y tus SMS', 'y también al micrófono.'],
    threat: true,
    flags: [
      { text: 'tus contactos y tus SMS', why: 'Una linterna no necesita tus mensajes ni tus contactos.' },
      { text: 'al micrófono', why: 'Un permiso de más para encender una luz.' },
    ],
    explanation: 'Permisos de más: una linterna no necesita eso, es señal de app espía.',
  }),
  card({
    id: 't-usb',
    channel: 'usb',
    from: 'Pendrive "Notas_Finales_2026"',
    lines: ['Lo encontraste tirado en el pasillo.', '¿Lo conectas a tu notebook para ver de quién es?'],
    threat: true,
    flags: [{ text: 'Lo encontraste tirado en el pasillo', why: 'Un USB de origen desconocido puede traer malware.' }],
    explanation: 'Un USB abandonado puede infectar tu equipo en cuanto lo conectas.',
  }),
  card({
    id: 't-bono',
    channel: 'correo',
    from: 'rrhh@usm-beneficios.net',
    lines: ['Adjunto tu bono de fin de año.', 'Ábrelo hoy: bono_2026.pdf.exe'],
    threat: true,
    flags: [
      { text: 'usm-beneficios.net', why: 'No es el dominio oficial de la universidad (usm.cl).' },
      { text: 'bono_2026.pdf.exe', why: 'Es un programa (.exe) disfrazado de PDF.' },
    ],
    explanation: 'Malware en un adjunto: la doble extensión .pdf.exe es un truco clásico.',
  }),
  card({
    id: 't-paquete',
    channel: 'sms',
    from: 'CORREOS',
    lines: ['Tu paquete está retenido.', 'Paga $1.500 de aduana en correos-cl.info/pago'],
    threat: true,
    flags: [
      { text: 'Paga $1.500', why: 'Cobro inesperado para capturar tu tarjeta.' },
      { text: 'correos-cl.info', why: 'Dominio falso: no es el del correo oficial.' },
    ],
    explanation: 'Falso aviso de paquete por SMS (smishing): muy común en Chile.',
  }),
  card({
    id: 't-virus',
    channel: 'web',
    from: 'Ventana emergente',
    lines: ['¡Tu teléfono tiene 3 virus!', 'Descarga CleanerMax YA para salvar tus fotos.'],
    threat: true,
    flags: [
      { text: 'tiene 3 virus', why: 'Una página web no puede escanear tu teléfono.' },
      { text: 'Descarga CleanerMax YA', why: 'Te empuja a instalar una app falsa.' },
    ],
    explanation: 'Scareware: te asusta para que instales un programa malicioso.',
  }),
  card({
    id: 'l-update',
    channel: 'aviso',
    from: 'Tienda de aplicaciones',
    lines: ['Hay una actualización de tu app de mensajería.', 'Incluye parches de seguridad.'],
    threat: false,
    flags: [],
    explanation: 'Actualizar desde la tienda oficial corrige fallas de seguridad.',
  }),
  card({
    id: 'l-feria',
    channel: 'correo',
    from: 'difusion@usm.cl',
    lines: ['Recordatorio: la feria de carreras es este viernes en el campus.', '¡Te esperamos!'],
    threat: false,
    flags: [],
    explanation: 'Dominio oficial (usm.cl), sin enlaces raros ni urgencias.',
  }),
  card({
    id: 'l-otp',
    channel: 'sms',
    from: 'BancoSur',
    lines: ['Pediste ingresar a tu cuenta.', 'Tu código es 482913. Nunca lo compartas con nadie.'],
    threat: false,
    flags: [],
    explanation: 'Es un código que tú pediste: sirve, pero jamás lo compartas.',
  }),
  card({
    id: 'l-eduroam',
    channel: 'wifi',
    from: 'eduroam',
    lines: ['Red oficial de la universidad, cifrada (WPA2-Enterprise).', 'Entras con tu cuenta USM, como siempre.'],
    threat: false,
    flags: [],
    explanation: 'Red conocida y cifrada: se entra con tu cuenta institucional.',
  }),
  card({
    id: 'l-mapas',
    channel: 'permiso',
    from: 'App de mapas',
    lines: ['Permitir acceso a tu ubicación solo mientras usas la app.'],
    threat: false,
    flags: [],
    explanation: 'Permiso razonable: un mapa necesita tu ubicación.',
  }),
  card({
    id: 'l-profe',
    channel: 'correo',
    from: 'profesor.redes@usm.cl',
    lines: ['Adjunto la guía del laboratorio de redes (guia_lab.pdf) para la próxima clase.'],
    threat: false,
    flags: [],
    explanation: 'Remitente conocido y un archivo que esperabas.',
  }),
];

export const DECISION_POINTS = 70;
export const FLAG_POINTS = 25;
// Marcar como sospechosa una fila normal resta: así no sirve tocar todo.
export const FALSE_ALARM_POINTS = 10;
export const CARD_SECONDS = 10;

export function pickCards(random: () => number, threats = 6, legit = 4): SecurityCard[] {
  const shuffle = <T,>(items: T[]) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const picked = [...shuffle(securityCards.filter((item) => item.threat)).slice(0, threats), ...shuffle(securityCards.filter((item) => !item.threat)).slice(0, legit)];
  return shuffle(picked);
}

export interface Segment {
  text: string;
  flag: number | null;
}

// Divide un texto en tramos para poder ubicar las señales de alerta que contiene.
export function segmentText(text: string, flags: SecurityCard['flags']): Segment[] {
  const marks = flags
    .map((flag, index) => ({ index, start: text.indexOf(flag.text), length: flag.text.length }))
    .filter((mark) => mark.start >= 0)
    .sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let cursor = 0;
  marks.forEach((mark) => {
    if (mark.start < cursor) return;
    if (mark.start > cursor) segments.push({ text: text.slice(cursor, mark.start), flag: null });
    segments.push({ text: text.slice(mark.start, mark.start + mark.length), flag: mark.index });
    cursor = mark.start + mark.length;
  });
  if (cursor < text.length) segments.push({ text: text.slice(cursor), flag: null });
  return segments;
}

// Las señales pueden estar en el remitente (dominio falso) o en el mensaje.
export function segmentCard(card: SecurityCard): { from: Segment[]; body: Segment[] } {
  return { from: segmentText(card.from, card.flags), body: segmentText(card.body, card.flags) };
}

export interface CardRow {
  key: string;
  kind: 'from' | 'line';
  text: string;
  // Índices (en card.flags) de las señales reales que contiene esta fila; vacío si es una fila normal.
  flags: number[];
}

// Las filas que ve el jugador: el remitente y luego cada línea del mensaje.
export function cardRows(item: SecurityCard): CardRow[] {
  const flagsIn = (text: string) => item.flags.flatMap((flag, index) => (text.includes(flag.text) ? [index] : []));
  return [
    { key: 'from', kind: 'from', text: item.from, flags: flagsIn(item.from) },
    ...item.lines.map((text, index) => ({ key: `l${index}`, kind: 'line' as const, text, flags: flagsIn(text) })),
  ];
}

// Puntos de un mensaje: acertar la decisión + señales reales tocadas − falsas alarmas (sin bajar de 0).
export function cardScore(item: SecurityCard, decisionOk: boolean, taps: readonly string[]): { points: number; found: number; falseAlarms: number } {
  const rows = cardRows(item);
  let found = 0;
  let falseAlarms = 0;
  new Set(taps).forEach((key) => {
    const row = rows.find((candidate) => candidate.key === key);
    if (!row) return;
    if (row.flags.length) found += row.flags.length;
    else falseAlarms += 1;
  });
  const bonus = Math.max(0, found * FLAG_POINTS - falseAlarms * FALSE_ALARM_POINTS);
  return { points: (decisionOk ? DECISION_POINTS : 0) + bonus, found, falseAlarms };
}

export function maxScore(cards: SecurityCard[]): number {
  return cards.length * DECISION_POINTS + cards.reduce((sum, item) => sum + item.flags.length, 0) * FLAG_POINTS;
}

export interface Tally {
  raw: number;
  // 0 a 1000, normalizado con el máximo posible de estos mensajes.
  score: number;
  found: number;
  decided: number;
  correct: number;
}

// Resumen de la partida con lo hecho hasta ahora. `decisions` dice, por mensaje, si la decisión fue la correcta.
export function tally(cards: SecurityCard[], decisions: Record<string, boolean>, taps: Record<string, string[]>): Tally {
  let raw = 0;
  let found = 0;
  cards.forEach((item) => {
    const result = cardScore(item, decisions[item.id] === true, taps[item.id] ?? []);
    raw += result.points;
    found += result.found;
  });
  const max = maxScore(cards);
  const decided = cards.filter((item) => decisions[item.id] !== undefined).length;
  const correct = cards.filter((item) => decisions[item.id] === true).length;
  return { raw, score: max ? Math.min(1000, Math.round((raw / max) * 1000)) : 0, found, decided, correct };
}
