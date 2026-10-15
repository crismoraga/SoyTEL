import type { IconName } from '@/graphics/icons';
import { pick, shuffle, type Random } from '../logic';

// Reglas puras del paquete «Sistemas» (sin UI) para poder probarlas con muchas semillas.
// Cada generador recibe el nivel de la ráfaga (0 = primera ronda) y entrega una ronda con UNA sola respuesta correcta.

export type Tier = 0 | 1 | 2;

// Escalón de dificultad: sube al llegar a cada corte de nivel.
export function tierFor(level: number, cuts: readonly [number, number]): Tier {
  return level >= cuts[1] ? 2 : level >= cuts[0] ? 1 : 0;
}

function int(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

// Colores de acierto y error (los mismos de ChoiceTile) para las piezas propias de cada juego.
export type RevealState = 'idle' | 'correct' | 'wrong' | 'dimmed';

export const revealPalette: Record<RevealState, { bg: string; border: string; fg: string }> = {
  idle: { bg: '#123D5C', border: 'rgba(167,212,237,0.3)', fg: '#F4ECD7' },
  correct: { bg: '#1F5E43', border: '#6BC59A', fg: '#FFFFFF' },
  wrong: { bg: '#6E2A2A', border: '#E58A8A', fg: '#FFFFFF' },
  dimmed: { bg: '#123D5C', border: 'rgba(167,212,237,0.1)', fg: '#8CA3B4' },
};

// ---- ¿Correo trampa? ----
// Un correo de verdad sale del dominio oficial; la trampa imita el dominio (una letra cambiada, un guion,
// un dominio pegado al final) y, a veces, mete prisa o pide la clave.
export const orgDomains: Record<string, string> = {
  usm: 'usm.cl',
  bancoestado: 'bancoestado.cl',
  instagram: 'instagram.com',
  google: 'google.com',
  netflix: 'netflix.com',
  correos: 'correos.cl',
  meli: 'mercadolibre.cl',
  spotify: 'spotify.com',
  sii: 'sii.cl',
  discord: 'discord.com',
};

interface MailBase {
  org: string;
  from: string;
  subject: string;
  line: string;
  link: string;
}

export interface PhishTemplate extends MailBase {
  urgent: boolean;
  asks: boolean;
  tell: string;
}

export interface LegitTemplate extends MailBase {
  // Suena apurado, pero viene del dominio oficial y no pide nada raro.
  decoy?: boolean;
}

export const phishTemplates: PhishTemplate[] = [
  { org: 'usm', from: 'alumnos@usm-cl.net', subject: 'Tu cuenta USM se bloquea', line: 'Confirma tu clave hoy mismo.', link: 'usm-cl.net/clave', urgent: true, asks: true, tell: '«usm-cl.net» no es «usm.cl»: el dominio falso delata la trampa.' },
  { org: 'bancoestado', from: 'seguridad@bancoestad0.cl', subject: 'Compra rechazada: confirma', line: 'Ingresa tu clave para anularla.', link: 'bancoestad0.cl/anular', urgent: true, asks: true, tell: '«bancoestad0» lleva un cero: el dominio oficial es bancoestado.cl.' },
  { org: 'instagram', from: 'ayuda@lnstagram.com', subject: 'Tu cuenta será eliminada', line: 'Verifica tu contraseña ahora.', link: 'lnstagram.com/verificar', urgent: true, asks: true, tell: '«lnstagram» empieza con L minúscula, no con i: dominio imitado.' },
  { org: 'google', from: 'alertas@google.com.entrar.top', subject: 'Alguien entró a tu cuenta', line: 'Cambia tu clave aquí, rápido.', link: 'google.com.entrar.top/cuenta', urgent: true, asks: true, tell: 'El dominio real es lo último: «entrar.top», no google.com.' },
  { org: 'netflix', from: 'pagos@netflix-cobro.com', subject: 'Pago fallido: cuenta pausada', line: 'Actualiza tu tarjeta ahora.', link: 'netflix-cobro.com/pagar', urgent: true, asks: true, tell: '«netflix-cobro.com» no es de Netflix: el oficial es netflix.com.' },
  { org: 'correos', from: 'envios@correos-cl.top', subject: 'Paquete sin entregar', line: 'Paga $990 para recibirlo hoy.', link: 'correos-cl.top/pago', urgent: true, asks: true, tell: '«correos-cl.top» no es «correos.cl»: dominio imitado.' },
  { org: 'spotify', from: 'cuenta@spotlfy.com', subject: 'Tu plan Premium venció', line: 'Actualiza tus datos de pago.', link: 'spotlfy.com/pago', urgent: true, asks: true, tell: '«spotlfy» lleva una L donde va la i: no es «spotify.com».' },
  { org: 'meli', from: 'premios@mercadolibre-pago.com', subject: '¡Ganaste un iPhone gratis!', line: 'Reclámalo con tus datos.', link: 'mercadolibre-pago.com/premio', urgent: false, asks: true, tell: '«mercadolibre-pago.com» no es «mercadolibre.cl», y nadie regala iPhones.' },
  { org: 'sii', from: 'devoluciones@sii-cl.com', subject: 'Tienes una devolución', line: 'Ingresa tu RUT y tu clave.', link: 'sii-cl.com/devolucion', urgent: false, asks: true, tell: '«sii-cl.com» no es «sii.cl», y el SII no pide tu clave por correo.' },
  { org: 'discord', from: 'nitro@discord-gifts.ru', subject: 'Nitro gratis por 3 meses', line: 'Inicia sesión para activarlo.', link: 'discord-gifts.ru/nitro', urgent: false, asks: true, tell: '«discord-gifts.ru» no es «discord.com»: ¡cuidado con los regalos!' },
  { org: 'usm', from: 'becas@usm.cl.beneficios.xyz', subject: 'Beca aprobada: reclámala', line: 'Sube tu cédula y tu clave.', link: 'usm.cl.beneficios.xyz/beca', urgent: false, asks: true, tell: 'El dominio real es lo último: «beneficios.xyz», no usm.cl.' },
  { org: 'usm', from: 'registro@usm-cl.com', subject: 'Actualización de tus datos', line: 'Revisa tu perfil en el portal.', link: 'usm-cl.com/perfil', urgent: false, asks: false, tell: '«usm-cl.com» no es «usm.cl»: un guion basta para engañarte.' },
  { org: 'bancoestado', from: 'info@banc0estado.cl', subject: 'Tu cartola de octubre', line: 'Ya está lista para descargar.', link: 'banc0estado.cl/cartola', urgent: false, asks: false, tell: '«banc0estado» lleva un cero: el oficial es bancoestado.cl.' },
  { org: 'google', from: 'no-reply@g00gle.com', subject: 'Nuevo inicio de sesión', line: 'Fue desde un teléfono nuevo.', link: 'g00gle.com/seguridad', urgent: false, asks: false, tell: '«g00gle» usa ceros en vez de la letra o: no es google.com.' },
  { org: 'instagram', from: 'info@instagrarn.com', subject: 'Nuevo seguidor', line: 'Alguien empezó a seguirte.', link: 'instagrarn.com/perfil', urgent: false, asks: false, tell: '«rn» juntas parecen una «m»: es «instagrarn», no instagram.' },
];

export const legitTemplates: LegitTemplate[] = [
  { org: 'usm', from: 'registro@usm.cl', subject: 'Tu certificado está listo', line: 'Descárgalo en tu portal.', link: 'usm.cl/certificados' },
  { org: 'usm', from: 'biblioteca@usm.cl', subject: 'Tu libro vence el viernes', line: 'Puedes renovarlo en línea.', link: 'usm.cl/biblioteca' },
  { org: 'usm', from: 'club@usm.cl', subject: 'Taller de robótica: sábado', line: 'Inscríbete en el sitio.', link: 'usm.cl/talleres' },
  { org: 'bancoestado', from: 'cartolas@bancoestado.cl', subject: 'Tu cartola de octubre', line: 'Ya puedes verla en tu banca.', link: 'bancoestado.cl/cartola' },
  { org: 'instagram', from: 'info@instagram.com', subject: 'Nuevo seguidor', line: 'Alguien empezó a seguirte.', link: 'instagram.com/perfil' },
  { org: 'google', from: 'no-reply@accounts.google.com', subject: 'Nuevo inicio de sesión', line: 'Fue desde tu teléfono.', link: 'accounts.google.com/seguridad' },
  { org: 'netflix', from: 'hola@netflix.com', subject: 'Nuevo episodio disponible', line: 'Tu serie ya está lista.', link: 'netflix.com/inicio' },
  { org: 'correos', from: 'avisos@correos.cl', subject: 'Tu paquete va en camino', line: 'Llega mañana a tu casa.', link: 'correos.cl/seguimiento' },
  { org: 'meli', from: 'ventas@mercadolibre.cl', subject: 'Tu compra fue enviada', line: 'Sigue tu pedido aquí.', link: 'mercadolibre.cl/pedidos' },
  { org: 'spotify', from: 'hola@spotify.com', subject: 'Tu resumen semanal', line: 'Mira lo que más escuchaste.', link: 'spotify.com/resumen' },
  { org: 'discord', from: 'equipo@discord.com', subject: 'Bienvenido al servidor', line: 'Ya puedes chatear.', link: 'discord.com/canales' },
  { org: 'sii', from: 'contacto@sii.cl', subject: 'Tu boleta fue emitida', line: 'Puedes verla en tu cuenta.', link: 'sii.cl/boletas' },
  { org: 'usm', from: 'registro@usm.cl', subject: '¡Último día de matrícula!', line: 'Hazla hoy en tu portal.', link: 'usm.cl/matricula', decoy: true },
  { org: 'meli', from: 'ofertas@mercadolibre.cl', subject: 'La oferta termina hoy', line: 'Mira los descuentos.', link: 'mercadolibre.cl/ofertas', decoy: true },
  { org: 'correos', from: 'avisos@correos.cl', subject: 'Retira tu paquete hoy', line: 'Ya está en la sucursal.', link: 'correos.cl/retiro', decoy: true },
  { org: 'netflix', from: 'hola@netflix.com', subject: 'Tu prueba termina mañana', line: 'Elige tu plan cuando quieras.', link: 'netflix.com/planes', decoy: true },
];

export interface MailCard {
  id: string;
  org: string;
  from: string;
  subject: string;
  line: string;
  link: string;
  phishing: boolean;
}

export interface PhishingRound {
  mails: MailCard[];
  answerId: string;
  // La pista que delata la trampa (Rutix la dice al cerrar la ronda).
  clue: string;
  tier: Tier;
  bonus: number;
}

// «alumnos@usm-cl.net» → ['alumnos@', 'usm-cl.net']
export function addressParts(address: string): [string, string] {
  const at = address.indexOf('@');
  return [address.slice(0, at + 1), address.slice(at + 1)];
}

// «usm-cl.net/clave» → ['usm-cl.net', '/clave']
export function linkParts(link: string): [string, string] {
  const slash = link.indexOf('/');
  return slash < 0 ? [link, ''] : [link.slice(0, slash), link.slice(slash)];
}

export function addressDomain(address: string): string {
  return addressParts(address)[1].toLowerCase();
}

export function linkHost(link: string): string {
  return linkParts(link)[0].toLowerCase();
}

// ¿El dominio es el oficial (o un subdominio suyo)? Lo que manda es el final del dominio.
export function belongsTo(host: string, official: string): boolean {
  return host === official || host.endsWith(`.${official}`);
}

const tells = (item: PhishTemplate) => Number(item.urgent) + Number(item.asks);

export function phishingRound(level = 0, random: Random = Math.random): PhishingRound {
  const tier = tierFor(level, [2, 4]);
  // Fácil: dominio falso + prisa + pide la clave. Medio: dominio falso y una señal más. Difícil: casi solo el dominio.
  const pool = phishTemplates.filter((item) => (tier === 0 ? tells(item) === 2 : tier === 1 ? tells(item) >= 1 : tells(item) <= 1));
  const bad = pick(pool, random);
  const same = shuffle(legitTemplates.filter((item) => item.org === bad.org), random);
  const calmOther = shuffle(legitTemplates.filter((item) => item.org !== bad.org && !item.decoy), random);
  const decoyOther = shuffle(legitTemplates.filter((item) => item.org !== bad.org && item.decoy), random);
  let legit: LegitTemplate[];
  if (tier === 0) {
    // Dos correos tranquilos de otras marcas.
    legit = [calmOther[0], calmOther.find((item) => item.org !== calmOther[0].org) ?? calmOther[1]];
  } else if (tier === 1) {
    // Uno de la misma marca que imita la trampa: solo el dominio los distingue.
    legit = [same.find((item) => !item.decoy) ?? same[0], calmOther[0]];
  } else {
    // También hay correos verdaderos que suenan apurados: la prisa no es la señal.
    legit = [same.find((item) => item.decoy) ?? same[0], decoyOther[0] ?? calmOther[0]];
  }
  const cards = [
    { org: bad.org, from: bad.from, subject: bad.subject, line: bad.line, link: bad.link, phishing: true },
    ...legit.map((item) => ({ org: item.org, from: item.from, subject: item.subject, line: item.line, link: item.link, phishing: false })),
  ];
  const mails = shuffle(cards, random).map((card, index) => ({ ...card, id: `m${index}` }));
  const answer = mails.find((mail) => mail.phishing) ?? mails[0];
  return { mails, answerId: answer.id, clue: bad.tell, tier, bonus: 20 + tier * 10 };
}

export function mailLabel(mail: MailCard): string {
  return `Correo de ${mail.from}. Asunto: ${mail.subject}. Dice: ${mail.line} Enlace a ${mail.link}.`;
}

// ---- César rápido ----
export const caesarWords4 = ['NUBE', 'DATO', 'ONDA', 'RUTA', 'NODO', 'CHIP', 'BYTE', 'WIFI', 'BASE', 'HOLA', 'MAPA', 'RAYO'];
export const caesarWords5 = ['CLAVE', 'REDES', 'CABLE', 'RADIO', 'ROBOT', 'TECLA', 'VIDEO', 'LASER', 'PIXEL', 'RUIDO', 'FIBRA', 'NIVEL'];

const CODE_A = 65;

// Cada letra avanza `shift` lugares en el abecedario (negativo = retrocede). Solo mueve las letras A–Z.
export function caesarShift(text: string, shift: number): string {
  return [...text]
    .map((char) => {
      const code = char.charCodeAt(0) - CODE_A;
      if (code < 0 || code > 25) return char;
      return String.fromCharCode(CODE_A + ((((code + shift) % 26) + 26) % 26));
    })
    .join('');
}

export interface CaesarRound {
  plain: string;
  cipher: string;
  // Lugares que avanzó cada letra (1 a 3).
  shift: number;
  // Desde cierto nivel no se dice el desplazamiento: hay que deducirlo de una pista.
  hidden: boolean;
  hint: { index: number; plain: string; cipher: string } | null;
  options: string[];
  bonus: number;
}

export function caesarRound(level = 0, random: Random = Math.random): CaesarRound {
  const hidden = level >= 3;
  const words = random() < (level >= 2 ? 0.6 : 0.4) ? caesarWords5 : caesarWords4;
  const plain = pick(words, random);
  const shift = 1 + Math.floor(random() * 3);
  const cipher = caesarShift(plain, shift);
  const others = shuffle(words.filter((word) => word !== plain), random);
  // Los señuelos empiezan con otra letra (basta descifrar una letra); desde el nivel 2, uno comparte la inicial.
  const twin = level >= 2 ? others.find((word) => word[0] === plain[0]) : undefined;
  const picked: string[] = twin ? [twin] : [];
  const used = new Set([plain[0]]);
  for (const word of others) {
    if (picked.length === 3) break;
    if (word === twin || used.has(word[0])) continue;
    picked.push(word);
    used.add(word[0]);
  }
  const index = int(random, 0, plain.length - 1);
  return {
    plain,
    cipher,
    shift,
    hidden,
    hint: hidden ? { index, plain: plain[index], cipher: cipher[index] } : null,
    options: shuffle([plain, ...picked], random),
    bonus: 20 + (hidden ? 15 : 0) + (plain.length === 5 ? 5 : 0),
  };
}

export function caesarRuleLabel(round: CaesarRound): string {
  if (round.hint) return `Pista: la ${round.hint.plain} se volvió ${round.hint.cipher}. ¿Cuántos lugares avanzó?`;
  return `Desplazamiento ${round.shift}: cada letra avanzó ${round.shift} lugares, como A que pasó a ser ${caesarShift('A', round.shift)}.`;
}

export function caesarNote(round: CaesarRound): string {
  const pairs = `${round.cipher[0]}→${round.plain[0]}, ${round.cipher[1]}→${round.plain[1]}`;
  if (round.hint) return `La pista ${round.hint.plain}→${round.hint.cipher} avanza ${round.shift}: al retroceder ${round.shift}, ${round.cipher} dice ${round.plain}.`;
  return `Retrocede ${round.shift} letras: ${pairs}… y ${round.cipher} dice ${round.plain}.`;
}

// ---- Que no se caiga ----
export interface ArchNode {
  id: string;
  icon: IconName;
  label: string;
  failed: boolean;
}

export interface ArchColumn {
  id: string;
  nodes: ArchNode[];
}

export interface Architecture {
  title: string;
  columns: ArchColumn[];
}

// Funciona si en cada etapa (columna) queda al menos una pieza sana: las piezas en paralelo se respaldan.
export function systemWorks(columns: ArchColumn[]): boolean {
  return columns.every((column) => column.nodes.some((node) => !node.failed));
}

interface Piece {
  icon: IconName;
  label: string;
}

export interface Family {
  id: string;
  head?: Piece;
  // Pieza única que reparte el trabajo (balanceador, switch): si cae, nada llega a las de atrás.
  front?: Piece;
  unit: { icon: IconName; single: string; labels: [string, string] };
  tail?: Piece;
  single: string;
  double: string;
  why: string;
  spofWhy?: string;
}

export const families: Family[] = [
  { id: 'servers', head: { icon: 'users', label: 'Usuarios' }, front: { icon: 'shuffle', label: 'Balanceador' }, unit: { icon: 'server', single: 'Servidor', labels: ['Servidor 1', 'Servidor 2'] }, single: 'Un servidor', double: 'Dos servidores', why: 'Con dos servidores, si uno cae el otro sigue atendiendo.', spofWhy: 'Si cae el único balanceador, nadie llega a los servidores: es un punto único de falla.' },
  { id: 'links', head: { icon: 'school', label: 'Sucursal' }, unit: { icon: 'fiber', single: 'Enlace', labels: ['Enlace 1', 'Enlace 2'] }, tail: { icon: 'globe', label: 'Internet' }, single: 'Un enlace', double: 'Dos enlaces', why: 'Con dos enlaces, si uno se corta el otro mantiene la conexión.' },
  { id: 'database', head: { icon: 'phone', label: 'App' }, unit: { icon: 'database', single: 'Datos', labels: ['Principal', 'Réplica'] }, single: 'Una base de datos', double: 'Base y réplica', why: 'La réplica guarda una copia: si cae la principal, toma su lugar.' },
  { id: 'disks', head: { icon: 'server', label: 'Servidor' }, unit: { icon: 'database', single: 'Disco', labels: ['Disco 1', 'Disco 2'] }, single: 'Un disco', double: 'Dos discos (espejo)', why: 'Con dos discos en espejo, si uno falla el otro conserva todo.' },
  { id: 'power', unit: { icon: 'bolt', single: 'Red', labels: ['Red', 'Generador'] }, tail: { icon: 'server', label: 'Servidores' }, single: 'Solo la red eléctrica', double: 'Red y generador', why: 'Un generador de respaldo mantiene todo encendido en un corte de luz.' },
  { id: 'routers', head: { icon: 'school', label: 'Oficina' }, front: { icon: 'lanSwitch', label: 'Switch' }, unit: { icon: 'router', single: 'Router', labels: ['Router 1', 'Router 2'] }, tail: { icon: 'globe', label: 'Internet' }, single: 'Un router', double: 'Dos routers', why: 'Con dos routers, si uno falla el otro sigue dando salida a Internet.', spofWhy: 'Si cae el único switch, ningún router recibe tráfico: es un punto único de falla.' },
  { id: 'centers', head: { icon: 'users', label: 'Usuarios' }, unit: { icon: 'cloud', single: 'Centro', labels: ['Centro 1', 'Centro 2'] }, single: 'Un centro de datos', double: 'Dos centros de datos', why: 'Con dos centros de datos, si uno se apaga el otro sigue en pie.' },
  { id: 'dns', head: { icon: 'laptop', label: 'Tu equipo' }, unit: { icon: 'dns', single: 'DNS', labels: ['DNS 1', 'DNS 2'] }, single: 'Un DNS', double: 'Dos DNS', why: 'Con un DNS de respaldo, si uno falla el otro sigue traduciendo nombres.' },
];

type Mode = 'single' | 'double' | 'frontDown';

// Arma las columnas de un sistema: siempre hay UNA pieza caída (la única, una de las dos o la que reparte).
export function buildColumns(family: Family, mode: Mode, failIndex: 0 | 1): ArchColumn[] {
  const columns: ArchColumn[] = [];
  if (family.head) columns.push({ id: 'head', nodes: [{ id: 'head', icon: family.head.icon, label: family.head.label, failed: false }] });
  if (family.front) columns.push({ id: 'front', nodes: [{ id: 'front', icon: family.front.icon, label: family.front.label, failed: mode === 'frontDown' }] });
  const units: ArchNode[] =
    mode === 'single'
      ? [{ id: 'unit-0', icon: family.unit.icon, label: family.unit.single, failed: true }]
      : family.unit.labels.map((label, index) => ({ id: `unit-${index}`, icon: family.unit.icon, label, failed: mode === 'double' && index === failIndex }));
  columns.push({ id: 'unit', nodes: units });
  if (family.tail) columns.push({ id: 'tail', nodes: [{ id: 'tail', icon: family.tail.icon, label: family.tail.label, failed: false }] });
  return columns;
}

export interface RedundancyRound {
  panels: [Architecture, Architecture];
  // Cuál de los dos sistemas sigue funcionando.
  answerIndex: 0 | 1;
  kind: 'basic' | 'spof';
  note: string;
  bonus: number;
}

export function redundancyRound(level = 0, random: Random = Math.random): RedundancyRound {
  const tier = tierFor(level, [2, 4]);
  // Desde el nivel medio aparece la trampa del «punto único de falla»: dos servidores, pero cae la pieza que reparte.
  const spof = tier >= 1 && random() < (tier === 1 ? 0.3 : 0.5);
  const family = pick(spof ? families.filter((item) => item.front) : families, random);
  const failIndex: 0 | 1 = random() < 0.5 ? 0 : 1;
  const up: Architecture = { title: family.double, columns: buildColumns(family, 'double', failIndex) };
  const down: Architecture = spof
    ? { title: family.double, columns: buildColumns(family, 'frontDown', failIndex) }
    : { title: family.single, columns: buildColumns(family, 'single', failIndex) };
  const answerIndex: 0 | 1 = random() < 0.5 ? 0 : 1;
  return {
    panels: answerIndex === 0 ? [up, down] : [down, up],
    answerIndex,
    kind: spof ? 'spof' : 'basic',
    note: spof ? (family.spofWhy ?? family.why) : family.why,
    bonus: spof ? 35 : 20 + tier * 5,
  };
}

export function failedLabels(panel: Architecture): string[] {
  return panel.columns.flatMap((column) => column.nodes.filter((node) => node.failed).map((node) => node.label));
}

export function panelLabel(panel: Architecture, index: number): string {
  return `Sistema ${index === 0 ? 'A' : 'B'}: ${panel.title}. Falló: ${failedLabels(panel).join(', ')}.`;
}

export interface PlacedNode extends ArchNode {
  x: number;
  y: number;
  size: number;
  labelX: number;
  labelY: number;
  labelWidth: number;
}

export interface PlacedEdge {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  // El camino sirve solo si las dos piezas que une están sanas.
  alive: boolean;
}

export interface ArchLayout {
  size: number;
  showLabels: boolean;
  nodes: PlacedNode[];
  edges: PlacedEdge[];
}

const LABEL_HEIGHT = 16;
const LABEL_GAP = 2;
const ROW_GAP = 8;

// Reparte las piezas en columnas dentro de `width × height` (el espacio que da FitBox): el tamaño de las
// piezas sale del espacio disponible, y con muy poco alto se esconden las etiquetas antes de achicar el dibujo.
export function layoutArchitecture(columns: ArchColumn[], width: number, height: number): ArchLayout {
  const cols = columns.length;
  const rows = Math.max(1, ...columns.map((column) => column.nodes.length));
  const colWidth = width / cols;
  const perRow = (height - (rows - 1) * ROW_GAP) / rows;
  const showLabels = perRow - LABEL_HEIGHT - LABEL_GAP >= 30;
  const extra = showLabels ? LABEL_HEIGHT + LABEL_GAP : 0;
  const size = Math.floor(Math.max(24, Math.min(56, perRow - extra, colWidth * 0.62)));
  const block = size + extra;
  const placed: PlacedNode[][] = columns.map((column, c) => {
    const count = column.nodes.length;
    const top = (height - (count * block + (count - 1) * ROW_GAP)) / 2;
    const center = colWidth * (c + 0.5);
    return column.nodes.map((node, r) => {
      const y = Math.round(top + r * (block + ROW_GAP));
      return { ...node, x: Math.round(center - size / 2), y, size, labelX: Math.round(colWidth * c), labelY: y + size + LABEL_GAP, labelWidth: Math.floor(colWidth) };
    });
  });
  const edges: PlacedEdge[] = [];
  for (let c = 0; c < cols - 1; c += 1) {
    for (const a of placed[c]) {
      for (const b of placed[c + 1]) {
        edges.push({ id: `${a.id}>${b.id}`, x1: a.x + a.size, y1: a.y + a.size / 2, x2: b.x, y2: b.y + b.size / 2, alive: !a.failed && !b.failed });
      }
    }
  }
  return { size, showLabels, nodes: placed.flat(), edges };
}

// ---- Proceso glotón ----
export interface ProcessRow {
  id: string;
  name: string;
  icon: IconName;
  // Porcentaje de CPU y memoria en MB.
  cpu: number;
  mem: number;
  system: boolean;
}

export interface CpuRound {
  rows: ProcessRow[];
  // El proceso de usuario que más CPU usa: el que hay que cerrar.
  answerId: string;
  showMemory: boolean;
  // Con memoria a la vista, el que más memoria usa NO es el glotón de CPU.
  memoryLeaderId: string | null;
  total: number;
  tier: Tier;
  bonus: number;
}

interface ProcDef {
  name: string;
  icon: IconName;
  mem: [number, number];
}

export const userProcesses: ProcDef[] = [
  { name: 'Navegador', icon: 'globe', mem: [600, 1400] },
  { name: 'Juego 3D', icon: 'gamepad', mem: [900, 1400] },
  { name: 'minero.exe', icon: 'bug', mem: [80, 300] },
  { name: 'Editor de video', icon: 'image', mem: [900, 1400] },
  { name: 'Actualizador', icon: 'refresh', mem: [100, 400] },
  { name: 'Antivirus', icon: 'shieldCheck', mem: [150, 500] },
  { name: 'Chat de voz', icon: 'sound', mem: [150, 400] },
  { name: 'Compilador', icon: 'code', mem: [300, 900] },
  { name: 'Descargas', icon: 'inbox', mem: [80, 300] },
  { name: 'Mensajería', icon: 'mail', mem: [200, 500] },
];

export const systemProcesses: ProcDef[] = [
  { name: 'System', icon: 'settings', mem: [100, 300] },
  { name: 'svchost.exe', icon: 'settings', mem: [100, 300] },
  { name: 'kernel_task', icon: 'cpu', mem: [100, 300] },
  { name: 'systemd', icon: 'cpu', mem: [100, 300] },
];

export function formatMemory(mb: number): string {
  return mb >= 1000 ? `${(mb / 1000).toFixed(1).replace('.', ',')} GB` : `${mb} MB`;
}

export function cpuHogRound(level = 0, random: Random = Math.random): CpuRound {
  // 0: solo CPU · 1: también memoria (que despista) · 2: además un proceso del sistema que parece el glotón.
  const tier = tierFor(level, [1, 2]);
  const showMemory = tier >= 1;
  const withSystem = tier >= 2;
  const users = shuffle(userProcesses, random).slice(0, withSystem ? 3 : 4);
  // `count` valores distintos, chicos, que caben en el CPU que queda.
  const spread = (count: number, budget: number): number[] => {
    const top = Math.max(count + 1, Math.floor(budget / count));
    const values: number[] = [];
    while (values.length < count) {
      const value = int(random, 2, top);
      if (!values.includes(value)) values.push(value);
    }
    return values;
  };
  let hogCpu: number;
  let systemCpu = 0;
  let small: number[];
  if (withSystem) {
    hogCpu = int(random, 30, 42);
    // Casi siempre el del sistema supera al glotón: es la trampa de «el que más CPU usa».
    systemCpu = random() < 0.65 ? Math.min(hogCpu + int(random, 2, 8), 90 - hogCpu) : hogCpu - int(random, 4, 10);
    small = spread(2, 99 - hogCpu - systemCpu);
  } else {
    hogCpu = int(random, 60, 80);
    small = spread(3, 99 - hogCpu);
  }
  const memOf = (def: ProcDef) => int(random, def.mem[0], def.mem[1]);
  const entries: { row: Omit<ProcessRow, 'id'>; hog: boolean }[] = users.map((def, index) => ({
    row: { name: def.name, icon: def.icon, cpu: index === 0 ? hogCpu : small[index - 1], mem: memOf(def), system: false },
    hog: index === 0,
  }));
  if (withSystem) {
    const def = pick(systemProcesses, random);
    entries.push({ row: { name: def.name, icon: def.icon, cpu: systemCpu, mem: memOf(def), system: true }, hog: false });
  }
  // La memoria despista: el que más usa no es el glotón de CPU (ni el del sistema).
  const trap = showMemory ? pick(entries.filter((entry) => !entry.hog && !entry.row.system), random) : null;
  if (trap) trap.row.mem = int(random, 1800, 3200);
  const rows = shuffle(entries, random).map((entry, index) => ({ entry, row: { ...entry.row, id: `p${index}` } }));
  return {
    rows: rows.map((item) => item.row),
    answerId: rows.find((item) => item.entry.hog)?.row.id ?? rows[0].row.id,
    showMemory,
    memoryLeaderId: trap ? (rows.find((item) => item.entry === trap)?.row.id ?? null) : null,
    total: rows.reduce((sum, item) => sum + item.row.cpu, 0),
    tier,
    bonus: 20 + (showMemory ? 10 : 0) + (withSystem ? 15 : 0),
  };
}

export function cpuNote(round: CpuRound, chosenId: string | null): string {
  const hog = round.rows.find((row) => row.id === round.answerId) ?? round.rows[0];
  const picked = round.rows.find((row) => row.id === chosenId);
  if (!picked || picked.id === hog.id) return `«${hog.name}» usaba el ${hog.cpu} % de la CPU: al cerrarlo, el equipo vuelve a volar.`;
  if (picked.system) return `«${picked.name}» es del sistema: nunca se cierra. El glotón era «${hog.name}» (${hog.cpu} %).`;
  if (round.memoryLeaderId === picked.id) return `Mucha memoria no es mucha CPU. El glotón era «${hog.name}» (${hog.cpu} %).`;
  return `Cierra al que más CPU usa: «${hog.name}» con ${hog.cpu} %.`;
}

export function processLabel(row: ProcessRow, showMemory: boolean): string {
  return `${row.name}${row.system ? ', proceso del sistema' : ''}, CPU ${row.cpu} por ciento${showMemory ? `, memoria ${formatMemory(row.mem)}` : ''}`;
}

// ---- Código HTTP ----
export type HttpGroup = 'ok' | 'moved' | 'client' | 'server';

export interface HttpDef {
  code: number;
  name: string;
  group: HttpGroup;
  // Los cinco códigos que se ven primero; el resto entra desde el nivel medio.
  core: boolean;
  meaning: string;
  icon: IconName;
  scenes: { url: string; headline: string; sub: string }[];
}

export const httpDefs: HttpDef[] = [
  {
    code: 200,
    name: 'OK',
    group: 'ok',
    core: true,
    meaning: 'todo salió bien y la página llegó completa.',
    icon: 'checkCircle',
    scenes: [
      { url: 'soytel.cl/inicio', headline: 'Todo cargó bien', sub: 'La página se ve completa.' },
      { url: 'soytel.cl/ranking', headline: '¡Aquí está tu ranking!', sub: 'Los datos llegaron sin problema.' },
      { url: 'usm.cl/telematica', headline: 'La página abrió perfecto', sub: 'Todo funcionó como debía.' },
    ],
  },
  {
    code: 404,
    name: 'Not Found',
    group: 'client',
    core: true,
    meaning: 'esa dirección no existe en el servidor.',
    icon: 'help',
    scenes: [
      { url: 'soytel.cl/jeugos', headline: 'Esta página no existe', sub: 'Revisa la dirección: ¿está bien escrita?' },
      { url: 'usm.cl/carrera-xyz', headline: 'No encontramos esa página', sub: 'Nadie vive en esta dirección.' },
      { url: 'soytel.cl/premios-secretos', headline: 'Página no encontrada', sub: 'Esa dirección no existe.' },
    ],
  },
  {
    code: 500,
    name: 'Server Error',
    group: 'server',
    core: true,
    meaning: 'el servidor falló por dentro; el error no es tuyo.',
    icon: 'bug',
    scenes: [
      { url: 'soytel.cl/ranking', headline: 'El servidor se rompió', sub: 'Algo falló por dentro. No fue tu culpa.' },
      { url: 'tienda.cl/pagar', headline: 'Error del servidor', sub: 'El programa del servidor falló al responder.' },
      { url: 'soytel.cl/perfil', headline: '¡Ups! Falló el servidor', sub: 'Tu petición estaba bien; el error es de ellos.' },
    ],
  },
  {
    code: 401,
    name: 'Unauthorized',
    group: 'client',
    core: true,
    meaning: 'el servidor no sabe quién eres: inicia sesión.',
    icon: 'lock',
    scenes: [
      { url: 'soytel.cl/perfil', headline: 'Debes iniciar sesión', sub: 'Aún no sabemos quién eres.' },
      { url: 'banco.cl/cuenta', headline: 'Inicia sesión para entrar', sub: 'Falta que te identifiques.' },
      { url: 'soytel.cl/mis-puntos', headline: 'Primero inicia sesión', sub: 'No hay ninguna sesión abierta.' },
    ],
  },
  {
    code: 429,
    name: 'Too Many Requests',
    group: 'client',
    core: true,
    meaning: 'hiciste demasiadas peticiones: espera un poco.',
    icon: 'timer',
    scenes: [
      { url: 'soytel.cl/login', headline: 'Demasiados intentos', sub: 'Espera un momento antes de volver a probar.' },
      { url: 'api.tel.cl/datos', headline: 'Vas muy rápido', sub: 'Hiciste muchas peticiones seguidas.' },
      { url: 'soytel.cl/votar', headline: 'Muchos clics seguidos', sub: 'Te pasaste del límite: espera un poco.' },
    ],
  },
  {
    code: 403,
    name: 'Forbidden',
    group: 'client',
    core: false,
    meaning: 'sí te conoce, pero no tienes permiso para entrar.',
    icon: 'shield',
    scenes: [
      { url: 'soytel.cl/admin', headline: 'No tienes permiso', sub: 'Sí iniciaste sesión, pero esta zona es de admins.' },
      { url: 'usm.cl/notas-profes', headline: 'Acceso prohibido', sub: 'Ya iniciaste sesión, pero no tienes permiso.' },
    ],
  },
  {
    code: 503,
    name: 'Unavailable',
    group: 'server',
    core: false,
    meaning: 'el servidor no puede atender ahora (mantenimiento o sobrecarga).',
    icon: 'settings',
    scenes: [
      { url: 'soytel.cl/tienda', headline: 'En mantenimiento', sub: 'El servidor no puede atender ahora. Vuelve luego.' },
      { url: 'entradas.cl/compra', headline: 'Servicio no disponible', sub: 'Hay tanta gente que el servidor no da abasto.' },
    ],
  },
  {
    code: 301,
    name: 'Moved Permanently',
    group: 'moved',
    core: false,
    meaning: 'la página se mudó para siempre a otra dirección.',
    icon: 'arrowRight',
    scenes: [
      { url: 'soytel.cl/viejo', headline: 'Esta página se mudó', sub: 'Ahora vive en otra dirección para siempre.' },
      { url: 'usm.cl/tel', headline: 'Cambió de dirección', sub: 'Te llevamos a la nueva, que es permanente.' },
    ],
  },
  {
    code: 400,
    name: 'Bad Request',
    group: 'client',
    core: false,
    meaning: 'el servidor no entendió tu petición.',
    icon: 'alert',
    scenes: [
      { url: 'soytel.cl/registro', headline: 'No entendimos tu pedido', sub: 'El formulario venía mal armado.' },
      { url: 'api.tel.cl/usuarios', headline: 'Petición mal formada', sub: 'El servidor no pudo entender lo que enviaste.' },
    ],
  },
  {
    code: 201,
    name: 'Created',
    group: 'ok',
    core: false,
    meaning: 'se creó algo nuevo (por ejemplo, tu cuenta).',
    icon: 'sparkle',
    scenes: [
      { url: 'soytel.cl/registro', headline: '¡Cuenta creada!', sub: 'El servidor guardó tu nuevo usuario.' },
      { url: 'api.tel.cl/mensajes', headline: 'Mensaje publicado', sub: 'Se creó un recurso nuevo.' },
    ],
  },
];

// Códigos que se confunden entre sí: nunca aparecen juntos como opciones de la misma ronda.
export const confusable: number[][] = [
  [200, 201],
  [401, 403],
  [500, 503],
  [429, 503],
];

export interface HttpOption {
  code: number;
  name: string;
  group: HttpGroup;
}

export interface HttpRound {
  code: number;
  url: string;
  headline: string;
  sub: string;
  icon: IconName;
  group: HttpGroup;
  options: HttpOption[];
  // Al principio las opciones traen el nombre en inglés; más tarde solo el número.
  showNames: boolean;
  tier: Tier;
  note: string;
  bonus: number;
}

export function httpRound(level = 0, random: Random = Math.random): HttpRound {
  const tier = tierFor(level, [2, 4]);
  const pool = tier === 0 ? httpDefs.filter((def) => def.core) : httpDefs;
  const answer = pick(pool, random);
  const scene = pick(answer.scenes, random);
  const clash = (code: number) => confusable.some((group) => group.includes(answer.code) && group.includes(code));
  const others = shuffle(pool.filter((def) => def.code !== answer.code && !clash(def.code)), random).slice(0, 3);
  return {
    code: answer.code,
    url: scene.url,
    headline: scene.headline,
    sub: scene.sub,
    icon: answer.icon,
    group: answer.group,
    options: shuffle([answer, ...others], random).map((def) => ({ code: def.code, name: def.name, group: def.group })),
    showNames: tier < 2,
    tier,
    note: `Era el ${answer.code}: ${answer.meaning}`,
    bonus: 15 + tier * 10,
  };
}

export function optionLabel(option: HttpOption, showNames: boolean): string {
  return showNames ? `${option.code} ${option.name}` : `${option.code}`;
}

// ---- Caza el bug ----
export type CodeKind = 'plain' | 'keyword' | 'string' | 'number';

export interface CodeToken {
  text: string;
  kind: CodeKind;
}

const KEYWORDS = new Set(['si', 'sino', 'para', 'en', 'mientras', 'y', 'o', 'romper', 'al']);

// Parte una línea en trozos para pintarla como un editor de código; al unir los trozos sale la línea original.
export function highlightCode(line: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  for (const match of line.matchAll(/"[^"]*"|\d+(?:\.\d+)?|[A-Za-zÁÉÍÓÚÑáéíóúñ_]+|\s+|./gu)) {
    const text = match[0];
    const kind: CodeKind = text.startsWith('"') ? 'string' : /^\d/.test(text) ? 'number' : KEYWORDS.has(text) ? 'keyword' : 'plain';
    tokens.push({ text, kind });
  }
  return tokens;
}

interface BugVariant {
  // Línea (desde 0) que se cambia y cómo queda; `tier` es qué tan sutil es el error.
  line: number;
  text: string;
  why: string;
  tier: Tier;
}

interface BugProgram {
  goal: string;
  lines: string[];
  bugs: BugVariant[];
}

// Programas cortos (3 o 4 líneas de 28 letras como máximo): cada error cambia UNA línea del programa correcto.
export const bugTemplates: ((random: Random) => BugProgram)[] = [
  (random) => {
    const n = pick([25, 30, 35], random);
    return {
      goal: `Encender el ventilador si hace más de ${n} °C`,
      lines: ['t = leer_temperatura()', `si t > ${n}:`, '    encender(ventilador)', 'sino: apagar(ventilador)'],
      bugs: [
        { line: 1, text: `si t < ${n}:`, why: `Con «<» enciende cuando hace MENOS de ${n} °C: debía ser «>».`, tier: 0 },
        { line: 2, text: '    apagar(ventilador)', why: 'Con calor debía encender el ventilador, no apagarlo.', tier: 0 },
        { line: 0, text: 't = leer_humedad()', why: 'Lee la humedad, no la temperatura.', tier: 1 },
      ],
    };
  },
  (random) => {
    const n = pick([4, 5, 6], random);
    return {
      goal: `Sumar los números del 1 al ${n}`,
      lines: ['total = 0', `para i en 1..${n}:`, '    total = total + i', 'mostrar(total)'],
      bugs: [
        { line: 2, text: '    total = total + 1', why: 'Suma siempre 1 en vez de sumar i.', tier: 0 },
        { line: 3, text: 'mostrar(i)', why: 'Muestra i, no el total.', tier: 0 },
        { line: 0, text: 'total = 1', why: 'Debe partir en 0: así suma 1 de más.', tier: 1 },
        { line: 1, text: `para i en 1..${n - 1}:`, why: `Se detiene en ${n - 1}: falta sumar el ${n}.`, tier: 1 },
        { line: 2, text: '    total = i', why: 'Reemplaza el total en cada vuelta en vez de acumular.', tier: 1 },
      ],
    };
  },
  (random) => {
    const n = pick([12, 14, 16, 18], random);
    return {
      goal: `Dejar pasar a quien tenga ${n} años o más`,
      lines: ['edad = pedir_edad()', `si edad >= ${n}:`, '    abrir(puerta)', 'sino: mostrar("No puedes")'],
      bugs: [
        { line: 1, text: `si edad <= ${n}:`, why: 'El signo está al revés: dejaría pasar a los menores.', tier: 0 },
        { line: 2, text: '    cerrar(puerta)', why: 'Si cumple la edad, debía abrir la puerta.', tier: 0 },
        { line: 1, text: `si edad > ${n}:`, why: `Con «>» no pasa quien tiene justo ${n}: debía ser «>=».`, tier: 2 },
      ],
    };
  },
  (random) => {
    const key = pick(['tel123', 'rutix', 'usm2025', 'redes'], random);
    return {
      goal: 'Entrar solo si la clave es correcta',
      lines: ['clave = pedir_clave()', `si clave == "${key}":`, '    entrar()', 'sino: bloquear()'],
      bugs: [
        { line: 2, text: '    bloquear()', why: 'Con la clave correcta debía entrar, no bloquear.', tier: 0 },
        { line: 1, text: `si clave != "${key}":`, why: '«!=» significa «distinto»: entraría con cualquier clave mala.', tier: 1 },
        { line: 1, text: `si clave = "${key}":`, why: 'Un solo «=» asigna; para comparar se usa «==».', tier: 2 },
      ],
    };
  },
  (random) => {
    const n = pick([3, 4, 5], random);
    return {
      goal: `Contar de ${n} a 1 y decir ¡Despegue!`,
      lines: [`n = ${n}`, 'mientras n > 0:', '    mostrar(n); n = n - 1', 'mostrar("¡Despegue!")'],
      bugs: [
        { line: 2, text: '    mostrar(n); n = n + 1', why: 'Suma en vez de restar: n nunca llega a 0 y no termina.', tier: 0 },
        { line: 1, text: 'mientras n < 0:', why: `Con «<» el bucle nunca arranca: ${n} no es menor que 0.`, tier: 1 },
        { line: 0, text: 'n = 0', why: 'Parte en 0: el bucle no cuenta nada.', tier: 1 },
      ],
    };
  },
  (random) => {
    const n = pick([20, 30, 50], random);
    return {
      goal: `Rebajar 10 % si el total pasa de $${n}.000`,
      lines: ['total = sumar(carrito)', `si total > ${n}000:`, '    total = total * 0.9', 'mostrar(total)'],
      bugs: [
        { line: 1, text: `si total < ${n}000:`, why: 'El descuento iría a las compras chicas: el signo está al revés.', tier: 0 },
        { line: 2, text: '    total = total * 1.9', why: 'Multiplicar por 1,9 sube el precio; rebajar 10 % es × 0,9.', tier: 1 },
        { line: 2, text: '    total = total * 0.1', why: 'Con × 0,1 queda solo el 10 %: rebajar 10 % es × 0,9.', tier: 2 },
      ],
    };
  },
  () => ({
    goal: 'Encontrar el número mayor de la lista',
    lines: ['mayor = lista[0]', 'para x en lista:', '    si x > mayor: mayor = x', 'mostrar(mayor)'],
    bugs: [
      { line: 2, text: '    si x < mayor: mayor = x', why: 'Así encuentra el menor, no el mayor.', tier: 0 },
      { line: 3, text: 'mostrar(x)', why: 'Muestra el último x, no el mayor.', tier: 0 },
      { line: 2, text: '    si x > mayor: x = mayor', why: 'Copia el mayor sobre x en vez de guardarlo: nunca se actualiza.', tier: 2 },
    ],
  }),
  (random) => {
    const n = pick([19, 20, 21], random);
    return {
      goal: `Prender la luz entre las ${n} y las 6 h`,
      lines: ['hora = leer_hora()', `si hora >= ${n} o hora < 6:`, '    prender(luz)', 'sino: apagar(luz)'],
      bugs: [
        { line: 2, text: '    apagar(luz)', why: 'De noche debía prender la luz, no apagarla.', tier: 0 },
        { line: 1, text: `si hora <= ${n} o hora < 6:`, why: 'Con «<=» prende la luz de día: debía ser «>=».', tier: 1 },
        { line: 1, text: `si hora >= ${n} y hora < 6:`, why: '«y» pide las dos cosas a la vez: imposible. Debía ser «o».', tier: 2 },
      ],
    };
  },
  (random) => {
    const n = pick([3, 5], random);
    return {
      goal: 'Terminar el juego al quedarse sin vidas',
      lines: [`vidas = ${n}`, 'al chocar: vidas = vidas - 1', 'si vidas == 0:', '    terminar_juego()'],
      bugs: [
        { line: 1, text: 'al chocar: vidas = vidas + 1', why: 'Al chocar debía restar una vida, no sumarla.', tier: 0 },
        { line: 2, text: `si vidas == ${n}:`, why: `Debía terminar al llegar a 0 vidas, no a ${n}.`, tier: 1 },
        { line: 0, text: 'vidas = 0', why: 'Con 0 vidas el juego terminaría de inmediato.', tier: 1 },
      ],
    };
  },
  (random) => {
    const n = pick([3, 4, 5], random);
    return {
      goal: `Reintentar la conexión hasta ${n} veces`,
      lines: ['intentos = 0', `mientras intentos < ${n}:`, '    si conectar(): romper', '    intentos = intentos + 1'],
      bugs: [
        { line: 1, text: `mientras intentos > ${n}:`, why: `Con «>» nunca entra: 0 no es mayor que ${n}.`, tier: 0 },
        { line: 3, text: '    intentos = intentos - 1', why: 'Restar impide llegar al límite: reintentaría sin fin.', tier: 1 },
        { line: 0, text: `intentos = ${n}`, why: `Partir en ${n} impide el primer intento.`, tier: 1 },
      ],
    };
  },
  (random) => {
    const n = pick([10, 15, 20, 25], random);
    return {
      goal: `Avisar si la batería llega a ${n} % o menos`,
      lines: ['b = leer_bateria()', `si b <= ${n}:`, '    avisar("Batería baja")'],
      bugs: [
        { line: 1, text: `si b >= ${n}:`, why: 'El signo está al revés: avisaría con la batería llena.', tier: 0 },
        { line: 0, text: 'b = leer_temperatura()', why: 'Lee la temperatura, no la batería.', tier: 1 },
        { line: 1, text: `si b < ${n}:`, why: `Con «<» no avisa justo en ${n} %: debía ser «<=».`, tier: 2 },
      ],
    };
  },
];

export interface BugRound {
  goal: string;
  // El programa con el error y el programa correcto (difieren en una sola línea).
  lines: string[];
  fixed: string[];
  bugIndex: number;
  why: string;
  tier: Tier;
  bonus: number;
}

export function bugHuntRound(level = 0, random: Random = Math.random): BugRound {
  const maxTier = tierFor(level, [2, 4]);
  const program = pick(bugTemplates, random)(random);
  const bug = pick(
    program.bugs.filter((item) => item.tier <= maxTier),
    random,
  );
  return {
    goal: program.goal,
    lines: program.lines.map((line, index) => (index === bug.line ? bug.text : line)),
    fixed: program.lines,
    bugIndex: bug.line,
    why: bug.why,
    tier: bug.tier,
    bonus: 20 + bug.tier * 15,
  };
}

export function bugNote(round: BugRound): string {
  return `Línea ${round.bugIndex + 1}: ${round.why}`;
}

export function lineLabel(index: number, line: string): string {
  return `Línea ${index + 1}: ${line.trim()}`;
}
