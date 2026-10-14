import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { Celebration } from '@/components/feedback/Celebration';
import { FitBox } from '@/components/FitBox';
import { PressableScale } from '@/components/PressableScale';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { feedbackSuccess, feedbackTap, feedbackWarning } from '@/lib/feedback';
import { useAmbientMotion, useMotionEnabled } from '@/lib/motion';
import { usePanHandlers } from '@/lib/usePanHandlers';
import { colors, radius, spacing } from '@/theme';
import { cellsAlong, checkpointNumber, isZipSolved, nextCheckpoint, resetZip, startZip, stepZip, undoZip, zipStuck, type Point, type ZipPuzzle, type ZipState } from './logic';

// Lo que pasó en el tablero (la ronda no lo usa; el desafío sin reloj hace que Rutix lo comente).
export type ZipEvent =
  | { type: 'point'; number: number }
  | { type: 'refused'; fault: 'order' | 'early'; next: number }
  | { type: 'cut' }
  | { type: 'undo' }
  | { type: 'reset' }
  | { type: 'stuck' }
  // El dedo bajó lejos del paquete, donde no pasa nada.
  | { type: 'lost' }
  | { type: 'solved' };

interface ZipBoardProps {
  puzzle: ZipPuzzle;
  // Sin entrada (se acabó el tiempo o ya está resuelto).
  disabled?: boolean;
  // Avisos de cada jugada bajo el tablero (si no, solo dice qué punto sigue).
  messages?: boolean;
  // Alto mínimo del tablero, para pantallas que se desplazan (así nunca queda diminuto).
  minBoard?: number;
  // Cada cambio del recorrido.
  onChange?: (state: ZipState) => void;
  onEvent?: (event: ZipEvent) => void;
  // Todas las casillas cubiertas, en orden, y terminando en el último punto.
  onSolved: (state: ZipState) => void;
}

interface Note {
  tone: 'info' | 'good' | 'bad' | 'warn';
  text: string;
}

const CABLE_DONE = '#6BC59A';
const NODE_DONE = '#6BC59A';
const tones = {
  info: { color: colors.accentSoft, icon: 'route' as IconName },
  good: { color: '#93DDB9', icon: 'checkCircle' as IconName },
  bad: { color: colors.dangerLight, icon: 'closeCircle' as IconName },
  warn: { color: '#F2CE63', icon: 'alert' as IconName },
};

// Une el punto 1 con el último pasando por todas las casillas: se arrastra el dedo desde el paquete.
export function ZipBoard({ puzzle, disabled = false, messages = true, minBoard, onChange, onEvent, onSolved }: ZipBoardProps) {
  const [state, setState] = useState(() => startZip(puzzle));
  // El dedo puede pasar por varias casillas antes de que React vuelva a dibujar: se juega sobre esta copia.
  const live = useRef(state);
  const finished = useRef(false);
  const [note, setNote] = useState<Note | null>(null);
  const [flash, setFlash] = useState<{ cell: number; key: number } | null>(null);
  const total = puzzle.size * puzzle.size;
  const last = puzzle.checkpoints.length;
  const solved = isZipSolved(puzzle, state);
  const next = nextCheckpoint(puzzle, state.path);
  const locked = disabled || solved;

  // El rechazo de un punto fuera de orden se marca un instante en rojo.
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 520);
    return () => clearTimeout(timer);
  }, [flash]);

  function commit(value: ZipState) {
    live.current = value;
    setState(value);
    onChange?.(value);
  }

  function play(cells: number[], fresh = false) {
    if (disabled || finished.current || cells.length === 0) return;
    let current = live.current;
    let message: Note | null | undefined;
    let done = false;
    for (const cell of cells) {
      const { state: after, outcome } = stepZip(puzzle, current, cell);
      if (outcome.kind === 'none') continue;
      if (outcome.kind === 'refused') {
        const wanted = nextCheckpoint(puzzle, current.path);
        void feedbackWarning();
        setFlash((value) => ({ cell, key: (value?.key ?? 0) + 1 }));
        message = { tone: 'bad', text: outcome.fault === 'early' ? `Antes del ${last}, pasa por todas las casillas.` : `Primero pasa por el ${wanted}.` };
        onEvent?.({ type: 'refused', fault: outcome.fault, next: wanted });
        continue;
      }
      current = after;
      void feedbackTap();
      if (outcome.kind === 'cut') {
        message = null;
        onEvent?.({ type: 'cut' });
      } else if (isZipSolved(puzzle, current)) {
        done = true;
        break;
      } else if (outcome.reached > 0) {
        message = { tone: 'good', text: `¡Punto ${outcome.reached}! Sigue al ${outcome.reached + 1}.` };
        onEvent?.({ type: 'point', number: outcome.reached });
      } else {
        message = null;
      }
    }
    const changed = current !== live.current;
    if (changed) commit(current);
    if (done) {
      finished.current = true;
      void feedbackSuccess();
      setNote({ tone: 'good', text: '¡Paquete entregado!' });
      onEvent?.({ type: 'solved' });
      onSolved(current);
      return;
    }
    if (changed && zipStuck(puzzle, current.path)) {
      message = { tone: 'warn', text: 'Así quedarán casillas sin paso. Retrocede un poco.' };
      onEvent?.({ type: 'stuck' });
    }
    // Un toque nuevo lejos del paquete no hace nada: se explica de dónde se arrastra.
    if (!changed && message === undefined && fresh && cells[0] !== current.path[current.path.length - 1]) {
      message = { tone: 'info', text: 'Arrastra desde el paquete: va al final del cable.' };
      onEvent?.({ type: 'lost' });
    }
    if (message !== undefined) setNote(message);
  }

  function undo() {
    if (locked) return;
    const before = undoZip(live.current);
    if (before === live.current) return;
    void feedbackTap();
    commit(before);
    setNote(null);
    onEvent?.({ type: 'undo' });
  }

  function reset() {
    if (locked) return;
    const fresh = resetZip(puzzle, live.current);
    if (fresh === live.current) return;
    void feedbackTap();
    commit(fresh);
    setNote(null);
    onEvent?.({ type: 'reset' });
  }

  const shown = messages ? note : null;
  const tone = shown ? tones[shown.tone] : tones.info;
  const text = shown ? shown.text : solved ? '¡Paquete entregado!' : messages ? `Une del 1 al ${last} sin dejar casillas vacías.` : `Siguiente: punto ${next}.`;

  return (
    <View style={styles.root}>
      <View style={styles.status}>
        <View style={styles.message} accessibilityLiveRegion="polite">
          <TelIcon name={tone.icon} size={16} color={tone.color} />
          <TelText variant="caption" numberOfLines={2} style={[styles.messageText, { color: tone.color }]}>
            {text}
          </TelText>
        </View>
        <View style={styles.counter} accessibilityLabel={`${state.path.length} de ${total} casillas`}>
          <TelText variant="label" color="cream" tabular>
            {state.path.length}/{total}
          </TelText>
        </View>
      </View>
      <FitBox aspectRatio={1} style={minBoard ? { minHeight: minBoard } : undefined}>
        {({ width, height }) => (
          <Grid
            puzzle={puzzle}
            path={state.path}
            side={Math.min(width, height)}
            next={next}
            solved={solved}
            disabled={locked}
            flash={flash}
            label={`Tablero de ${puzzle.size} por ${puzzle.size}. Llevas ${state.path.length} de ${total} casillas. Siguiente: punto ${next}.`}
            onCells={play}
          />
        )}
      </FitBox>
      <View style={styles.actions}>
        <ActionButton icon="arrowLeft" label="Deshacer" disabled={locked || state.history.length === 0} onPress={undo} />
        <ActionButton icon="refresh" label="Reiniciar" disabled={locked || state.path.length <= 1} onPress={reset} />
      </View>
    </View>
  );
}

interface GridProps {
  puzzle: ZipPuzzle;
  path: number[];
  side: number;
  next: number;
  solved: boolean;
  disabled: boolean;
  flash: { cell: number; key: number } | null;
  label: string;
  onCells: (cells: number[], fresh: boolean) => void;
}

// En la web el navegador no debe desplazar ni ampliar la página mientras se arrastra sobre el tablero.
const surface = (Platform.OS === 'web' ? { touchAction: 'none', userSelect: 'none', cursor: 'pointer' } : undefined) as unknown as ViewStyle | undefined;

function Grid({ puzzle, path, side, next, solved, disabled, flash, label, onCells }: GridProps) {
  const size = puzzle.size;
  const cell = side / size;
  const pointer = useRef<Point | null>(null);
  const origin = useRef<Point>({ x: 0, y: 0 });
  const handlers = usePanHandlers({
    canStart: () => !disabled,
    onGrant: (event) => {
      const { locationX, locationY } = event.nativeEvent;
      origin.current = { x: locationX, y: locationY };
      pointer.current = origin.current;
      onCells(cellsAlong(size, side, null, origin.current), true);
    },
    onMove: (_, gesture) => {
      const point = { x: origin.current.x + gesture.dx, y: origin.current.y + gesture.dy };
      const cells = cellsAlong(size, side, pointer.current, point);
      pointer.current = point;
      onCells(cells, false);
    },
    onRelease: () => {
      pointer.current = null;
    },
    onTerminate: () => {
      pointer.current = null;
    },
  });

  const center = (index: number) => ({ x: ((index % size) + 0.5) * cell, y: (Math.floor(index / size) + 0.5) * cell });
  const covered = new Set(path);
  const inset = Math.max(1, cell * 0.04);
  const line = path.map((index, position) => `${position === 0 ? 'M' : 'L'}${center(index).x.toFixed(1)} ${center(index).y.toFixed(1)}`).join(' ');
  const head = path[path.length - 1];
  const headCenter = center(head);
  const headOnPoint = checkpointNumber(puzzle, head) > 0;
  const last = puzzle.checkpoints.length;

  return (
    <View testID="zip-board" {...handlers} pointerEvents="box-only" accessible accessibilityLabel={label} style={[styles.grid, { width: side, height: side }, surface]}>
      <Svg width={side} height={side} style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: size * size }, (_, index) => (
          <Rect
            key={index}
            x={(index % size) * cell + inset}
            y={Math.floor(index / size) * cell + inset}
            width={cell - inset * 2}
            height={cell - inset * 2}
            rx={cell * 0.16}
            fill={covered.has(index) ? 'rgba(111, 179, 217, 0.2)' : 'rgba(18, 61, 92, 0.9)'}
            stroke="rgba(167, 212, 237, 0.18)"
            strokeWidth={1}
          />
        ))}
        {path.length > 1 && (
          <>
            <Path d={line} stroke={colors.primaryDeep} strokeWidth={cell * 0.4} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.9} />
            <Path d={line} stroke={solved ? CABLE_DONE : colors.accent} strokeWidth={cell * 0.28} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <Path d={line} stroke="rgba(255, 255, 255, 0.45)" strokeWidth={cell * 0.08} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </>
        )}
      </Svg>
      {puzzle.checkpoints.map((index, position) => {
        const number = position + 1;
        const point = center(index);
        return (
          <NodeMark
            key={number}
            number={number}
            last={last}
            x={point.x}
            y={point.y}
            cell={cell}
            state={covered.has(index) ? 'done' : number === next ? 'next' : 'todo'}
            shakeKey={flash && flash.cell === index ? flash.key : 0}
          />
        );
      })}
      <HeadMark x={headCenter.x} y={headCenter.y} cell={cell} onPoint={headOnPoint} />
      {solved && <Celebration burstKey={1} count={36} />}
    </View>
  );
}

interface NodeProps {
  number: number;
  last: number;
  x: number;
  y: number;
  cell: number;
  state: 'done' | 'next' | 'todo';
  shakeKey: number;
}

// Punto numerado con aspecto de equipo: 1 es el computador, el último el servidor y el resto routers.
function NodeMark({ number, last, x, y, cell, state, shakeKey }: NodeProps) {
  const motion = useMotionEnabled();
  const shift = useSharedValue(0);
  useEffect(() => {
    if (shakeKey === 0 || !motion) return;
    shift.set(withSequence(withTiming(-6, { duration: 50 }), withTiming(6, { duration: 80 }), withTiming(-4, { duration: 70 }), withTiming(0, { duration: 50 })));
  }, [motion, shakeKey, shift]);
  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: shift.value }] }));
  const diameter = Math.round(cell * 0.72);
  const refused = shakeKey > 0;
  const icon: IconName = number === 1 ? 'laptop' : number === last ? 'server' : 'router';
  const fontSize = Math.max(12, Math.round(diameter * 0.5));
  const badge = Math.round(diameter * 0.5);
  return (
    <Animated.View pointerEvents="none" style={[styles.node, { left: x - diameter / 2, top: y - diameter / 2, width: diameter, height: diameter }, shake]}>
      {state === 'next' && !refused && <Pulse size={diameter + 8} />}
      <View
        style={[
          styles.nodeBody,
          { borderRadius: diameter / 2 },
          state === 'done' && { backgroundColor: NODE_DONE, borderColor: colors.cream },
          state === 'next' && { borderColor: colors.accent, borderWidth: 3 },
          refused && { backgroundColor: '#FBE2E2', borderColor: colors.dangerLight, borderWidth: 3 },
        ]}
      >
        <TelText variant="heading" allowFontScaling={false} style={{ color: colors.primary, fontSize, lineHeight: fontSize + 2 }}>
          {number}
        </TelText>
      </View>
      {diameter >= 26 && (
        <View style={[styles.badge, { width: badge, height: badge, borderRadius: badge / 2, right: -badge * 0.3, top: -badge * 0.3 }]}>
          <TelIcon name={icon} size={Math.round(badge * 0.66)} color={colors.cream} strokeWidth={2.4} />
        </View>
      )}
    </Animated.View>
  );
}

// Anillo que late alrededor del siguiente punto (quieto si se reduce el movimiento).
function Pulse({ size }: { size: number }) {
  const ambient = useAmbientMotion();
  const grow = useSharedValue(0);
  useEffect(() => {
    if (!ambient) return;
    grow.set(withRepeat(withTiming(1, { duration: 900 }), -1, true));
    return () => cancelAnimation(grow);
  }, [ambient, grow]);
  const style = useAnimatedStyle(() => ({ opacity: 0.9 - grow.value * 0.6, transform: [{ scale: 1 + grow.value * 0.25 }] }));
  return <Animated.View pointerEvents="none" style={[styles.pulse, { width: size, height: size, borderRadius: size / 2 }, style]} />;
}

// El paquete: un punto brillante en la cabeza del cable (un anillo si está sobre un punto numerado).
function HeadMark({ x, y, cell, onPoint }: { x: number; y: number; cell: number; onPoint: boolean }) {
  const size = Math.round(onPoint ? cell * 0.92 : cell * 0.5);
  const chip = Math.round(cell * 0.3);
  return (
    <View pointerEvents="none" style={[styles.head, { left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: size / 2 }, onPoint ? styles.headRing : styles.headDot]}>
      {onPoint ? (
        <View style={[styles.chip, { width: chip, height: chip, borderRadius: chip / 2, right: -chip * 0.15, bottom: -chip * 0.15 }]}>
          <TelIcon name="packet" size={Math.round(chip * 0.7)} color={colors.primary} strokeWidth={2.4} />
        </View>
      ) : (
        <TelIcon name="packet" size={Math.round(size * 0.62)} color={colors.primary} strokeWidth={2.2} />
      )}
    </View>
  );
}

function ActionButton({ icon, label, disabled, onPress }: { icon: IconName; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.action, disabled && styles.actionOff]}>
      <TelIcon name={icon} size={18} color={colors.cream} />
      <TelText variant="label" color="cream">
        {label}
      </TelText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    gap: spacing.xs,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 36,
  },
  message: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  messageText: {
    flex: 1,
  },
  counter: {
    minWidth: 52,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  grid: {
    borderRadius: radius.md,
    backgroundColor: 'rgba(7, 31, 49, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(167, 212, 237, 0.2)',
  },
  node: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeBody: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: 'rgba(244, 236, 215, 0.35)',
  },
  badge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.cream,
  },
  pulse: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.accent,
  },
  head: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headDot: {
    backgroundColor: colors.cream,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  headRing: {
    borderWidth: 3,
    borderColor: colors.cream,
  },
  chip: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.cream,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  action: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 212, 237, 0.55)',
    backgroundColor: 'rgba(11, 45, 69, 0.55)',
  },
  actionOff: {
    opacity: 0.45,
  },
});
