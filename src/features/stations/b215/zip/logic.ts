import { mulberry32 } from '@/route/random';

// «Ruta del paquete» (estilo Zip): une los puntos numerados en orden pasando por TODAS las casillas.
// Lógica pura: primero se genera un recorrido que cubre todo el tablero (camino hamiltoniano) y luego se
// ponen los puntos numerados a lo largo de él, así que cada tablero tiene solución. Las casillas se
// numeran por filas: casilla = fila * tamaño + columna.

export const ZIP_MIN_SIZE = 4;
export const ZIP_MAX_SIZE = 7;

export interface ZipPuzzle {
  size: number;
  // Casilla de cada punto numerado, en orden: el punto 1 es checkpoints[0] y el último es el destino.
  checkpoints: number[];
  // Una solución posible (todas las casillas, del primer al último punto). Puede haber otras.
  solution: number[];
}

export interface Point {
  x: number;
  y: number;
}

export function clampZipSize(size: number): number {
  const value = Math.round(size);
  return Number.isFinite(value) ? Math.min(ZIP_MAX_SIZE, Math.max(ZIP_MIN_SIZE, value)) : ZIP_MIN_SIZE;
}

// Cantidad de puntos numerados: tamaño + 1 hasta 5×5 y tamaño + 2 desde 6×6.
export function checkpointCount(size: number): number {
  return size <= 5 ? size + 1 : size + 2;
}

// Ronda del circuito B215: nivel 0 → 4×4, 1 → 5×5, 2 → 6×6.
export function zipSizeForRoundLevel(level: number): number {
  return level <= 0 ? 4 : level === 1 ? 5 : 6;
}

// Desafío sin reloj: nivel 1 → 4×4, 2 → 5×5, 3 → 6×6, 4 o más → 7×7.
export function zipSizeForPuzzleLevel(level: number): number {
  return level <= 1 ? 4 : level === 2 ? 5 : level === 3 ? 6 : 7;
}

// ——— Tablero ———

const tables = new Map<number, number[][]>();

// Vecinos (arriba, derecha, abajo, izquierda) de cada casilla.
export function neighborTable(size: number): number[][] {
  let table = tables.get(size);
  if (!table) {
    table = [];
    for (let cell = 0; cell < size * size; cell += 1) {
      const row = Math.floor(cell / size);
      const col = cell % size;
      const list: number[] = [];
      if (row > 0) list.push(cell - size);
      if (col < size - 1) list.push(cell + 1);
      if (row < size - 1) list.push(cell + size);
      if (col > 0) list.push(cell - 1);
      table.push(list);
    }
    tables.set(size, table);
  }
  return table;
}

export function areAdjacent(size: number, a: number, b: number): boolean {
  return neighborTable(size)[a]?.includes(b) ?? false;
}

// Condiciones necesarias para poder terminar un recorrido que cubra todo el tablero desde `head`:
// toda casilla libre se alcanza desde la cabeza y tiene salida suficiente (2 vecinos libres o la
// cabeza; la casilla final solo necesita 1). `end`: dónde debe terminar (null: en cualquiera, pero
// entonces solo una casilla puede quedar como callejón sin salida).
function canFinish(size: number, visited: Uint8Array, head: number, end: number | null): boolean {
  const adjacent = neighborTable(size);
  const total = size * size;
  let free = 0;
  let deadEnds = 0;
  for (let cell = 0; cell < total; cell += 1) {
    if (visited[cell]) continue;
    free += 1;
    let exits = 0;
    for (const next of adjacent[cell]) if (!visited[next] || next === head) exits += 1;
    if (exits === 0) return false;
    if (exits === 1) {
      if (end !== null) {
        if (cell !== end) return false;
      } else {
        deadEnds += 1;
        if (deadEnds > 1) return false;
      }
    }
  }
  if (free === 0) return true;
  const seen = new Uint8Array(total);
  const stack: number[] = [];
  let reached = 0;
  for (const next of adjacent[head]) {
    if (!visited[next]) {
      seen[next] = 1;
      reached += 1;
      stack.push(next);
    }
  }
  while (stack.length > 0) {
    const cell = stack.pop() as number;
    for (const next of adjacent[cell]) {
      if (!visited[next] && !seen[next]) {
        seen[next] = 1;
        reached += 1;
        stack.push(next);
      }
    }
  }
  return reached === free;
}

// ——— Generación ———

// Ruido del orden de Warnsdorff: 0 daría siempre espirales; con algo de ruido los caminos serpentean.
const WARNSDORFF_NOISE = 2.2;

// Recorrido en serpiente por filas: siempre válido (último recurso).
function snakePath(size: number): number[] {
  const path: number[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let step = 0; step < size; step += 1) path.push(row * size + (row % 2 === 0 ? step : size - 1 - step));
  }
  return path;
}

// Camino hamiltoniano al azar: DFS con el orden de Warnsdorff (primero la casilla con menos salidas),
// poda de callejones y vuelta atrás. En tableros impares solo puede partir de una casilla «par».
function randomHamiltonianPath(size: number, random: () => number): number[] {
  const total = size * size;
  const adjacent = neighborTable(size);
  const starts: number[] = [];
  for (let cell = 0; cell < total; cell += 1) {
    if (size % 2 === 0 || (Math.floor(cell / size) + (cell % size)) % 2 === 0) starts.push(cell);
  }
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const start = starts[Math.floor(random() * starts.length)];
    const visited = new Uint8Array(total);
    const path = [start];
    visited[start] = 1;
    let budget = 3000 + total * 60;
    const extend = (): boolean => {
      if (path.length === total) return true;
      budget -= 1;
      if (budget < 0) return false;
      const head = path[path.length - 1];
      const options = adjacent[head]
        .filter((cell) => !visited[cell])
        .map((cell) => ({ cell, key: adjacent[cell].filter((next) => !visited[next]).length + random() * WARNSDORFF_NOISE }))
        .sort((a, b) => a.key - b.key);
      for (const { cell } of options) {
        visited[cell] = 1;
        path.push(cell);
        if (canFinish(size, visited, cell, null) && extend()) return true;
        path.pop();
        visited[cell] = 0;
        if (budget < 0) return false;
      }
      return false;
    };
    if (extend()) return path;
  }
  return snakePath(size);
}

// Puntos numerados repartidos a lo largo del recorrido: siempre la primera y la última casilla, y el
// resto a distancias parecidas (con algo de variación y nunca pegados en el recorrido).
function placeCheckpoints(size: number, solution: number[], random: () => number): number[] {
  const total = solution.length;
  const gaps = checkpointCount(size) - 1;
  const spacing = (total - 1) / gaps;
  const positions = [0];
  for (let k = 1; k < gaps; k += 1) {
    const jitter = Math.round((random() * 2 - 1) * spacing * 0.3);
    const min = positions[k - 1] + 2;
    const max = total - 1 - 2 * (gaps - k);
    positions.push(Math.min(max, Math.max(min, Math.round(k * spacing) + jitter)));
  }
  positions.push(total - 1);
  return positions.map((position) => solution[position]);
}

// Tablero de `size`×`size` (4 a 7), igual para la misma semilla en cualquier dispositivo.
export function createZipPuzzle(size: number, seed: number): ZipPuzzle {
  const side = clampZipSize(size);
  const random = mulberry32(seed);
  const solution = randomHamiltonianPath(side, random);
  return { size: side, solution, checkpoints: placeCheckpoints(side, solution, random) };
}

// ——— Reglas ———

// Número (1…K) del punto que hay en la casilla; 0 si no hay ninguno.
export function checkpointNumber(puzzle: ZipPuzzle, cell: number): number {
  return puzzle.checkpoints.indexOf(cell) + 1;
}

// Número del siguiente punto que toca visitar (K + 1 si ya pasó por todos).
export function nextCheckpoint(puzzle: ZipPuzzle, path: readonly number[]): number {
  let reached = 0;
  for (const cell of path) {
    if (checkpointNumber(puzzle, cell) === reached + 1) reached += 1;
  }
  return reached + 1;
}

export type ZipFault = 'empty' | 'start' | 'step' | 'repeat' | 'order' | 'incomplete' | 'end';

export type ZipVerdict = { ok: true } | { ok: false; fault: ZipFault; at: number };

// Comprueba un recorrido completo: parte en el punto 1, avanza de a una casilla (sin diagonales), no
// repite casillas, pasa por los puntos en orden, cubre todo el tablero y termina en el último punto.
export function validateZipPath(puzzle: ZipPuzzle, path: readonly number[]): ZipVerdict {
  const total = puzzle.size * puzzle.size;
  if (path.length === 0) return { ok: false, fault: 'empty', at: 0 };
  if (path[0] !== puzzle.checkpoints[0]) return { ok: false, fault: 'start', at: 0 };
  const seen = new Set<number>([path[0]]);
  let reached = 1;
  for (let index = 1; index < path.length; index += 1) {
    const cell = path[index];
    if (!Number.isInteger(cell) || cell < 0 || cell >= total || !areAdjacent(puzzle.size, path[index - 1], cell)) return { ok: false, fault: 'step', at: index };
    if (seen.has(cell)) return { ok: false, fault: 'repeat', at: index };
    seen.add(cell);
    const number = checkpointNumber(puzzle, cell);
    if (number > 0) {
      if (number !== reached + 1) return { ok: false, fault: 'order', at: index };
      reached = number;
    }
  }
  if (path.length !== total) return { ok: false, fault: 'incomplete', at: path.length };
  if (path[path.length - 1] !== puzzle.checkpoints[puzzle.checkpoints.length - 1]) return { ok: false, fault: 'end', at: path.length - 1 };
  return { ok: true };
}

// Por qué no se puede pasar de la cabeza del recorrido a `cell` (null: se puede).
// «order»: es un punto que aún no toca; «early»: es el último punto y faltan casillas.
export function extendFault(puzzle: ZipPuzzle, path: readonly number[], cell: number): 'far' | 'taken' | 'order' | 'early' | null {
  const total = puzzle.size * puzzle.size;
  if (path.length === 0) return cell === puzzle.checkpoints[0] ? null : 'far';
  if (cell < 0 || cell >= total || !areAdjacent(puzzle.size, path[path.length - 1], cell)) return 'far';
  if (path.includes(cell)) return 'taken';
  const number = checkpointNumber(puzzle, cell);
  if (number === 0) return null;
  if (number !== nextCheckpoint(puzzle, path)) return 'order';
  if (number === puzzle.checkpoints.length && path.length !== total - 1) return 'early';
  return null;
}

export function canExtend(puzzle: ZipPuzzle, path: readonly number[], cell: number): boolean {
  return extendFault(puzzle, path, cell) === null;
}

// Vuelve el recorrido hasta `cell` (que queda como cabeza). Si no está en el recorrido, no cambia.
export function cutTo(path: number[], cell: number): number[] {
  const index = path.indexOf(cell);
  return index < 0 ? path : path.slice(0, index + 1);
}

// ¿El recorrido ya no se puede completar? (casillas aisladas o sin salida). Solo avisa cuando es seguro:
// nunca da falsos positivos, aunque puede no notar algunos callejones.
export function zipStuck(puzzle: ZipPuzzle, path: readonly number[]): boolean {
  const total = puzzle.size * puzzle.size;
  if (path.length === 0 || path.length >= total) return false;
  const end = puzzle.checkpoints[puzzle.checkpoints.length - 1];
  const visited = new Uint8Array(total);
  for (const cell of path) visited[cell] = 1;
  if (visited[end]) return true;
  return !canFinish(puzzle.size, visited, path[path.length - 1], end);
}

// ——— Partida ———

export interface ZipState {
  path: number[];
  // Recorridos anteriores, para «Deshacer».
  history: number[][];
  // Casillas que se han ido sumando (también las que luego se quitaron).
  steps: number;
}

export type ZipOutcome =
  | { kind: 'none' }
  | { kind: 'extend'; reached: number }
  | { kind: 'cut'; removed: number }
  | { kind: 'refused'; fault: 'order' | 'early' };

const NONE: ZipOutcome = { kind: 'none' };
const HISTORY_LIMIT = 150;

export function startZip(puzzle: ZipPuzzle): ZipState {
  return { path: [puzzle.checkpoints[0]], history: [], steps: 0 };
}

// El dedo pasó por `cell`: la alarga, la corta si es una casilla ya recorrida o la rechaza.
export function stepZip(puzzle: ZipPuzzle, state: ZipState, cell: number): { state: ZipState; outcome: ZipOutcome } {
  const { path } = state;
  if (cell === path[path.length - 1]) return { state, outcome: NONE };
  const history = [...state.history, path].slice(-HISTORY_LIMIT);
  if (path.includes(cell)) {
    const next = cutTo(path, cell);
    return { state: { ...state, path: next, history }, outcome: { kind: 'cut', removed: path.length - next.length } };
  }
  const fault = extendFault(puzzle, path, cell);
  if (fault === null) {
    return { state: { path: [...path, cell], history, steps: state.steps + 1 }, outcome: { kind: 'extend', reached: checkpointNumber(puzzle, cell) } };
  }
  return { state, outcome: fault === 'order' || fault === 'early' ? { kind: 'refused', fault } : NONE };
}

export function undoZip(state: ZipState): ZipState {
  if (state.history.length === 0) return state;
  return { ...state, path: state.history[state.history.length - 1], history: state.history.slice(0, -1) };
}

export function resetZip(puzzle: ZipPuzzle, state: ZipState): ZipState {
  if (state.path.length <= 1) return state;
  return { ...state, path: [puzzle.checkpoints[0]], history: [...state.history, state.path].slice(-HISTORY_LIMIT) };
}

export function isZipSolved(puzzle: ZipPuzzle, state: ZipState): boolean {
  return state.path.length === puzzle.size * puzzle.size && validateZipPath(puzzle, state.path).ok;
}

// Qué parte de los pasos dados quedó en el recorrido (1 = sin quitar ni deshacer nada).
export function zipAccuracy(state: ZipState): number {
  return state.steps <= 0 ? 0 : Math.min(1, (state.path.length - 1) / state.steps);
}

// ——— Puntajes ———

// Ronda resuelta: 0,85 y hasta 0,15 más según el tiempo que sobró (`timeLeft` de 0 a 1).
export function zipSolvedScore(timeLeft: number): number {
  return 0.85 + 0.15 * Math.min(1, Math.max(0, timeLeft));
}

// Se acabó el tiempo: 0,6 por la parte del tablero que alcanzó a cubrir.
export function zipTimeUpScore(covered: number, total: number): number {
  return total > 0 ? 0.6 * Math.min(1, Math.max(0, covered / total)) : 0;
}

// Desafío sin reloj: resolver vale 600 y la eficiencia (pasos que quedaron / pasos dados) hasta 400 más.
export function zipPuzzleScore(accuracy: number): number {
  return Math.round(600 + 400 * Math.min(1, Math.max(0, accuracy)));
}

// ——— Dedo sobre el tablero ———

// Casilla bajo el punto (x, y) de un tablero cuadrado de lado `side`. Devuelve null fuera del tablero y
// en las esquinas de cada casilla (ahí el dedo aún no decidió hacia dónde va, y así no hay diagonales).
export function cellAtPoint(size: number, side: number, x: number, y: number): number | null {
  if (!(side > 0) || x < 0 || y < 0 || x >= side || y >= side) return null;
  const cell = side / size;
  const col = Math.floor(x / cell);
  const row = Math.floor(y / cell);
  if (Math.hypot(x - (col + 0.5) * cell, y - (row + 0.5) * cell) > cell * 0.62) return null;
  return row * size + col;
}

// Casillas por las que pasa el dedo al ir de `from` a `to` (sin repetir la casilla de `from`), para no
// perder ninguna si se mueve rápido. Sin `from` (primer toque) devuelve solo la casilla tocada.
export function cellsAlong(size: number, side: number, from: Point | null, to: Point): number[] {
  const cell = side / size;
  let previous = from ? cellAtPoint(size, side, from.x, from.y) : null;
  const steps = from ? Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / (cell * 0.25))) : 1;
  const out: number[] = [];
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const current = from ? cellAtPoint(size, side, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t) : cellAtPoint(size, side, to.x, to.y);
    if (current === null || current === previous) continue;
    out.push(current);
    previous = current;
  }
  return out;
}
