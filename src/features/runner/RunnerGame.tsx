import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Line, Polygon } from 'react-native-svg';
import { IconButton } from '@/components/IconButton';
import { PressableScale } from '@/components/PressableScale';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import type { CoachMood } from '@/data/coachLines';
import { CoachBubble } from '@/features/coach/CoachBubble';
import { PauseSheet, useBackToPause } from '@/features/coach/PauseSheet';
import { runnerCharacterDrawing, runnerItemDrawing, runnerItemKinds } from '@/graphics/runners';
import { SvgDrawing } from '@/graphics/ShapeLayer';
import type { Drawing } from '@/graphics/shapes';
import { feedbackSuccess, feedbackTap, feedbackWarning } from '@/lib/feedback';
import { formatNumber } from '@/lib/format';
import { mulberry32 } from '@/route/random';
import { colors, radius, spacing } from '@/theme';
import type { RunnerCharacter } from './characters';
import {
  applyRunnerInput,
  createRunnerState,
  isBoosted,
  runnerAccuracy,
  runnerScore,
  stepRunner,
  VIEW_AHEAD,
  VIEW_BEHIND,
  type RunnerEvent,
  type RunnerInput,
  type RunnerItem,
} from './logic';

export interface RunnerSummary {
  score: number;
  distance: number;
  data: number;
  accuracy: number;
  seconds: number;
}

interface RunnerGameProps {
  character: RunnerCharacter;
  // Ritmo de juego elegido en Ajustes (1 = rápido, 1,7 = tranquilo).
  pace: number;
  seed: number;
  coach: boolean;
  onFinish: (summary: RunnerSummary) => void;
  onLeave: () => void;
}

// Medidas de la pista en pantalla (la calcula el layout; la usan los estilos animados).
interface Geometry {
  centerX: number;
  horizon: number;
  // Píxeles entre el horizonte y el corredor.
  depth: number;
  playerY: number;
  // Ancho de una pista a la altura del corredor.
  lane: number;
  item: number;
  player: number;
  road: number;
}

const itemDrawings: Record<string, Drawing> = Object.fromEntries(runnerItemKinds.map((kind) => [kind, runnerItemDrawing(kind)]));
const STRIPES = 5;
const STRIPE_SPAN = 30;
const SWIPE_PX = 22;

const eventLines: Partial<Record<RunnerEvent, { text: string; mood: CoachMood }>> = {
  hit: { text: '¡Ay! Cambia de pista para esquivar los virus y salta los cables.', mood: 'bad' },
  blocked: { text: '¡El cortafuegos te salvó del golpe!', mood: 'good' },
  shield: { text: '¡Cortafuegos activado! Te protege de un golpe.', mood: 'good' },
  boost: { text: '¡Fibra óptica! Cada paquete vale el doble por unos segundos.', mood: 'great' },
  revive: { text: '¡Respaldo en la nube! Vuelves con una vida.', mood: 'great' },
};

// Objeto de la pista: su posición sale de la distancia recorrida, sin re-renderizar por cuadro.
const RunnerSprite = memo(function RunnerSprite({ item, distance, geo }: { item: RunnerItem; distance: SharedValue<number>; geo: Geometry }) {
  const style = useAnimatedStyle(() => {
    const progress = 1 - (item.at - distance.value) / VIEW_AHEAD;
    const eased = progress <= 0 ? 0 : progress * progress;
    const scale = 0.3 + 0.7 * Math.min(eased, 1.3);
    const spread = 0.3 + 0.7 * Math.min(eased, 1.5);
    return {
      opacity: progress < 0.05 ? Math.max(0, progress / 0.05) : 1,
      transform: [
        { translateX: geo.centerX + (item.lane - 1) * geo.lane * spread - geo.item / 2 },
        { translateY: geo.horizon + geo.depth * eased - geo.item * (0.5 + scale * 0.42) },
        { scale },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.sprite, { width: geo.item, height: geo.item }, style]}>
      <SvgDrawing drawing={itemDrawings[item.kind]} width={geo.item} height={geo.item} />
    </Animated.View>
  );
});

// Franja del suelo que se acerca: da la sensación de velocidad.
function Stripe({ index, distance, geo }: { index: number; distance: SharedValue<number>; geo: Geometry }) {
  const style = useAnimatedStyle(() => {
    const ahead = ((((index * STRIPE_SPAN) / STRIPES - distance.value) % STRIPE_SPAN) + STRIPE_SPAN) % STRIPE_SPAN - VIEW_BEHIND;
    const progress = 1 - ahead / VIEW_AHEAD;
    const eased = progress <= 0 ? 0 : progress * progress;
    const half = 1.5 * geo.lane * (0.3 + 0.7 * Math.min(eased, 1.6));
    return {
      opacity: 0.06 + 0.2 * Math.min(1, eased),
      transform: [{ translateX: geo.centerX - geo.road / 2 }, { translateY: geo.horizon + geo.depth * eased }, { scaleX: (half * 2) / geo.road }, { scaleY: 0.4 + Math.min(1.4, eased) }],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.stripe, { width: geo.road }, style]} />;
}

// TEL Runner: corre por la autopista de datos, junta paquetes y esquiva virus y cables sueltos.
export function RunnerGame({ character, pace, seed, coach, onFinish, onLeave }: RunnerGameProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [phase, setPhase] = useState<'ready' | 'running' | 'over'>('ready');
  const [paused, setPaused] = useState(false);
  const [items, setItems] = useState<RunnerItem[]>([]);
  const [hud, setHud] = useState({ meters: 0, data: 0, lives: character.perks.lives, shield: character.perks.startShield, boost: false });
  const [say, setSay] = useState<{ text: string; mood: CoachMood; key: number } | null>(null);
  const sim = useRef(createRunnerState(character.perks));
  const random = useRef(mulberry32(seed));
  const sayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const milestone = useRef(0);
  const distance = useSharedValue(0);
  const laneX = useSharedValue(1);
  const jump = useSharedValue(0);
  const blink = useSharedValue(1);
  const playerDrawing = useMemo(() => runnerCharacterDrawing(character.id), [character.id]);

  const geo = useMemo<Geometry>(() => {
    const lane = Math.min(size.width, 520) * 0.27;
    const horizon = size.height * 0.06;
    const playerY = size.height * 0.8;
    const depth = playerY - horizon;
    const bottom = depth > 0 ? (size.height - horizon) / depth : 1;
    return { centerX: size.width / 2, horizon, depth, playerY, lane, item: lane * 0.62, player: lane * 0.98, road: 3 * lane * (0.3 + 0.7 * bottom) };
  }, [size.height, size.width]);

  const speak = useCallback((text: string, mood: CoachMood) => {
    if (sayTimer.current) clearTimeout(sayTimer.current);
    setSay((previous) => ({ text, mood, key: (previous?.key ?? 0) + 1 }));
    sayTimer.current = setTimeout(() => setSay(null), 2600);
  }, []);

  useEffect(
    () => () => {
      if (sayTimer.current) clearTimeout(sayTimer.current);
    },
    [],
  );

  const running = phase === 'running' && !paused;

  const input = useCallback(
    (kind: RunnerInput) => {
      const state = sim.current;
      if (!running || state.over || !applyRunnerInput(state, kind)) return;
      void feedbackTap();
      if (kind === 'jump') {
        const total = state.perks.jumpSeconds * 1000;
        jump.set(withSequence(withTiming(1, { duration: total * 0.45, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: total * 0.55, easing: Easing.in(Easing.quad) })));
      } else {
        laneX.set(withTiming(state.lane, { duration: 110, easing: Easing.out(Easing.quad) }));
      }
    },
    [jump, laneX, running],
  );

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last = 0;
    let shown = sim.current.revision;
    let lastHud = 0;
    const tick = (time: number) => {
      const state = sim.current;
      const events = stepRunner(state, last === 0 ? 0 : (time - last) / 1000, random.current, pace);
      last = time;
      distance.set(state.distance);
      if (state.revision !== shown) {
        shown = state.revision;
        setItems([...state.items]);
      }
      for (const event of events) {
        if (event === 'hit') {
          void feedbackWarning();
          blink.set(withRepeat(withSequence(withTiming(0.25, { duration: 110 }), withTiming(1, { duration: 110 })), 6));
        } else if (event === 'shield' || event === 'boost' || event === 'blocked' || event === 'revive') {
          void feedbackSuccess();
        }
        const line = eventLines[event];
        if (line) speak(line.text, line.mood);
      }
      const reached = Math.floor(state.distance / 250);
      if (reached > milestone.current) {
        milestone.current = reached;
        speak(`¡${formatNumber(reached * 250)} metros! La autopista se acelera.`, 'great');
      }
      if (events.length > 0 || time - lastHud > 140) {
        lastHud = time;
        setHud({ meters: Math.floor(state.distance), data: state.data, lives: state.lives, shield: state.shield, boost: isBoosted(state) });
      }
      if (state.over) {
        setPhase('over');
        onFinish({ score: runnerScore(state), distance: Math.floor(state.distance), data: state.data, accuracy: runnerAccuracy(state), seconds: Math.max(1, Math.round(state.time)) });
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [blink, distance, onFinish, pace, running, speak]);

  // En el computador también se juega con las flechas y la barra espaciadora.
  useEffect(() => {
    if (Platform.OS !== 'web' || !running || typeof document === 'undefined') return;
    const onKey = (event: KeyboardEvent) => {
      const kind: RunnerInput | null = event.key === 'ArrowLeft' ? 'left' : event.key === 'ArrowRight' ? 'right' : event.key === 'ArrowUp' || event.key === ' ' ? 'jump' : null;
      if (!kind) return;
      event.preventDefault();
      input(kind);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [input, running]);

  const pause = useCallback(() => setPaused(true), []);
  useBackToPause(phase !== 'over' && !paused, pause);

  // Gestos sobre la pista: deslizar cambia de pista o salta; un toque simple hace lo mismo según
  // dónde caiga. El deslizamiento se reconoce apenas el dedo avanza, sin esperar a soltarlo.
  const gesture = useRef({ x: 0, y: 0, swiped: false });

  function onTouchStart(event: GestureResponderEvent) {
    gesture.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY, swiped: false };
  }

  function onTouchMove(event: GestureResponderEvent) {
    const current = gesture.current;
    if (current.swiped) return;
    const dx = event.nativeEvent.pageX - current.x;
    const dy = event.nativeEvent.pageY - current.y;
    if (Math.abs(dx) < SWIPE_PX && Math.abs(dy) < SWIPE_PX) return;
    current.swiped = true;
    if (Math.abs(dx) > Math.abs(dy)) input(dx < 0 ? 'left' : 'right');
    else if (dy < 0) input('jump');
  }

  function onTouchEnd(event: GestureResponderEvent) {
    if (gesture.current.swiped) return;
    const x = event.nativeEvent.locationX;
    input(x < size.width / 3 ? 'left' : x > (size.width * 2) / 3 ? 'right' : 'jump');
  }

  const playerStyle = useAnimatedStyle(() => ({
    opacity: blink.value,
    transform: [
      { translateX: geo.centerX + (laneX.value - 1) * geo.lane - geo.player / 2 },
      { translateY: geo.playerY - geo.player * 0.92 - jump.value * geo.player * 0.55 },
      { scale: 1 + jump.value * 0.14 },
    ],
  }));
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 0.4 - jump.value * 0.2,
    transform: [{ translateX: geo.centerX + (laneX.value - 1) * geo.lane - geo.player * 0.32 }, { translateY: geo.playerY - geo.player * 0.1 }, { scale: 1 - jump.value * 0.3 }],
  }));

  function onLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  }

  const ready = size.width > 0 && size.height > 0;
  const topHalf = 1.5 * geo.lane * 0.3;
  const bottomHalf = geo.road / 2;
  const edge = (side: number, third: number) => ({
    x1: geo.centerX + side * topHalf * third,
    y1: geo.horizon,
    x2: geo.centerX + side * bottomHalf * third,
    y2: size.height,
  });

  return (
    <View style={styles.root}>
      <View style={styles.hud}>
        <View style={styles.lives} accessible accessibilityLabel={`${hud.lives} vidas`}>
          {Array.from({ length: character.perks.lives }, (_, index) => (
            <TelIcon key={index} name={index < hud.lives ? 'heartSolid' : 'heart'} size={20} color={index < hud.lives ? '#F4B8C4' : colors.secondary} />
          ))}
          {hud.shield && <TelIcon name="shieldCheck" size={20} color={colors.accent} />}
        </View>
        <View style={styles.counter} accessible accessibilityLabel={`${hud.meters} metros`}>
          <TelIcon name="route" size={16} color={colors.accent} />
          <TelText variant="label" color="cream" tabular>
            {formatNumber(hud.meters)} m
          </TelText>
        </View>
        <View style={[styles.counter, hud.boost && styles.counterBoost]} accessible accessibilityLabel={`${hud.data} paquetes de datos${hud.boost ? ', valen el doble' : ''}`}>
          <TelIcon name="packet" size={16} color={hud.boost ? colors.primary : colors.accent} />
          <TelText variant="label" color={hud.boost ? 'primary' : 'cream'} tabular>
            {formatNumber(hud.data)}
            {hud.boost ? ' ×2' : ''}
          </TelText>
        </View>
        <IconButton icon="pause" tone="dark" size={40} accessibilityLabel="Pausar" onPress={pause} />
      </View>

      <View style={styles.track} onLayout={onLayout} onStartShouldSetResponder={() => true} onResponderGrant={onTouchStart} onResponderMove={onTouchMove} onResponderRelease={onTouchEnd}>
        {ready && (
          <>
            <Svg pointerEvents="none" width={size.width} height={size.height} style={StyleSheet.absoluteFill}>
              <Polygon
                points={`${geo.centerX - topHalf},${geo.horizon} ${geo.centerX + topHalf},${geo.horizon} ${geo.centerX + bottomHalf},${size.height} ${geo.centerX - bottomHalf},${size.height}`}
                fill={colors.primaryDeep}
                fillOpacity={0.82}
              />
              <Line {...edge(-1, 1)} stroke={colors.accent} strokeWidth={3} strokeOpacity={0.8} />
              <Line {...edge(1, 1)} stroke={colors.accent} strokeWidth={3} strokeOpacity={0.8} />
              <Line {...edge(-1, 1 / 3)} stroke={colors.accentSoft} strokeWidth={2} strokeOpacity={0.3} strokeDasharray="10 12" />
              <Line {...edge(1, 1 / 3)} stroke={colors.accentSoft} strokeWidth={2} strokeOpacity={0.3} strokeDasharray="10 12" />
            </Svg>
            {Array.from({ length: STRIPES }, (_, index) => (
              <Stripe key={index} index={index} distance={distance} geo={geo} />
            ))}
            {items.map((item) => (
              <RunnerSprite key={item.id} item={item} distance={distance} geo={geo} />
            ))}
            <Animated.View pointerEvents="none" style={[styles.shadow, { width: geo.player * 0.64, height: geo.player * 0.16, borderRadius: geo.player * 0.1 }, shadowStyle]} />
            <Animated.View pointerEvents="none" style={[styles.sprite, { width: geo.player, height: geo.player }, playerStyle]}>
              {hud.shield && <View style={[styles.shieldRing, { borderRadius: geo.player / 2 }]} />}
              <SvgDrawing drawing={playerDrawing} width={geo.player} height={geo.player} />
            </Animated.View>
          </>
        )}
        {coach && say && (
          <View pointerEvents="none" style={styles.say} accessibilityLiveRegion="polite">
            <CoachBubble mood={say.mood} tone={say.mood === 'bad' ? 'bad' : say.mood === 'idle' ? 'info' : 'good'} size={44} bounceKey={say.key}>
              {say.text}
            </CoachBubble>
          </View>
        )}
        {phase === 'ready' && (
          <View style={styles.readyLayer}>
            <PressableScale accessibilityRole="button" accessibilityLabel="Toca para correr" haptic onPress={() => setPhase('running')} style={styles.readyCard}>
              <TelIcon name="tap" size={22} color={colors.primary} />
              <TelText variant="button" color="primary">
                Toca para correr
              </TelText>
            </PressableScale>
            <TelText variant="caption" color="accentSoft" align="center">
              {character.name} · {character.perk}
            </TelText>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <ControlButton icon="chevronLeft" label="Izquierda" onPress={() => input('left')} />
        <ControlButton icon="chevronUp" label="Saltar" wide onPress={() => input('jump')} />
        <ControlButton icon="chevronRight" label="Derecha" onPress={() => input('right')} />
      </View>

      <PauseSheet
        visible={paused && phase !== 'over'}
        title="¿Salir de la carrera?"
        body="La carrera está detenida. Si sales ahora, no se guardan los paquetes de esta carrera."
        stayLabel="Seguir corriendo"
        leaveLabel="Salir"
        onStay={() => setPaused(false)}
        onLeave={() => {
          setPaused(false);
          onLeave();
        }}
      />
    </View>
  );
}

function ControlButton({ icon, label, wide = false, onPress }: { icon: IconName; label: string; wide?: boolean; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPressIn={onPress} scaleTo={0.94} style={[styles.control, wide && styles.controlWide]}>
      <TelIcon name={icon} size={28} color={colors.primary} strokeWidth={2.6} />
      {wide && (
        <TelText variant="button" color="primary">
          {label}
        </TelText>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: spacing.xs,
  },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  lives: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minWidth: 76,
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  counterBoost: {
    backgroundColor: '#F2CE63',
  },
  track: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: radius.lg,
  },
  sprite: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  stripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accentSoft,
  },
  shadow: {
    position: 'absolute',
    left: 0,
    top: 0,
    backgroundColor: colors.black,
  },
  shieldRing: {
    ...StyleSheet.absoluteFill,
    borderWidth: 3,
    borderColor: colors.accent,
    backgroundColor: 'rgba(111, 179, 217, 0.16)',
  },
  say: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    right: spacing.xs,
  },
  readyLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: 'rgba(7, 31, 49, 0.55)',
  },
  readyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.cream,
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  control: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 60,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  controlWide: {
    flex: 1.5,
    backgroundColor: colors.cream,
  },
});
