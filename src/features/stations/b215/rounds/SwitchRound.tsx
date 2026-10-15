import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
  type SharedValue,
} from 'react-native-reanimated';
import { FitBox, type FitSize } from '@/components/FitBox';
import { DeviceArt } from '@/components/graphics/DeviceArt';
import { PressableScale } from '@/components/PressableScale';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { useCoachEnabled } from '@/features/coach/CoachBubble';
import { feedbackSuccess, feedbackWarning } from '@/lib/feedback';
import { useMotionEnabled } from '@/lib/motion';
import { colors, monoFamily, radius } from '@/theme';
import { gameNow, Hint, useGameTimeout } from '../../kit';
import type { RoundProps, RoundResult } from '../types';
import {
  buildResult,
  checkSwitchAnswer,
  FLOOD,
  holdMs,
  makeSwitchRound,
  normalizeLevel,
  ROUND_ITEMS,
  streakOf,
  SWITCH_FLOOD_HINT,
  switchBoardLayout,
  switchFeedback,
  switchTableAfter,
  type MacEntry,
  type Rect,
  type RoundKind,
  type SwitchDevice,
  type SwitchFrame,
  type SwitchRoundData,
} from './equipos.logic';

// ——— Piezas compartidas con «¿Por dónde sale?» (RouterRound las importa de aquí) ———

export interface Point {
  x: number;
  y: number;
}

// Cómo se ve cada casilla o fila durante la respuesta.
export type Visual = 'idle' | 'ok' | 'bad' | 'target' | 'flood' | 'dim';

export const visualPalette: Record<Visual, { bg: string; border: string; opacity: number }> = {
  idle: { bg: colors.primarySoft, border: 'rgba(167, 212, 237, 0.4)', opacity: 1 },
  ok: { bg: '#1F5E43', border: '#6BC59A', opacity: 1 },
  target: { bg: '#1F5E43', border: '#6BC59A', opacity: 1 },
  bad: { bg: '#6E2A2A', border: '#E58A8A', opacity: 1 },
  flood: { bg: '#174B6D', border: colors.accent, opacity: 1 },
  dim: { bg: colors.primarySoft, border: 'rgba(167, 212, 237, 0.15)', opacity: 0.5 },
};

export function place(rect: Rect): ViewStyle {
  return { position: 'absolute', left: rect.x, top: rect.y, width: rect.width, height: rect.height };
}

interface FlowOptions {
  kind: RoundKind;
  total: number;
  timeUp: boolean;
  pace: number;
  onDone: (result: RoundResult) => void;
}

// Avance de la ronda: un mensaje a la vez. Al responder se queda el resultado en pantalla un momento (con el
// reloj pausable del juego) y sigue el próximo; al terminar los seis, o si se acaba el tiempo, entrega el
// resultado una sola vez. `marks` guarda cómo le fue a cada respuesta (true = acierto).
export function useRoundFlow({ kind, total, timeUp, pace, onDone }: FlowOptions) {
  const [index, setIndex] = useState(0);
  const [marks, setMarks] = useState<boolean[]>([]);
  const [holdUntil, setHoldUntil] = useState<number | null>(null);
  const closed = useRef(false);

  const finish = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    onDone(buildResult(kind, marks.filter(Boolean).length, marks.length, total));
  }, [kind, marks, onDone, total]);

  // Sin tiempo: se entrega de inmediato lo logrado hasta ahí.
  useEffect(() => {
    if (timeUp) finish();
  }, [timeUp, finish]);

  useGameTimeout(
    holdUntil,
    () => {
      if (index + 1 >= total) {
        finish();
      } else {
        setIndex(index + 1);
        setHoldUntil(null);
      }
    },
    index,
  );

  // Registra la respuesta del mensaje actual; devuelve false si ya no se aceptan respuestas.
  const resolve = useCallback(
    (ok: boolean): boolean => {
      if (closed.current || holdUntil !== null) return false;
      setMarks((current) => [...current, ok]);
      setHoldUntil(gameNow() + holdMs(ok, pace));
      return true;
    },
    [holdUntil, pace],
  );

  return { index, holding: holdUntil !== null, marks, resolve };
}

export type CardState = 'idle' | 'ok' | 'bad';

const cardTones: Record<CardState, { bg: string; border: string; icon: string }> = {
  idle: { bg: colors.cream, border: 'transparent', icon: colors.accent },
  ok: { bg: '#DDF3E6', border: '#6BC59A', icon: colors.success },
  bad: { bg: '#FBE2E2', border: '#E58A8A', icon: colors.danger },
};

interface FrameCardProps {
  index: number;
  total: number;
  icon: IconName;
  label: string;
  // Cómo le fue a cada respuesta hasta ahora (la tira de abajo se pinta con eso).
  marks: readonly boolean[];
  // Al responder, la tarjeta se tiñe de verde o rojo y el ícono cambia a ✓ o ✕.
  state: CardState;
}

// El mensaje (o paquete) que toca resolver, como una tarjeta crema con una tira de avance de seis tramos.
export function FrameCard({ index, total, icon, label, marks, state, children }: PropsWithChildren<FrameCardProps>) {
  const motion = useMotionEnabled();
  const tone = cardTones[state];
  const verdict = state === 'ok' ? ' Correcto.' : state === 'bad' ? ' Incorrecto.' : '';
  return (
    <Animated.View
      key={index}
      entering={motion ? FadeInDown.duration(220) : undefined}
      accessible
      accessibilityLabel={`${label}${verdict}`}
      style={[styles.card, { backgroundColor: tone.bg, borderColor: tone.border }]}
    >
      <Animated.View key={state} entering={motion && state !== 'idle' ? ZoomIn.springify().damping(9) : undefined} style={[styles.cardIcon, { backgroundColor: tone.icon }]}>
        <TelIcon name={state === 'ok' ? 'check' : state === 'bad' ? 'close' : icon} size={18} color={state === 'idle' ? colors.primary : colors.white} strokeWidth={state === 'idle' ? 2 : 3} />
      </Animated.View>
      <View style={styles.cardText}>{children}</View>
      <View pointerEvents="none" style={styles.steps}>
        {Array.from({ length: total }, (_, step) => (
          <View
            key={step}
            style={[styles.step, { backgroundColor: step < marks.length ? (marks[step] ? colors.success : colors.danger) : step === marks.length ? colors.accent : 'rgba(11, 45, 69, 0.16)' }]}
          />
        ))}
      </View>
    </Animated.View>
  );
}

export interface SlotMessage {
  tone: 'info' | 'good' | 'bad';
  text: string;
}

// Franja fija bajo el tablero: la explicación que se da una vez, el resultado de cada respuesta o, en reposo,
// un recordatorio corto de qué hacer. Tiene alto reservado para que el tablero no salte al cambiar de texto.
export function MessageSlot({ message, idle }: { message: SlotMessage | null; idle: string }) {
  const coach = useCoachEnabled();
  return (
    <View style={[styles.messageSlot, { minHeight: coach ? 52 : 38 }]}>
      {message ? (
        <View key={message.text} style={styles.messageFill}>
          <Hint tone={message.tone}>{message.text}</Hint>
        </View>
      ) : (
        <TelText variant="caption" color="accentSoft" align="center" numberOfLines={2}>
          {idle}
        </TelText>
      )}
    </View>
  );
}

interface ShakyProps {
  // Cambia para sacudir (error).
  token: number | null;
  // Cambia para hacer rebotar (acierto), con un retraso opcional para encadenar varios.
  pop?: number | null;
  popDelay?: number;
  style?: StyleProp<ViewStyle>;
}

// Sacudida (error) y rebote (acierto): solo adorno, el puntaje no depende de ellos.
export function Shaky({ token, pop = null, popDelay = 0, style, children }: PropsWithChildren<ShakyProps>) {
  const offset = useSharedValue(0);
  const scale = useSharedValue(1);
  useEffect(() => {
    if (token === null) return;
    offset.set(withSequence(withTiming(-8, { duration: 55 }), withTiming(8, { duration: 90 }), withTiming(-5, { duration: 80 }), withTiming(0, { duration: 60 })));
  }, [token, offset]);
  useEffect(() => {
    if (pop === null) return;
    scale.set(withDelay(popDelay, withSequence(withTiming(1.12, { duration: 110 }), withSpring(1, { damping: 7, stiffness: 240 }))));
  }, [pop, popDelay, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }, { scale: scale.value }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

const FLYER = 26;

// Sobre (o paquete) que viaja desde el equipo del centro hasta su destino: solo adorno.
export function Flyer({ from, to, delay = 0, icon = 'mail' }: { from: Point; to: Point; delay?: number; icon?: IconName }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withDelay(delay, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) })));
  }, [delay, progress]);
  const animated = useAnimatedStyle(() => ({
    opacity: progress.value < 0.8 ? 1 : Math.max(0, (1 - progress.value) / 0.2),
    transform: [
      { translateX: from.x + (to.x - from.x) * progress.value - FLYER / 2 },
      { translateY: from.y + (to.y - from.y) * progress.value - FLYER / 2 },
      { scale: 1 - 0.45 * progress.value },
    ],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.flyer, animated]}>
      <TelIcon name={icon} size={14} color={colors.primary} />
    </Animated.View>
  );
}

const CONFETTI = ['#6FB3D9', '#F4ECD7', '#F6C945', '#6BC59A', '#E58A5A', '#A7D4ED', '#F6C945', '#6BC59A'];

interface ParticleProps {
  progress: SharedValue<number>;
  at: Point;
  angle: number;
  reach: number;
  size: number;
  color: string;
}

function Particle({ progress, at, angle, reach, size, color }: ParticleProps) {
  const animated = useAnimatedStyle(() => ({
    opacity: progress.value < 0.6 ? 1 : Math.max(0, (1 - progress.value) / 0.4),
    transform: [
      { translateX: at.x + Math.cos(angle) * reach * progress.value - size / 2 },
      { translateY: at.y + Math.sin(angle) * reach * progress.value - size / 2 },
      { scale: 1 - 0.5 * progress.value },
    ],
  }));
  return <Animated.View pointerEvents="none" style={[styles.particle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }, animated]} />;
}

// ¡Acierto!: confeti que sale del punto tocado y un «+1» que sube y se desvanece. Solo adorno.
export function Burst({ at, label }: { at: Point; label?: string }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [progress]);
  const rise = useAnimatedStyle(() => ({
    opacity: progress.value < 0.55 ? 1 : Math.max(0, (1 - progress.value) / 0.45),
    transform: [{ translateX: at.x - 18 }, { translateY: at.y - 24 - 34 * progress.value }, { scale: 0.8 + 0.4 * Math.min(1, progress.value * 4) }],
  }));
  return (
    <>
      {CONFETTI.map((color, position) => (
        <Particle key={position} progress={progress} at={at} angle={(position / CONFETTI.length) * Math.PI * 2 + 0.3} reach={30 + (position % 3) * 9} size={6 + (position % 2) * 3} color={color} />
      ))}
      {label ? (
        <Animated.View pointerEvents="none" style={[styles.plus, rise]}>
          <TelText variant="label" color="white" maxFontSizeMultiplier={1}>
            {label}
          </TelText>
        </Animated.View>
      ) : null}
    </>
  );
}

// Marca de acierto (✓) o error (✕) en la esquina de lo que se tocó.
export function ResultChip({ ok }: { ok: boolean }) {
  return (
    <View pointerEvents="none" style={[styles.resultChip, { backgroundColor: ok ? colors.success : colors.danger }]}>
      <TelIcon name={ok ? 'check' : 'close'} size={12} color={colors.white} strokeWidth={3} />
    </View>
  );
}

// ——— Ronda 1: El switch reparte ———

const IDLE_SIMPLE = 'Toca el puerto del destino.';
const IDLE_LEARNING = 'En la tabla: toca su puerto. Si no: «A todos».';

interface SwitchOutcome {
  index: number;
  choice: number;
  ok: boolean;
  text: string;
}

function portVisual(port: number, frame: SwitchFrame, outcome: SwitchOutcome | null): Visual {
  if (!outcome) return 'idle';
  if (outcome.choice === port) return outcome.ok ? 'ok' : 'bad';
  if (frame.answer === port) return 'target';
  if (frame.answer === FLOOD && port !== frame.from) return 'flood';
  return 'dim';
}

function floodVisual(frame: SwitchFrame, outcome: SwitchOutcome | null): Visual {
  if (!outcome) return 'idle';
  if (outcome.choice === FLOOD) return outcome.ok ? 'ok' : 'bad';
  return frame.answer === FLOOD ? 'target' : 'dim';
}

const floodPalette: Record<Visual, { bg: string; border: string; fg: string; opacity: number }> = {
  idle: { bg: colors.accent, border: colors.accentSoft, fg: colors.primary, opacity: 1 },
  flood: { bg: colors.accent, border: colors.accentSoft, fg: colors.primary, opacity: 1 },
  ok: { bg: '#1F5E43', border: '#6BC59A', fg: colors.white, opacity: 1 },
  target: { bg: '#1F5E43', border: '#6BC59A', fg: colors.white, opacity: 1 },
  bad: { bg: '#6E2A2A', border: '#E58A8A', fg: colors.white, opacity: 1 },
  dim: { bg: colors.accent, border: colors.accentSoft, fg: colors.primary, opacity: 0.45 },
};

interface MacTableProps {
  ports: number;
  entries: MacEntry[];
  fresh: ReadonlySet<string>;
}

// Lo que el switch sabe: una casilla por entrada (dirección MAC y su puerto). Parte vacía.
function MacTable({ ports, entries, fresh }: MacTableProps) {
  const motion = useMotionEnabled();
  const label = entries.length ? `Tabla MAC: ${entries.map((entry) => `MAC ${entry.mac} en el puerto ${entry.port}`).join(', ')}` : 'Tabla MAC: vacía';
  return (
    <View accessible accessibilityLabel={label} style={styles.table}>
      <View style={styles.tableLabel}>
        <TelIcon name="table" size={16} color={colors.accentSoft} />
        <TelText variant="small" color="accentSoft" align="center" numberOfLines={1} maxFontSizeMultiplier={1.1}>
          Tabla MAC
        </TelText>
      </View>
      <View style={styles.macSlots}>
        {Array.from({ length: ports }, (_, position) => {
          const entry = entries[position];
          if (!entry) return <View key={`vacia-${position}`} style={[styles.macSlot, styles.macSlotEmpty]} />;
          return (
            <Animated.View key={entry.mac} entering={motion ? ZoomIn.springify().damping(10) : undefined} style={[styles.macSlot, fresh.has(entry.mac) && styles.macSlotNew]}>
              <TelText variant="small" color="cream" maxFontSizeMultiplier={1.1} style={styles.mono}>
                {entry.mac}
              </TelText>
              <View style={styles.badge}>
                <TelText variant="small" color="primary" maxFontSizeMultiplier={1} style={styles.badgeText}>
                  {entry.port}
                </TelText>
              </View>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

interface Bounce {
  token: number | null;
  delay: number;
}

interface PortTileProps {
  device: SwitchDevice;
  rect: Rect;
  visual: Visual;
  showMac: boolean;
  disabled: boolean;
  shake: number | null;
  bounce: Bounce;
  onPress: () => void;
}

// Un puerto del switch con el equipo conectado: dibujo, nombre y, desde el nivel 1, su MAC.
function PortTile({ device, rect, visual, showMac, disabled, shake, bounce, onPress }: PortTileProps) {
  const narrow = rect.width < 112;
  const art = Math.max(20, Math.min(narrow ? 22 : 38, Math.round(rect.height * 0.5)));
  const palette = visualPalette[visual];
  return (
    <Shaky token={shake} pop={bounce.token} popDelay={bounce.delay} style={place(rect)}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Puerto ${device.port}: ${device.name}${showMac ? `, MAC ${device.mac}` : ''}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        scaleTo={0.95}
        style={[styles.tile, { backgroundColor: palette.bg, borderColor: palette.border, opacity: palette.opacity }]}
      >
        <DeviceArt device={device.kind} size={art} />
        <View style={styles.tileText}>
          <TelText variant="small" color="cream" numberOfLines={2} maxFontSizeMultiplier={1.15} style={narrow ? styles.narrowText : undefined}>
            {device.name}
          </TelText>
          {showMac && (
            <TelText variant="small" color="accentSoft" maxFontSizeMultiplier={1.15} style={[styles.mono, narrow && styles.narrowText]}>
              MAC {device.mac}
            </TelText>
          )}
        </View>
        <View pointerEvents="none" style={styles.portChip}>
          <TelText variant="small" color="primary" maxFontSizeMultiplier={1} style={styles.badgeText}>
            {device.port}
          </TelText>
        </View>
        {(visual === 'ok' || visual === 'target' || visual === 'bad') && <ResultChip ok={visual !== 'bad'} />}
      </PressableScale>
    </Shaky>
  );
}

interface FloodButtonProps {
  visual: Visual;
  disabled: boolean;
  shake: number | null;
  bounce: Bounce;
  onPress: () => void;
}

// «A todos»: el switch no sabe dónde está el destino y lo manda por todos los puertos.
function FloodButton({ visual, disabled, shake, bounce, onPress }: FloodButtonProps) {
  const palette = floodPalette[visual];
  return (
    <Shaky token={shake} pop={bounce.token} popDelay={bounce.delay} style={styles.floodWrap}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="A todos, enviar por todos los puertos"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        scaleTo={0.94}
        style={[styles.flood, { backgroundColor: palette.bg, borderColor: palette.border, opacity: palette.opacity }]}
      >
        <TelIcon name="megaphone" size={18} color={palette.fg} />
        <TelText variant="small" align="center" numberOfLines={2} maxFontSizeMultiplier={1.1} style={{ color: palette.fg }}>
          A todos
        </TelText>
        {(visual === 'ok' || visual === 'target' || visual === 'bad') && <ResultChip ok={visual !== 'bad'} />}
      </PressableScale>
    </Shaky>
  );
}

interface BoardProps {
  size: FitSize;
  data: SwitchRoundData;
  frame: SwitchFrame;
  outcome: SwitchOutcome | null;
  motion: boolean;
  onChoose: (choice: number) => void;
}

// El switch en el centro y un equipo en cada puerto. Todo se dibuja a partir del tamaño que entrega FitBox.
function SwitchBoard({ size, data, frame, outcome, motion, onChoose }: BoardProps) {
  const layout = switchBoardLayout(size.width, size.height, data.ports, data.learning);
  const disabled = outcome !== null;
  const center: Point = { x: layout.bar.x + layout.bar.width / 2, y: layout.bar.y + layout.bar.height / 2 };
  const tileCenter = (port: number): Point => {
    const rect = layout.tiles[port - 1];
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  };
  const token = outcome && motion ? outcome.index + 1 : null;
  const shake = outcome && !outcome.ok ? token : null;
  const flooded = frame.answer === FLOOD;
  // El adorno muestra lo que hace el switch de verdad: un puerto, o todos menos el de quien envía.
  const receivers = data.devices.map((device) => device.port).filter((port) => port !== frame.from);
  const targets = outcome ? (flooded ? receivers : [frame.answer]) : [];

  // Quién rebota: la casilla tocada si acertó; si no, la correcta (un momento después); con «A todos», todas en cadena.
  function bounceOf(port: number): Bounce {
    const none: Bounce = { token: null, delay: 0 };
    if (token === null || !outcome) return none;
    if (flooded) return receivers.includes(port) ? { token, delay: receivers.indexOf(port) * 45 } : none;
    if (outcome.choice === port && outcome.ok) return { token, delay: 0 };
    return frame.answer === port && !outcome.ok ? { token, delay: 280 } : none;
  }
  const floodBounce: Bounce = token !== null && outcome && ((outcome.choice === FLOOD && outcome.ok) || (flooded && !outcome.ok)) ? { token, delay: outcome.ok ? 0 : 280 } : { token: null, delay: 0 };

  return (
    <>
      {layout.tiles.map((rect, position) => {
        const visual = portVisual(position + 1, frame, outcome);
        const left = rect.x < layout.bar.x;
        return (
          <View
            key={`cable-${position}`}
            pointerEvents="none"
            style={[
              styles.cable,
              {
                left: left ? rect.x + rect.width : layout.bar.x + layout.bar.width,
                top: rect.y + rect.height / 2 - 1.5,
                width: layout.cable,
                backgroundColor: visual === 'ok' || visual === 'target' || visual === 'flood' ? colors.accent : 'rgba(167, 212, 237, 0.4)',
              },
            ]}
          />
        );
      })}
      <View style={[styles.bar, place(layout.bar)]}>
        <TelIcon name="switchPorts" size={22} color={colors.cream} />
        {layout.bar.height >= 120 && (
          <TelText variant="small" color="accentSoft" maxFontSizeMultiplier={1.1}>
            Switch
          </TelText>
        )}
        {data.learning && (
          <FloodButton visual={floodVisual(frame, outcome)} disabled={disabled} shake={outcome?.choice === FLOOD ? shake : null} bounce={floodBounce} onPress={() => onChoose(FLOOD)} />
        )}
      </View>
      {layout.tiles.map((rect, position) => (
        <PortTile
          key={`puerto-${position}`}
          device={data.devices[position]}
          rect={rect}
          visual={portVisual(position + 1, frame, outcome)}
          showMac={data.learning}
          disabled={disabled}
          shake={outcome?.choice === position + 1 ? shake : null}
          bounce={bounceOf(position + 1)}
          onPress={() => onChoose(position + 1)}
        />
      ))}
      {motion &&
        outcome &&
        targets.map((port, order) => <Flyer key={`${outcome.index}-${port}`} from={center} to={tileCenter(port)} delay={order * 40} />)}
      {motion && outcome?.ok && <Burst key={`burst-${outcome.index}`} at={outcome.choice === FLOOD ? center : tileCenter(outcome.choice)} label="+1" />}
    </>
  );
}

export function SwitchRound({ seed, level, pace, timeUp, onDone }: RoundProps) {
  const lvl = normalizeLevel(level);
  const data = useMemo(() => makeSwitchRound(seed, lvl), [seed, lvl]);
  const motion = useMotionEnabled();
  const flow = useRoundFlow({ kind: 'switch', total: ROUND_ITEMS, timeUp, pace, onDone });
  const [last, setLast] = useState<SwitchOutcome | null>(null);

  const frame = data.frames[Math.min(flow.index, data.frames.length - 1)];
  const outcome = last && last.index === flow.index ? last : null;
  const sender = data.devices[frame.from - 1];
  const receiver = data.devices[frame.to - 1];
  const to = data.learning ? `MAC ${receiver.mac}` : receiver.name;

  function choose(choice: number) {
    if (outcome) return;
    const ok = checkSwitchAnswer(frame, choice);
    // Aciertos seguidos contando este (solo para el elogio: el puntaje no depende de la racha).
    const result = switchFeedback(data, flow.index, choice, ok ? streakOf(flow.marks) + 1 : 0);
    if (!flow.resolve(result.ok)) return;
    setLast({ index: flow.index, choice, ok: result.ok, text: result.text });
    void (result.ok ? feedbackSuccess() : feedbackWarning());
  }

  const message: SlotMessage | null = outcome
    ? { tone: outcome.ok ? 'good' : 'bad', text: outcome.text }
    : data.learning && flow.index === 0
      ? { tone: 'info', text: SWITCH_FLOOD_HINT }
      : null;
  const entries = outcome ? switchTableAfter(frame) : frame.table;
  const fresh = new Set(outcome ? frame.learned.map((entry) => entry.mac) : []);

  return (
    <View style={styles.root}>
      <FrameCard
        index={flow.index}
        total={ROUND_ITEMS}
        icon="mail"
        label={`Mensaje ${flow.index + 1} de ${ROUND_ITEMS}. De ${sender.name}. Para ${to}.`}
        marks={flow.marks}
        state={outcome ? (outcome.ok ? 'ok' : 'bad') : 'idle'}
      >
        <TelText variant="caption" color="secondary" numberOfLines={2} maxFontSizeMultiplier={1.3}>
          De: {sender.name}
          {data.learning ? ` · MAC ${sender.mac}` : ''}
        </TelText>
        <TelText variant={to.length > 17 ? 'label' : 'subtitle'} color="primary" numberOfLines={2} maxFontSizeMultiplier={1.3}>
          Para: {to}
        </TelText>
      </FrameCard>
      {data.learning && <MacTable ports={data.ports} entries={entries} fresh={fresh} />}
      <FitBox style={styles.board}>{(boardSize) => <SwitchBoard size={boardSize} data={data} frame={frame} outcome={outcome} motion={motion} onChoose={choose} />}</FitBox>
      <MessageSlot message={message} idle={data.learning ? IDLE_LEARNING : IDLE_SIMPLE} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    gap: 6,
  },
  // Aunque el contenedor no acote el alto, el tablero nunca desaparece.
  board: {
    minHeight: 150,
  },
  mono: {
    fontFamily: monoFamily,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 7,
    paddingBottom: 14,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 2,
  },
  cardIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
  },
  steps: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 4,
    height: 4,
    flexDirection: 'row',
    gap: 3,
  },
  step: {
    flex: 1,
    borderRadius: 2,
  },
  messageSlot: {
    justifyContent: 'center',
  },
  messageFill: {
    alignSelf: 'stretch',
  },
  flyer: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: FLYER,
    height: FLYER,
    borderRadius: FLYER / 2,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  particle: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 6,
  },
  plus: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 36,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#6BC59A',
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 7,
  },
  resultChip: {
    position: 'absolute',
    top: -6,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  table: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    backgroundColor: 'rgba(18, 61, 92, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(167, 212, 237, 0.2)',
  },
  tableLabel: {
    width: 52,
    alignItems: 'center',
    gap: 1,
  },
  macSlots: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  macSlot: {
    flex: 1,
    height: 40,
    borderRadius: radius.xs,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 212, 237, 0.3)',
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  macSlotEmpty: {
    borderStyle: 'dashed',
    borderColor: 'rgba(167, 212, 237, 0.25)',
    backgroundColor: 'transparent',
  },
  macSlotNew: {
    borderColor: colors.accent,
    backgroundColor: '#174B6D',
  },
  badge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  cable: {
    position: 'absolute',
    height: 3,
    borderRadius: 2,
  },
  bar: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 212, 237, 0.4)',
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  floodWrap: {
    alignSelf: 'stretch',
    marginHorizontal: 3,
  },
  flood: {
    minHeight: 56,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 2,
  },
  tile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 6,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  tileText: {
    flex: 1,
    justifyContent: 'center',
  },
  narrowText: {
    fontSize: 11,
    lineHeight: 14,
  },
  portChip: {
    position: 'absolute',
    top: -6,
    left: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
