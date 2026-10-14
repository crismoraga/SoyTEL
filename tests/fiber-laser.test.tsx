import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { FitBox } from '@/components/FitBox';
import { FiberLaserGame } from '@/features/stations/games/FiberLaserGame';
import { withContinue } from '@/features/stations/kit';
import {
  acceptanceAngle,
  ANGLE_MAX,
  ANGLE_STEP,
  angularCoupling,
  buildPlan,
  charBits,
  couplingBand,
  decodeBits,
  elevationFromPoint,
  emptyProgress,
  FIBER_KINDS,
  fiberTotals,
  fitScene,
  groupBits,
  HOLD_MS,
  isGuided,
  laserPoint,
  lateralCoupling,
  LIGHT_COUNT,
  lightPoints,
  messagePoints,
  OFFSET_MAX,
  OFFSET_STEP,
  reflectionCount,
  SCENE_W,
  sceneLayout,
  spliceCoupling,
  splicePoints,
  TILT_MAX,
  TILT_STEP,
  TOTAL_MAX,
  toBits,
  traceRay,
  type FiberKind,
  type LightTarget,
  type SpliceTarget,
} from '@/features/stations/logic/fiber';
import { mulberry32 } from '@/route/random';

// "Viaje de la luz": geometría de la fibra, empalmes, bits, puntaje y el juego completo.

const optics = (kind: FiberKind, length = 170) => ({ ...kind, length });

describe('geometría de la fibra', () => {
  it('el cono de aceptación se estrecha de una fibra a la siguiente', () => {
    const cones = FIBER_KINDS.map((kind) => acceptanceAngle(kind.nCore, kind.nClad));
    expect(cones[0]).toBeCloseTo(30.7, 0);
    expect(cones[1]).toBeCloseTo(14.03, 1);
    expect(cones[2]).toBeCloseTo(7, 0);
    expect(cones[0]).toBeGreaterThan(cones[1]);
    expect(cones[1]).toBeGreaterThan(cones[2]);
  });

  it('dentro del cono la luz llega al receptor y fuera se escapa', () => {
    FIBER_KINDS.forEach((kind) => {
      const cone = acceptanceAngle(kind.nCore, kind.nClad);
      for (let angle = -ANGLE_MAX; angle <= ANGLE_MAX; angle += 0.5) {
        const trace = traceRay(optics(kind), angle);
        if (Math.abs(angle) <= cone - 0.01) expect(trace.outcome).toBe('guided');
        if (Math.abs(angle) >= cone + 0.01) expect(trace.outcome).toBe('leaked');
        expect(isGuided(kind, angle)).toBe(Math.abs(angle) <= cone + 1e-6);
      }
    });
  });

  it('la luz que se escapa atraviesa el revestimiento y no rebota', () => {
    const trace = traceRay(optics(FIBER_KINDS[1]), 30);
    expect(trace.bounces).toBe(0);
    const [hit, outer, tail] = trace.escape;
    expect(Math.abs(hit.y)).toBeCloseTo(FIBER_KINDS[1].coreHalf, 6);
    expect(Math.abs(outer.y)).toBeCloseTo(FIBER_KINDS[1].coreHalf + FIBER_KINDS[1].cladding, 6);
    expect(Math.abs(tail.y)).toBeGreaterThan(Math.abs(outer.y));
    expect(Math.sign(hit.y)).toBe(Math.sign(tail.y));
  });

  it('cuenta los rebotes: coincide con la fórmula, crece con el ángulo y es simétrico', () => {
    FIBER_KINDS.forEach((kind) => {
      const cone = acceptanceAngle(kind.nCore, kind.nClad);
      const fiber = optics(kind);
      let previous = 0;
      for (let angle = 0; angle <= cone; angle += 0.37) {
        const trace = traceRay(fiber, angle);
        expect(trace.bounces).toBe(reflectionCount(fiber, angle));
        expect(trace.bounces).toBeGreaterThanOrEqual(previous);
        previous = trace.bounces;
        // Siempre dentro del núcleo y terminando en el receptor.
        trace.points.forEach((point) => expect(Math.abs(point.y)).toBeLessThanOrEqual(kind.coreHalf + 1e-9));
        expect(trace.points[trace.points.length - 1].x).toBeCloseTo(fiber.length, 9);
        const mirror = traceRay(fiber, -angle);
        expect(mirror.bounces).toBe(trace.bounces);
        mirror.points.forEach((point, position) => expect(point.y).toBeCloseTo(-trace.points[position].y, 6));
      }
      // En el borde del cono la luz rebota varias veces y por el eje no rebota.
      expect(traceRay(fiber, cone).bounces).toBeGreaterThanOrEqual(2);
      expect(traceRay(fiber, 0)).toMatchObject({ outcome: 'guided', bounces: 0 });
    });
  });

  it('un haz que no puede entrar a la fibra no cuenta', () => {
    expect(traceRay(optics(FIBER_KINDS[0]), 90).outcome).toBe('missed');
    expect(traceRay(optics(FIBER_KINDS[0]), Number.NaN).outcome).toBe('missed');
  });

  it('el láser gira alrededor de la cara de la fibra y arrastrarlo devuelve el mismo ángulo', () => {
    const layout = sceneLayout({ axisShift: 4, length: 170 }, 180);
    for (let angle = -ANGLE_MAX; angle <= ANGLE_MAX; angle += 5) {
      const point = laserPoint(layout, angle);
      expect(Math.hypot(layout.faceX - point.x, layout.axisY - point.y)).toBeCloseTo(layout.orbit, 5);
      expect(elevationFromPoint(layout, point.x, point.y)).toBe(angle);
    }
    expect(elevationFromPoint(layout, 0, -500)).toBe(ANGLE_MAX);
    expect(elevationFromPoint(layout, 0, 900)).toBe(-ANGLE_MAX);
  });

  it('el dibujo cabe en el lienzo con cualquier alto y desplazamiento', () => {
    for (let height = 120; height <= 260; height += 10) {
      for (let shift = -6; shift <= 6; shift += 3) {
        const layout = sceneLayout({ axisShift: shift, length: 180 }, height);
        [ANGLE_MAX, -ANGLE_MAX].forEach((angle) => {
          const point = laserPoint(layout, angle);
          expect(point.x).toBeGreaterThanOrEqual(0);
          expect(point.y).toBeGreaterThanOrEqual(0);
          expect(point.y).toBeLessThanOrEqual(layout.height);
        });
        expect(layout.receiverX + 30).toBeLessThanOrEqual(SCENE_W);
      }
    }
  });

  it('el lienzo se ajusta al espacio sin deformarse', () => {
    [
      [328, 211],
      [288, 119],
      [358, 324],
      [380, 440],
    ].forEach(([width, height]) => {
      const fit = fitScene({ width, height }, 150, 230);
      expect(fit.width).toBeLessThanOrEqual(width + 1e-9);
      expect(fit.height).toBeLessThanOrEqual(height + 1e-9);
      expect(fit.width / fit.height).toBeCloseTo(SCENE_W / fit.H, 6);
      expect(fit.H).toBeGreaterThanOrEqual(150);
      expect(fit.H).toBeLessThanOrEqual(230);
    });
  });
});

describe('empalme', () => {
  const spec = { coreDiameter: 52, na: 0.2 };

  it('con los núcleos alineados pasa toda la luz y sin tocarse no pasa nada', () => {
    expect(spliceCoupling(0, 0, spec)).toBe(1);
    expect(lateralCoupling(52, 52)).toBeCloseTo(0, 9);
    expect(lateralCoupling(80, 52)).toBe(0);
  });

  it('el acoplamiento baja de forma monótona con el desfase y con el giro, y es simétrico', () => {
    let previous = 1;
    for (let offset = 0; offset <= 52; offset += 1) {
      const coupling = spliceCoupling(offset, 0, spec);
      expect(coupling).toBeLessThanOrEqual(previous + 1e-12);
      previous = coupling;
    }
    previous = 1;
    for (let tilt = 0; tilt <= TILT_MAX; tilt += 0.5) {
      const coupling = spliceCoupling(0, tilt, spec);
      expect(coupling).toBeLessThanOrEqual(previous + 1e-12);
      previous = coupling;
    }
    expect(spliceCoupling(10, 0, spec)).toBeCloseTo(spliceCoupling(-10, 0, spec), 12);
    expect(spliceCoupling(0, 3, spec)).toBeCloseTo(spliceCoupling(0, -3, spec), 12);
    // Desfase y giro se suman en pérdida.
    expect(spliceCoupling(6, 2, spec)).toBeLessThan(Math.min(spliceCoupling(6, 0, spec), spliceCoupling(0, 2, spec)));
  });

  it('para pasar el 90 % hay que alinear a menos de ~8 % del diámetro y a pocos grados', () => {
    expect(lateralCoupling(0.07 * 52, 52)).toBeGreaterThan(0.9);
    expect(lateralCoupling(0.09 * 52, 52)).toBeLessThan(0.9);
    expect(angularCoupling(1, 0.2)).toBeGreaterThan(0.9);
    expect(angularCoupling(4, 0.2)).toBeLessThan(0.8);
  });

  it('la medida se divide en bandas y solo se puntúa desde el 90 %', () => {
    expect(couplingBand(0.3)).toBe('low');
    expect(couplingBand(0.75)).toBe('mid');
    expect(couplingBand(0.93)).toBe('ok');
    expect(splicePoints(0.89)).toBe(0);
    expect(splicePoints(0.9)).toBe(60);
    expect(splicePoints(0.95)).toBeGreaterThan(60);
    expect(splicePoints(0.99)).toBe(110);
    expect(splicePoints(1)).toBe(110);
  });
});

describe('bits', () => {
  it('cada letra viaja como 8 bits y se decodifica igual', () => {
    expect(charBits('S')).toEqual([0, 1, 0, 1, 0, 0, 1, 1]);
    expect(toBits('SOS')).toHaveLength(24);
    expect(decodeBits(toBits('LUZ'))).toBe('LUZ');
    expect(groupBits(charBits('S'))).toBe('0101 0011');
    expect(groupBits([1, 0])).toBe('10');
  });
});

describe('partida según la semilla', () => {
  it('es determinista y cambia con la semilla', () => {
    expect(buildPlan(5)).toEqual(buildPlan(5));
    const distinct = new Set(Array.from({ length: 20 }, (_, seed) => JSON.stringify(buildPlan(seed + 1))));
    expect(distinct.size).toBeGreaterThan(10);
  });

  it('cada objetivo se puede resolver, con cualquier semilla y cualquier tamaño de pantalla', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const plan = buildPlan(seed * 7919);
      expect(plan.light).toHaveLength(LIGHT_COUNT);
      expect(plan.light[0].cone).toBeGreaterThan(plan.light[1].cone);
      expect(plan.light[1].cone).toBeGreaterThan(plan.light[2].cone);
      expect(Math.sign(plan.light[0].startAngle)).not.toBe(Math.sign(plan.light[1].startAngle));
      plan.light.forEach((target) => {
        // Se parte fuera del cono (hay que moverse), dentro del rango y se llega al 0° con pasos de 2°.
        expect(Math.abs(target.startAngle)).toBeGreaterThan(target.cone);
        expect(Math.abs(target.startAngle)).toBeLessThanOrEqual(ANGLE_MAX);
        expect(Math.abs(target.startAngle) % ANGLE_STEP).toBe(0);
        expect(isGuided(target, target.startAngle)).toBe(false);
        expect(isGuided(target, 0)).toBe(true);
        [150, 190, 230].forEach((height) => {
          const fiber = { ...target, length: sceneLayout(target, height).length };
          expect(traceRay(fiber, target.startAngle).outcome).toBe('leaked');
          const inside = traceRay(fiber, Math.floor(target.cone));
          expect(inside.outcome).toBe('guided');
          expect(inside.bounces).toBeGreaterThanOrEqual(1);
        });
      });
      expect(plan.splices).toHaveLength(3);
      expect(plan.splices[0].startTilt).toBe(0);
      plan.splices.forEach((splice) => {
        expect(spliceCoupling(0, 0, splice)).toBe(1);
        const start = spliceCoupling(splice.startOffset, splice.startTilt, splice);
        expect(start).toBeLessThan(0.9);
        expect(start).toBeGreaterThan(0.15);
        expect(Math.abs(splice.startOffset) % OFFSET_STEP).toBe(0);
        expect(Math.abs(splice.startOffset)).toBeLessThanOrEqual(OFFSET_MAX);
        expect(Math.abs(splice.startTilt)).toBeLessThanOrEqual(TILT_MAX);
        expect(Math.abs(splice.startTilt) % TILT_STEP).toBe(0);
      });
      expect(plan.word).toMatch(/^[A-Z]{3}$/);
      expect(decodeBits(toBits(plan.word))).toBe(plan.word);
    }
  });
});

describe('puntaje', () => {
  it('una partida perfecta suma exactamente 1000 con precisión 1', () => {
    const perfect = { lightWrong: [0, 0, 0], spliceCouplings: [1, 1, 1], messageBits: 24, messageTotal: 24, messageErrors: 0 };
    expect(fiberTotals(perfect)).toEqual({ light: 330, splice: 330, message: 340, total: 1000, accuracy: 1 });
    expect(TOTAL_MAX).toBe(1000);
  });

  it('sin jugar no hay puntos y cada error resta sin pasar de los topes', () => {
    expect(fiberTotals(emptyProgress(24))).toEqual({ light: 0, splice: 0, message: 0, total: 0, accuracy: 0 });
    expect([0, 1, 2, 3, 10].map(lightPoints)).toEqual([110, 90, 70, 50, 50]);
    expect(messagePoints(24, 24, 0)).toBe(340);
    expect(messagePoints(24, 24, 3)).toBe(279);
    expect(messagePoints(24, 24, 50)).toBe(119);
    expect(messagePoints(12, 24, 0)).toBe(170);
    expect(messagePoints(100, 24, 0)).toBe(340);
    expect(messagePoints(5, 0, 0)).toBe(0);
  });

  it('con cualquier avance el total no pasa de 1000 ni la precisión de 1', () => {
    const random = mulberry32(99);
    for (let round = 0; round < 300; round += 1) {
      const progress = {
        lightWrong: Array.from({ length: Math.floor(random() * 5) }, () => Math.floor(random() * 6)),
        spliceCouplings: Array.from({ length: Math.floor(random() * 5) }, () => random() * 1.2),
        messageBits: Math.floor(random() * 40),
        messageTotal: 24,
        messageErrors: Math.floor(random() * 30),
      };
      const totals = fiberTotals(progress);
      expect(Number.isFinite(totals.total)).toBe(true);
      expect(totals.total).toBeGreaterThanOrEqual(0);
      expect(totals.total).toBeLessThanOrEqual(1000);
      expect(totals.accuracy).toBeGreaterThanOrEqual(0);
      expect(totals.accuracy).toBeLessThanOrEqual(1);
    }
  });
});

// ——— El juego completo ———

const Game = withContinue(FiberLaserGame);

function layoutBoards() {
  // FitBox no dibuja hasta conocer su tamaño: en las pruebas se le entrega a mano.
  screen.UNSAFE_getAllByType(FitBox).forEach((box) => {
    const host = box.findAll((node) => typeof node.props.onLayout === 'function')[0];
    act(() => host.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 328, height: 200 } } }));
  });
}

function startStage(number: number) {
  act(() => {
    jest.advanceTimersByTime(400);
  });
  fireEvent.press(screen.getByLabelText(new RegExp(`^Etapa ${number}:`)));
  layoutBoards();
}

function enterCone(target: LightTarget) {
  const steps = Math.ceil((Math.abs(target.startAngle) - target.cone) / ANGLE_STEP);
  const label = target.startAngle > 0 ? 'Bajar el ángulo del láser' : 'Subir el ángulo del láser';
  for (let step = 0; step < steps; step += 1) fireEvent.press(screen.getByLabelText(label));
}

function alignSplice(target: SpliceTarget) {
  const vertical = target.startOffset > 0 ? 'Subir el extremo' : 'Bajar el extremo';
  for (let step = 0; step < Math.abs(target.startOffset) / OFFSET_STEP; step += 1) fireEvent.press(screen.getByLabelText(vertical));
  const turn = target.startTilt > 0 ? 'Girar a la izquierda' : 'Girar a la derecha';
  for (let step = 0; step < Math.abs(target.startTilt) / TILT_STEP; step += 1) fireEvent.press(screen.getByLabelText(turn));
}

function playLight(plan: ReturnType<typeof buildPlan>) {
  plan.light.forEach((target, index) => {
    enterCone(target);
    fireEvent.press(screen.getByText('Enviar luz'));
    fireEvent.press(screen.getByText(index < plan.light.length - 1 ? 'Siguiente fibra' : 'Continuar'));
  });
}

function playSplices(plan: ReturnType<typeof buildPlan>) {
  plan.splices.forEach((target, index) => {
    alignSplice(target);
    fireEvent.press(screen.getByText('Fijar empalme'));
    fireEvent.press(screen.getByText(index < plan.splices.length - 1 ? 'Siguiente empalme' : 'Continuar'));
  });
}

function sendBit(bit: number) {
  fireEvent.press(screen.getByLabelText(bit === 1 ? 'Enviar luz: bit 1' : 'Apagado: bit 0'));
}

function playMessage(plan: ReturnType<typeof buildPlan>) {
  plan.word.split('').forEach((letter) => charBits(letter).forEach(sendBit));
}

describe('Viaje de la luz · juego', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('se juega de punta a punta y entrega 1000 puntos una sola vez', () => {
    const plan = buildPlan(7);
    const onComplete = jest.fn();
    // Con un plazo lejano: llegar al resumen y enviar no debe duplicar la entrega cuando el plazo venza.
    render(<Game seed={7} deadline={Date.now() + 30 * 60_000} onComplete={onComplete} />);

    startStage(1);
    expect(screen.getByLabelText(/Láser a [+−]?\d+ grados/)).toBeTruthy();
    playLight(plan);
    expect(screen.getByText('330')).toBeTruthy();

    startStage(2);
    expect(screen.getByLabelText(/^Empalme 1 de 3\. Pasa el \d+ % de la luz\./)).toBeTruthy();
    playSplices(plan);

    startStage(3);
    expect(screen.getByLabelText(/^Receptor: bits/)).toBeTruthy();
    playMessage(plan);
    fireEvent.press(screen.getByText('Ver resultado'));

    expect(screen.getByText(`Mensaje recibido: ${plan.word} · 0 errores de bits`)).toBeTruthy();
    expect(screen.getByText('1000')).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText('Enviar mi puntaje'));
    fireEvent.press(screen.getByText('Enviar mi puntaje'));
    act(() => {
      jest.advanceTimersByTime(31 * 60_000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ score: 1000, accuracy: 1 });
  });

  it('los envíos fuera del cono y los bits equivocados restan puntos y se explican', () => {
    const plan = buildPlan(21);
    const onComplete = jest.fn();
    render(<Game seed={21} onComplete={onComplete} />);

    startStage(1);
    // Enviar la luz sin entrar al cono: se escapa y cuenta como fallo en este objetivo.
    fireEvent.press(screen.getByText('Enviar luz'));
    expect(screen.getByText(/^Se escapó: pasa de ±/)).toBeTruthy();
    enterCone(plan.light[0]);
    fireEvent.press(screen.getByText('Enviar luz'));
    expect(screen.getByText('90')).toBeTruthy();
    fireEvent.press(screen.getByText('Siguiente fibra'));
    plan.light.slice(1).forEach((target, index) => {
      enterCone(target);
      fireEvent.press(screen.getByText('Enviar luz'));
      fireEvent.press(screen.getByText(index === 0 ? 'Siguiente fibra' : 'Continuar'));
    });

    startStage(2);
    // Antes de alinear no se puede fijar el empalme.
    fireEvent.press(screen.getByText('Fijar empalme'));
    expect(screen.queryByText('Siguiente empalme')).toBeNull();
    playSplices(plan);

    startStage(3);
    const firstBit = charBits(plan.word[0])[0];
    sendBit(1 - firstBit);
    expect(screen.getByText(`ERROR: llegó un ${1 - firstBit}`)).toBeTruthy();
    expect(screen.getByText(new RegExp(`^Ahí iba un ${firstBit}: `))).toBeTruthy();
    playMessage(plan);
    fireEvent.press(screen.getByText('Ver resultado'));
    fireEvent.press(screen.getByText('Enviar mi puntaje'));

    expect(onComplete).toHaveBeenCalledTimes(1);
    // 90 + 110 + 110 (luz) + 330 (empalmes) + 340 × 0,94 (un error de bits).
    expect(onComplete.mock.calls[0][0].score).toBe(90 + 110 + 110 + 330 + 320);
    // Luz: 2 de 3 objetivos sin fallos; empalmes perfectos; mensaje: 24 bits buenos de 24 + 1 error.
    expect(onComplete.mock.calls[0][0].accuracy).toBeCloseTo((2 / 3 + 1 + 24 / 25) / 3, 6);
  });

  it('la luz se confirma sola si el buen ángulo se mantiene, y no si se sale del cono', () => {
    const plan = buildPlan(11);
    render(<Game seed={11} onComplete={jest.fn()} />);
    startStage(1);
    const target = plan.light[0];
    enterCone(target);
    expect(screen.queryByText('Siguiente fibra')).toBeNull();
    act(() => {
      jest.advanceTimersByTime(HOLD_MS + 100);
    });
    expect(screen.getByText('Siguiente fibra')).toBeTruthy();

    // En el segundo objetivo: entrar y salir antes de tiempo cancela la confirmación.
    fireEvent.press(screen.getByText('Siguiente fibra'));
    const second = plan.light[1];
    enterCone(second);
    fireEvent.press(screen.getByLabelText(second.startAngle > 0 ? 'Subir el ángulo del láser' : 'Bajar el ángulo del láser'));
    fireEvent.press(screen.getByLabelText(second.startAngle > 0 ? 'Subir el ángulo del láser' : 'Bajar el ángulo del láser'));
    act(() => {
      jest.advanceTimersByTime(HOLD_MS + 100);
    });
    expect(screen.queryByText('Siguiente fibra')).toBeNull();
    expect(screen.getByText('Enviar luz')).toBeTruthy();
  });

  it('con el plazo vencido entrega lo logrado hasta ese momento, una sola vez', () => {
    const plan = buildPlan(7);
    const onComplete = jest.fn();
    render(<Game seed={7} deadline={Date.now() + 60_000} onComplete={onComplete} />);
    startStage(1);
    enterCone(plan.light[0]);
    fireEvent.press(screen.getByText('Enviar luz'));
    act(() => {
      jest.advanceTimersByTime(61_000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0][0];
    expect(result.score).toBe(110);
    expect(result.accuracy).toBeCloseTo(1 / 9, 6);
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('con el plazo ya vencido y sin jugar entrega 0 una sola vez', () => {
    const onComplete = jest.fn();
    render(<Game seed={3} deadline={1} onComplete={onComplete} />);
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ score: 0, accuracy: 0 });
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
