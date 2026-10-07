import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentType, type PropsWithChildren } from 'react';
import { AppState, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, ZoomIn } from 'react-native-reanimated';
import { ProgressBar } from '@/components/feedback/Progress';
import { Rutix } from '@/components/graphics/Rutix';
import { TelButton } from '@/components/TelButton';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { coachMoodForScore, coachSummaryLine } from '@/data/coachLines';
import { CoachBubble, useCoachEnabled } from '@/features/coach/CoachBubble';
import { now as clockNow } from '@/lib/clock';
import { useMotionEnabled } from '@/lib/motion';
import { colors, radius, spacing } from '@/theme';

export interface StationGameResult {
  score: number;
  accuracy: number;
}

export interface StationGameProps {
  // Ritmo de juego: multiplica los tiempos (1 = original). En la ruta en vivo lo fija el stand para todos.
  pace?: number;
  seed: number;
  // Hora local (ms) en que el juego debe cerrarse sí o sí (B215 va sincronizado con el grupo).
  deadline?: number | null;
  onComplete: (result: StationGameResult) => void;
}

// ——— Reloj del juego ———
// Los tiempos de cada etapa se miden con un reloj que se puede detener: mientras el jugador lee una
// explicación, o la app queda en segundo plano durante una práctica, el tiempo de la etapa no corre.
// El cierre que impone la ruta en vivo no usa este reloj sino la hora real (ver useDeadline).
// Hay un solo juego de estación abierto a la vez, así que el reloj es uno.

let pausedAt: number | null = null;
let pausedTotal = 0;
const pauseListeners = new Set<() => void>();

// Hora del juego en ms: avanza como la hora real, salvo mientras está en pausa.
export function gameNow(): number {
  return (pausedAt ?? clockNow()) - pausedTotal;
}

function isGamePaused(): boolean {
  return pausedAt !== null;
}

function setGamePaused(paused: boolean): void {
  if (paused === isGamePaused()) return;
  if (paused) {
    pausedAt = clockNow();
  } else {
    pausedTotal += clockNow() - (pausedAt as number);
    pausedAt = null;
  }
  pauseListeners.forEach((listener) => listener());
}

function subscribePause(listener: () => void): () => void {
  pauseListeners.add(listener);
  return () => {
    pauseListeners.delete(listener);
  };
}

export function useGamePaused(): boolean {
  return useSyncExternalStore(subscribePause, isGamePaused, isGamePaused);
}

// Hora del juego que se actualiza sola mientras el juego está activo.
export function useNow(active: boolean, intervalMs = 250): number {
  const [now, setNow] = useState(() => gameNow());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(gameNow()), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs]);
  return now;
}

// Ejecuta `onTime` cuando el reloj del juego llega a `at` (null: nada pendiente). En pausa no corre y
// al reanudar se reprograma con el tiempo que quedaba. `token` vuelve a armarlo aunque `at` no cambie.
export function useGameTimeout(at: number | null | undefined, onTime: () => void, token: unknown = null): void {
  const callback = useRef(onTime);
  useEffect(() => {
    callback.current = onTime;
  });
  const paused = useGamePaused();
  useEffect(() => {
    if (at === null || at === undefined || paused) return;
    const timer = setTimeout(() => callback.current(), Math.max(0, at - gameNow()));
    return () => clearTimeout(timer);
  }, [at, paused, token]);
}

// Entrega el resultado una sola vez, aunque el cierre forzado y el botón de enviar coincidan.
export function useSubmitOnce(onComplete: (result: StationGameResult) => void): (result: StationGameResult) => void {
  const done = useRef(false);
  return useCallback(
    (result: StationGameResult) => {
      if (done.current) return;
      done.current = true;
      onComplete(result);
    },
    [onComplete],
  );
}

// Cierra el juego a la hora indicada (hora local en ms). En la ruta en vivo la decide el stand: cuando
// el grupo avanza, el juego abierto se cierra solo y entrega lo logrado hasta ese momento.
export function useDeadline(deadline: number | null | undefined, onDeadline: () => void): void {
  const callback = useRef(onDeadline);
  useEffect(() => {
    callback.current = onDeadline;
  });
  useEffect(() => {
    if (!deadline) return;
    const timer = setTimeout(() => callback.current(), Math.max(0, deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [deadline]);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface HudProps {
  stage: number;
  stages: number;
  title: string;
  score: number;
  secondsLeft: number | null;
  totalSeconds?: number;
  accent?: string;
}

// Barra superior del juego: etapa, puntaje y tiempo.
export function StationHud({ stage, stages, title, score, secondsLeft, totalSeconds, accent = colors.accent }: HudProps) {
  const urgent = secondsLeft !== null && secondsLeft <= 5;
  return (
    <View style={styles.hud}>
      <View style={styles.hudRow}>
        <View style={styles.flex}>
          <TelText variant="small" color="accentSoft" style={styles.kicker}>
            ETAPA {stage} DE {stages}
          </TelText>
          <TelText variant="subtitle" color="cream" numberOfLines={1}>
            {title}
          </TelText>
        </View>
        <View style={styles.scoreBox} accessibilityLabel={`${score} puntos`}>
          <TelText variant="heading" color="cream" tabular>
            {score}
          </TelText>
          <TelText variant="small" color="accentSoft">
            pts
          </TelText>
        </View>
        {secondsLeft !== null && (
          <View style={[styles.timeBox, urgent && styles.timeUrgent]} accessibilityLabel={`${secondsLeft} segundos`}>
            <TelIcon name="timer" size={16} color={urgent ? colors.white : colors.cream} />
            <TelText variant="label" color={urgent ? 'white' : 'cream'} tabular>
              {secondsLeft}s
            </TelText>
          </View>
        )}
      </View>
      {secondsLeft !== null && totalSeconds ? (
        <ProgressBar progress={clamp(secondsLeft / totalSeconds, 0, 1)} color={urgent ? colors.danger : accent} trackColor={colors.primarySoft} height={5} />
      ) : null}
    </View>
  );
}

// ——— Avanzar al ritmo del jugador ———
// Las etapas no saltan solas tras una explicación: piden "Continuar" y el jugador decide cuándo seguir.

type AskContinue = (action: () => void, label?: string) => void;

interface ContinueApi {
  ask: AskContinue;
  cancel: () => void;
}

const ContinueContext = createContext<ContinueApi>({ ask: (action) => action(), cancel: () => undefined });

const PaceContext = createContext(1);

// Multiplicador de tiempo del juego en curso (lo entrega withContinue desde la prop `pace`).
export function usePace(): number {
  return useContext(PaceContext);
}

export function useAskContinue(): AskContinue {
  return useContext(ContinueContext).ask;
}

// `pausable`: el juego no tiene un cierre impuesto por la ruta en vivo, así que puede esperar al jugador.
function ContinueHost({ children, pausable }: PropsWithChildren<{ pausable: boolean }>) {
  const motion = useMotionEnabled();
  const [pending, setPending] = useState<{ action: () => void; label: string } | null>(null);
  // El jugador salió de la app en medio del juego: queda en pausa hasta que él lo reanuda.
  const [away, setAway] = useState(false);
  const ask = useCallback<AskContinue>((action, label = 'Continuar') => setPending({ action, label }), []);
  const cancel = useCallback(() => setPending(null), []);
  const api = useMemo(() => ({ ask, cancel }), [ask, cancel]);

  // Mientras hay una explicación en pantalla (o el jugador no está), el reloj del juego no corre.
  useEffect(() => {
    setGamePaused(pending !== null || away);
  }, [away, pending]);
  // Al cerrar el juego el reloj queda corriendo para el siguiente.
  useEffect(() => () => setGamePaused(false), []);

  useEffect(() => {
    if (!pausable) return;
    const pause = () => setAway(true);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') pause();
    });
    const page = Platform.OS === 'web' ? (globalThis as { document?: { visibilityState?: string; addEventListener(type: string, listener: () => void): void; removeEventListener(type: string, listener: () => void): void } }).document : undefined;
    const onVisibility = () => {
      if (page?.visibilityState === 'hidden') pause();
    };
    page?.addEventListener('visibilitychange', onVisibility);
    return () => {
      subscription.remove();
      page?.removeEventListener('visibilitychange', onVisibility);
    };
  }, [pausable]);

  return (
    <ContinueContext.Provider value={api}>
      <View style={styles.continueHost}>
        <View style={styles.continueGame}>{children}</View>
        {away && pausable && (
          <View style={styles.pauseLayer} accessibilityViewIsModal>
            <View style={styles.pauseCard}>
              <TelIcon name="pause" size={30} color={colors.cream} />
              <TelText variant="subtitle" color="cream" align="center">
                Juego en pausa
              </TelText>
              <TelText variant="caption" color="accentSoft" align="center">
                Saliste un momento. El tiempo no corrió: sigues donde quedaste.
              </TelText>
              <TelButton label="Seguir jugando" variant="cream" icon="play" onPress={() => setAway(false)} />
            </View>
          </View>
        )}
        {pending && (
          <Animated.View entering={motion ? FadeInDown.duration(180) : undefined} style={styles.continueBar}>
            <TelButton
              label={pending.label}
              variant="cream"
              iconRight="arrowRight"
              onPress={() => {
                setPending(null);
                pending.action();
              }}
            />
          </Animated.View>
        )}
      </View>
    </ContinueContext.Provider>
  );
}

// Envuelve un juego de estación con el botón "Continuar" compartido por sus etapas.
export function withContinue<P extends { pace?: number; deadline?: number | null }>(Game: ComponentType<P>): ComponentType<P> {
  function WithContinue(props: P) {
    return (
      <PaceContext.Provider value={props.pace && props.pace > 0 ? props.pace : 1}>
        <ContinueHost pausable={props.deadline === null || props.deadline === undefined}>
          <Game {...props} />
        </ContinueHost>
      </PaceContext.Provider>
    );
  }
  WithContinue.displayName = `WithContinue(${Game.displayName ?? Game.name ?? 'Game'})`;
  return WithContinue;
}

interface BannerProps {
  index: number;
  title: string;
  body: string;
  icon: IconName;
  accent?: string;
  onDone: () => void;
}

// Presentación de cada etapa: queda en pantalla hasta que el jugador la toca (se lee con calma).
export function StageBanner({ index, title, body, icon, accent = colors.accent, onDone }: BannerProps) {
  const motion = useMotionEnabled();
  const coach = useCoachEnabled();
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = clockNow();
  }, []);
  // Evita que el mismo toque que cerró la pantalla anterior salte esta presentación.
  function start() {
    if (clockNow() - shownAt.current < 350) return;
    onDone();
  }
  return (
    <Animated.View entering={motion ? FadeIn.duration(200) : undefined} exiting={motion ? FadeOut.duration(160) : undefined} style={styles.bannerWrap}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Etapa ${index}: ${title}. ${body} Toca para empezar`} onPress={start} style={styles.banner}>
        {coach ? (
          <Animated.View entering={motion ? ZoomIn.springify().damping(12) : undefined} style={styles.bannerRutix}>
            <Rutix size={124} expression="happy" pose="point" />
            <View style={[styles.bannerBadge, { backgroundColor: accent }]}>
              <TelIcon name={icon} size={24} color={colors.primary} />
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={motion ? ZoomIn.springify().damping(12) : undefined} style={[styles.bannerIcon, { backgroundColor: accent }]}>
            <TelIcon name={icon} size={40} color={colors.primary} />
          </Animated.View>
        )}
        <TelText variant="overline" color="accent" align="center">
          Etapa {index}
        </TelText>
        <TelText variant="title" color="cream" align="center">
          {title}
        </TelText>
        <TelText variant="body" color="accentSoft" align="center" style={styles.bannerBody}>
          {body}
        </TelText>
        <View style={[styles.bannerCta, { borderColor: accent }]}>
          <TelIcon name="tap" size={18} color={colors.cream} />
          <TelText variant="label" color="cream">
            Toca para empezar
          </TelText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export interface ResultRow {
  label: string;
  value: number;
  max: number;
  icon: IconName;
}

interface ResultProps {
  title: string;
  message: string;
  rows: ResultRow[];
  total: number;
  learned: string;
  accent?: string;
  submitLabel?: string;
  onSubmit: () => void;
}

export function StationSummary({ title, message, rows, total, learned, accent = colors.accent, submitLabel = 'Enviar mi puntaje', onSubmit }: ResultProps) {
  // Si el tiempo cerró el juego con un "Continuar" pendiente, ya no corresponde mostrarlo.
  const { cancel } = useContext(ContinueContext);
  const coach = useCoachEnabled();
  const ratio = clamp(total / 1000, 0, 1);
  useEffect(() => {
    cancel();
  }, [cancel]);
  return (
    <Animated.View entering={FadeIn.duration(260)} style={styles.summary}>
      {coach && (
        <CoachBubble mood={coachMoodForScore(ratio)} tone={ratio >= 0.45 ? 'good' : 'info'} size={76}>
          {coachSummaryLine(ratio)}
        </CoachBubble>
      )}
      <View style={styles.summaryHead}>
        <TelText variant="overline" color="accent" align="center">
          {title}
        </TelText>
        <TelText variant="display" color="cream" align="center" tabular>
          {total}
        </TelText>
        <TelText variant="label" color="accentSoft" align="center">
          {message}
        </TelText>
      </View>
      <View style={styles.rows}>
        {rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: accent }]}>
              <TelIcon name={row.icon} size={18} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <TelText variant="label" color="cream">
                {row.label}
              </TelText>
              <ProgressBar progress={row.max ? clamp(row.value / row.max, 0, 1) : 0} color={accent} trackColor={colors.primary} height={5} />
            </View>
            <TelText variant="label" color="cream" tabular>
              {row.value}/{row.max}
            </TelText>
          </View>
        ))}
      </View>
      <View style={styles.learned}>
        <TelIcon name="lightbulb" size={20} color={colors.cream} />
        <TelText variant="caption" color="cream" style={styles.flex}>
          {learned}
        </TelText>
      </View>
      <TelButton label={submitLabel} variant="cream" iconRight="send" onPress={onSubmit} />
    </Animated.View>
  );
}

export function GameBoard({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.board, style]}>{children}</View>;
}

// Pista o reacción durante el juego. Con "Rutix en los juegos" activo la dice Rutix en una burbuja.
export function Hint({ children, tone = 'info' }: PropsWithChildren<{ tone?: 'info' | 'good' | 'bad' }>) {
  const coach = useCoachEnabled();
  if (coach) {
    return (
      <CoachBubble mood={tone === 'good' ? 'good' : tone === 'bad' ? 'bad' : 'tip'} tone={tone} size={44}>
        {children}
      </CoachBubble>
    );
  }
  return <PlainHint tone={tone}>{children}</PlainHint>;
}

function PlainHint({ children, tone = 'info' }: PropsWithChildren<{ tone?: 'info' | 'good' | 'bad' }>) {
  const palette = tone === 'good' ? '#1F5E43' : tone === 'bad' ? '#6E2A2A' : 'rgba(167,212,237,0.12)';
  return (
    <Animated.View entering={FadeIn.duration(160)} style={[styles.hint, { backgroundColor: palette }]}>
      <TelText variant="caption" color="cream" align="center">
        {children}
      </TelText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    gap: 4,
  },
  kicker: {
    letterSpacing: 1.2,
  },
  hud: {
    gap: 8,
  },
  hudRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scoreBox: {
    alignItems: 'center',
    minWidth: 58,
  },
  timeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  timeUrgent: {
    backgroundColor: colors.danger,
  },
  bannerWrap: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    backgroundColor: 'rgba(7, 31, 49, 0.94)',
    justifyContent: 'center',
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(167, 212, 237, 0.25)',
  },
  banner: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  bannerIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  bannerBody: {
    maxWidth: 320,
  },
  bannerRutix: {
    width: 124,
    height: 124,
  },
  bannerBadge: {
    position: 'absolute',
    right: -8,
    bottom: 4,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.primaryDeep,
  },
  bannerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  continueHost: {
    flex: 1,
    gap: spacing.sm,
  },
  continueGame: {
    flex: 1,
  },
  continueBar: {
    paddingBottom: spacing.xs,
  },
  pauseLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(6, 26, 41, 0.9)',
    zIndex: 20,
  },
  pauseCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
  summary: {
    gap: spacing.md,
  },
  summaryHead: {
    gap: 4,
    alignItems: 'center',
  },
  rows: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  learned: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(244, 236, 215, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 236, 215, 0.25)',
  },
  board: {
    borderRadius: radius.lg,
    backgroundColor: 'rgba(18, 61, 92, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(167, 212, 237, 0.2)',
    overflow: 'hidden',
  },
  hint: {
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
});
