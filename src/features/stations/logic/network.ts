// Lógica pura de "Operación Red B215": topología, tabla de rutas y canales Wi-Fi.

export type DeviceKind = 'router' | 'switch' | 'ap' | 'hub';
export type SlotId = 'edge' | 'core' | 'wifi';

export const slotNeeds: Record<SlotId, DeviceKind> = {
  edge: 'router',
  core: 'switch',
  wifi: 'ap',
};

export const deviceLabels: Record<DeviceKind, string> = {
  router: 'Router',
  switch: 'Switch',
  ap: 'Access Point',
  hub: 'Hub',
};

// Explicación cuando el equipo no corresponde al lugar.
export function placementHint(device: DeviceKind, slot: SlotId): string {
  if (device === 'hub') return 'Los hubs repiten todo a todos los puertos: hoy se usan switches.';
  if (slot === 'edge') return 'Para salir a Internet se necesita un router: une redes y elige rutas.';
  if (slot === 'core') return 'Para conectar varios PCs por cable dentro de la LAN se usa un switch.';
  return 'Los celulares se conectan sin cables: ahí va el access point (Wi-Fi).';
}

export type Interface = 'lan' | 'servers' | 'internet';

export const routingTable: { id: Interface; network: string; label: string }[] = [
  { id: 'lan', network: '192.168.1.0/24', label: 'LAN B215' },
  { id: 'servers', network: '10.0.0.0/24', label: 'Servidores' },
  { id: 'internet', network: '0.0.0.0/0', label: 'Internet' },
];

// Aplica la tabla: coincidencia más específica primero y ruta por defecto al final.
export function routeFor(ip: string): Interface {
  const parts = ip.split('.').map(Number);
  if (parts[0] === 192 && parts[1] === 168 && parts[2] === 1) return 'lan';
  if (parts[0] === 10 && parts[1] === 0 && parts[2] === 0) return 'servers';
  return 'internet';
}

export interface Packet {
  id: number;
  ip: string;
  answer: Interface;
  tricky: boolean;
}

const INTERNET_HOSTS = ['8.8.8.8', '1.1.1.1', '142.250.78.14', '200.1.123.45', '157.240.12.35', '104.16.132.229'];

export function makePacket(id: number, random: () => number): Packet {
  const octet = () => 2 + Math.floor(random() * 250);
  const roll = random();
  let ip: string;
  let tricky = false;
  if (id > 4 && roll < 0.22) {
    // Parecen locales, pero no calzan con la máscara /24: salen por la ruta por defecto.
    tricky = true;
    ip = random() < 0.5 ? `192.168.${2 + Math.floor(random() * 8)}.${octet()}` : `10.0.${1 + Math.floor(random() * 8)}.${octet()}`;
  } else if (roll < 0.5) {
    ip = `192.168.1.${octet()}`;
  } else if (roll < 0.75) {
    ip = `10.0.0.${octet()}`;
  } else {
    ip = INTERNET_HOSTS[Math.floor(random() * INTERNET_HOSTS.length)];
  }
  return { id, ip, answer: routeFor(ip), tricky };
}

// Tiempo de vida del paquete: baja a medida que el jugador avanza.
export function packetTtlMs(resolved: number): number {
  return Math.max(2400, 5000 - resolved * 130);
}

export function packetPoints(streak: number): number {
  return 18 + (streak >= 6 ? 8 : streak >= 3 ? 4 : 0);
}

export const ROUTING_MAX = 450;
export const TOPOLOGY_MAX = 300;
export const WIFI_MAX = 250;

// Canales de 2,4 GHz: cada uno ocupa ~22 MHz (≈ 5 canales de 5 MHz).
export function channelOverlap(a: number, b: number): number {
  return Math.max(0, 5 - Math.abs(a - b));
}

export function interference(channels: number[]): number {
  let total = 0;
  for (let i = 0; i < channels.length; i += 1) {
    for (let j = i + 1; j < channels.length; j += 1) total += channelOverlap(channels[i], channels[j]);
  }
  return total;
}

export const MAX_INTERFERENCE = 15;

export function initialChannels(random: () => number): number[] {
  const base = 4 + Math.floor(random() * 5);
  return [base, Math.min(13, base + 1), Math.max(1, base - 1 + Math.floor(random() * 3))];
}

export function wifiScore(solved: boolean, remainingRatio: number, currentInterference: number): number {
  if (solved) return Math.round(WIFI_MAX * (0.45 + 0.55 * Math.max(0, Math.min(1, remainingRatio))));
  return Math.round(WIFI_MAX * 0.4 * (1 - Math.min(1, currentInterference / MAX_INTERFERENCE)));
}
