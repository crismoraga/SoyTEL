import type { IconName } from '@/graphics/icons';

// Lógica de "Escudo digital" (proyecto Shielded): mensajes reales y falsos para decidir en segundos.

export type Channel = 'sms' | 'correo' | 'whatsapp' | 'wifi' | 'permiso' | 'usb' | 'web';

export interface SecurityCard {
  id: string;
  channel: Channel;
  from: string;
  body: string;
  threat: boolean;
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
};

export const securityCards: SecurityCard[] = [
  {
    id: 't-banco',
    channel: 'sms',
    from: '+56 9 4521 8890',
    body: 'BancoSur: su cuenta será BLOQUEADA hoy. Verifique sus datos en bancosur-seguro.xyz/login',
    threat: true,
    flags: [
      { text: 'BLOQUEADA hoy', why: 'Urgencia para que no pienses.' },
      { text: 'bancosur-seguro.xyz', why: 'Dominio que no es del banco.' },
    ],
    explanation: 'Phishing: los bancos no piden datos por SMS con enlaces raros.',
  },
  {
    id: 't-streaming',
    channel: 'correo',
    from: 'soporte@netfIix-pagos.com',
    body: 'Tu pago fue rechazado. Actualiza tu tarjeta en 24 horas o perderás tu cuenta.',
    threat: true,
    flags: [
      { text: 'netfIix-pagos.com', why: 'Remitente falso (una I mayúscula en vez de l).' },
      { text: 'en 24 horas', why: 'Presión de tiempo.' },
    ],
    explanation: 'Correo falso que imita a un servicio conocido para robar tu tarjeta.',
  },
  {
    id: 't-premio',
    channel: 'whatsapp',
    from: 'Número desconocido',
    body: '¡Felicidades! Ganaste un iPhone 17. Solo paga el envío de $2.990 en premios-chile.top',
    threat: true,
    flags: [
      { text: 'Ganaste un iPhone 17', why: 'Premio de un concurso en que no participaste.' },
      { text: 'premios-chile.top', why: 'Enlace sospechoso para cobrarte.' },
    ],
    explanation: 'Estafa de premio falso: nadie regala celulares por WhatsApp.',
  },
  {
    id: 't-wifi',
    channel: 'wifi',
    from: 'WiFi_Gratis_Aeropuerto',
    body: 'Red abierta, sin contraseña. Para navegar, ingresa el correo y la contraseña de tu Instagram.',
    threat: true,
    flags: [
      { text: 'sin contraseña', why: 'Cualquiera puede espiar el tráfico.' },
      { text: 'la contraseña de tu Instagram', why: 'Una red Wi-Fi nunca necesita tus claves de redes sociales.' },
    ],
    explanation: 'Portal falso (evil twin) para robar cuentas.',
  },
  {
    id: 't-linterna',
    channel: 'permiso',
    from: 'Linterna Pro',
    body: 'Esta app solicita acceso a tus contactos, tus SMS y el micrófono.',
    threat: true,
    flags: [
      { text: 'tus contactos, tus SMS', why: 'Una linterna no necesita tus mensajes.' },
      { text: 'el micrófono', why: 'Permiso excesivo para su función.' },
    ],
    explanation: 'Permisos excesivos: señal de app espía.',
  },
  {
    id: 't-usb',
    channel: 'usb',
    from: 'Pendrive "Notas_Finales_2026"',
    body: 'Encontraste este pendrive tirado en el pasillo. ¿Lo conectas a tu notebook para ver de quién es?',
    threat: true,
    flags: [{ text: 'Encontraste este pendrive tirado', why: 'Un USB de origen desconocido puede traer malware.' }],
    explanation: 'Ataque de cebo: los USB abandonados pueden infectar el equipo al conectarlos.',
  },
  {
    id: 't-bono',
    channel: 'correo',
    from: 'rrhh@usm-beneficios.net',
    body: 'Adjunto tu bono de fin de año. Ábrelo hoy: bono_2026.pdf.exe',
    threat: true,
    flags: [
      { text: 'usm-beneficios.net', why: 'No es un dominio oficial de la universidad.' },
      { text: 'bono_2026.pdf.exe', why: 'Es un programa ejecutable disfrazado de PDF.' },
    ],
    explanation: 'Malware en un adjunto con doble extensión.',
  },
  {
    id: 't-paquete',
    channel: 'sms',
    from: 'CORREOS',
    body: 'Tu paquete está retenido. Paga $1.500 de aduana en correos-cl.info/pago',
    threat: true,
    flags: [
      { text: 'Paga $1.500', why: 'Cobro inesperado para capturar tu tarjeta.' },
      { text: 'correos-cl.info', why: 'Dominio falso.' },
    ],
    explanation: 'Smishing de paquetería: muy común en Chile.',
  },
  {
    id: 't-virus',
    channel: 'web',
    from: 'Ventana emergente',
    body: '¡Tu teléfono tiene 3 virus! Descarga CleanerMax YA para salvar tus fotos.',
    threat: true,
    flags: [
      { text: 'tiene 3 virus', why: 'Una página web no puede escanear tu teléfono.' },
      { text: 'Descarga CleanerMax YA', why: 'Te empuja a instalar una app falsa.' },
    ],
    explanation: 'Scareware: asusta para que instales malware.',
  },
  {
    id: 'l-update',
    channel: 'permiso',
    from: 'Tienda de aplicaciones',
    body: 'Actualización disponible de tu app de mensajería: incluye parches de seguridad.',
    threat: false,
    flags: [],
    explanation: 'Actualizar desde la tienda oficial corrige vulnerabilidades.',
  },
  {
    id: 'l-feria',
    channel: 'correo',
    from: 'difusion@usm.cl',
    body: 'Recordatorio: la feria de carreras es este viernes en el campus. ¡Te esperamos!',
    threat: false,
    flags: [],
    explanation: 'Dominio oficial, sin enlaces raros ni urgencias.',
  },
  {
    id: 'l-otp',
    channel: 'sms',
    from: 'BancoSur',
    body: 'Tu código de verificación es 482913. Nunca lo compartas con nadie.',
    threat: false,
    flags: [],
    explanation: 'Un código que tú pediste es legítimo… pero jamás lo compartas.',
  },
  {
    id: 'l-eduroam',
    channel: 'wifi',
    from: 'eduroam',
    body: 'Red protegida WPA2-Enterprise: ingresa con tu cuenta institucional.',
    threat: false,
    flags: [],
    explanation: 'Red académica cifrada con autenticación por usuario.',
  },
  {
    id: 'l-mapas',
    channel: 'permiso',
    from: 'App de mapas',
    body: 'Permitir acceso a tu ubicación solo mientras usas la app.',
    threat: false,
    flags: [],
    explanation: 'Permiso razonable: un mapa necesita tu ubicación.',
  },
  {
    id: 'l-profe',
    channel: 'correo',
    from: 'profesor.redes@usm.cl',
    body: 'Adjunto la guía del laboratorio de redes (guia_lab.pdf) para la próxima clase.',
    threat: false,
    flags: [],
    explanation: 'Remitente conocido y archivo esperado.',
  },
];

export const DECISION_POINTS = 70;
export const FLAG_POINTS = 25;
export const CARD_SECONDS = 9;

export function pickCards(random: () => number, threats = 6, legit = 4): SecurityCard[] {
  const shuffle = <T,>(items: T[]) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const picked = [...shuffle(securityCards.filter((card) => card.threat)).slice(0, threats), ...shuffle(securityCards.filter((card) => !card.threat)).slice(0, legit)];
  return shuffle(picked);
}

export interface Segment {
  text: string;
  flag: number | null;
}

// Divide un texto en tramos para poder tocar las señales de alerta que contiene.
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

export function maxScore(cards: SecurityCard[]): number {
  return cards.length * DECISION_POINTS + cards.reduce((sum, card) => sum + card.flags.length, 0) * FLAG_POINTS;
}
