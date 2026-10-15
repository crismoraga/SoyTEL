import type { DeviceKind } from '@/components/graphics/DeviceArt';
import { mulberry32, seededPick, seededShuffle } from '@/route/random';
import type { RoundResult } from '../types';

// Lógica pura de las rondas «El switch reparte» y «¿Por dónde sale?» del circuito de la sala B215:
// generadores deterministas por semilla, comprobación de respuestas, tabla que aprende el switch,
// geometría de los tableros y puntaje. No depende de React: se prueba con Jest sin pantalla.

// Cada ronda trae seis mensajes (o paquetes).
export const ROUND_ITEMS = 6;

export type Level = 0 | 1 | 2;

// 0 fácil, 1 normal, 2 desafío; cualquier otro valor se acota (sin número válido, normal).
export function normalizeLevel(level: number): Level {
  if (!Number.isFinite(level)) return 1;
  return Math.max(0, Math.min(2, Math.round(level))) as Level;
}

const range = (from: number, to: number): number[] => Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);

const sentence = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

export interface Feedback {
  ok: boolean;
  text: string;
}

// ——— Puntaje y tiempos ———

export type RoundKind = 'switch' | 'router';

const whole = (value: number): number => (Number.isFinite(value) ? Math.floor(value) : 0);

// score = aciertos / total (lo que no alcanzó a responder no suma); accuracy = aciertos / respondidos.
export function buildResult(kind: RoundKind, correct: number, answered: number, total: number = ROUND_ITEMS): RoundResult {
  const right = Math.max(0, Math.min(total, whole(correct)));
  const tried = Math.max(right, Math.min(total, whole(answered)));
  const unit = kind === 'switch' ? 'mensajes entregados' : 'paquetes bien enrutados';
  return {
    score: total > 0 ? right / total : 0,
    accuracy: tried > 0 ? right / tried : 0,
    detail: `${right} de ${total} ${unit}`,
  };
}

// Cuánto se queda el resultado en pantalla antes de pasar al siguiente (un error se lee con más calma).
// `pace` es el ritmo elegido (mayor = más lento); aquí solo alarga un poco la lectura.
export function holdMs(ok: boolean, pace: number): number {
  const factor = Math.sqrt(Math.min(4, Math.max(1, Number.isFinite(pace) ? pace : 1)));
  return Math.round((ok ? 900 : 2600) * factor);
}

// ——— Elogios ———

const praises = ['¡Bien!', '¡Eso!', '¡Justo!', '¡Genial!', '¡Perfecto!', '¡Así!'];

// Lo primero que se lee al acertar: un elogio que va cambiando y, con tres aciertos seguidos, la racha.
export function praiseFor(index: number, streak: number): string {
  if (streak >= 3) return `¡Racha x${Math.floor(streak)}!`;
  return praises[Math.abs(Math.floor(index)) % praises.length];
}

// Aciertos seguidos al final de las respuestas dadas.
export function streakOf(marks: readonly boolean[]): number {
  let streak = 0;
  for (let position = marks.length - 1; position >= 0 && marks[position]; position -= 1) streak += 1;
  return streak;
}

// ——— Switch ———

// Respuesta «A todos»: el switch no sabe dónde está el destino y lo reenvía por todos los puertos.
export const FLOOD = 0;

export const SWITCH_FLOOD_HINT = 'El switch aún no sabe dónde está: lo manda a todos y anota quién responde.';

export interface SwitchDevice {
  // Puerto del switch al que está conectado (1 a N).
  port: number;
  name: string;
  // Con artículo, para las explicaciones («la impresora»).
  det: string;
  kind: DeviceKind;
  // Dirección MAC corta («3C»).
  mac: string;
}

export interface MacEntry {
  mac: string;
  port: number;
}

export interface SwitchFrame {
  // Puertos del que envía y del que recibe.
  from: number;
  to: number;
  // Respuesta correcta: FLOOD o el número del puerto.
  answer: number;
  // Lo que el switch sabe cuando llega el mensaje (en el orden en que lo aprendió).
  table: MacEntry[];
  // Lo que anota después: quien envía (si era nuevo) y, tras un «A todos», quien responde.
  learned: MacEntry[];
}

export interface SwitchRoundData {
  level: Level;
  ports: number;
  // Desde el nivel 1 hay direcciones MAC, tabla y «A todos».
  learning: boolean;
  // devices[puerto - 1]
  devices: SwitchDevice[];
  frames: SwitchFrame[];
}

interface DeviceTemplate {
  name: string;
  det: string;
  kind: DeviceKind;
}

const personBank = ['Ana', 'Beto', 'Caro', 'Diego', 'Fran', 'Gabo', 'Isi', 'Joaco', 'Kari', 'Lalo', 'Mati', 'Nico', 'Pili', 'Rafa', 'Sofi', 'Tomás', 'Vale'];

const thingBank: DeviceTemplate[] = [
  { name: 'Impresora', det: 'la impresora', kind: 'printer' },
  { name: 'Cámara', det: 'la cámara', kind: 'camera' },
  { name: 'Teléfono IP', det: 'el teléfono IP', kind: 'phone' },
  { name: 'Servidor', det: 'el servidor', kind: 'server' },
  { name: 'Access point', det: 'el access point', kind: 'accessPoint' },
];

// Sin 0/O, 1/I, 6, 8/B ni D: así dos direcciones no se confunden a simple vista.
const MAC_CHARS = ['2', '3', '4', '5', '7', '9', 'A', 'C', 'E', 'F'];

// Direcciones cortas únicas: la primera letra nunca se repite entre equipos.
function makeMacs(random: () => number, count: number): string[] {
  const firsts = seededShuffle(MAC_CHARS, random).slice(0, count);
  const seconds = new Set<string>();
  return firsts.map((first) => {
    const second = seededPick(
      MAC_CHARS.filter((char) => char !== first && !seconds.has(char)),
      random,
    );
    seconds.add(second);
    return `${first}${second}`;
  });
}

function makeSwitchDevices(random: () => number, ports: number): SwitchDevice[] {
  const things = ports <= 4 ? 1 + Math.floor(random() * 2) : 2 + Math.floor(random() * 2);
  const people = seededShuffle(personBank, random)
    .slice(0, ports - things)
    .map<DeviceTemplate>((person) =>
      random() < 0.5
        ? { name: `PC de ${person}`, det: `el PC de ${person}`, kind: 'pc' }
        : { name: `Notebook de ${person}`, det: `el notebook de ${person}`, kind: 'laptop' },
    );
  const macs = makeMacs(random, ports);
  return seededShuffle([...people, ...seededShuffle(thingBank, random).slice(0, things)], random).map((template, index) => ({
    port: index + 1,
    ...template,
    mac: macs[index],
  }));
}

const hasRepeat = (list: number[]): boolean => list.some((value, index) => index > 0 && value === list[index - 1]);

// Nivel 0: sin tabla, cada mensaje va al puerto del equipo de destino. Todos los puertos reciben al menos uno
// y el mismo puerto no se repite seguido.
function directFrames(random: () => number, ports: number): SwitchFrame[] {
  const all = range(1, ports);
  const pool = [...all, ...seededShuffle(all, random).slice(0, Math.max(0, ROUND_ITEMS - ports))];
  let targets = seededShuffle(pool, random);
  for (let attempt = 0; attempt < 40 && hasRepeat(targets); attempt += 1) targets = seededShuffle(pool, random);
  let previousFrom = 0;
  return targets.slice(0, ROUND_ITEMS).map((to) => {
    const others = all.filter((port) => port !== to);
    const fresh = others.filter((port) => port !== previousFrom);
    const from = seededPick(fresh.length ? fresh : others, random);
    previousFrom = from;
    return { from, to, answer: to, table: [], learned: [] };
  });
}

type Step = 'flood' | 'known';

// Niveles 1 y 2: la tabla parte vacía. Si el switch no conoce al destino, la respuesta es «A todos»; después
// anota quién envió y quién respondió, y los mensajes siguientes a esos equipos van solo a su puerto.
// El primer mensaje siempre es un «A todos» y el segundo ya usa lo aprendido.
function learningFrames(random: () => number, devices: SwitchDevice[], level: Level): SwitchFrame[] {
  const all = range(1, devices.length);
  const floods = (level === 1 ? 2 : 3) + (random() < 0.5 ? 1 : 0);
  const rest = seededShuffle<Step>([...Array<Step>(floods - 1).fill('flood'), ...Array<Step>(ROUND_ITEMS - 2 - (floods - 1)).fill('known')], random);
  const plan: Step[] = ['flood', 'known', ...rest];
  const table = new Map<number, string>();
  const frames: SwitchFrame[] = [];
  let previousTo = 0;
  for (let step = 0; step < ROUND_ITEMS; step += 1) {
    const floodsLeft = plan.slice(step + 1).filter((item) => item === 'flood').length;
    const unknown = all.filter((port) => !table.has(port));
    const known = all.filter((port) => table.has(port));
    let kind = plan[step];
    if (kind === 'flood' && unknown.length === 0) kind = 'known';
    if (kind === 'known' && known.length === 0) kind = 'flood';
    let to: number;
    if (kind === 'flood') {
      to = seededPick(unknown, random);
    } else {
      const options = known.filter((port) => port !== previousTo);
      to = seededPick(options.length ? options : known, random);
    }
    const others = all.filter((port) => port !== to);
    const knownOthers = others.filter((port) => table.has(port));
    const freshOthers = others.filter((port) => !table.has(port));
    // Desconocidos que quedarían si quien envía fuera nuevo: tienen que alcanzar para los «A todos» que faltan.
    const spare = unknown.length - (kind === 'flood' ? 1 : 0) - 1;
    let from: number;
    if (knownOthers.length === 0) from = seededPick(freshOthers, random);
    else if (level === 2 && freshOthers.length > 0 && spare >= floodsLeft && random() < 0.4) from = seededPick(freshOthers, random);
    else from = seededPick(knownOthers, random);

    const snapshot = [...table].map(([port, mac]) => ({ mac, port }));
    const learned: MacEntry[] = [];
    if (!table.has(from)) {
      table.set(from, devices[from - 1].mac);
      learned.push({ mac: devices[from - 1].mac, port: from });
    }
    if (kind === 'flood') {
      table.set(to, devices[to - 1].mac);
      learned.push({ mac: devices[to - 1].mac, port: to });
    }
    frames.push({ from, to, answer: kind === 'flood' ? FLOOD : to, table: snapshot, learned });
    previousTo = to;
  }
  return frames;
}

export function makeSwitchRound(seed: number, level: number): SwitchRoundData {
  const lvl = normalizeLevel(level);
  const random = mulberry32((seed ^ 0x5171c4) >>> 0);
  const ports = lvl === 2 ? 6 : 4;
  const devices = makeSwitchDevices(random, ports);
  return {
    level: lvl,
    ports,
    learning: lvl >= 1,
    devices,
    frames: lvl === 0 ? directFrames(random, ports) : learningFrames(random, devices, lvl),
  };
}

// La regla, aparte del generador: con tabla, un destino desconocido va «A todos»; si no, a su puerto.
export function expectedSwitchAnswer(frame: Pick<SwitchFrame, 'to' | 'table'>, learning: boolean): number {
  if (!learning) return frame.to;
  return frame.table.some((entry) => entry.port === frame.to) ? frame.to : FLOOD;
}

export function checkSwitchAnswer(frame: SwitchFrame, choice: number): boolean {
  return choice === frame.answer;
}

// La tabla una vez entregado el mensaje.
export function switchTableAfter(frame: SwitchFrame): MacEntry[] {
  return [...frame.table, ...frame.learned];
}

// Poco texto: el elogio o la explicación en una línea (con `streak`, los aciertos seguidos contando este).
export function switchFeedback(data: SwitchRoundData, index: number, choice: number, streak = 0): Feedback {
  const frame = data.frames[index];
  const dest = data.devices[frame.to - 1];
  const ok = checkSwitchAnswer(frame, choice);
  const cheer = praiseFor(index, streak);
  if (!data.learning) {
    return ok ? { ok, text: `${cheer} ${dest.name} → puerto ${frame.to}` } : { ok, text: `Iba al puerto ${frame.to}, donde está ${dest.det}.` };
  }
  if (frame.answer === FLOOD) {
    return ok ? { ok, text: `${cheer} Anotó MAC ${dest.mac} → puerto ${frame.to}` } : { ok, text: 'Aún no lo conocía: ¡A todos!' };
  }
  if (ok) return { ok, text: `${cheer} MAC ${dest.mac} → puerto ${frame.to}` };
  if (choice === FLOOD) return { ok, text: `Ya lo conocía: puerto ${frame.to}, ${dest.det}.` };
  return { ok, text: `Iba al puerto ${frame.to}, donde está ${dest.det}.` };
}

// ——— Router ———

export type ExitId = 'b215' | 'b213' | 'biblioteca' | 'internet';
type LocalId = Exclude<ExitId, 'internet'>;

export const ROUTER_DEFAULT_HINT = 'Si ninguna fila calza, sale por la ruta por defecto: Internet.';

export interface RouteRow {
  id: ExitId;
  name: string;
  // Las tres primeras cifras de las IP de esa red (null en la ruta por defecto).
  prefix: string | null;
  // Cómo se ve en la tabla.
  network: string;
}

export interface RouterPacket {
  ip: string;
  exit: ExitId;
  // Nombre amigable que se muestra en el nivel 0 («notebook en B213»).
  note: string;
}

export interface RouterRoundData {
  level: Level;
  // La tabla de rutas: las redes locales y, al final, la ruta por defecto.
  rows: RouteRow[];
  packets: RouterPacket[];
  // Posición del primer paquete hacia Internet (ahí se explica la ruta por defecto).
  firstInternet: number;
}

const localRows: Record<LocalId, RouteRow & { prefix: string }> = {
  b215: { id: 'b215', name: 'Sala B215', prefix: '10.0.1', network: '10.0.1.x' },
  b213: { id: 'b213', name: 'Sala B213', prefix: '10.0.2', network: '10.0.2.x' },
  biblioteca: { id: 'biblioteca', name: 'Biblioteca', prefix: '10.0.3', network: '10.0.3.x' },
};

export const defaultRow: RouteRow = { id: 'internet', name: 'Internet', prefix: null, network: 'todo lo demás' };

const localNotes: Record<LocalId, string[]> = {
  b215: ['PC en B215', 'notebook en B215', 'impresora en B215', 'servidor de B215', 'cámara en B215'],
  b213: ['PC en B213', 'notebook en B213', 'impresora 3D en B213', 'placa Arduino en B213', 'cámara en B213'],
  biblioteca: ['PC en la biblioteca', 'notebook en la biblioteca', 'impresora en la biblioteca', 'teléfono IP en la biblioteca'],
};

// Servidores DNS públicos reales: direcciones de Internet, fuera de las redes privadas del laboratorio.
export const internetHosts = [
  { ip: '8.8.8.8', note: 'DNS de Google' },
  { ip: '8.8.4.4', note: 'DNS de Google' },
  { ip: '1.1.1.1', note: 'DNS de Cloudflare' },
  { ip: '1.0.0.1', note: 'DNS de Cloudflare' },
  { ip: '9.9.9.9', note: 'DNS Quad9' },
  { ip: '208.67.222.222', note: 'DNS de OpenDNS' },
];

// Filas de la tabla que calzan con la IP (sin contar la ruta por defecto). Con el punto final, 10.0.12.5 no calza con 10.0.1.
export function matchingRows(rows: RouteRow[], ip: string): RouteRow[] {
  return rows.filter((row) => row.prefix !== null && ip.startsWith(`${row.prefix}.`));
}

// Lo que hace el router: la fila que calza o, si ninguna, la ruta por defecto.
export function routeFor(rows: RouteRow[], ip: string): ExitId {
  return matchingRows(rows, ip)[0]?.id ?? 'internet';
}

export function makeRouterRound(seed: number, level: number): RouterRoundData {
  const lvl = normalizeLevel(level);
  const random = mulberry32((seed ^ 0x2007e5) >>> 0);
  const ids = seededShuffle<LocalId>(lvl === 2 ? ['b215', 'b213', 'biblioteca'] : ['b215', 'b213'], random);
  const rows: RouteRow[] = [...ids.map((id) => localRows[id]), defaultRow];

  // Uno o dos paquetes a Internet; cada sala recibe al menos uno; el primero siempre es de una sala.
  const internetCount = 1 + (random() < 0.5 ? 1 : 0);
  const exits: ExitId[] = [...ids];
  while (exits.length < ROUND_ITEMS - internetCount) exits.push(seededPick(ids, random));
  for (let count = 0; count < internetCount; count += 1) exits.push('internet');
  const order = seededShuffle(exits, random);
  if (order[0] === 'internet') {
    const swap = order.findIndex((exit) => exit !== 'internet');
    [order[0], order[swap]] = [order[swap], order[0]];
  }

  const hosts = seededShuffle(internetHosts, random);
  const used = new Set<string>();
  let nextHost = 0;
  const packets = order.map<RouterPacket>((exit) => {
    if (exit === 'internet') {
      const host = hosts[nextHost];
      nextHost += 1;
      return { ip: host.ip, exit, note: host.note };
    }
    let ip: string;
    do {
      ip = `${localRows[exit].prefix}.${2 + Math.floor(random() * 249)}`;
    } while (used.has(ip));
    used.add(ip);
    return { ip, exit, note: seededPick(localNotes[exit], random) };
  });
  return { level: lvl, rows, packets, firstInternet: order.indexOf('internet') };
}

export function checkRouterAnswer(packet: RouterPacket, choice: ExitId): boolean {
  return choice === packet.exit;
}

export function routerFeedback(data: RouterRoundData, index: number, choice: ExitId, streak = 0): Feedback {
  const packet = data.packets[index];
  const right = data.rows.find((row) => row.id === packet.exit) ?? defaultRow;
  const ok = checkRouterAnswer(packet, choice);
  const cheer = praiseFor(index, streak);
  if (packet.exit === 'internet') {
    return ok ? { ok, text: `${cheer} ${packet.ip} → Internet` } : { ok, text: `${packet.ip} no calza: va a Internet.` };
  }
  if (ok) return { ok, text: `${cheer} ${right.network} → ${right.name}` };
  if (choice === 'internet') return { ok, text: `${packet.ip} sí calza: ${right.network} → ${right.name}.` };
  return { ok, text: `${packet.ip} va a ${right.name} (${right.network}).` };
}

// ——— Geometría de los tableros (a partir del tamaño que entrega FitBox) ———

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SwitchBoardLayout {
  // tiles[puerto - 1]
  tiles: Rect[];
  // El switch, en el centro, entre las dos columnas de equipos.
  bar: Rect;
  // Largo de cada cable entre un equipo y el switch.
  cable: number;
}

// Equipos en dos columnas (puertos 1.. a la izquierda, el resto a la derecha) con el switch en medio.
// Con «A todos» el centro es un poco más ancho para que el botón mida al menos 44 px.
export function switchBoardLayout(width: number, height: number, ports: number, flood: boolean): SwitchBoardLayout {
  const inset = 6;
  const cable = 8;
  const gap = 6;
  const perSide = Math.ceil(ports / 2);
  const barWidth = flood ? 58 : 46;
  const tileWidth = Math.max(40, Math.floor((width - inset * 2 - barWidth - cable * 2) / 2));
  const maxHeight = ports > 4 ? 78 : 104;
  const tileHeight = Math.max(20, Math.min(maxHeight, Math.floor((height - inset * 2 - gap * (perSide - 1)) / perSide)));
  const used = tileHeight * perSide + gap * (perSide - 1);
  const x0 = Math.max(0, Math.floor((width - (tileWidth * 2 + cable * 2 + barWidth)) / 2));
  const y0 = Math.max(0, Math.floor((height - used) / 2));
  const rightX = x0 + tileWidth + cable * 2 + barWidth;
  return {
    tiles: range(1, ports).map((port) => {
      const left = port <= perSide;
      const row = left ? port - 1 : port - 1 - perSide;
      return { x: left ? x0 : rightX, y: y0 + row * (tileHeight + gap), width: tileWidth, height: tileHeight };
    }),
    bar: { x: x0 + tileWidth + cable, y: y0, width: barWidth, height: used },
    cable,
  };
}

export interface RouterBoardLayout {
  // Encabezado: el router y el título de la tabla.
  header: Rect;
  // rows[i] es la fila i de la tabla (de arriba hacia abajo).
  rows: Rect[];
  // Posición horizontal del cable vertical que baja del router a cada salida.
  spineX: number;
  // Lado del dibujo del router.
  artSize: number;
}

export function routerBoardLayout(width: number, height: number, rowCount: number): RouterBoardLayout {
  const gap = 6;
  const headerHeight = height >= 250 ? 44 : 34;
  const free = height - headerHeight - gap - gap * (rowCount - 1);
  const rowHeight = Math.max(20, Math.min(66, Math.floor(free / Math.max(1, rowCount))));
  const used = headerHeight + gap + rowHeight * rowCount + gap * (rowCount - 1);
  const y0 = Math.max(0, Math.floor((height - used) / 2));
  const artSize = headerHeight - 4;
  const spineX = Math.round(artSize / 2) + 2;
  const rowX = spineX + 14;
  return {
    header: { x: 0, y: y0, width, height: headerHeight },
    rows: range(0, rowCount - 1).map((index) => ({
      x: rowX,
      y: y0 + headerHeight + gap + index * (rowHeight + gap),
      width: Math.max(0, width - rowX),
      height: rowHeight,
    })),
    spineX,
    artSize,
  };
}
