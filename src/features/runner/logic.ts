// TEL Runner: simulación pura de la carrera por la "autopista de datos" (tres pistas, sin fin).
// La pantalla solo dibuja este estado; por eso toda la regla del juego se puede probar sin interfaz.

export const LANES = 3;
// Metros visibles por delante y por detrás del corredor.
export const VIEW_AHEAD = 24;
export const VIEW_BEHIND = 5;
// Metros entre una fila de objetos y la siguiente.
export const ROW_GAP = 4;
// Distancia (hacia adelante o atrás) a la que un objeto de la misma pista toca al corredor.
export const HIT_RANGE = 0.9;
// Tras un golpe, el corredor parpadea y nada lo daña por un momento.
export const SAFE_SECONDS = 1.4;
// Primeros metros sin obstáculos: sirven de calentamiento.
export const WARMUP_METERS = 40;

export type RunnerItemKind = 'packet' | 'virus' | 'cable' | 'shield' | 'fiber';
export type RunnerInput = 'left' | 'right' | 'jump';
export type RunnerEvent = 'collect' | 'hit' | 'blocked' | 'shield' | 'boost' | 'revive' | 'over';

export interface RunnerItem {
  id: number;
  kind: RunnerItemKind;
  lane: number;
  // Metro de la pista donde está el objeto.
  at: number;
}

// Ventaja de cada personaje (ver characters.ts).
export interface RunnerPerks {
  lives: number;
  jumpSeconds: number;
  boostSeconds: number;
  // Parte con un cortafuegos puesto.
  startShield: boolean;
  // Recoge paquetes de las pistas vecinas.
  magnet: boolean;
  // Una vez por carrera, vuelve con una vida cuando se queda sin ninguna.
  backup: boolean;
}

export const basePerks: RunnerPerks = { lives: 3, jumpSeconds: 0.62, boostSeconds: 7, startShield: false, magnet: false, backup: false };

export interface RunnerState {
  time: number;
  distance: number;
  lane: number;
  jumpEndsAt: number;
  lives: number;
  shield: boolean;
  boostEndsAt: number;
  safeUntil: number;
  // Paquetes de datos recogidos en esta carrera.
  data: number;
  hits: number;
  // Obstáculos que pasaron sin tocar al corredor.
  dodged: number;
  backupLeft: boolean;
  items: RunnerItem[];
  nextRowAt: number;
  nextId: number;
  rowsSinceObstacle: number;
  rowsSincePower: number;
  trailLane: number;
  trailLeft: number;
  over: boolean;
  // Cambia cada vez que la lista de objetos cambia (para redibujar solo entonces).
  revision: number;
  perks: RunnerPerks;
}

export function createRunnerState(perks: RunnerPerks = basePerks): RunnerState {
  return {
    time: 0,
    distance: 0,
    lane: 1,
    jumpEndsAt: 0,
    lives: perks.lives,
    shield: perks.startShield,
    boostEndsAt: 0,
    safeUntil: 0,
    data: 0,
    hits: 0,
    dodged: 0,
    backupLeft: perks.backup,
    items: [],
    nextRowAt: 12,
    nextId: 1,
    rowsSinceObstacle: 0,
    rowsSincePower: 0,
    trailLane: 1,
    trailLeft: 0,
    over: false,
    revision: 0,
    perks,
  };
}

// Tramo de dificultad (0 a 6): sube cada 150 metros.
export function runnerLevel(distance: number): number {
  return Math.min(6, Math.floor(Math.max(0, distance) / 150));
}

// Metros por segundo. `pace` es el ritmo elegido en Ajustes (1 = rápido, 1,7 = tranquilo).
export function runnerSpeed(distance: number, pace = 1): number {
  const calm = Math.sqrt(Math.max(1, pace));
  return (9 + Math.min(7, Math.max(0, distance) / 140)) / calm;
}

export function isAirborne(state: RunnerState): boolean {
  return state.time < state.jumpEndsAt;
}

export function isBoosted(state: RunnerState): boolean {
  return state.time < state.boostEndsAt;
}

// Aplica un gesto del jugador. Devuelve si cambió algo (para la vibración y el sonido).
export function applyRunnerInput(state: RunnerState, input: RunnerInput): boolean {
  if (state.over) return false;
  if (input === 'jump') {
    if (isAirborne(state)) return false;
    state.jumpEndsAt = state.time + state.perks.jumpSeconds;
    return true;
  }
  const next = Math.min(LANES - 1, Math.max(0, state.lane + (input === 'left' ? -1 : 1)));
  if (next === state.lane) return false;
  state.lane = next;
  return true;
}

// Fila nueva de objetos en el metro `at`. Reglas de juego limpio: los virus nunca tapan las tres
// pistas, tras un obstáculo vienen filas libres y el rastro de paquetes lleva a una pista segura.
export function spawnRunnerRow(state: RunnerState, at: number, random: () => number): RunnerItem[] {
  const level = runnerLevel(at);
  const row: (RunnerItemKind | null)[] = [null, null, null];
  state.rowsSinceObstacle += 1;
  state.rowsSincePower += 1;
  const breathing = Math.max(2, 4 - Math.floor(level / 2));
  const obstacleChance = at < WARMUP_METERS ? 0 : 0.34 + level * 0.06;

  if (state.rowsSinceObstacle > breathing && random() < obstacleChance) {
    state.rowsSinceObstacle = 0;
    if (random() < 0.4) {
      // Cable suelto: es bajo, se salta o se esquiva; puede cruzar varias pistas.
      // En el primer tramo deja siempre una pista libre: también se puede esquivar.
      const span = 1 + Math.floor(random() * (level === 0 ? LANES - 1 : LANES));
      const start = Math.floor(random() * (LANES - span + 1));
      for (let lane = start; lane < start + span; lane += 1) row[lane] = 'cable';
    } else {
      // Virus: es alto, solo se esquiva.
      const free = Math.floor(random() * LANES);
      if (level >= 2 && random() < 0.35) {
        for (let lane = 0; lane < LANES; lane += 1) if (lane !== free) row[lane] = 'virus';
        state.trailLane = free;
      } else {
        row[(free + 1 + Math.floor(random() * (LANES - 1))) % LANES] = 'virus';
      }
    }
  }

  if (state.trailLeft <= 0) {
    state.trailLane = Math.floor(random() * LANES);
    state.trailLeft = 3 + Math.floor(random() * 5);
  }
  state.trailLeft -= 1;
  if (row[state.trailLane] === 'virus') {
    const free = row.findIndex((kind) => kind === null);
    if (free >= 0) state.trailLane = free;
  }
  if (row[state.trailLane] === null) row[state.trailLane] = 'packet';

  if (state.rowsSincePower > 26 && state.rowsSinceObstacle > 0 && random() < 0.14) {
    const free = row.map((kind, lane) => (kind === null ? lane : -1)).filter((lane) => lane >= 0);
    if (free.length > 0) {
      row[free[Math.floor(random() * free.length)]] = random() < 0.5 ? 'shield' : 'fiber';
      state.rowsSincePower = 0;
    }
  }

  const items: RunnerItem[] = [];
  row.forEach((kind, lane) => {
    if (!kind) return;
    items.push({ id: state.nextId, kind, lane, at });
    state.nextId += 1;
  });
  return items;
}

// Avanza la carrera `seconds` segundos. Devuelve lo que pasó en ese paso.
export function stepRunner(state: RunnerState, seconds: number, random: () => number, pace = 1): RunnerEvent[] {
  if (state.over) return [];
  const events: RunnerEvent[] = [];
  // Si la app se congeló un instante, el corredor no se "teletransporta" a través de un obstáculo.
  const step = Math.min(Math.max(0, seconds), 0.1);
  state.time += step;
  state.distance += runnerSpeed(state.distance, pace) * step;
  let changed = false;

  while (state.nextRowAt <= state.distance + VIEW_AHEAD) {
    const row = spawnRunnerRow(state, state.nextRowAt, random);
    if (row.length > 0) {
      state.items.push(...row);
      changed = true;
    }
    state.nextRowAt += ROW_GAP;
  }

  const airborne = isAirborne(state);
  const kept: RunnerItem[] = [];
  for (const item of state.items) {
    if (state.over) {
      kept.push(item);
      continue;
    }
    if (item.at < state.distance - VIEW_BEHIND) {
      if (item.kind === 'virus' || item.kind === 'cable') state.dodged += 1;
      changed = true;
      continue;
    }
    const close = Math.abs(item.at - state.distance) <= HIT_RANGE;
    const reach = item.kind === 'packet' && state.perks.magnet ? 1 : 0;
    if (!close || Math.abs(item.lane - state.lane) > reach) {
      kept.push(item);
      continue;
    }
    if (item.kind === 'packet') {
      state.data += isBoosted(state) ? 2 : 1;
      events.push('collect');
      changed = true;
      continue;
    }
    if (item.kind === 'shield') {
      state.shield = true;
      events.push('shield');
      changed = true;
      continue;
    }
    if (item.kind === 'fiber') {
      state.boostEndsAt = state.time + state.perks.boostSeconds;
      events.push('boost');
      changed = true;
      continue;
    }
    // Obstáculo: el cable pasa por debajo si va saltando; con el parpadeo de seguridad nada lo daña.
    if ((item.kind === 'cable' && airborne) || state.time < state.safeUntil) {
      kept.push(item);
      continue;
    }
    changed = true;
    if (state.shield) {
      state.shield = false;
      state.safeUntil = state.time + SAFE_SECONDS / 2;
      events.push('blocked');
      continue;
    }
    state.lives -= 1;
    state.hits += 1;
    state.safeUntil = state.time + SAFE_SECONDS;
    events.push('hit');
    if (state.lives <= 0) {
      if (state.backupLeft) {
        state.backupLeft = false;
        state.lives = 1;
        events.push('revive');
      } else {
        state.over = true;
        events.push('over');
      }
    }
  }
  state.items = kept;
  if (changed) state.revision += 1;
  return events;
}

// Puntaje de la carrera: un punto por metro y diez por paquete de datos.
export function runnerScore(state: Pick<RunnerState, 'distance' | 'data'>): number {
  return Math.round(state.distance) + state.data * 10;
}

// Precisión para la XP: qué parte de los obstáculos se esquivó.
export function runnerAccuracy(state: Pick<RunnerState, 'dodged' | 'hits'>): number {
  const total = state.dodged + state.hits;
  return total === 0 ? 1 : state.dodged / total;
}
