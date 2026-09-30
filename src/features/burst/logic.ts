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
