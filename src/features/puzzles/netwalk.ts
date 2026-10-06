// "Conecta la red": rompecabezas de rotar piezas (tipo NetWalk) para llevar la señal del servidor a
// todos los equipos. Lógica pura: se genera un árbol sobre la grilla y se desordena girando piezas.

export const NORTH = 1;
export const EAST = 2;
export const SOUTH = 4;
export const WEST = 8;

const DIRECTIONS = [
  { bit: NORTH, dx: 0, dy: -1, opposite: SOUTH },
  { bit: EAST, dx: 1, dy: 0, opposite: WEST },
  { bit: SOUTH, dx: 0, dy: 1, opposite: NORTH },
  { bit: WEST, dx: -1, dy: 0, opposite: EAST },
];

export interface NetPuzzle {
  size: number;
  server: number;
  // Conexiones de cada pieza en su posición resuelta (bits N/E/S/W).
  solved: number[];
  // Cuartos de giro (sentido horario) aplicados al entregar el rompecabezas.
  turns: number[];
}

export function netSizeForLevel(level: number): number {
  if (level <= 1) return 3;
  if (level <= 3) return 4;
  if (level <= 6) return 5;
  return 6;
}

// Gira una pieza `turns` cuartos de vuelta en sentido horario.
export function rotateMask(mask: number, turns: number): number {
  let value = mask & 15;
  for (let step = 0; step < ((turns % 4) + 4) % 4; step += 1) {
    value = ((value << 1) & 15) | (value >> 3);
  }
  return value;
}

export function portCount(mask: number): number {
  return [NORTH, EAST, SOUTH, WEST].filter((bit) => mask & bit).length;
}

// Árbol aleatorio que cubre toda la grilla (crecimiento desde el servidor, con ramas).
export function generateNet(size: number, random: () => number = Math.random): { size: number; server: number; solved: number[] } {
  const cells = size * size;
  const solved = new Array<number>(cells).fill(0);
  const server = Math.floor(size / 2) * size + Math.floor(size / 2);
  const visited = new Set<number>([server]);
  const frontier: number[] = [server];
  while (visited.size < cells) {
    // Sin celdas desde donde crecer (quedó un hueco encerrado): se genera otra red.
    if (frontier.length === 0) return generateNet(size, random);
    // Mezcla "serpiente" y "ramas": casi siempre se extiende desde una celda reciente.
    const pickIndex = random() < 0.65 ? frontier.length - 1 : Math.floor(random() * frontier.length);
    const cell = frontier[pickIndex];
    const x = cell % size;
    const y = Math.floor(cell / size);
    const options = DIRECTIONS.filter(({ dx, dy }) => {
      const nx = x + dx;
      const ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < size && ny < size && !visited.has(ny * size + nx);
    }).filter(() => portCount(solved[cell]) < 3);
    if (options.length === 0) {
      frontier.splice(pickIndex, 1);
      continue;
    }
    const direction = options[Math.floor(random() * options.length)];
    const next = (y + direction.dy) * size + (x + direction.dx);
    solved[cell] |= direction.bit;
    solved[next] |= direction.opposite;
    visited.add(next);
    frontier.push(next);
  }
  return { size, server, solved };
}

// Equipos de la red: las puntas del árbol (una sola conexión) que no son el servidor.
export function terminalCount(net: { server: number; solved: number[] }): number {
  return net.solved.filter((mask, index) => index !== net.server && portCount(mask) === 1).length;
}

// Mínimo de equipos por tablero: con uno solo el desafío sería un único cable largo.
export function minTerminals(size: number): number {
  return size - 1;
}

// Orden para las pistas: desde el servidor hacia afuera, siguiendo los cables de la solución.
export function hintOrder(net: { size: number; server: number; solved: number[] }): number[] {
  const order: number[] = [net.server];
  const seen = new Set<number>(order);
  for (let head = 0; head < order.length; head += 1) {
    const cell = order[head];
    const x = cell % net.size;
    const y = Math.floor(cell / net.size);
    DIRECTIONS.forEach(({ bit, dx, dy }) => {
      const next = (y + dy) * net.size + (x + dx);
      if (!(net.solved[cell] & bit) || seen.has(next)) return;
      seen.add(next);
      order.push(next);
    });
  }
  return order;
}

// Giros mínimos para volver una pieza a una orientación equivalente a la resuelta.
export function turnsToSolve(solvedMask: number, turns: number): number {
  const current = rotateMask(solvedMask, turns);
  for (let extra = 0; extra < 4; extra += 1) {
    if (rotateMask(current, extra) === solvedMask) return extra;
  }
  return 0;
}

export function createNetPuzzle(level: number, random: () => number = Math.random): NetPuzzle {
  const size = netSizeForLevel(level);
  for (let attempt = 0; ; attempt += 1) {
    const net = generateNet(size, random);
    // Se prefieren redes con varias ramas; tras muchos intentos se acepta la que salga.
    if (attempt < 60 && terminalCount(net) < minTerminals(size)) continue;
    const turns = net.solved.map(() => Math.floor(random() * 4));
    const puzzle = { ...net, turns };
    // Al menos un tercio de las piezas debe necesitar giro (y nunca se entrega resuelto).
    const pending = turns.filter((value, index) => turnsToSolve(net.solved[index], value) > 0).length;
    if (pending >= Math.ceil((size * size) / 3)) return puzzle;
  }
}

export function currentMasks(puzzle: Pick<NetPuzzle, 'solved'>, turns: number[]): number[] {
  return puzzle.solved.map((mask, index) => rotateMask(mask, turns[index] ?? 0));
}

// Celdas que reciben señal: se avanza solo por conexiones que calzan en ambos lados.
export function poweredCells(size: number, server: number, masks: number[]): boolean[] {
  const powered = new Array<boolean>(masks.length).fill(false);
  const queue = [server];
  powered[server] = true;
  while (queue.length) {
    const cell = queue.pop() as number;
    const x = cell % size;
    const y = Math.floor(cell / size);
    for (const direction of DIRECTIONS) {
      if (!(masks[cell] & direction.bit)) continue;
      const nx = x + direction.dx;
      const ny = y + direction.dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const next = ny * size + nx;
      if (powered[next] || !(masks[next] & direction.opposite)) continue;
      powered[next] = true;
      queue.push(next);
    }
  }
  return powered;
}

export function isNetSolved(size: number, server: number, masks: number[]): boolean {
  return poweredCells(size, server, masks).every(Boolean);
}

export function minimalMoves(puzzle: NetPuzzle): number {
  return puzzle.turns.reduce((total, turns, index) => total + turnsToSolve(puzzle.solved[index], turns), 0);
}

// Puntaje: resolver vale 600 y la eficiencia (giros mínimos / giros usados) hasta 400 más.
export function netScore(optimal: number, moves: number): number {
  const efficiency = moves <= 0 ? 1 : Math.min(1, optimal / moves);
  return Math.round(600 + 400 * efficiency);
}
