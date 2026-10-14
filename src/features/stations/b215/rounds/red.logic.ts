import type { DeviceKind } from '@/components/graphics/DeviceArt';
import type { IconName } from '@/graphics/icons';
import { mulberry32, seededShuffle } from '@/route/random';
import type { RoundResult } from '../types';

// Lógica pura de las tres rondas de red de la sala B215: firewall, canal Wi-Fi y armar la red.
// Todo es determinista a partir de la semilla (mulberry32) y no depende de React.

export type Level = 0 | 1 | 2;

export function normalizeLevel(level: number): Level {
  if (!Number.isFinite(level)) return 1;
  return Math.max(0, Math.min(2, Math.round(level))) as Level;
}

// Cuánto se deja ver la reacción antes de seguir; un ritmo más lento (pace > 1) la alarga.
export function feedbackWait(ms: number, pace: number): number {
  const factor = Number.isFinite(pace) && pace > 0 ? Math.min(3, Math.max(0.7, pace)) : 1;
  return Math.round(ms * factor);
}

// Resultado de una ronda: puntaje = aciertos sobre el total de la ronda (lo que no se alcanzó cuenta como no
// logrado); precisión = aciertos sobre intentos.
export function scoreRound(correct: number, attempts: number, total: number, noun: string): RoundResult {
  const size = Math.max(1, Math.floor(total));
  const ok = Math.max(0, Math.min(Math.floor(correct), size));
  const tries = Math.max(0, Math.floor(attempts));
  return { score: ok / size, accuracy: tries > 0 ? Math.min(1, ok / tries) : 0, detail: `${ok} de ${size} ${noun}` };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function lower(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

// Aciertos seguidos al final de la lista.
export function streakOf(hits: readonly boolean[]): number {
  let streak = 0;
  for (let index = hits.length - 1; index >= 0 && hits[index]; index -= 1) streak += 1;
  return streak;
}

// Palabra de ánimo según la racha: corta, para que se lea de un vistazo.
export function cheer(streak: number): string {
  if (streak >= 3) return `¡Racha x${streak}!`;
  return streak === 2 ? '¡Eso es!' : '¡Bien!';
}

// ——— Ronda A · Firewall: ¿pasa o no pasa? ———

export type ServiceId = 'https' | 'http' | 'dns' | 'ssh' | 'telnet' | 'ftp' | 'rdp' | 'minecraft' | 'mysql';

export interface Service {
  id: ServiceId;
  name: string;
  port: number;
  icon: IconName;
}

// Cada servicio tiene su propio puerto: una regla por puerto equivale a una regla por servicio.
export const SERVICES: Record<ServiceId, Service> = {
  https: { id: 'https', name: 'Web segura (HTTPS)', port: 443, icon: 'lock' },
  http: { id: 'http', name: 'Web (HTTP)', port: 80, icon: 'globe' },
  dns: { id: 'dns', name: 'DNS', port: 53, icon: 'dns' },
  ssh: { id: 'ssh', name: 'SSH (acceso remoto)', port: 22, icon: 'key' },
  telnet: { id: 'telnet', name: 'Telnet', port: 23, icon: 'terminal' },
  ftp: { id: 'ftp', name: 'FTP (archivos)', port: 21, icon: 'send' },
  rdp: { id: 'rdp', name: 'Escritorio remoto', port: 3389, icon: 'laptop' },
  minecraft: { id: 'minecraft', name: 'Minecraft (juego)', port: 25565, icon: 'gamepad' },
  mysql: { id: 'mysql', name: 'Base de datos', port: 3306, icon: 'database' },
};

export type FirewallAction = 'allow' | 'deny';

export type RuleMatch = { kind: 'service'; service: ServiceId } | { kind: 'origin'; ip: string } | { kind: 'any' };

export interface FirewallRule {
  action: FirewallAction;
  match: RuleMatch;
}

export interface Connection {
  id: number;
  originName: string;
  originIp: string;
  service: ServiceId;
}

export interface Decision {
  action: FirewallAction;
  // Posición (desde 0) de la regla que decide; -1 si ninguna calza (un firewall bloquea por defecto).
  ruleIndex: number;
}

export interface FirewallRoundData {
  level: Level;
  rules: FirewallRule[];
  connections: Connection[];
  // IP de la regla de excepción (solo en el nivel 2).
  exceptionIp: string | null;
}

interface RuleTemplate {
  allow: [ServiceId, ServiceId];
  deny: ServiceId;
}

const TEMPLATES: RuleTemplate[] = [
  { allow: ['https', 'dns'], deny: 'telnet' },
  { allow: ['https', 'ssh'], deny: 'telnet' },
  { allow: ['http', 'dns'], deny: 'ftp' },
  { allow: ['https', 'dns'], deny: 'rdp' },
];

// Direcciones "malas" de la excepción (66.6.6.6 sale más seguido).
export const HOSTILE_POOL = ['66.6.6.6', '66.6.6.6', '13.13.13.13', '31.3.3.7'];

const FRIENDS = [
  { name: 'Notebook de Ana', ip: '192.168.1.23' },
  { name: 'Celular de Tomás', ip: '192.168.1.41' },
  { name: 'PC del laboratorio', ip: '192.168.1.15' },
  { name: 'Tablet de Sofía', ip: '192.168.1.58' },
  { name: 'Consola de Mati', ip: '192.168.1.77' },
  { name: 'Notebook de Pía', ip: '192.168.1.64' },
  { name: 'Celular de Nico', ip: '192.168.1.89' },
  { name: 'PC de la profe', ip: '192.168.1.10' },
];

export function ruleMatches(rule: FirewallRule, connection: Connection): boolean {
  if (rule.match.kind === 'service') return rule.match.service === connection.service;
  if (rule.match.kind === 'origin') return rule.match.ip === connection.originIp;
  return true;
}

// Las reglas se leen de arriba hacia abajo y manda la primera que calza.
export function decide(rules: readonly FirewallRule[], connection: Connection): Decision {
  const index = rules.findIndex((rule) => ruleMatches(rule, connection));
  return index < 0 ? { action: 'deny', ruleIndex: -1 } : { action: rules[index].action, ruleIndex: index };
}

export function ruleText(rule: FirewallRule): string {
  if (rule.match.kind === 'service') {
    const service = SERVICES[rule.match.service];
    return `${service.name} · puerto ${service.port}`;
  }
  if (rule.match.kind === 'origin') return `Cualquier cosa desde ${rule.match.ip}`;
  return 'Todo lo demás';
}

// Qué regla decidió y por qué, en una frase (sin el "¡Bien!" / "Ojo:" del comienzo).
export function explainDecision(rules: readonly FirewallRule[], connection: Connection, decision: Decision): string {
  const service = SERVICES[connection.service];
  const rule = rules[decision.ruleIndex];
  const number = decision.ruleIndex + 1;
  if (!rule) return `${service.name} no está permitido y se bloquea.`;
  if (rule.match.kind === 'origin') {
    const later = rules.some((other, index) => index > decision.ruleIndex && other.action === 'allow' && ruleMatches(other, connection));
    return `la regla ${number} bloquea todo lo que viene de ${rule.match.ip}${later ? ', y se lee antes que las demás.' : '.'}`;
  }
  if (rule.match.kind === 'service') {
    return `la regla ${number} ${rule.action === 'allow' ? 'deja pasar' : 'bloquea'} ${service.name} (puerto ${service.port}).`;
  }
  return `${service.name} no está permitido: cae en «Todo lo demás» (regla ${number}).`;
}

// La regla que decidió, en pocas palabras (se muestra al acertar).
export function shortWhy(rules: readonly FirewallRule[], connection: Connection, decision: Decision): string {
  const rule = rules[decision.ruleIndex];
  if (!rule) return 'se bloquea por defecto';
  const number = decision.ruleIndex + 1;
  if (rule.match.kind === 'origin') {
    const later = rules.some((other, index) => index > decision.ruleIndex && other.action === 'allow' && ruleMatches(other, connection));
    return later ? `regla ${number}, se lee primero` : `regla ${number}`;
  }
  return rule.match.kind === 'any' ? `regla ${number}, todo lo demás` : `regla ${number}`;
}

// Reacción a una respuesta: al acertar, ánimo + número de regla; al errar, la regla que aplica y por qué.
export function reactionLine(ok: boolean, streak: number, rules: readonly FirewallRule[], connection: Connection, decision: Decision): string {
  if (!ok) return `Ojo: ${explainDecision(rules, connection, decision)}`;
  return `${cheer(streak)} ${capitalize(shortWhy(rules, connection, decision))}.`;
}

export function firewallPrompt(level: number): string {
  return normalizeLevel(level) === 2 ? 'Se leen en orden: gana la primera que calza.' : '¿Pasa o se bloquea?';
}

function longestRun(values: string[]): number {
  let best = 0;
  let run = 0;
  values.forEach((value, index) => {
    run = index > 0 && value === values[index - 1] ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

// 6 conexiones: mezcla de permitidas y bloqueadas. Nivel 0: reglas simples y lo demás se bloquea; nivel 1: una
// regla de bloqueo con nombre; nivel 2: además una excepción por origen que va ANTES de las reglas que permiten.
export function makeFirewallRound(seed: number, level: number): FirewallRoundData {
  const lvl = normalizeLevel(level);
  const random = mulberry32((seed ^ 0x5f1e) >>> 0);
  const template = TEMPLATES[Math.floor(random() * TEMPLATES.length)];
  const hostileIp = HOSTILE_POOL[Math.floor(random() * HOSTILE_POOL.length)];

  const rules: FirewallRule[] = [];
  if (lvl === 2) rules.push({ action: 'deny', match: { kind: 'origin', ip: hostileIp } });
  template.allow.forEach((service) => rules.push({ action: 'allow', match: { kind: 'service', service } }));
  if (lvl >= 1) rules.push({ action: 'deny', match: { kind: 'service', service: template.deny } });
  rules.push({ action: 'deny', match: { kind: 'any' } });

  const reserved = new Set<ServiceId>(template.allow);
  if (lvl >= 1) reserved.add(template.deny);
  const others = seededShuffle(
    (Object.keys(SERVICES) as ServiceId[]).filter((id) => !reserved.has(id)),
    random,
  );
  const [first, second] = template.allow;
  const repeat = random() < 0.5 ? first : second;
  const twoTraps = random() < 0.5;
  const friends = seededShuffle(FRIENDS, random);
  let nextFriend = 0;
  const friendly = (service: ServiceId): Omit<Connection, 'id'> => {
    const friend = friends[nextFriend % friends.length];
    nextFriend += 1;
    return { originName: friend.name, originIp: friend.ip, service };
  };
  const hostile = (service: ServiceId): Omit<Connection, 'id'> => ({ originName: 'Desconocido', originIp: hostileIp, service });

  const drafts: Omit<Connection, 'id'>[] = [];
  if (lvl === 0) {
    drafts.push(friendly(first), friendly(second), friendly(repeat), friendly(others[0]), friendly(others[1]), friendly(others[2]));
  } else if (lvl === 1) {
    drafts.push(friendly(first), friendly(second), friendly(repeat), friendly(template.deny), friendly(others[0]), friendly(others[1]));
  } else {
    // Trampa: el mismo servicio permitido, pero desde la IP de la excepción (que se lee primero).
    drafts.push(friendly(first), friendly(second), hostile(first), friendly(template.deny), friendly(others[0]));
    drafts.push(twoTraps ? hostile(second) : friendly(repeat));
  }

  const verdicts = (list: Omit<Connection, 'id'>[]) => list.map((draft, id) => decide(rules, { ...draft, id }).action);
  let order = seededShuffle(drafts, random);
  for (let attempt = 0; attempt < 30 && longestRun(verdicts(order)) > 3; attempt += 1) order = seededShuffle(drafts, random);
  const connections = order.map((draft, id) => ({ ...draft, id }));
  return { level: lvl, rules, connections, exceptionIp: lvl === 2 ? hostileIp : null };
}

// ——— Ronda B · Canal libre (Wi-Fi 2,4 GHz) ———

export const WIFI_CHANNELS = [1, 6, 11] as const;
export type WifiChoice = (typeof WIFI_CHANNELS)[number];
export type Strength = 1 | 2 | 3;

export interface Neighbor {
  name: string;
  channel: number;
  strength: Strength;
}

export interface WifiScenario {
  neighbors: Neighbor[];
  // Interferencia total que sufriría el Wi-Fi del laboratorio en cada canal (menos es mejor).
  costs: Record<WifiChoice, number>;
  best: WifiChoice;
}

// Una red ocupa ~5 canales de ancho (±2,5 desde su centro): por eso 1, 6 y 11 no se pisan.
export const HILL_HALF = 2.5;
// Borde del gráfico en unidades de canal: caben justo tres bandas de 5 canales (1, 6 y 11).
export const SPECTRUM_MIN = -1.5;
export const SPECTRUM_MAX = 13.5;
export const STRENGTH_HEIGHT: Record<Strength, number> = { 1: 0.4, 2: 0.68, 3: 0.95 };
const STRENGTH_WORD: Record<Strength, string> = { 1: 'débil', 2: 'media', 3: 'fuerte' };

// Forma de la colina (coseno elevado) a `offset` canales de su centro: 1 en el centro, 0 en los bordes.
export function hillHeight(offset: number): number {
  if (Math.abs(offset) >= HILL_HALF) return 0;
  return 0.5 * (1 + Math.cos((Math.PI * offset) / HILL_HALF));
}

// Área bajo la colina (altura 1) entre dos posiciones medidas desde su centro.
export function hillArea(from: number, to: number): number {
  const low = Math.max(from, -HILL_HALF);
  const high = Math.min(to, HILL_HALF);
  if (high <= low) return 0;
  const k = Math.PI / HILL_HALF;
  const antiderivative = (t: number) => 0.5 * (t + Math.sin(k * t) / k);
  return antiderivative(high) - antiderivative(low);
}

// Cuánto se pisa una red vecina con la banda del canal elegido: es el área de su colina que cae dentro de la
// banda (lo mismo que se ve pintado en rojo en el gráfico). Crece con la fuerza y con la cercanía.
export function overlapArea(channel: number, neighbor: Neighbor): number {
  return neighbor.strength * hillArea(channel - HILL_HALF - neighbor.channel, channel + HILL_HALF - neighbor.channel);
}

export function channelCost(channel: number, neighbors: readonly Neighbor[]): number {
  return neighbors.reduce((sum, neighbor) => sum + overlapArea(channel, neighbor), 0);
}

export function channelCosts(neighbors: readonly Neighbor[]): Record<WifiChoice, number> {
  return { 1: channelCost(1, neighbors), 6: channelCost(6, neighbors), 11: channelCost(11, neighbors) };
}

export function bestChannel(neighbors: readonly Neighbor[]): WifiChoice {
  const costs = channelCosts(neighbors);
  return WIFI_CHANNELS.reduce((best, channel) => (costs[channel] < costs[best] ? channel : best), WIFI_CHANNELS[0]);
}

// Vecinas que de verdad se pisan con ese canal, de la que más a la que menos.
export function overlappingNeighbors(channel: number, neighbors: readonly Neighbor[]): Neighbor[] {
  return neighbors
    .filter((neighbor) => overlapArea(channel, neighbor) >= 0.3)
    .sort((a, b) => overlapArea(channel, b) - overlapArea(channel, a));
}

export interface Point {
  x: number;
  y: number;
}

// Puntos (canal, altura 0–1) del contorno de una colina, opcionalmente recortada entre `from` y `to`.
export function hillPoints(center: number, strength: Strength, from = center - HILL_HALF, to = center + HILL_HALF, steps = 18): Point[] {
  const low = Math.max(from, center - HILL_HALF);
  const high = Math.min(to, center + HILL_HALF);
  if (high <= low) return [];
  const points: Point[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const x = low + ((high - low) * index) / steps;
    points.push({ x, y: STRENGTH_HEIGHT[strength] * hillHeight(x - center) });
  }
  return points;
}

// Polígono SVG cerrado sobre la línea base a partir de esos puntos.
export function polygonPath(points: readonly Point[], toX: (x: number) => number, toY: (y: number) => number, baseY: number): string {
  if (points.length === 0) return '';
  const round = (value: number) => Math.round(value * 10) / 10;
  const first = points[0];
  const last = points[points.length - 1];
  const body = points.map((point) => `L${round(toX(point.x))} ${round(toY(point.y))}`).join(' ');
  return `M${round(toX(first.x))} ${round(baseY)} ${body} L${round(toX(last.x))} ${round(baseY)} Z`;
}

// Fila (0, 1, 2…) del rótulo de cada vecina para que dos rótulos cercanos no se encimen.
export function assignLanes(neighbors: readonly Neighbor[], gap: number): number[] {
  const order = neighbors.map((_, index) => index).sort((a, b) => neighbors[a].channel - neighbors[b].channel);
  const lanes = new Array<number>(neighbors.length).fill(0);
  const done: number[] = [];
  order.forEach((index) => {
    let lane = 0;
    while (done.some((other) => lanes[other] === lane && Math.abs(neighbors[other].channel - neighbors[index].channel) < gap)) lane += 1;
    lanes[index] = lane;
    done.push(index);
  });
  return lanes;
}

export function listNames(names: readonly string[]): string {
  const quoted = names.map((name) => `«${name}»`);
  if (quoted.length <= 1) return quoted.join('');
  return `${quoted.slice(0, -1).join(', ')} y ${quoted[quoted.length - 1]}`;
}

export function explainChannel(scenario: WifiScenario, picked: WifiChoice, streak = 1): string {
  if (picked === scenario.best) return `${cheer(streak)} Canal ${picked} libre.`;
  const hits = overlappingNeighbors(picked, scenario.neighbors)
    .slice(0, 2)
    .map((neighbor) => neighbor.name);
  return `El canal ${picked} se pisa con ${listNames(hits)}. El más libre es el ${scenario.best}.`;
}

// Barras de señal (1 a 4) del Wi-Fi del laboratorio en ese canal, comparado con los otros dos: el mejor canal
// siempre muestra 3 o 4 barras y los demás 1 o 2.
export function signalBars(scenario: WifiScenario, channel: WifiChoice): number {
  const worst = Math.max(1, ...WIFI_CHANNELS.map((item) => scenario.costs[item]));
  const bars = 1 + Math.round((1 - scenario.costs[channel] / worst) * 3);
  return channel === scenario.best ? Math.max(3, bars) : Math.min(2, bars);
}

export function describeScenario(scenario: WifiScenario): string {
  const parts = [...scenario.neighbors].sort((a, b) => a.channel - b.channel).map((neighbor) => `${neighbor.name} en el canal ${neighbor.channel} (señal ${STRENGTH_WORD[neighbor.strength]})`);
  return `Gráfico de canales Wi-Fi. Redes vecinas: ${parts.join(', ')}.`;
}

export const WIFI_PROMPT_FIRST = '1, 6 y 11 no se pisan. Elige el canal con menos redes encima.';
export const WIFI_PROMPT = 'Elige el canal más libre.';

const NEIGHBOR_NAMES = [
  'Casa_Pérez',
  'Café',
  'Depto 402',
  'Hotel Sol',
  'Kiosco',
  'Panadería',
  'Gimnasio',
  'Farmacia',
  'Depto 12B',
  'Librería',
  'Sushi Bar',
  'Casa_Soto',
  'Dentista',
  'Pizzería',
  'Casa_Díaz',
  'Copias',
];

interface WifiLevel {
  count: [number, number];
  strengths: Strength[];
  // Diferencia mínima de interferencia entre el mejor canal y el segundo (para que haya un ganador claro).
  margin: number;
  // Interferencia máxima que puede tener el mejor canal.
  bestMax: number;
}

const WIFI_LEVELS: WifiLevel[] = [
  { count: [2, 3], strengths: [2, 3], margin: 5, bestMax: 1 },
  { count: [3, 3], strengths: [1, 2, 3], margin: 3, bestMax: 2.5 },
  { count: [4, 4], strengths: [1, 2, 3], margin: 2, bestMax: 4 },
];

// Canales de las vecinas: separados al menos 2 y nunca tres juntas dentro de 5 canales (los rótulos no se pisan).
function validSpacing(sorted: readonly number[]): boolean {
  for (let index = 1; index < sorted.length; index += 1) if (sorted[index] - sorted[index - 1] < 2) return false;
  for (let index = 2; index < sorted.length; index += 1) if (sorted[index] - sorted[index - 2] < 5) return false;
  return true;
}

function channelSets(count: number): number[][] {
  const sets: number[][] = [];
  const walk = (start: number, current: number[]) => {
    if (current.length === count) {
      if (validSpacing(current)) sets.push(current);
      return;
    }
    for (let channel = start; channel <= 11; channel += 1) walk(channel + 1, [...current, channel]);
  };
  walk(1, []);
  return sets;
}

const CHANNEL_SETS: Record<number, number[][]> = { 2: channelSets(2), 3: channelSets(3), 4: channelSets(4) };

function makeScenario(random: () => number, target: WifiChoice, rules: WifiLevel, names: string[]): WifiScenario {
  const [minCount, maxCount] = rules.count;
  for (let attempt = 0; attempt < 600; attempt += 1) {
    const count = minCount + Math.floor(random() * (maxCount - minCount + 1));
    const sets = CHANNEL_SETS[count];
    const channels = sets[Math.floor(random() * sets.length)];
    const neighbors: Neighbor[] = channels.map((channel, index) => ({
      name: names[index],
      channel,
      strength: rules.strengths[Math.floor(random() * rules.strengths.length)],
    }));
    const costs = channelCosts(neighbors);
    const ranked = [...WIFI_CHANNELS].sort((a, b) => costs[a] - costs[b]);
    if (ranked[0] === target && costs[ranked[1]] - costs[ranked[0]] >= rules.margin && costs[target] <= rules.bestMax) {
      return { neighbors, costs, best: target };
    }
  }
  // Salida segura: una red fuerte sobre cada uno de los otros dos canales; el elegido queda libre.
  const neighbors: Neighbor[] = WIFI_CHANNELS.filter((channel) => channel !== target).map((channel, index) => ({ name: names[index], channel, strength: 3 }));
  return { neighbors, costs: channelCosts(neighbors), best: target };
}

// 3 escenarios; el canal ganador es distinto en cada uno y siempre es único.
export function makeWifiScenarios(seed: number, level: number): WifiScenario[] {
  const rules = WIFI_LEVELS[normalizeLevel(level)];
  const random = mulberry32((seed ^ 0x71f1) >>> 0);
  const targets = seededShuffle<WifiChoice>([...WIFI_CHANNELS], random);
  const names = seededShuffle(NEIGHBOR_NAMES, random);
  return targets.map((target, index) => makeScenario(random, target, rules, names.slice(index * 5, index * 5 + 5)));
}

// ——— Ronda C · Arma la red ———

export type SlotId = 'firewall' | 'router' | 'switch' | 'ap';
export type DeviceId = 'firewall' | 'router' | 'switch' | 'ap' | 'printer' | 'camera';
export type Placed = Partial<Record<SlotId, DeviceId>>;

export interface DeviceInfo {
  id: DeviceId;
  name: string;
  article: string;
  art: DeviceKind;
  // Línea que se muestra al acertar.
  role: string;
  // Lo que hace, para explicar un error.
  does: string;
}

export const DEVICES: Record<DeviceId, DeviceInfo> = {
  router: { id: 'router', name: 'Router', article: 'El', art: 'router', role: 'El router conecta la sala con Internet.', does: 'conecta con Internet' },
  switch: { id: 'switch', name: 'Switch', article: 'El', art: 'switch', role: 'El switch une por cable los equipos de la sala.', does: 'une los cables' },
  ap: { id: 'ap', name: 'Access point', article: 'El', art: 'accessPoint', role: 'El access point reparte Wi-Fi a los celulares.', does: 'da Wi-Fi' },
  firewall: { id: 'firewall', name: 'Firewall', article: 'El', art: 'firewall', role: 'El firewall revisa lo que entra desde Internet.', does: 'filtra lo que entra' },
  printer: { id: 'printer', name: 'Impresora', article: 'La', art: 'printer', role: '', does: '' },
  camera: { id: 'camera', name: 'Cámara', article: 'La', art: 'camera', role: '', does: '' },
};

// Qué equipo va en cada hueco.
export const SLOT_NEEDS: Record<SlotId, DeviceId> = { firewall: 'firewall', router: 'router', switch: 'switch', ap: 'ap' };

export function slotsForLevel(level: number): SlotId[] {
  return normalizeLevel(level) === 2 ? ['firewall', 'router', 'switch', 'ap'] : ['router', 'switch', 'ap'];
}

export interface NetworkRoundData {
  level: Level;
  slots: SlotId[];
  // Equipos de la bandeja (los de los huecos más un distractor), en orden mezclado.
  tray: DeviceId[];
  distractor: DeviceId;
}

export function makeNetworkRound(seed: number, level: number): NetworkRoundData {
  const lvl = normalizeLevel(level);
  const random = mulberry32((seed ^ 0xb215) >>> 0);
  const slots = slotsForLevel(lvl);
  const distractor: DeviceId = random() < 0.5 ? 'printer' : 'camera';
  const tray = seededShuffle<DeviceId>([...slots.map((slot) => SLOT_NEEDS[slot]), distractor], random);
  return { level: lvl, slots, tray, distractor };
}

// Resultado de poner `device` en `slot`: si calza, la línea del rol; si no, explica cuál iba.
export function placementResult(slot: SlotId, device: DeviceId): { ok: boolean; text: string } {
  const need = DEVICES[SLOT_NEEDS[slot]];
  if (SLOT_NEEDS[slot] === device) return { ok: true, text: need.role };
  const given = DEVICES[device];
  if (device === 'printer' || device === 'camera') {
    return { ok: false, text: `${given.article} ${lower(given.name)} usa la red, no la arma. Ahí va el ${lower(need.name)}.` };
  }
  return { ok: false, text: `Ahí va el ${lower(need.name)}: ${need.does}.` };
}

export interface Online {
  slots: Record<SlotId, boolean>;
  pcs: boolean;
  phones: boolean;
}

// Qué partes de la red ya tienen Internet: cada hueco necesita que todos los anteriores (desde Internet) estén bien.
export function onlineState(placed: Placed, slots: readonly SlotId[]): Online {
  const result: Online = { slots: { firewall: false, router: false, switch: false, ap: false }, pcs: false, phones: false };
  let chain = true;
  slots
    .filter((slot) => slot !== 'ap')
    .forEach((slot) => {
      chain = chain && placed[slot] === SLOT_NEEDS[slot];
      result.slots[slot] = chain;
    });
  if (slots.includes('ap')) result.slots.ap = chain && placed.ap === SLOT_NEEDS.ap;
  result.pcs = chain;
  result.phones = result.slots.ap;
  return result;
}

export function correctSlots(placed: Placed, slots: readonly SlotId[]): number {
  return slots.filter((slot) => placed[slot] === SLOT_NEEDS[slot]).length;
}

export function isComplete(placed: Placed, slots: readonly SlotId[]): boolean {
  return correctSlots(placed, slots) === slots.length;
}

const SLOT_WHERE: Record<SlotId, string> = {
  firewall: 'junto a Internet',
  router: 'entre Internet y la red de la sala',
  switch: 'entre el router y los PCs',
  ap: 'junto a los celulares',
};

// Nombre accesible de un hueco: dónde está en el dibujo (sin decir qué equipo lleva).
export function slotLabel(slot: SlotId, slots: readonly SlotId[], placed: Placed): string {
  const device = placed[slot];
  return `Hueco ${slots.indexOf(slot) + 1} de ${slots.length}, ${SLOT_WHERE[slot]}${device ? `: ${DEVICES[device].name} puesto` : ', vacío'}`;
}

// Guía del paso siguiente (se muestra siempre sobre el dibujo).
export function stepCaption(selectedSlot: SlotId | null, selectedDevice: DeviceId | null): string {
  if (selectedSlot) return '2 · Ahora toca el equipo que va ahí';
  if (selectedDevice) return '2 · Ahora toca el hueco para este equipo';
  return '1 · Toca un hueco vacío';
}

export interface LayoutNode {
  id: string;
  kind: 'internet' | 'slot' | 'pc' | 'phone';
  slot?: SlotId;
  // Centro y tamaño de la caja, en píxeles.
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutLink {
  from: string;
  to: string;
  kind: 'cable' | 'wifi';
}

export interface TopologyLayout {
  nodes: LayoutNode[];
  links: LayoutLink[];
  slotSize: number;
  wifi: { x: number; y: number; radii: number[] };
  labels: { internet: Point; pcs: Point; phones: Point };
}

const BOARD_PAD = 6;

// Dibujo de la red en un tablero de `width`×`height`: fila de arriba = Internet y los huecos (el último es el
// access point); fila de abajo = 3 PCs bajo el switch (cable) y 2 celulares bajo el access point (Wi-Fi).
export function topologyLayout(width: number, height: number, slots: readonly SlotId[]): TopologyLayout {
  const count = slots.length;
  const usable = width - BOARD_PAD * 2;
  const bySize = Math.floor((usable - count * 12) / (count + 0.8));
  const slotSize = Math.max(44, Math.min(58, bySize));
  const internetSize = Math.round(slotSize * 0.8);
  const gap = (usable - internetSize - count * slotSize) / count;
  const rowA = 8 + slotSize / 2;

  const nodes: LayoutNode[] = [];
  let cursor = BOARD_PAD;
  nodes.push({ id: 'internet', kind: 'internet', x: cursor + internetSize / 2, y: rowA, w: internetSize, h: internetSize });
  cursor += internetSize + gap;
  slots.forEach((slot) => {
    nodes.push({ id: `slot:${slot}`, kind: 'slot', slot, x: cursor + slotSize / 2, y: rowA, w: slotSize, h: slotSize });
    cursor += slotSize + gap;
  });

  const scale = Math.max(0.9, Math.min(1.25, width / 320));
  const pcW = Math.round(28 * scale);
  const pcH = Math.round(23 * scale);
  const phoneW = Math.round(15 * scale);
  const phoneH = Math.round(25 * scale);
  const rowH = Math.max(pcH, phoneH);
  const rowB = height - 8 - 14 - rowH / 2;
  const xSwitch = nodes.find((node) => node.slot === 'switch')?.x ?? width / 2;
  const xAp = nodes.find((node) => node.slot === 'ap')?.x ?? width / 2;
  const pcStep = pcW + 6;
  const pcsHalf = pcStep + pcW / 2;
  const phoneStep = phoneW + 14;
  const phonesHalf = phoneStep / 2 + phoneW / 2;
  // Los PCs quedan bajo el switch, corridos a la izquierda lo justo para no chocar con los celulares.
  const pcCenter = Math.max(BOARD_PAD + pcsHalf, Math.min(xSwitch, xAp - phonesHalf - 8 - pcsHalf));
  for (let index = 0; index < 3; index += 1) nodes.push({ id: `pc:${index}`, kind: 'pc', x: pcCenter + (index - 1) * pcStep, y: rowB, w: pcW, h: pcH });
  for (let index = 0; index < 2; index += 1) nodes.push({ id: `phone:${index}`, kind: 'phone', x: xAp + (index - 0.5) * phoneStep, y: rowB, w: phoneW, h: phoneH });

  const chain = slots.filter((slot) => slot !== 'ap');
  const links: LayoutLink[] = [{ from: 'internet', to: `slot:${chain[0]}`, kind: 'cable' }];
  chain.slice(1).forEach((slot, index) => links.push({ from: `slot:${chain[index]}`, to: `slot:${slot}`, kind: 'cable' }));
  links.push({ from: `slot:${chain[chain.length - 1]}`, to: 'slot:ap', kind: 'cable' });
  for (let index = 0; index < 3; index += 1) links.push({ from: 'slot:switch', to: `pc:${index}`, kind: 'cable' });
  for (let index = 0; index < 2; index += 1) links.push({ from: 'slot:ap', to: `phone:${index}`, kind: 'wifi' });

  const arcTop = rowA + slotSize / 2 + 3;
  const room = Math.max(12, rowB - phoneH / 2 - 4 - arcTop);
  return {
    nodes,
    links,
    slotSize,
    wifi: { x: xAp, y: arcTop, radii: [0.34, 0.6, 0.86].map((fraction) => Math.max(6, Math.round(room * fraction))) },
    labels: {
      internet: { x: nodes[0].x, y: rowA + internetSize / 2 + 1 },
      pcs: { x: pcCenter, y: rowB + rowH / 2 + 2 },
      phones: { x: xAp, y: rowB + rowH / 2 + 2 },
    },
  };
}
