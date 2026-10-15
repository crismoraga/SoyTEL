import {
  areAdjacent,
  canExtend,
  cellAtPoint,
  cellsAlong,
  checkpointCount,
  checkpointNumber,
  clampZipSize,
  createZipPuzzle,
  cutTo,
  extendFault,
  isZipSolved,
  nextCheckpoint,
  resetZip,
  startZip,
  stepZip,
  undoZip,
  validateZipPath,
  zipAccuracy,
  zipPuzzleScore,
  zipSizeForPuzzleLevel,
  zipSizeForRoundLevel,
  zipSolvedScore,
  zipStuck,
  zipTimeUpScore,
  type ZipPuzzle,
} from '@/features/stations/b215/zip/logic';

const SIZES = [4, 5, 6, 7];
const SEEDS = 200;

// Tablero 4×4 a mano: la serpiente por filas pasa por los puntos 1 a 5 en las casillas 0, 3, 4, 11 y 12.
const SNAKE = [0, 1, 2, 3, 7, 6, 5, 4, 8, 9, 10, 11, 15, 14, 13, 12];
const snake: ZipPuzzle = { size: 4, checkpoints: [0, 3, 4, 11, 12], solution: SNAKE };

describe('Ruta del paquete · generador', () => {
  it.each(SIZES)('tamaño %i: 200 semillas dan un camino que recorre todas las casillas una sola vez', (size) => {
    for (let seed = 1; seed <= SEEDS; seed += 1) {
      const { solution } = createZipPuzzle(size, seed);
      expect(solution).toHaveLength(size * size);
      expect(new Set(solution).size).toBe(size * size);
      for (let index = 1; index < solution.length; index += 1) {
        if (!areAdjacent(size, solution[index - 1], solution[index])) throw new Error(`tamaño ${size}, semilla ${seed}: salto en el paso ${index}`);
      }
    }
  });

  it.each(SIZES)('tamaño %i: los puntos van en orden, repartidos, y la solución generada valida', (size) => {
    for (let seed = 1; seed <= SEEDS; seed += 1) {
      const puzzle = createZipPuzzle(size, seed);
      const { checkpoints, solution } = puzzle;
      expect(checkpoints).toHaveLength(checkpointCount(size));
      expect(checkpoints[0]).toBe(solution[0]);
      expect(checkpoints[checkpoints.length - 1]).toBe(solution[solution.length - 1]);
      const positions = checkpoints.map((cell) => solution.indexOf(cell));
      positions.forEach((position, index) => {
        if (position < 0) throw new Error(`punto ${index + 1} fuera de la solución`);
        if (index > 0 && position - positions[index - 1] < 2) throw new Error(`tamaño ${size}, semilla ${seed}: puntos ${index} y ${index + 1} demasiado juntos`);
      });
      expect(validateZipPath(puzzle, solution)).toEqual({ ok: true });
      expect(isZipSolved(puzzle, { path: solution, history: [], steps: solution.length - 1 })).toBe(true);
    }
  });

  it('pone tamaño + 1 puntos hasta 5×5 y tamaño + 2 desde 6×6', () => {
    expect(SIZES.map(checkpointCount)).toEqual([5, 6, 8, 9]);
  });

  it('es determinista: la misma semilla da el mismo tablero y otras semillas dan otros', () => {
    expect(createZipPuzzle(6, 1234)).toEqual(createZipPuzzle(6, 1234));
    const distinct = new Set(Array.from({ length: SEEDS }, (_, seed) => createZipPuzzle(6, seed + 1).solution.join(',')));
    expect(distinct.size).toBeGreaterThan(150);
  });

  it('genera 7×7 rápido y ajusta los tamaños fuera de rango', () => {
    const start = Date.now();
    for (let seed = 1; seed <= SEEDS; seed += 1) createZipPuzzle(7, seed);
    expect(Date.now() - start).toBeLessThan(4000);
    expect([1, 3.6, 99, Number.NaN].map(clampZipSize)).toEqual([4, 4, 7, 4]);
    expect(createZipPuzzle(2, 5).size).toBe(4);
  });

  it('el tamaño sigue al nivel (ronda 0–2, desafío 1–4+)', () => {
    expect([0, 1, 2].map(zipSizeForRoundLevel)).toEqual([4, 5, 6]);
    expect([1, 2, 3, 4, 9].map(zipSizeForPuzzleLevel)).toEqual([4, 5, 6, 7, 7]);
  });
});

describe('Ruta del paquete · validación del recorrido', () => {
  it('acepta la serpiente de ejemplo', () => {
    expect(validateZipPath(snake, SNAKE)).toEqual({ ok: true });
  });

  it.each(SIZES)('rechaza recorridos equivocados (tamaño %i)', (size) => {
    const puzzle = createZipPuzzle(size, 11);
    const path = puzzle.solution;
    const fault = (value: number[]) => {
      const verdict = validateZipPath(puzzle, value);
      return verdict.ok ? 'ok' : verdict.fault;
    };
    expect(fault([])).toBe('empty');
    expect(fault([...path].reverse())).toBe('start');
    expect(fault(path.slice(0, -1))).toBe('incomplete');
    expect(fault(path.slice(0, 1))).toBe('incomplete');
    expect(fault([path[0], path[3], ...path.slice(1)])).not.toBe('ok');
    expect(fault([...path.slice(0, -1), path[0]])).not.toBe('ok');
    expect(fault([...path, path[0]])).not.toBe('ok');
    const swapped = [...path];
    [swapped[2], swapped[5]] = [swapped[5], swapped[2]];
    expect(fault(swapped)).not.toBe('ok');
    expect(fault([-1, ...path.slice(1)])).toBe('start');
  });

  it('distingue cada falta: orden de los puntos, final equivocado y casillas repetidas', () => {
    // Serpiente por columnas: pasa por el punto 3 (casilla 4) antes que por el 2 (casilla 3).
    const columns = [0, 4, 8, 12, 13, 9, 5, 1, 2, 6, 10, 14, 15, 11, 7, 3];
    expect(validateZipPath(snake, columns)).toEqual({ ok: false, fault: 'order', at: 1 });
    // Cubre todo y pasa por los puntos en orden, pero el último punto (casilla 8) no queda al final.
    expect(validateZipPath({ size: 4, checkpoints: [0, 3, 4, 8], solution: SNAKE }, SNAKE)).toEqual({ ok: false, fault: 'end', at: 15 });
    expect(validateZipPath(snake, [0, 1, 0])).toEqual({ ok: false, fault: 'repeat', at: 2 });
    expect(validateZipPath(snake, [0, 5])).toEqual({ ok: false, fault: 'step', at: 1 });
    expect(validateZipPath(snake, [1, 2])).toEqual({ ok: false, fault: 'start', at: 0 });
  });
});

describe('Ruta del paquete · ayudas del tablero', () => {
  it('canExtend: solo casillas vecinas, libres y, si son un punto, el que toca', () => {
    expect(canExtend(snake, [0], 1)).toBe(true);
    expect(extendFault(snake, [0], 5)).toBe('far');
    expect(extendFault(snake, [0, 1], 0)).toBe('taken');
    // Desde la casilla 0, la 4 es el punto 3 y todavía toca el 2.
    expect(extendFault(snake, [0], 4)).toBe('order');
    expect(nextCheckpoint(snake, [0])).toBe(2);
    expect(nextCheckpoint(snake, [0, 1, 2, 3])).toBe(3);
    expect(checkpointNumber(snake, 11)).toBe(4);
    expect(checkpointNumber(snake, 9)).toBe(0);
  });

  it('el último punto no se alcanza antes de cubrir todas las casillas', () => {
    const early: ZipPuzzle = { size: 4, checkpoints: [0, 3, 4, 12], solution: SNAKE };
    const path = [0, 1, 2, 3, 7, 6, 5, 4, 8];
    expect(extendFault(early, path, 12)).toBe('early');
    expect(extendFault(snake, SNAKE.slice(0, 15), 12)).toBe(null);
  });

  it('cutTo vuelve el recorrido hasta una casilla y no toca lo que no está', () => {
    expect(cutTo([0, 1, 2, 3], 1)).toEqual([0, 1]);
    expect(cutTo([0, 1, 2, 3], 0)).toEqual([0]);
    const path = [0, 1, 2];
    expect(cutTo(path, 9)).toBe(path);
  });

  it('stepZip alarga, corta, rechaza puntos fuera de orden; deshacer y reiniciar son reversibles', () => {
    let state = startZip(snake);
    expect(state.path).toEqual([0]);
    let step = stepZip(snake, state, 4);
    expect(step.outcome).toEqual({ kind: 'refused', fault: 'order' });
    expect(step.state).toBe(state);
    step = stepZip(snake, state, 1);
    expect(step.outcome).toEqual({ kind: 'extend', reached: 0 });
    state = step.state;
    state = stepZip(snake, state, 2).state;
    step = stepZip(snake, state, 3);
    expect(step.outcome).toEqual({ kind: 'extend', reached: 2 });
    state = step.state;
    expect(state.steps).toBe(3);
    // Tocar una casilla ya recorrida corta hasta ahí.
    step = stepZip(snake, state, 1);
    expect(step.outcome).toEqual({ kind: 'cut', removed: 2 });
    state = step.state;
    expect(state.path).toEqual([0, 1]);
    // Deshacer devuelve lo cortado; reiniciar vuelve al punto 1 y también se puede deshacer.
    state = undoZip(state);
    expect(state.path).toEqual([0, 1, 2, 3]);
    state = resetZip(snake, state);
    expect(state.path).toEqual([0]);
    expect(undoZip(state).path).toEqual([0, 1, 2, 3]);
    expect(undoZip(startZip(snake)).path).toEqual([0]);
    expect(resetZip(snake, startZip(snake)).path).toEqual([0]);
    expect(stepZip(snake, state, 0).outcome).toEqual({ kind: 'none' });
    expect(stepZip(snake, state, 99).outcome).toEqual({ kind: 'none' });
  });

  it('seguir la solución paso a paso resuelve el tablero sin pasos de más', () => {
    SIZES.forEach((size) => {
      for (let seed = 1; seed <= 20; seed += 1) {
        const puzzle = createZipPuzzle(size, seed);
        let state = startZip(puzzle);
        puzzle.solution.slice(1).forEach((cell) => {
          const step = stepZip(puzzle, state, cell);
          if (step.outcome.kind !== 'extend') throw new Error(`tamaño ${size}, semilla ${seed}: ${step.outcome.kind} en la casilla ${cell}`);
          state = step.state;
        });
        expect(isZipSolved(puzzle, state)).toBe(true);
        expect(state.steps).toBe(size * size - 1);
        expect(zipAccuracy(state)).toBe(1);
      }
    });
  });

  it('la precisión baja con los pasos que se quitaron', () => {
    expect(zipAccuracy(startZip(snake))).toBe(0);
    let state = startZip(snake);
    state = stepZip(snake, state, 1).state;
    state = stepZip(snake, state, 5).state;
    state = stepZip(snake, state, 1).state;
    expect(state.path).toEqual([0, 1]);
    expect(zipAccuracy(state)).toBeCloseTo(1 / 2);
  });

  it('zipStuck nunca da falsos positivos en una solución y detecta casillas aisladas', () => {
    SIZES.forEach((size) => {
      for (let seed = 1; seed <= 30; seed += 1) {
        const puzzle = createZipPuzzle(size, seed);
        for (let length = 1; length <= puzzle.solution.length; length += 1) {
          if (zipStuck(puzzle, puzzle.solution.slice(0, length))) throw new Error(`tamaño ${size}, semilla ${seed}: falso callejón con ${length} casillas`);
        }
      }
    });
    // La casilla 0 solo se podría alcanzar desde la cabeza y ahí terminaría el recorrido.
    const open: ZipPuzzle = { size: 4, checkpoints: [1, 15], solution: [] };
    expect(zipStuck(open, [1, 5, 4])).toBe(true);
    expect(zipStuck(open, [1, 0])).toBe(false);
  });
});

describe('Ruta del paquete · dedo y puntajes', () => {
  it('cellAtPoint ignora las esquinas de las casillas y lo de fuera', () => {
    expect(cellAtPoint(4, 400, 50, 50)).toBe(0);
    expect(cellAtPoint(4, 400, 150, 50)).toBe(1);
    expect(cellAtPoint(4, 400, 349, 50)).toBe(3);
    expect(cellAtPoint(4, 400, 100, 100)).toBeNull();
    expect(cellAtPoint(4, 400, -1, 50)).toBeNull();
    expect(cellAtPoint(4, 400, 400, 50)).toBeNull();
    expect(cellAtPoint(4, 0, 0, 0)).toBeNull();
  });

  it('cellsAlong no pierde casillas con un arrastre rápido ni cuenta diagonales', () => {
    expect(cellsAlong(4, 400, null, { x: 50, y: 50 })).toEqual([0]);
    expect(cellsAlong(4, 400, { x: 50, y: 50 }, { x: 350, y: 50 })).toEqual([1, 2, 3]);
    expect(cellsAlong(4, 400, { x: 350, y: 50 }, { x: 50, y: 50 })).toEqual([2, 1, 0]);
    expect(cellsAlong(4, 400, { x: 50, y: 50 }, { x: 60, y: 55 })).toEqual([]);
    // En diagonal no pasa por ninguna casilla vecina (solo llega a la de la esquina).
    expect(cellsAlong(4, 400, { x: 50, y: 50 }, { x: 150, y: 150 })).toEqual([5]);
  });

  it('puntajes: resuelta 0,85 a 1 según el tiempo; sin tiempo 0,6 por lo cubierto; desafío 600 a 1000', () => {
    expect(zipSolvedScore(1)).toBe(1);
    expect(zipSolvedScore(0)).toBeCloseTo(0.85);
    expect(zipSolvedScore(-3)).toBeCloseTo(0.85);
    expect(zipSolvedScore(9)).toBe(1);
    expect(zipSolvedScore(0.5)).toBeCloseTo(0.925);
    expect(zipTimeUpScore(0, 25)).toBe(0);
    expect(zipTimeUpScore(25, 25)).toBeCloseTo(0.6);
    expect(zipTimeUpScore(12, 25)).toBeCloseTo(0.6 * 0.48);
    expect(zipTimeUpScore(40, 25)).toBeCloseTo(0.6);
    expect(zipTimeUpScore(3, 0)).toBe(0);
    expect(zipPuzzleScore(1)).toBe(1000);
    expect(zipPuzzleScore(0)).toBe(600);
    expect(zipPuzzleScore(0.5)).toBe(800);
  });
});
