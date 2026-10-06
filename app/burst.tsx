import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming, ZoomIn } from 'react-native-reanimated';
import { AppHeader } from '@/components/AppHeader';
import { Tag } from '@/components/Chips';
import { IconButton } from '@/components/IconButton';
import { Celebration } from '@/components/feedback/Celebration';
import { Illustration } from '@/components/graphics/Illustration';
import { Medallion } from '@/components/graphics/Medallion';
import { Rutix } from '@/components/graphics/Rutix';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { AccountGate } from '@/features/account/AccountGate';
import { TelButton } from '@/components/TelButton';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { getAchievement } from '@/data/achievements';
import { coachLine } from '@/data/coachLines';
import { CoachBubble, useCoachEnabled } from '@/features/coach/CoachBubble';
import { PauseSheet, useBackToPause } from '@/features/coach/PauseSheet';
import { DAILY_BONUS, DAILY_ROUNDS, dailyKey, dailySeed, isDailyDone } from '@/features/burst/daily';
import { getMicroGameGuide } from '@/features/burst/guides';
import { getMicroGame, pickBurstGames, roundDuration } from '@/features/burst/registry';
import type { MicroGameDefinition } from '@/features/burst/types';
import { HelpButton, TutorialSheet } from '@/features/tutorial/TutorialSheet';
import { tutorials } from '@/features/tutorial/tutorials';
import { feedbackHeavy, feedbackSuccess, feedbackWarning } from '@/lib/feedback';
import { now } from '@/lib/clock';
import { formatNumber } from '@/lib/format';
import { mulberry32 } from '@/route/random';
import { useEntering, useMotionEnabled } from '@/lib/motion';
import { PACE_ACCELERATION, paceFactor } from '@/lib/pace';
import { loadResults, recordGameResult } from '@/storage/profile';
import { useSettings, type GamePace } from '@/storage/settings';
import { useTutorial } from '@/storage/tutorials';
import { colors, radius, spacing } from '@/theme';
import type { GameOutcome, MicroGameId } from '@/types/game';

const ROUNDS = 6;
const FOCUS_ROUNDS = 3;
const LIVES = 3;
const READY_GUARD_MS = 350;
const FEEDBACK_MS = 1150;
// Últimos segundos de la ronda: el reloj se pone rojo y Rutix avisa.
const HURRY_SECONDS = 5;

// Lo que dice Rutix antes de partir, según el ritmo elegido en Ajustes.
const introLines: Record<GamePace, string> = {
  calm: 'Lee con calma: cada ronda parte cuando tú tocas y el reloj va tranquilo.',
  normal: 'Cada ronda parte cuando tú tocas. ¡Concéntrate y a jugar!',
  fast: 'Elegiste el ritmo rápido: reloj corto y cada vez más veloz. ¡A volar!',
};

type Phase = 'intro' | 'ready' | 'playing' | 'feedback' | 'finished';

interface RoundResult {
  id: MicroGameId;
  correct: boolean;
}

interface BurstState {
  phase: Phase;
  games: MicroGameDefinition[];
  round: number;
  lives: number;
  score: number;
  results: RoundResult[];
  lastPoints: number;
  // Explicación breve de la última ronda (la dice Rutix).
  lastNote: string | null;
}

type Action =
  | { type: 'start'; games: MicroGameDefinition[] }
  | { type: 'play' }
  | { type: 'answer'; correct: boolean; bonus: number; secondsLeft: number; note?: string }
  | { type: 'advance' };

const initialState: BurstState = { phase: 'intro', games: [], round: 0, lives: LIVES, score: 0, results: [], lastPoints: 0, lastNote: null };

function reducer(state: BurstState, action: Action): BurstState {
  switch (action.type) {
    case 'start':
      return { ...initialState, phase: 'ready', games: action.games };
    case 'play':
      return state.phase === 'ready' ? { ...state, phase: 'playing' } : state;
    case 'answer': {
      if (state.phase !== 'playing') return state;
      const game = state.games[state.round];
      const points = action.correct ? 100 + action.bonus + action.secondsLeft * 10 : 0;
      return {
        ...state,
        phase: 'feedback',
        score: state.score + points,
        lives: action.correct ? state.lives : state.lives - 1,
        results: [...state.results, { id: game.id, correct: action.correct }],
        lastPoints: points,
        lastNote: action.note ?? null,
      };
    }
    case 'advance': {
      if (state.phase !== 'feedback') return state;
      const over = state.lives <= 0 || state.round + 1 >= state.games.length;
      return over ? { ...state, phase: 'finished' } : { ...state, phase: 'ready', round: state.round + 1 };
    }
    default:
      return state;
  }
}

// Ráfaga TEL: microjuegos encadenados, con vidas, pausa y un reloj que sigue el ritmo elegido.
export default function BurstScreen() {
  const { focus, diario } = useLocalSearchParams<{ focus?: string; diario?: string }>();
  const focusGame = focus ? getMicroGame(focus) : undefined;
  // Desafío diario: los mismos microjuegos para todos durante el día, con bono la primera vez.
  const daily = !focusGame && diario === '1';
  const coach = useCoachEnabled();
  // La primera vez, Rutix explica cómo funciona la ráfaga antes de empezar.
  const tutorial = useTutorial(focusGame ? null : 'burst');
  const [dailyDone, setDailyDone] = useState(false);
  const entering = useEntering();
  const motionEnabled = useMotionEnabled();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [best, setBest] = useState(0);
  const [outcome, setOutcome] = useState<GameOutcome | null>(null);
  const secondsRef = useRef(0);
  // Milisegundos que le quedan a la ronda (se conserva al pausar).
  const remainingRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const startedAt = useRef(0);
  const [runId, setRunId] = useState(0);
  const recorded = useRef(false);
  const timer = useSharedValue(1);
  const current = state.games[state.round];
  const { pace } = useSettings();
  const factor = paceFactor(pace);
  const acceleration = PACE_ACCELERATION[pace];
  const duration = current ? roundDuration(current.durationSeconds, state.round, Boolean(focusGame), factor, acceleration) : 0;

  useEffect(() => {
    void loadResults().then((results) => {
      setBest(results.filter((item) => item.gameId === 'burst').reduce((max, item) => Math.max(max, item.score), 0));
      setDailyDone(isDailyDone(results, dailyKey(new Date())));
    });
  }, []);

  const start = useCallback(() => {
    recorded.current = false;
    setOutcome(null);
    startedAt.current = now();
    setRunId((value) => value + 1);
    const games = focusGame
      ? Array.from({ length: FOCUS_ROUNDS }, () => focusGame)
      : daily
        ? pickBurstGames(DAILY_ROUNDS, mulberry32(dailySeed(new Date())))
        : pickBurstGames(ROUNDS);
    dispatch({ type: 'start', games });
    void feedbackHeavy();
  }, [daily, focusGame]);

  // Cada ronda parte cuando el jugador toca la pantalla: así alcanza a leer la instrucción.
  const readyAt = useRef(0);
  useEffect(() => {
    if (state.phase === 'ready') readyAt.current = now();
  }, [state.phase, state.round]);

  const play = useCallback(() => {
    // Ignora el mismo toque que cerró la ronda anterior.
    if (now() - readyAt.current < READY_GUARD_MS) return;
    setSecondsLeft(duration);
    dispatch({ type: 'play' });
  }, [duration]);

  // Cada ronda parte con el reloj completo…
  useEffect(() => {
    if (state.phase !== 'playing') return;
    remainingRef.current = duration * 1000;
    secondsRef.current = duration;
    timer.set(1);
  }, [duration, state.phase, state.round, timer]);

  // …y corre solo mientras no está en pausa.
  useEffect(() => {
    if (state.phase !== 'playing' || paused) return;
    const deadline = Date.now() + remainingRef.current;
    timer.set(withTiming(0, { duration: remainingRef.current, easing: Easing.linear }));
    const interval = setInterval(() => {
      const leftMs = Math.max(0, deadline - Date.now());
      const left = Math.ceil(leftMs / 1000);
      remainingRef.current = leftMs;
      secondsRef.current = left;
      setSecondsLeft(left);
      if (leftMs <= 0) {
        clearInterval(interval);
        void feedbackWarning();
        dispatch({ type: 'answer', correct: false, bonus: 0, secondsLeft: 0 });
      }
    }, 200);
    return () => {
      clearInterval(interval);
      remainingRef.current = Math.max(0, deadline - Date.now());
      cancelAnimation(timer);
    };
  }, [duration, paused, state.phase, state.round, timer]);

  const inRun = state.phase === 'ready' || state.phase === 'playing' || state.phase === 'feedback';
  const pause = useCallback(() => setPaused(true), []);
  useBackToPause(inRun && !paused, pause);

  // Solo el ritmo rápido avanza solo; en los demás el jugador toca "Continuar" cuando terminó de leer.
  useEffect(() => {
    if (state.phase !== 'feedback' || pace !== 'fast') return;
    const timeout = setTimeout(() => dispatch({ type: 'advance' }), FEEDBACK_MS);
    return () => clearTimeout(timeout);
  }, [pace, state.phase, state.round]);

  useEffect(() => {
    if (state.phase !== 'finished' || recorded.current) return;
    recorded.current = true;
    const won = [...new Set(state.results.filter((item) => item.correct).map((item) => item.id))];
    const correct = state.results.filter((item) => item.correct).length;
    const dailyBonus = daily && !dailyDone ? DAILY_BONUS : 0;
    void recordGameResult({
      gameId: 'burst',
      score: state.score + dailyBonus,
      accuracy: state.games.length ? correct / state.games.length : 0,
      durationSeconds: Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)),
      completedAt: new Date().toISOString(),
      metadata: { rounds: state.results.length, won: won.join(','), lives: state.lives, focus: focus ?? '', daily: daily ? dailyKey(new Date()) : '' },
    }).then(setOutcome);
  }, [daily, dailyDone, focus, state.games.length, state.lives, state.phase, state.results, state.score]);

  const onAnswer = useCallback(
    (correct: boolean, bonus = 0, note?: string) => {
      if (correct) void feedbackSuccess();
      else void feedbackWarning();
      // El tiempo sobrante se normaliza por el ritmo: jugar tranquilo no da más puntos.
      dispatch({ type: 'answer', correct, bonus, secondsLeft: Math.round(secondsRef.current / factor), note });
    },
    [factor],
  );

  const timerStyle = useAnimatedStyle(() => ({ width: `${timer.value * 100}%` }));

  const pauseSheet = (
    <PauseSheet
      visible={paused && inRun}
      title={focusGame ? '¿Salir de la práctica?' : '¿Salir de la ráfaga?'}
      body={
        state.phase === 'playing'
          ? 'El reloj está detenido. Si sales ahora, esta partida no suma puntos.'
          : 'Si sales ahora, esta partida no suma puntos. Puedes volver a intentarlo cuando quieras.'
      }
      leaveLabel="Salir"
      onStay={() => setPaused(false)}
      onLeave={() => {
        setPaused(false);
        router.back();
      }}
    />
  );

  if (state.phase === 'intro') {
    return (
      <Screen tone="dark" backdrop="signal" header={<AppHeader transparent onBack={() => router.back()} compact right={focusGame ? undefined : <HelpButton onPress={tutorial.open} />} />}>
        <Animated.View entering={entering.pop()} style={styles.introArt}>
          <Illustration name="burst" width={250} tone="dark" />
        </Animated.View>
        <View style={styles.introText}>
          <TelText variant="overline" color="accent" align="center">
            {focusGame ? 'Práctica de microjuego' : daily ? 'Desafío de hoy' : 'Microjuegos exprés'}
          </TelText>
          <TelText variant="hero" color="cream" align="center">
            {focusGame ? focusGame.title : daily ? 'Desafío diario' : 'Ráfaga TEL'}
          </TelText>
          <TelText variant="body" color="onDark" align="center">
            {focusGame
              ? focusGame.instruction
              : daily
                ? dailyDone
                  ? 'Ya completaste el desafío de hoy. Puedes repetirlo para practicar; el bono vuelve mañana.'
                  : `Los mismos ${DAILY_ROUNDS} microjuegos para todos, solo por hoy. Termínalo y suma +${DAILY_BONUS} puntos de bono.`
                : 'Microjuegos cortos, uno tras otro. Lee la instrucción con calma, juega y cuida tus 3 vidas.'}
          </TelText>
        </View>
        <View style={styles.pills}>
          <Pill icon="bolt" label={focusGame ? `${FOCUS_ROUNDS} rondas` : `${daily ? DAILY_ROUNDS : ROUNDS} microjuegos`} />
          <Pill icon="heart" label={`${LIVES} vidas`} />
          <Pill icon="timer" label={focusGame || acceleration === 0 ? 'A tu ritmo' : 'Cada vez más rápido'} />
        </View>
        {best > 0 && !focusGame && (
          <TelText variant="label" color="accentSoft" align="center" tabular>
            Tu récord: {formatNumber(best)} pts
          </TelText>
        )}
        {coach && (
          <CoachBubble mood="intro" size={64}>
            {introLines[pace]}
          </CoachBubble>
        )}
        <TelButton label="¡Empezar!" variant="cream" size="lg" iconRight="arrowRight" onPress={start} />
        <AccountGate />
        <TutorialSheet tutorial={tutorials.burst} visible={tutorial.visible} onClose={tutorial.close} />
      </Screen>
    );
  }

  if (state.phase === 'finished') {
    const correct = state.results.filter((item) => item.correct).length;
    const newRecord = !focusGame && state.score > best && best > 0;
    const unlocked = outcome?.newAchievements.map((id) => getAchievement(id)) ?? [];
    return (
      <Screen tone="dark" backdrop="orbits" header={<AppHeader transparent compact />}>
        <Celebration burstKey={correct >= Math.ceil(state.games.length / 2) ? runId : null} count={correct === state.games.length ? 44 : 28} />
        <View style={styles.finishHero}>
          <Rutix
            size={160}
            expression={state.lives <= 0 ? 'sad' : correct === state.games.length ? 'celebrate' : 'happy'}
            pose={state.lives <= 0 ? 'idle' : 'celebrate'}
            signal={state.lives <= 0 ? 1 : 4}
          />
          <TelText variant="overline" color="accent" align="center">
            {state.lives <= 0 ? '¡Sin vidas!' : 'Ráfaga completada'}
          </TelText>
          <TelText variant="display" color="cream" align="center" tabular>
            {formatNumber(state.score)}
          </TelText>
          <TelText variant="label" color="accentSoft" align="center">
            puntos · {correct} de {state.games.length} microjuegos
          </TelText>
          <View style={styles.rewardRow}>
            {daily && !dailyDone && <Tag tone="cream" icon="calendar" label={`Bono diario +${DAILY_BONUS}`} />}
            {newRecord && <Tag tone="cream" icon="crown" label="¡Nuevo récord!" />}
            {outcome && <Tag tone="glass" icon="sparkle" label={`+${outcome.xpGained} XP`} />}
            {outcome?.leveledUp && <Tag tone="cream" icon="rocket" label={`Nivel ${outcome.profile.level}`} />}
          </View>
        </View>
        <View style={styles.summary}>
          {state.results.map((result, index) => {
            const game = state.games[index];
            return (
              <View key={`${result.id}-${index}`} style={styles.summaryRow}>
                <View style={[styles.summaryIcon, { backgroundColor: result.correct ? colors.accent : colors.primary }]}>
                  <TelIcon name={game.icon} size={18} color={result.correct ? colors.primary : colors.slate} />
                </View>
                <TelText variant="label" color="cream" style={styles.flex}>
                  {game.title}
                </TelText>
                <TelIcon name={result.correct ? 'checkCircle' : 'closeCircle'} size={20} color={result.correct ? '#6BC59A' : '#E58A8A'} />
              </View>
            );
          })}
        </View>
        {unlocked.map((achievement) =>
          achievement ? (
            <View key={achievement.id} style={styles.unlock}>
              <Medallion glyph={achievement.glyph} tier={achievement.tier} size={44} />
              <View style={styles.flex}>
                <TelText variant="small" color="accent">
                  LOGRO DESBLOQUEADO
                </TelText>
                <TelText variant="label" color="cream">
                  {achievement.title}
                </TelText>
              </View>
            </View>
          ) : null,
        )}
        <View style={styles.actions}>
          <TelButton label="Jugar otra vez" variant="cream" icon="refresh" onPress={start} />
          <TelButton label="Volver" variant="outlineLight" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  if (!current) {
    return <Screen tone="dark" />;
  }
  const guide = getMicroGameGuide(current.id);

  if (state.phase === 'ready') {
    const faster = !focusGame && acceleration > 0 && state.round >= 2;
    return (
      <Screen tone="dark" backdrop="signal" scroll={false} contentStyle={styles.readyContent}>
        <View style={styles.topBar}>
          <Lives lives={state.lives} />
          <IconButton icon="pause" tone="dark" size={40} accessibilityLabel="Pausar" onPress={pause} />
        </View>
        <PressableScale accessibilityRole="button" accessibilityLabel={`${current.title}. ${current.instruction}. Toca para jugar`} onPress={play} scaleTo={0.98} style={styles.readyTap}>
        <Animated.View key={`ready-${state.round}`} entering={motionEnabled ? ZoomIn.springify().damping(12) : undefined} style={styles.ready}>
          <TelText variant="overline" color="accent" align="center">
            Ronda {state.round + 1} de {state.games.length}
          </TelText>
          <View style={styles.readyIcon}>
            <TelIcon name={current.icon} size={44} color={colors.primary} />
          </View>
          <TelText variant="hero" color="cream" align="center">
            {current.title}
          </TelText>
          <TelText variant="subtitle" color="accentSoft" align="center">
            {current.instruction}
          </TelText>
          <View style={styles.steps} accessible accessibilityLabel={`Cómo se juega. ${guide.steps.map((step, index) => `Paso ${index + 1}: ${step}`).join(' ')}`}>
            <TelText variant="small" color="accent" style={styles.stepsKicker}>
              CÓMO SE JUEGA
            </TelText>
            {guide.steps.map((step, index) => (
              <View key={step} style={styles.step}>
                <View style={styles.stepNumber}>
                  <TelText variant="small" color="primary">
                    {index + 1}
                  </TelText>
                </View>
                <TelText variant="caption" color="cream" style={styles.flex}>
                  {step}
                </TelText>
              </View>
            ))}
          </View>
          {faster && <Tag tone="cream" icon="bolt" label="¡Más rápido!" style={styles.fasterTag} />}
        </Animated.View>
        {coach && (
          <CoachBubble mood="tip" title="Pista de Rutix" size={64} style={styles.readyCoach}>
            {current.tip}
          </CoachBubble>
        )}
        </PressableScale>
        <PressableScale accessibilityRole="button" accessibilityLabel="Jugar" haptic onPress={play} style={styles.readyCta}>
          <TelIcon name="tap" size={20} color={colors.primary} />
          <TelText variant="label" color="primary">
            Toca para jugar · {duration} s
          </TelText>
        </PressableScale>
        {pauseSheet}
      </Screen>
    );
  }

  const Game = current.Component;
  return (
    <Screen tone="dark" backdrop="none" scroll={false} contentStyle={styles.playContent}>
      <View style={styles.topBar}>
        <Lives lives={state.lives} />
        <TelText variant="label" color="accentSoft">
          {state.round + 1}/{state.games.length}
        </TelText>
        <View style={styles.topRight}>
          <TelText variant="label" color="cream" tabular>
            {formatNumber(state.score)} pts
          </TelText>
          <IconButton icon="pause" tone="dark" size={40} accessibilityLabel="Pausar" onPress={pause} />
        </View>
      </View>
      <View style={styles.timerRow}>
        {coach && (
          // Rutix mira el reloj contigo: se alarma cuando queda poco.
          <Rutix
            size={40}
            expression={state.phase === 'playing' && secondsLeft <= HURRY_SECONDS ? 'alert' : 'focus'}
            reactKey={state.phase === 'playing' && secondsLeft <= HURRY_SECONDS ? `apuro-${state.round}` : `ronda-${state.round}`}
            animated={false}
            accessibilityLabel=""
          />
        )}
        <View style={styles.timerTrack}>
          <Animated.View style={[styles.timerFill, secondsLeft <= 3 && styles.timerDanger, timerStyle]} />
        </View>
        <View style={[styles.seconds, secondsLeft <= 3 && styles.secondsDanger]}>
          <TelText variant="label" color="cream" tabular>
            {secondsLeft}s
          </TelText>
        </View>
      </View>
      <TelText variant="bodyStrong" color="accentSoft" align="center">
        {current.instruction}
      </TelText>
      <View style={styles.gameArea}>
        <Game
          key={`${state.round}-${current.id}`}
          durationSeconds={duration}
          level={focusGame ? 0 : state.round}
          pace={factor}
          active={state.phase === 'playing' && !paused}
          onAnswer={onAnswer}
        />
        {paused && state.phase === 'playing' && (
          // En pausa el tablero se tapa: el reloj detenido no regala tiempo para pensar.
          <View style={styles.pauseCover}>
            <TelIcon name="pause" size={44} color={colors.accentSoft} />
            <TelText variant="subtitle" color="cream" align="center">
              Juego en pausa
            </TelText>
          </View>
        )}
        {state.phase === 'feedback' && (
          <View style={styles.overlay} pointerEvents="box-none">
            <PressableScale accessibilityRole="button" accessibilityLabel="Continuar" onPress={() => dispatch({ type: 'advance' })} scaleTo={0.99} style={styles.overlayInner}>
              {coach ? (
                <Animated.View entering={motionEnabled ? ZoomIn.springify().damping(10) : undefined}>
                  <Rutix
                    size={150}
                    expression={state.lastPoints > 0 ? (state.lastPoints >= 200 ? 'celebrate' : 'happy') : 'worried'}
                    pose={state.lastPoints > 0 ? (state.lastPoints >= 200 ? 'celebrate' : 'thumbsUp') : 'shrug'}
                    signal={state.lastPoints > 0 ? 4 : 1}
                  />
                </Animated.View>
              ) : (
                <Animated.View entering={motionEnabled ? ZoomIn.springify().damping(10) : undefined} style={[styles.verdict, { backgroundColor: state.lastPoints > 0 ? '#6BC59A' : colors.danger }]}>
                  <TelIcon name={state.lastPoints > 0 ? 'check' : 'close'} size={64} color={colors.white} strokeWidth={3.4} />
                </Animated.View>
              )}
              <TelText variant="title" color="cream" align="center" accessibilityLiveRegion="assertive">
                {state.lastPoints > 0 ? '¡Conexión establecida!' : secondsLeft === 0 ? '¡Se acabó el tiempo!' : '¡Paquete perdido!'}
              </TelText>
              <TelText variant="subtitle" color={state.lastPoints > 0 ? 'accent' : 'dangerSoft'} align="center">
                {state.lastPoints > 0 ? `+${state.lastPoints} pts` : '−1 vida'}
              </TelText>
              {coach && (
                <TelText variant="label" color="accentSoft" align="center">
                  {coachLine(state.lastPoints > 0 ? 'good' : 'bad', state.round + state.score)}
                </TelText>
              )}
              <View style={styles.overlayNote}>
                <TelText variant="small" color="accent" align="center" style={styles.stepsKicker}>
                  {state.lastPoints > 0 ? 'LO QUE APRENDISTE' : 'PARA LA PRÓXIMA'}
                </TelText>
                <TelText variant="body" color="cream" align="center">
                  {state.lastNote ?? guide.learn}
                </TelText>
              </View>
              {pace !== 'fast' && (
                <View style={styles.overlayCta}>
                  <TelText variant="button" color="primary">
                    Continuar
                  </TelText>
                  <TelIcon name="arrowRight" size={20} color={colors.primary} />
                </View>
              )}
            </PressableScale>
          </View>
        )}
      </View>
      {pauseSheet}
    </Screen>
  );
}

function Lives({ lives }: { lives: number }) {
  return (
    <View style={styles.lives} accessibilityLabel={`${lives} vidas`}>
      {Array.from({ length: LIVES }, (_, index) => (
        <TelIcon key={index} name={index < lives ? 'heartSolid' : 'heart'} size={22} color={index < lives ? '#F4B8C4' : colors.secondary} />
      ))}
    </View>
  );
}

function Pill({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={styles.pill}>
      <View style={styles.pillIcon}>
        <TelIcon name={icon} size={18} color={colors.primary} />
      </View>
      <TelText variant="small" color="cream" align="center">
        {label}
      </TelText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  introArt: {
    alignItems: 'center',
  },
  introText: {
    gap: spacing.sm,
  },
  pills: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
  pillIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyContent: {
    justifyContent: 'space-between',
  },
  ready: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  steps: {
    alignSelf: 'stretch',
    gap: 6,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(18, 61, 92, 0.85)',
  },
  stepsKicker: {
    letterSpacing: 1.2,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  readyIcon: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.cream,
    borderWidth: 6,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fasterTag: {
    alignSelf: 'center',
  },
  readyTap: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  readyCoach: {
    alignSelf: 'stretch',
  },
  overlayNote: {
    minHeight: 48,
    maxWidth: 330,
    gap: 4,
    justifyContent: 'center',
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(18, 61, 92, 0.9)',
  },
  overlayCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 52,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
  },
  readyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: spacing.xs,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.cream,
  },
  playContent: {
    gap: spacing.sm,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pauseCover: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryDeep,
  },
  lives: {
    flexDirection: 'row',
    gap: 4,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timerTrack: {
    flex: 1,
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
  },
  timerFill: {
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  timerDanger: {
    backgroundColor: colors.danger,
  },
  seconds: {
    minWidth: 52,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondsDanger: {
    backgroundColor: colors.danger,
  },
  gameArea: {
    flex: 1,
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    // Casi opaco: el tablero de atrás no debe competir con la explicación.
    backgroundColor: 'rgba(7, 31, 49, 0.95)',
    borderRadius: radius.xl,
  },
  overlayInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  verdict: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishHero: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  rewardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  summary: {
    gap: 6,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(18, 61, 92, 0.85)',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  actions: {
    gap: spacing.sm,
    marginTop: 'auto',
  },
});
