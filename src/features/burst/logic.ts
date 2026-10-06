// Reglas puras de los microjuegos (sin UI) para poder probarlas.

export type Random = () => number;

export function shuffle<T>(items: T[], random: Random = Math.random): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

export function pick<T>(items: T[], random: Random = Math.random): T {
  return items[Math.floor(random() * items.length)];
}

// ---- Contraseña fuerte ----
export type PasswordLevel = 0 | 1 | 2 | 3;
export const passwordLevelLabels = ['Débil', 'Media', 'Fuerte', 'Muy fuerte'] as const;

export function passwordStrength(password: string, words: number): { level: PasswordLevel; points: number } {
  const variety = [/[a-záéíóúñ]/, /[A-ZÁÉÍÓÚÑ]/, /\d/, /[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ]/].filter((pattern) => pattern.test(password)).length;
  const multiplier = variety >= 3 ? 1.3 : variety === 2 ? 1.1 : 1;
  const points = password.length * multiplier + words * 3;
  const level: PasswordLevel = points < 10 ? 0 : points < 16 ? 1 : points < 22 ? 2 : 3;
  return { level, points };
}

// ---- Wi-Fi Boost ----
export interface Point {
  x: number;
  y: number;
}

export function wifiSignal(router: Point, laptop: Point, microwave: Point, size: { width: number; height: number }): { strength: number; interference: boolean } {
  const maxDistance = Math.hypot(size.width, size.height) * 0.7;
  const distance = Math.hypot(router.x - laptop.x, router.y - laptop.y);
  const base = Math.max(0, Math.min(1, 1 - distance / maxDistance));
  const interference = Math.hypot(router.x - microwave.x, router.y - microwave.y) < 70;
  return { strength: interference ? base * 0.45 : base, interference };
}

export function signalBars(strength: number): number {
  if (strength >= 0.92) return 4;
  if (strength >= 0.7) return 3;
  if (strength >= 0.45) return 2;
  return strength > 0.15 ? 1 : 0;
}

// ---- Sintoniza la antena (onda triangular determinista) ----
export function needlePosition(elapsedMs: number, periodMs: number): number {
  const phase = (elapsedMs % periodMs) / periodMs;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}

// ---- Crimpado RJ45 (norma T568B) ----
export interface Wire {
  id: string;
  label: string;
  color: string;
  striped: boolean;
}

const ORANGE = '#E8833A';
const GREEN = '#3FA66B';
const BLUE = '#3B6FD6';
const BROWN = '#8B5A3C';

export const t568b: Wire[] = [
  { id: 'wo', label: 'Blanco-naranja', color: ORANGE, striped: true },
  { id: 'o', label: 'Naranja', color: ORANGE, striped: false },
  { id: 'wg', label: 'Blanco-verde', color: GREEN, striped: true },
  { id: 'b', label: 'Azul', color: BLUE, striped: false },
  { id: 'wb', label: 'Blanco-azul', color: BLUE, striped: true },
  { id: 'g', label: 'Verde', color: GREEN, striped: false },
  { id: 'wbr', label: 'Blanco-marrón', color: BROWN, striped: true },
  { id: 'br', label: 'Marrón', color: BROWN, striped: false },
];

export function crimpRound(random: Random = Math.random): { missing: number; options: Wire[] } {
  const missing = Math.floor(random() * t568b.length);
  const answer = t568b[missing];
  const distractors = shuffle(t568b.filter((wire) => wire.id !== answer.id), random).slice(0, 3);
  return { missing, options: shuffle([answer, ...distractors], random) };
}

// ---- Firewall ----
export interface Packet {
  id: string;
  title: string;
  detail: string;
  malicious: boolean;
}

export const firewallPackets: Packet[] = [
  { id: 'https', title: 'HTTPS · puerto 443', detail: 'Navegación web cifrada', malicious: false },
  { id: 'dns', title: 'DNS · puerto 53', detail: 'Consulta de nombre de dominio', malicious: false },
  { id: 'mail', title: 'Correo · puerto 587', detail: 'Envío autenticado del campus', malicious: false },
  { id: 'update', title: 'Actualización firmada', detail: 'Parche oficial del sistema operativo', malicious: false },
  { id: 'telnet', title: 'Telnet · puerto 23', detail: 'Acceso sin cifrar desde IP desconocida', malicious: true },
  { id: 'exe', title: 'factura_urgente.exe', detail: 'Adjunto sospechoso de remitente falso', malicious: true },
  { id: 'scan', title: 'Escaneo de puertos', detail: '1.000 conexiones en 2 segundos', malicious: true },
  { id: 'brute', title: 'Acceso remoto', detail: '50 contraseñas fallidas seguidas', malicious: true },
];

export function firewallRound(count = 4, random: Random = Math.random): Packet[] {
  const good = shuffle(firewallPackets.filter((packet) => !packet.malicious), random).slice(0, Math.ceil(count / 2));
  const bad = shuffle(firewallPackets.filter((packet) => packet.malicious), random).slice(0, Math.floor(count / 2));
  return shuffle([...good, ...bad], random);
}

// ---- Ping ----
export type PingScenario = 'ok' | 'timeout' | 'unreachable';

export function pingLines(scenario: PingScenario, host = 'usm.cl'): string[] {
  const header = `$ ping ${host}`;
  if (scenario === 'ok') {
    return [header, ...[1, 2, 3].map((seq) => `64 bytes de 203.0.113.10: icmp_seq=${seq} ttl=54 tiempo=${18 + seq * 3} ms`)];
  }
  if (scenario === 'timeout') {
    return [header, ...[1, 2, 3].map((seq) => `Tiempo de espera agotado para icmp_seq ${seq}`)];
  }
  return [header, 'Desde 192.168.1.1: Host de destino inaccesible', 'Desde 192.168.1.1: Host de destino inaccesible'];
}

// ---- Bits en orden (binario) ----
export function binaryRound(random: Random = Math.random, bits = 4): { target: number; bits: number } {
  const max = 2 ** bits - 1;
  return { target: 1 + Math.floor(random() * max), bits };
}

// Valor decimal de los bits (el primero es el más significativo).
export function bitsValue(flags: boolean[]): number {
  return flags.reduce((total, on, index) => total + (on ? 2 ** (flags.length - 1 - index) : 0), 0);
}

// ---- Ordenar tocando (capas TCP/IP, unidades de datos) ----
export interface OrderItem {
  id: string;
  label: string;
  detail: string;
}

// De abajo (el medio físico) hacia arriba (lo que ve la persona).
export const tcpIpStack: OrderItem[] = [
  { id: 'link', label: 'Enlace', detail: 'Wi-Fi o cable' },
  { id: 'internet', label: 'Internet', detail: 'Direcciones IP' },
  { id: 'transport', label: 'Transporte', detail: 'TCP o UDP' },
  { id: 'app', label: 'Aplicación', detail: 'La app que usas' },
];

export const dataUnits: OrderItem[] = [
  { id: 'bit', label: 'bit', detail: 'un 0 o un 1' },
  { id: 'byte', label: 'byte', detail: '8 bits' },
  { id: 'kb', label: 'kilobyte', detail: 'kB · mil bytes' },
  { id: 'mb', label: 'megabyte', detail: 'MB · una foto' },
  { id: 'gb', label: 'gigabyte', detail: 'GB · una película' },
];

// Elige `count` elementos (respetando su orden) y los entrega desordenados.
export function orderRound(items: OrderItem[], count: number, random: Random = Math.random): { correct: OrderItem[]; shuffled: OrderItem[] } {
  const keep = new Set(shuffle(items.map((item) => item.id), random).slice(0, Math.min(count, items.length)));
  const correct = items.filter((item) => keep.has(item.id));
  let shuffled = shuffle(correct, random);
  // Nunca se entrega ya resuelto.
  if (shuffled.every((item, index) => item.id === correct[index].id)) shuffled = [...shuffled.slice(1), shuffled[0]];
  return { correct, shuffled };
}

// ---- ¿IP válida? ----
export function isValidIpv4(text: string): boolean {
  const parts = text.split('.');
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

export interface IpOption {
  id: string;
  text: string;
  valid: boolean;
}

export function ipRound(random: Random = Math.random): IpOption[] {
  const octet = (max = 255) => Math.floor(random() * (max + 1));
  const base = pick(
    [
      () => `192.168.${octet(20)}.${1 + octet(253)}`,
      () => `10.${octet(50)}.${octet()}.${1 + octet(253)}`,
      () => `172.16.${octet(31)}.${1 + octet(253)}`,
      () => `200.${1 + octet(30)}.${octet()}.${1 + octet(253)}`,
    ],
    random,
  );
  const fakes = shuffle(
    [
      () => `192.168.${256 + octet(40)}.${octet(99)}`,
      () => `10.0.${octet(99)}`,
      () => `172.16.${octet(31)}.${octet(99)}.${octet(99)}`,
      () => `192.168,1,${octet(99)}`,
      () => `300.${octet(99)}.${octet(99)}.1`,
      () => `10.a.${octet(99)}.7`,
    ],
    random,
  ).slice(0, 3);
  const options = [{ text: base(), valid: true }, ...fakes.map((make) => ({ text: make(), valid: false }))];
  return shuffle(options, random).map((option, index) => ({ ...option, id: `ip${index}` }));
}

// ---- Ruta más rápida ----
export interface RouteOption {
  id: string;
  hops: number[];
  total: number;
}

export function fastRouteRound(random: Random = Math.random, level = 0): RouteOption[] {
  const hopsCount = level >= 3 ? 4 : 3;
  for (;;) {
    const routes = ['A', 'B', 'C'].map((id) => {
      const hops = Array.from({ length: hopsCount }, () => 4 + Math.floor(random() * 42));
      return { id, hops, total: hops.reduce((sum, value) => sum + value, 0) };
    });
    const totals = routes.map((route) => route.total).sort((a, b) => a - b);
    // Una sola ruta ganadora, con diferencia visible.
    if (totals[1] - totals[0] >= 4) return routes;
  }
}

// ---- Sitio verdadero ----
export interface UrlOption {
  id: string;
  url: string;
  legit: boolean;
  why: string;
}

const urlSets: { legit: string; fakes: { url: string; why: string }[] }[] = [
  {
    legit: 'https://www.usm.cl',
    fakes: [
      { url: 'http://usm-cl.premios.xyz', why: 'El dominio real es premios.xyz.' },
      { url: 'https://www.usrn.cl', why: '«rn» imita a la «m».' },
      { url: 'https://usm.cl.acceso-seguro.ru', why: 'El dominio real es lo último: acceso-seguro.ru.' },
    ],
  },
  {
    legit: 'https://www.instagram.com',
    fakes: [
      { url: 'https://www.lnstagram.com', why: 'Empieza con «L» minúscula, no con «i».' },
      { url: 'https://instagram.com.premio.live', why: 'El dominio real es premio.live.' },
      { url: 'http://insta-gram.login.xyz', why: 'Sin candado y con dominio login.xyz.' },
    ],
  },
  {
    legit: 'https://mail.google.com',
    fakes: [
      { url: 'https://mail.google.com.verificar.io', why: 'El dominio real es verificar.io.' },
      { url: 'https://mail.g00gle.com', why: 'Usa ceros en vez de la letra «o».' },
      { url: 'http://google-mail.entrar.top', why: 'Sin candado y con dominio entrar.top.' },
    ],
  },
  {
    legit: 'https://www.bancoestado.cl',
    fakes: [
      { url: 'https://bancoestado.cl-clave.com', why: 'El dominio real es cl-clave.com.' },
      { url: 'http://www.banc0estado.cl', why: 'Tiene un cero en vez de «o» y no usa https.' },
      { url: 'https://bancoestado.seguridad-cl.net', why: 'El dominio real es seguridad-cl.net.' },
    ],
  },
];

export function urlRound(random: Random = Math.random): UrlOption[] {
  const set = pick(urlSets, random);
  const options = [{ url: set.legit, legit: true, why: 'Dominio oficial y con https.' }, ...set.fakes.map((fake) => ({ ...fake, legit: false }))];
  return shuffle(options, random).map((option, index) => ({ ...option, id: `url${index}` }));
}
