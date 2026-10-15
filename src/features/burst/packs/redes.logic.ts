import type { DeviceKind } from '@/components/graphics/DeviceArt';
import type { IconName } from '@/graphics/icons';
import { pick, shuffle, type Random } from '../logic';

// Reglas puras del paquete de microjuegos «Redes»: switch, router, DNS, TCP, subredes y topologías.
// Cada generador recibe el nivel de la ráfaga (0 = primera ronda) y devuelve una ronda con una sola
// respuesta correcta. Todo el azar entra por `random`, así se prueba con muchas semillas.

// ---- Utilidades ----

// Entero entre `min` y `max`, ambos incluidos.
export function randInt(min: number, max: number, random: Random = Math.random): number {
  return min + Math.floor(random() * (max - min + 1));
}

// Bono de una ronda ganada: sube un poco con el nivel y nunca pasa de 60.
export function bonusFor(level: number, base = 20): number {
  const steps = Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
  return Math.min(60, base + steps * 4);
}

// Elige `count` elementos de familias distintas (para no juntar equipos casi iguales en una ronda).
function pickDistinct<T extends { family: string }>(items: readonly T[], count: number, random: Random): T[] {
  const used = new Set<string>();
  const chosen: T[] = [];
  for (const item of shuffle([...items], random)) {
    if (used.has(item.family)) continue;
    used.add(item.family);
    chosen.push(item);
    if (chosen.length === count) break;
  }
  return chosen;
}

// Un número vecino (±1) de `value` que siga dentro de [min, max].
function neighbor(value: number, min: number, max: number, random: Random): number {
  const up = value + 1 <= max;
  const down = value - 1 >= min;
  if (up && down) return random() < 0.5 ? value + 1 : value - 1;
  return up ? value + 1 : value - 1;
}

// Un número distinto de `value` dentro de [min, max].
function different(value: number, min: number, max: number, random: Random): number {
  const next = randInt(min, max - 1, random);
  return next >= value ? next + 1 : next;
}

// ---- 1. El switch reparte ----

export interface SwitchDevice {
  kind: DeviceKind;
  name: string;
  // Equipos de la misma familia no se mezclan en una ronda (PC y notebook, servidor y servidor DNS).
  family: string;
}

export const switchDevices: SwitchDevice[] = [
  { kind: 'pc', name: 'Computador', family: 'estacion' },
  { kind: 'laptop', name: 'Notebook', family: 'estacion' },
  { kind: 'printer', name: 'Impresora', family: 'impresora' },
  { kind: 'server', name: 'Servidor', family: 'servidor' },
  { kind: 'dns', name: 'Servidor DNS', family: 'servidor' },
  { kind: 'camera', name: 'Cámara IP', family: 'camara' },
  { kind: 'accessPoint', name: 'Access point', family: 'wifi' },
  { kind: 'router', name: 'Router', family: 'router' },
  { kind: 'firewall', name: 'Firewall', family: 'firewall' },
];

// Con nombres al principio; desde el nivel 2 el sobre y los puertos usan la dirección MAC.
export type SwitchMode = 'name' | 'mac';

export interface SwitchPort {
  port: number;
  device: SwitchDevice;
  mac: string;
}

export interface SwitchRound {
  mode: SwitchMode;
  ports: SwitchPort[];
  // Número del puerto correcto (1 a 4).
  answer: number;
  // Lo que dice el sobre: el nombre del equipo o su dirección MAC.
  destination: string;
  note: string;
}

const HEX = '0123456789ABCDEF';

function hexDigit(random: Random): string {
  return HEX[Math.floor(random() * 16)];
}

function hexByte(random: Random): string {
  return hexDigit(random) + hexDigit(random);
}

// Otro dígito hexadecimal (nunca el mismo).
function otherDigit(digit: string, random: Random): string {
  return HEX[(HEX.indexOf(digit) + 1 + Math.floor(random() * 15)) % 16];
}

// Un byte casi igual al original: cambia un dígito o intercambia los dos.
function lookalikeByte(byte: string, random: Random): string {
  const kind = Math.floor(random() * 3);
  if (kind === 0) return otherDigit(byte[0], random) + byte[1];
  if (kind === 1) return byte[0] + otherDigit(byte[1], random);
  return byte[1] + byte[0];
}

// Cuatro direcciones MAC distintas. Desde el nivel 4 solo cambia el último byte, y por poco.
function switchMacs(level: number, random: Random): string[] {
  const vendor = [hexByte(random), hexByte(random), hexByte(random)];
  if (level >= 4) {
    const shared = [...vendor, hexByte(random), hexByte(random)];
    const last = [hexByte(random)];
    let guard = 0;
    while (last.length < 4 && guard < 300) {
      guard += 1;
      const candidate = lookalikeByte(pick(last, random), random);
      if (!last.includes(candidate)) last.push(candidate);
    }
    while (last.length < 4) {
      const candidate = hexByte(random);
      if (!last.includes(candidate)) last.push(candidate);
    }
    return last.map((byte) => [...shared, byte].join(':'));
  }
  const macs: string[] = [];
  while (macs.length < 4) {
    const mac = [...vendor, hexByte(random), hexByte(random), hexByte(random)].join(':');
    if (!macs.includes(mac)) macs.push(mac);
  }
  return macs;
}

// Texto que lee el lector de pantalla (y que usan las pruebas) para cada puerto.
export function switchPortLabel(port: SwitchPort, mode: SwitchMode): string {
  return mode === 'mac' ? `Puerto ${port.port}: ${port.mac}, ${port.device.name}` : `Puerto ${port.port}: ${port.device.name}`;
}

export function switchRound(level: number, random: Random = Math.random): SwitchRound {
  const mode: SwitchMode = level >= 2 ? 'mac' : 'name';
  const devices = pickDistinct(switchDevices, 4, random);
  const macs = switchMacs(level, random);
  const ports: SwitchPort[] = devices.map((device, index) => ({ port: index + 1, device, mac: macs[index] }));
  const answer = randInt(1, 4, random);
  const target = ports[answer - 1];
  return {
    mode,
    ports,
    answer,
    destination: mode === 'mac' ? target.mac : target.device.name,
    note:
      mode === 'mac'
        ? `La MAC ${target.mac} está en el puerto ${answer}: el switch entrega solo por ese puerto.`
        : `El sobre iba para «${target.device.name}», que está en el puerto ${answer}. El switch lo entrega solo por ahí.`,
  };
}

// ---- 2. ¿Por dónde sale? ----

export interface RouteExit {
  id: string;
  label: string;
  icon: IconName;
}

export const internetExit: RouteExit = { id: 'internet', label: 'Internet', icon: 'globe' };
const roomB215: RouteExit = { id: 'b215', label: 'Sala B215', icon: 'network' };
const roomB213: RouteExit = { id: 'b213', label: 'Sala B213', icon: 'rocket' };
const extraExits: RouteExit[] = [
  { id: 'biblioteca', label: 'Biblioteca', icon: 'book' },
  { id: 'invitados', label: 'Wi-Fi invitados', icon: 'wifi' },
  { id: 'auditorio', label: 'Auditorio', icon: 'megaphone' },
];

export interface RouteLine {
  id: string;
  // Tres primeros números de la red ("10.0.2"); null es la ruta por defecto («lo demás»).
  prefix: string | null;
  pattern: string;
  exit: RouteExit;
}

export interface RouterRound {
  lines: RouteLine[];
  destination: string;
  // Identificador de la línea correcta.
  answer: string;
  // Destino que se parece a una línea de la tabla pero no coincide (desde el nivel 2).
  lookalike: boolean;
  note: string;
}

// Direcciones públicas de ejemplo: ninguna cae en las redes 10.0.x.x de la tabla.
export const publicAddresses = ['8.8.8.8', '1.1.1.1', '142.250.78.14', '151.101.1.69', '157.240.1.35', '104.18.32.7', '13.107.42.14', '185.199.108.153', '23.45.67.89', '52.84.12.9'];

// La línea de la tabla que corresponde a una IP: la que empieza igual o, si ninguna, la ruta por defecto.
export function matchRoute(lines: RouteLine[], ip: string): RouteLine {
  const network = ip.split('.').slice(0, 3).join('.');
  const specific = lines.find((line) => line.prefix !== null && line.prefix === network);
  return specific ?? lines.find((line) => line.prefix === null) ?? lines[lines.length - 1];
}

export function routeLineLabel(line: RouteLine): string {
  return line.prefix ? `Si empieza con ${line.prefix}, sale por ${line.exit.label}` : `Todo lo demás sale por ${line.exit.label}`;
}

export function routerRound(level: number, random: Random = Math.random): RouterRound {
  const exits = shuffle(level >= 2 ? [roomB215, roomB213, pick(extraExits, random)] : [roomB215, roomB213], random);
  const thirds = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random)
    .slice(0, exits.length)
    .sort((a, b) => a - b);
  const lines: RouteLine[] = exits.map((exit, index) => ({ id: exit.id, prefix: `10.0.${thirds[index]}`, pattern: `10.0.${thirds[index]}.x`, exit }));
  lines.push({ id: internetExit.id, prefix: null, pattern: 'lo demás', exit: internetExit });

  const target = pick(lines, random);
  const host = randInt(2, 250, random);
  let destination: string;
  let lookalike = false;
  if (target.prefix) {
    destination = `${target.prefix}.${host}`;
  } else if (level >= 2 && random() < 0.6) {
    // 110.0.1.x se parece a 10.0.1.x, pero es una dirección pública: sale por Internet.
    const copy = pick(
      lines.filter((line) => line.prefix !== null),
      random,
    );
    destination = `${pick(['110', '210'], random)}.0.${copy.pattern.split('.')[2]}.${host}`;
    lookalike = true;
  } else {
    destination = pick(publicAddresses, random);
  }
  return {
    lines,
    destination,
    answer: target.id,
    lookalike,
    note: target.prefix
      ? `${destination} empieza con ${target.prefix}: la tabla lo manda a ${target.exit.label}.`
      : `${destination} no está en ninguna línea: va por «lo demás», hacia Internet.`,
  };
}

// ---- 3. Agenda DNS ----

export interface DnsRow {
  name: string;
  ip: string;
}

export interface DnsRound {
  rows: DnsRow[];
  // Nombre por el que se pregunta.
  question: string;
  // IP correcta.
  answer: string;
  // Los cuatro nombres se parecen (usm.cl, usm.com…).
  lookalike: boolean;
  note: string;
}

const dnsSites = [
  { stem: 'usm', main: 'usm.cl' },
  { stem: 'google', main: 'google.com' },
  { stem: 'wikipedia', main: 'wikipedia.org' },
  { stem: 'youtube', main: 'youtube.com' },
  { stem: 'netflix', main: 'netflix.com' },
  { stem: 'spotify', main: 'spotify.com' },
  { stem: 'instagram', main: 'instagram.com' },
  { stem: 'github', main: 'github.com' },
  { stem: 'twitch', main: 'twitch.tv' },
  { stem: 'whatsapp', main: 'whatsapp.com' },
];

const dnsEndings = ['.cl', '.com', '.org', '.net'];

// Rangos de direcciones reservados para ejemplos (RFC 5737): no apuntan a sitios reales.
export const documentationBlocks = ['203.0.113', '198.51.100', '192.0.2'];

function dnsAddresses(level: number, random: Random): string[] {
  if (level >= 2) {
    const block = pick(documentationBlocks, random);
    // Desde el nivel 4 los últimos números quedan cerca unos de otros.
    const hosts =
      level >= 4
        ? (() => {
            const start = randInt(10, 230, random);
            return shuffle(Array.from({ length: 16 }, (_, index) => start + index), random).slice(0, 4);
          })()
        : shuffle(Array.from({ length: 249 }, (_, index) => index + 2), random).slice(0, 4);
    return hosts.map((host) => `${block}.${host}`);
  }
  const ips: string[] = [];
  while (ips.length < 4) {
    const ip = `${pick(documentationBlocks, random)}.${randInt(2, 250, random)}`;
    if (!ips.includes(ip)) ips.push(ip);
  }
  return ips;
}

export function dnsRowLabel(row: DnsRow): string {
  return `${row.name}, dirección ${row.ip}`;
}

export function dnsRound(level: number, random: Random = Math.random): DnsRound {
  const lookalike = level >= 2;
  let names: string[];
  if (lookalike) {
    // Los cuatro nombres comparten la raíz y solo cambia el final: usm.cl, usm.com, usm.org…
    const stem = pick(dnsSites, random).stem;
    names = shuffle(dnsEndings, random).map((ending) => `${stem}${ending}`);
  } else {
    names = shuffle(dnsSites, random)
      .slice(0, 4)
      .map((site) => site.main);
  }
  const ips = dnsAddresses(level, random);
  const rows = names.map((name, index) => ({ name, ip: ips[index] }));
  const target = pick(rows, random);
  return {
    rows,
    question: target.name,
    answer: target.ip,
    lookalike,
    note: `${target.name} apunta a ${target.ip}: el DNS traduce cada nombre a su dirección IP.`,
  };
}

// ---- 4. Saludo TCP ----

export type TcpId = 'syn' | 'synack' | 'ack' | 'fin';

export interface TcpCard {
  id: TcpId;
  label: string;
  // Lo que «dice» el mensaje, en palabras simples.
  say: string;
  // Quién lo envía en el saludo (el cliente o el servidor); FIN no es parte del saludo.
  from: 'client' | 'server' | null;
}

// El saludo de tres pasos, en orden.
export const tcpSequence: TcpCard[] = [
  { id: 'syn', label: 'SYN', say: '¿Hablamos?', from: 'client' },
  { id: 'synack', label: 'SYN-ACK', say: 'Sí, hablemos', from: 'server' },
  { id: 'ack', label: 'ACK', say: '¡Listo!', from: 'client' },
];

// Distractor desde el nivel 2: cierra la conexión, no la abre.
export const tcpFin: TcpCard = { id: 'fin', label: 'FIN', say: 'Adiós', from: null };

export interface TcpParty {
  kind: DeviceKind;
  label: string;
}

export interface TcpRound {
  client: TcpParty;
  server: TcpParty;
  // Las tarjetas que se muestran, en desorden.
  cards: TcpCard[];
  sequence: TcpCard[];
}

const tcpClients: TcpParty[] = [
  { kind: 'laptop', label: 'Tu notebook' },
  { kind: 'phone', label: 'Tu teléfono' },
  { kind: 'pc', label: 'Tu PC' },
];

const tcpServers: TcpParty[] = ['usm.cl', 'Servidor web', 'Wikipedia', 'YouTube', 'Tienda web', 'Juego en línea', 'Correo', 'Aula virtual'].map((label) => ({ kind: 'server' as const, label }));

export function tcpRound(level: number, random: Random = Math.random): TcpRound {
  let cards = shuffle(tcpSequence, random);
  // Nunca se entrega ya en orden.
  if (cards.every((card, index) => card.id === tcpSequence[index].id)) cards = [...cards.slice(1), cards[0]];
  if (level >= 2) cards.splice(randInt(0, cards.length, random), 0, tcpFin);
  return { client: pick(tcpClients, random), server: pick(tcpServers, random), cards, sequence: tcpSequence };
}

// Explicación de una sola línea cuando se toca la tarjeta equivocada.
export function tcpWrongNote(expected: TcpCard, tapped: TcpCard): string {
  if (tapped.id === 'fin') return 'FIN cierra la conexión. Para abrirla va SYN, SYN-ACK y ACK, en ese orden.';
  if (expected.id === 'syn') return 'Empieza el cliente con SYN: «¿hablamos?». Luego SYN-ACK y al final ACK.';
  if (expected.id === 'synack') return 'Tras el SYN responde el servidor con SYN-ACK: «sí, hablemos». Al final va ACK.';
  return 'Cierra el cliente con ACK: «¡listo!». El orden es SYN, SYN-ACK y ACK.';
}

// ---- 5. ¿Misma red? ----

export type SubnetPrefix = 16 | 24;

export interface SubnetHost {
  ip: string;
  kind: DeviceKind;
  name: string;
}

export interface SubnetRound {
  prefix: SubnetPrefix;
  mask: string;
  a: SubnetHost;
  b: SubnetHost;
  // Misma red: hablan directo por el switch. Si no, el mensaje pasa por el router.
  same: boolean;
  note: string;
}

const subnetDevices: { kind: DeviceKind; name: string }[] = [
  { kind: 'pc', name: 'Computador' },
  { kind: 'laptop', name: 'Notebook' },
  { kind: 'printer', name: 'Impresora' },
  { kind: 'server', name: 'Servidor' },
  { kind: 'camera', name: 'Cámara IP' },
];

export function maskFor(prefix: SubnetPrefix): string {
  return prefix === 24 ? '255.255.255.0' : '255.255.0.0';
}

// Cuántos de los cuatro números de la IP pertenecen a la red.
export function networkOctets(prefix: SubnetPrefix): number {
  return prefix / 8;
}

function ipToInt(ip: string): number {
  return ip.split('.').reduce((total, part) => total * 256 + Number(part), 0);
}

// Dos IP están en la misma red cuando coinciden en los bits que la máscara marca como red.
export function sameSubnet(a: string, b: string, prefix: SubnetPrefix): boolean {
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return ((ipToInt(a) & mask) >>> 0) === ((ipToInt(b) & mask) >>> 0);
}

// La parte de red de una IP, según la máscara ("192.168.1" con /24).
export function networkPart(ip: string, prefix: SubnetPrefix): string {
  return ip.split('.').slice(0, networkOctets(prefix)).join('.');
}

export function subnetRound(level: number, random: Random = Math.random): SubnetRound {
  const prefix: SubnetPrefix = level >= 3 && random() < 0.5 ? 16 : 24;
  const same = random() < 0.5;
  const [deviceA, deviceB] = shuffle(subnetDevices, random);
  const hostA = randInt(2, 250, random);
  const hostB = different(hostA, 2, 250, random);
  let a: number[];
  let b: number[];

  if (prefix === 24) {
    const [first, second] = pick<[number, number]>([[192, 168], [10, 0], [172, 16]], random);
    const third = randInt(1, 9, random);
    a = [first, second, third, hostA];
    if (same) {
      b = [first, second, third, hostB];
    } else if (first !== 192 && random() < 0.25) {
      // Cambia el segundo número (10.0 → 10.1): sigue siendo otra red.
      b = [first, second + 1, third, hostB];
    } else {
      b = [first, second, random() < 0.7 ? neighbor(third, 1, 9, random) : different(third, 1, 9, random), hostB];
    }
  } else {
    // Con /16 solo cuentan los dos primeros números: el tercero puede cambiar y seguir en la misma red.
    const family = same ? pick(['10', '172', '192'], random) : pick(['10', '172'], random);
    const first = family === '192' ? 192 : Number(family);
    const second = family === '192' ? 168 : family === '10' ? randInt(0, 9, random) : randInt(16, 31, random);
    const thirdA = randInt(1, 30, random);
    a = [first, second, thirdA, hostA];
    if (same) {
      b = [first, second, different(thirdA, 1, 30, random), hostB];
    } else {
      const otherSecond = family === '10' ? different(second, 0, 9, random) : different(second, 16, 31, random);
      b = [first, otherSecond, random() < 0.5 ? thirdA : randInt(1, 30, random), hostB];
    }
  }

  const hostOf = (octets: number[], device: { kind: DeviceKind; name: string }): SubnetHost => ({ ip: octets.join('.'), kind: device.kind, name: device.name });
  const left = hostOf(a, deviceA);
  const right = hostOf(b, deviceB);
  const netA = networkPart(left.ip, prefix);
  const netB = networkPart(right.ip, prefix);
  return {
    prefix,
    mask: maskFor(prefix),
    a: left,
    b: right,
    same,
    note: same
      ? `Con /${prefix} cuenta ${netA}: es igual en las dos IP, así que hablan directo por el switch.`
      : `${netA} y ${netB} son redes distintas: para cruzar de una a otra hace falta el router.`,
  };
}

// ---- 6. ¿Qué topología? ----

export type TopologyKind = 'estrella' | 'anillo' | 'bus' | 'malla';

export const topologyKinds: TopologyKind[] = ['estrella', 'anillo', 'bus', 'malla'];

export const topologyNames: Record<TopologyKind, string> = {
  estrella: 'Estrella',
  anillo: 'Anillo',
  bus: 'Bus',
  malla: 'Malla',
};

export const topologyNotes: Record<TopologyKind, string> = {
  estrella: 'Es una estrella: cada equipo se conecta a un switch en el centro.',
  anillo: 'Es un anillo: cada equipo se une a sus dos vecinos y todos forman un círculo.',
  bus: 'Es un bus: todos los equipos cuelgan de un mismo cable largo.',
  malla: 'Es una malla: los equipos se conectan entre sí por varios caminos.',
};

// Medidas del dibujo (el SVG se escala a cualquier pantalla con este viewBox).
export const TOPOLOGY_VIEW = { width: 240, height: 150 } as const;
export const NODE_RADIUS = 9;

export type TopologyRole = 'device' | 'hub' | 'tap';

export interface TopologyNode {
  x: number;
  y: number;
  // `tap` es el punto del cable troncal donde cuelga un equipo del bus.
  role: TopologyRole;
}

export interface TopologyDrawing {
  kind: TopologyKind;
  nodes: TopologyNode[];
  links: [number, number][];
  // Cable troncal del bus, de punta a punta.
  backbone?: { x1: number; y1: number; x2: number; y2: number };
  // Elipse del anillo, dibujada de una pieza.
  ring?: { cx: number; cy: number; rx: number; ry: number };
}

const CENTER_X = TOPOLOGY_VIEW.width / 2;
const CENTER_Y = TOPOLOGY_VIEW.height / 2;
const RADIUS_X = 84;
const RADIUS_Y = 50;

const tenth = (value: number) => Math.round(value * 10) / 10;

function aroundEllipse(count: number, offset: number): TopologyNode[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = offset + (2 * Math.PI * index) / count;
    return { x: tenth(CENTER_X + RADIUS_X * Math.cos(angle)), y: tenth(CENTER_Y + RADIUS_Y * Math.sin(angle)), role: 'device' as const };
  });
}

function starDrawing(leaves: number, random: Random): TopologyDrawing {
  const nodes: TopologyNode[] = [{ x: CENTER_X, y: CENTER_Y, role: 'hub' }, ...aroundEllipse(leaves, random() * ((2 * Math.PI) / leaves))];
  return { kind: 'estrella', nodes, links: nodes.slice(1).map((_, index): [number, number] => [0, index + 1]) };
}

function ringDrawing(count: number, random: Random): TopologyDrawing {
  const nodes = aroundEllipse(count, random() * ((2 * Math.PI) / count));
  return {
    kind: 'anillo',
    nodes,
    links: nodes.map((_, index): [number, number] => [index, (index + 1) % count]),
    ring: { cx: CENTER_X, cy: CENTER_Y, rx: RADIUS_X, ry: RADIUS_Y },
  };
}

function meshDrawing(count: number, random: Random): TopologyDrawing {
  const nodes = aroundEllipse(count, random() * ((2 * Math.PI) / count));
  const links: [number, number][] = [];
  for (let a = 0; a < count; a += 1) for (let b = a + 1; b < count; b += 1) links.push([a, b]);
  return { kind: 'malla', nodes, links };
}

function busDrawing(devices: number, random: Random): TopologyDrawing {
  const tilt = ((random() * 2 - 1) * 8 * Math.PI) / 180;
  const flip = random() < 0.5 ? 1 : -1;
  const left = 24;
  const right = 216;
  const reach = 44;
  const rotate = (x: number, y: number) => {
    const dx = x - CENTER_X;
    const dy = y - CENTER_Y;
    return { x: tenth(CENTER_X + dx * Math.cos(tilt) - dy * Math.sin(tilt)), y: tenth(CENTER_Y + dx * Math.sin(tilt) + dy * Math.cos(tilt)) };
  };
  const taps: TopologyNode[] = [];
  const hosts: TopologyNode[] = [];
  for (let index = 0; index < devices; index += 1) {
    const x = left + ((right - left) * (index + 0.5)) / devices;
    const side = (index % 2 === 0 ? 1 : -1) * flip;
    taps.push({ ...rotate(x, CENTER_Y), role: 'tap' });
    hosts.push({ ...rotate(x, CENTER_Y + side * reach), role: 'device' });
  }
  const links: [number, number][] = [];
  for (let index = 0; index < devices; index += 1) {
    if (index > 0) links.push([index - 1, index]);
    links.push([index, devices + index]);
  }
  const start = rotate(left, CENTER_Y);
  const end = rotate(right, CENTER_Y);
  return { kind: 'bus', nodes: [...taps, ...hosts], links, backbone: { x1: start.x, y1: start.y, x2: end.x, y2: end.y } };
}

function adjacency(drawing: TopologyDrawing): number[][] {
  const list: number[][] = drawing.nodes.map(() => []);
  drawing.links.forEach(([a, b]) => {
    list[a].push(b);
    list[b].push(a);
  });
  return list;
}

function isConnected(adj: number[][]): boolean {
  if (adj.length === 0) return false;
  const seen = new Set<number>([0]);
  const queue = [0];
  while (queue.length > 0) {
    const current = queue.shift() as number;
    adj[current].forEach((next) => {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    });
  }
  return seen.size === adj.length;
}

const hasRole = (drawing: TopologyDrawing, role: TopologyRole) => drawing.nodes.some((node) => node.role === role);

// Estrella: un equipo central unido a todos los demás, y ninguna otra conexión.
export function isStar(drawing: TopologyDrawing): boolean {
  const hubs = drawing.nodes.flatMap((node, index) => (node.role === 'hub' ? [index] : []));
  if (hubs.length !== 1 || hasRole(drawing, 'tap')) return false;
  const adj = adjacency(drawing);
  const hub = hubs[0];
  return adj[hub].length === drawing.nodes.length - 1 && adj.every((list, index) => index === hub || (list.length === 1 && list[0] === hub));
}

// Anillo: todos con exactamente dos vecinos, formando un solo círculo.
export function isRing(drawing: TopologyDrawing): boolean {
  if (hasRole(drawing, 'hub') || hasRole(drawing, 'tap') || drawing.nodes.length < 3) return false;
  const adj = adjacency(drawing);
  return adj.every((list) => list.length === 2) && isConnected(adj);
}

// Malla completa: cada equipo unido con todos los demás (3 o más vecinos cada uno).
export function isMesh(drawing: TopologyDrawing): boolean {
  if (hasRole(drawing, 'hub') || hasRole(drawing, 'tap') || drawing.nodes.length < 4) return false;
  const adj = adjacency(drawing);
  const total = drawing.nodes.length;
  return adj.every((list) => new Set(list).size === total - 1 && list.length === total - 1);
}

// Bus: un cable troncal (los puntos `tap` en fila) y equipos que cuelgan de él, cada uno de un punto.
export function isBus(drawing: TopologyDrawing): boolean {
  if (hasRole(drawing, 'hub')) return false;
  const taps = drawing.nodes.flatMap((node, index) => (node.role === 'tap' ? [index] : []));
  if (taps.length < 3) return false;
  const adj = adjacency(drawing);
  const isTap = (index: number) => drawing.nodes[index].role === 'tap';
  const devicesOk = drawing.nodes.every((node, index) => node.role !== 'device' || (adj[index].length === 1 && isTap(adj[index][0])));
  const trunk = drawing.links.filter(([a, b]) => isTap(a) && isTap(b)).length;
  const tapsOk = taps.every((tap) => adj[tap].filter(isTap).length <= 2);
  return devicesOk && trunk === taps.length - 1 && tapsOk && isConnected(adj);
}

// Todas las topologías que el dibujo cumple (una ronda válida cumple exactamente una).
export function classifyTopology(drawing: TopologyDrawing): TopologyKind[] {
  const result: TopologyKind[] = [];
  if (isStar(drawing)) result.push('estrella');
  if (isRing(drawing)) result.push('anillo');
  if (isBus(drawing)) result.push('bus');
  if (isMesh(drawing)) result.push('malla');
  return result;
}

export function buildTopology(kind: TopologyKind, level: number, random: Random = Math.random): TopologyDrawing {
  const extra = level >= 4 ? 2 : level >= 2 ? 1 : 0;
  if (kind === 'estrella') return starDrawing(4 + extra, random);
  if (kind === 'anillo') return ringDrawing(5 + extra, random);
  if (kind === 'bus') return busDrawing(4 + extra, random);
  return meshDrawing(level >= 3 ? 5 : 4, random);
}

export interface TopologyRound {
  kind: TopologyKind;
  drawing: TopologyDrawing;
  // Los cuatro nombres, en orden aleatorio.
  options: TopologyKind[];
  // Equipos que se ven en el dibujo (sin contar los puntos del cable del bus).
  devices: number;
  note: string;
}

export function topologyRound(level: number, random: Random = Math.random): TopologyRound {
  const kind = pick(topologyKinds, random);
  const drawing = buildTopology(kind, level, random);
  return { kind, drawing, options: shuffle(topologyKinds, random), devices: drawing.nodes.filter((node) => node.role !== 'tap').length, note: topologyNotes[kind] };
}
