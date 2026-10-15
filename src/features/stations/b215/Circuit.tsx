import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Celebration } from '@/components/feedback/Celebration';
import { ProgressBar } from '@/components/feedback/Progress';
import { DeviceArt } from '@/components/graphics/DeviceArt';
import { TelButton } from '@/components/TelButton';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { feedbackSuccess, feedbackWarning } from '@/lib/feedback';
import { useMotionEnabled } from '@/lib/motion';
import { colors, radius, spacing } from '@/theme';
import { clamp, gameNow, StationSummary, useDeadline, useGameTimeout, useNow, usePace, useSubmitOnce, type StationGameProps } from '../kit';
import { pickB215Rounds } from './pool';
import type { B215Round, B215Track, RoundResult } from './types';

// Circuito de la sala B215: tres rondas cortas y muy claras, una por cada lado de la carrera (redes,
// hardware o telecomunicaciones, y software). Cada una se presenta antes de jugarla, lleva su propio tiempo
// y deja su resultado; al final se suman hasta 1000 puntos.

export const B215_ROUND_COUNT = 3;
const ACCENT = '#6FB3D9';
const STAR = '#F2CE63';
// La ruta en vivo juega en nivel normal.
const LEVEL = 1;
// Si al cerrar el juego la ronda no entrega su resultado en este tiempo, se sigue sin ella.
const FORCE_WAIT_MS = 700;

// Cada lado de la carrera tiene su color (los mismos de los pilares de la app) y su ícono.
const TRACKS: Record<B215Track, { label: string; color: string; icon: IconName }> = {
  redes: { label: 'Redes', color: '#4FB38A', icon: 'network' },
  hardware: { label: 'Hardware', color: '#E0B84A', icon: 'circuit' },
  telecom: { label: 'Telecom', color: '#6FB3D9', icon: 'antenna' },
  software: { label: 'Software', color: '#E58A5A', icon: 'code' },
};

const trackOf = (round: B215Round) => TRACKS[round.track ?? 'redes'];

function tint(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  return `rgba(${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)}, ${alpha})`;
}

// Puntaje máximo de cada ronda: reparte 1000 entre las rondas que toquen (333 + 333 + 334 con tres).
export function roundMax(count: number, index: number): number {
  const base = Math.floor(1000 / Math.max(1, count));
  return index === count - 1 ? 1000 - base * (count - 1) : base;
}

type Phase = 'intro' | 'play' | 'result' | 'summary';

interface Played {
  points: number;
  ratio: number;
  accuracy: number;
  detail: string;
}

export function B215Circuit({ seed, groupSeed, pace: paceProp, deadline, onComplete }: StationGameProps) {
  const contextPace = usePace();
  const pace = paceProp && paceProp > 0 ? paceProp : contextPace;
  // Todo el grupo juega las mismas rondas (groupSeed); cada jugador tiene su propio tablero (seed).
  const [rounds] = useState(() => pickB215Rounds(B215_ROUND_COUNT, groupSeed ?? seed));
  const count = rounds.length;
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>(count > 0 ? 'intro' : 'summary');
  const [played, setPlayed] = useState<(Played | null)[]>(() => rounds.map(() => null));
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  const [forced, setForced] = useState(false);
  const submitOnce = useSubmitOnce(onComplete);
  // Lo último que se sabe, para el aviso de la ronda y el cierre forzado (que llegan desde efectos).
  const live = useRef({ index, phase, forced });
  useLayoutEffect(() => {
    live.current = { index, phase, forced };
  });

  const total = played.reduce((sum, item) => sum + (item?.points ?? 0), 0);
  const accuracy = count > 0 ? played.reduce((sum, item) => sum + (item?.accuracy ?? 0), 0) / count : 0;
  const submit = useCallback(() => submitOnce({ score: Math.min(1000, total), accuracy: clamp(accuracy, 0, 1) }), [accuracy, submitOnce, total]);

  // El tiempo de la ronda corre con el reloj del juego: se detiene mientras se lee un «Continuar» o se sale de la app.
  useGameTimeout(phase === 'play' && !timeUp ? endsAt : null, () => setTimeUp(true));

  // Cierre que impone la ruta en vivo: la ronda en curso entrega lo hecho hasta ahora, las que faltan cuentan 0.
  useDeadline(deadline, () => {
    const playing = live.current.phase === 'play';
    live.current = { ...live.current, forced: true, phase: playing ? 'play' : 'summary' };
    setForced(true);
    if (playing) setTimeUp(true);
    else setPhase('summary');
  });

  useEffect(() => {
    if (!forced || phase !== 'play') return;
    const timer = setTimeout(() => setPhase('summary'), FORCE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [forced, phase]);

  useEffect(() => {
    if (forced && phase === 'summary') submit();
  }, [forced, phase, submit]);

  const handleDone = useCallback(
    (result: RoundResult) => {
      const at = live.current;
      if (at.phase !== 'play') return;
      const score = clamp(Number.isFinite(result.score) ? result.score : 0, 0, 1);
      const item: Played = {
        points: Math.round(score * roundMax(count, at.index)),
        ratio: score,
        accuracy: clamp(Number.isFinite(result.accuracy) ? result.accuracy : 0, 0, 1),
        detail: result.detail,
      };
      const following: Phase = at.forced ? 'summary' : 'result';
      live.current = { ...at, phase: following };
      setPlayed((list) => list.map((value, position) => (position === at.index ? item : value)));
      setPhase(following);
      void (score >= 0.5 ? feedbackSuccess() : feedbackWarning());
    },
    [count],
  );

  const round: B215Round | undefined = rounds[index];

  function start() {
    if (!round) return;
    setTimeUp(false);
    setEndsAt(gameNow() + Math.round(round.seconds * pace * 1000));
    setPhase('play');
  }

  function next() {
    setEndsAt(null);
    setTimeUp(false);
    if (index + 1 < count) {
      setIndex(index + 1);
      setPhase('intro');
    } else {
      setPhase('summary');
    }
  }

  if (phase === 'summary' || !round) {
    const ratio = clamp(total / 1000, 0, 1);
    return (
      <View style={styles.fill}>
        <ScrollView style={styles.fill} contentContainerStyle={styles.summaryContent} showsVerticalScrollIndicator={false}>
          <StationSummary
            title="Circuito B215"
            total={total}
            message={ratio >= 0.75 ? '¡Circuito impecable!' : ratio >= 0.45 ? '¡Buen circuito!' : '¡A practicar más!'}
            accent={ACCENT}
            rows={rounds.map((item, position) => ({ label: `${trackOf(item).label} · ${item.title}`, value: played[position]?.points ?? 0, max: roundMax(count, position), icon: item.icon }))}
            learned={rounds.map((item) => item.learned).join(' ')}
            onSubmit={submit}
          />
        </ScrollView>
        {ratio >= 0.6 && <Celebration burstKey={count + 1} count={40} />}
      </View>
    );
  }

  const result = played[index];
  const Round = round.Component;
  return (
    <View style={styles.fill}>
      {phase === 'play' && endsAt !== null && (
        <PlayHud index={index} count={count} color={trackOf(round).color} endsAt={endsAt} totalMs={Math.round(round.seconds * pace * 1000)} points={total} />
      )}
      {phase === 'intro' && <IntroCard rounds={rounds} round={round} index={index} pace={pace} onStart={start} />}
      {phase === 'play' && (
        <View style={styles.stage}>
          <Round key={`${round.id}:${index}`} seed={(seed + index) >>> 0} level={LEVEL} pace={pace} timeUp={timeUp} onDone={handleDone} />
        </View>
      )}
      {phase === 'result' && result && <ResultCard rounds={rounds} round={round} item={result} index={index} max={roundMax(count, index)} onNext={next} />}
    </View>
  );
}

interface HudProps {
  index: number;
  count: number;
  color: string;
  endsAt: number;
  totalMs: number;
  points: number;
}

// Barra compacta sobre la ronda: número de ronda (con el color de su lado), tiempo y puntos acumulados.
function PlayHud({ index, count, color, endsAt, totalMs, points }: HudProps) {
  const now = useNow(true, 250);
  const left = clamp(endsAt - now, 0, totalMs);
  const seconds = Math.ceil(left / 1000);
  const urgent = seconds <= 5;
  return (
    <View style={styles.hud}>
      <View style={[styles.hudRound, { backgroundColor: color }]} accessibilityLabel={`Ronda ${index + 1} de ${count}`}>
        <TelText variant="small" color="primary">
          RONDA {index + 1}/{count}
        </TelText>
      </View>
      <View style={styles.hudBar} accessibilityLabel={`${seconds} segundos`}>
        <ProgressBar progress={totalMs > 0 ? left / totalMs : 0} color={urgent ? colors.danger : color} trackColor={colors.primarySoft} height={6} />
      </View>
      <View style={[styles.hudTime, urgent && styles.hudUrgent]}>
        <TelIcon name="timer" size={14} color={urgent ? colors.white : colors.cream} />
        <TelText variant="label" color={urgent ? 'white' : 'cream'} tabular>
          {seconds}s
        </TelText>
      </View>
      <View style={styles.hudPoints} accessibilityLabel={`${points} puntos`}>
        <TelText variant="label" color="cream" tabular>
          {points}
        </TelText>
        <TelText variant="small" color="accentSoft">
          pts
        </TelText>
      </View>
    </View>
  );
}

// Los lados de la carrera que toca recorrer, con el que se está jugando resaltado: así se ve de un
// vistazo que Telemática es redes, hardware, telecomunicaciones y software.
function JourneyStrip({ rounds, current, finished }: { rounds: B215Round[]; current: number; finished: boolean }) {
  return (
    <View style={styles.journey}>
      {rounds.map((round, position) => {
        const track = trackOf(round);
        const done = position < current || (finished && position === current);
        const live = !done && position === current;
        const ink = live ? colors.primary : done ? track.color : colors.slate;
        return (
          <View key={round.id} style={[styles.chip, live && { backgroundColor: track.color, borderColor: track.color }, done && { borderColor: track.color, backgroundColor: tint(track.color, 0.14) }]}>
            <TelIcon name={done ? 'check' : track.icon} size={14} color={ink} strokeWidth={2.4} />
            <TelText variant="small" numberOfLines={1} maxFontSizeMultiplier={1.3} style={{ color: ink }}>
              {track.label}
            </TelText>
          </View>
        );
      })}
    </View>
  );
}

interface IntroProps {
  rounds: B215Round[];
  round: B215Round;
  index: number;
  pace: number;
  onStart: () => void;
}

// Antes de jugar: qué equipo es, qué hay que hacer y cómo funciona. El reloj parte al tocar «¡Vamos!».
function IntroCard({ rounds, round, index, pace, onStart }: IntroProps) {
  const motion = useMotionEnabled();
  const track = trackOf(round);
  return (
    <View style={styles.fill}>
      <ScrollView style={styles.fill} contentContainerStyle={styles.cardContent} showsVerticalScrollIndicator={false}>
        <View style={styles.cardBody}>
          <JourneyStrip rounds={rounds} current={index} finished={false} />
          <View style={styles.roundRow}>
            <TelText variant="overline" color="accent">
              Ronda {index + 1} de {rounds.length}
            </TelText>
            <View style={styles.timePill} accessibilityLabel={`${Math.round(round.seconds * pace)} segundos`}>
              <TelIcon name="timer" size={13} color={colors.cream} />
              <TelText variant="small" color="cream" tabular>
                {Math.round(round.seconds * pace)} s
              </TelText>
            </View>
          </View>
          <Animated.View entering={motion ? ZoomIn.springify().damping(12) : undefined} style={[styles.hero, { borderColor: track.color, backgroundColor: tint(track.color, 0.14) }]}>
            <DeviceArt device={round.art} size={54} />
            <View style={[styles.heroBadge, { backgroundColor: track.color }]}>
              <TelIcon name={round.icon} size={16} color={colors.primary} strokeWidth={2.4} />
            </View>
          </Animated.View>
          <View style={styles.titles}>
            <TelText variant="overline" align="center" style={{ color: track.color }}>
              {round.device}
            </TelText>
            <TelText variant="title" color="cream" align="center">
              {round.title}
            </TelText>
          </View>
          <View style={styles.goal}>
            <TelIcon name="target" size={22} color={colors.primary} />
            <TelText variant="label" color="primary" style={styles.grow}>
              {round.goal}
            </TelText>
          </View>
          <View style={styles.explain}>
            {round.explain.map((line) => (
              <View key={line} style={styles.explainRow}>
                <TelIcon name="lightbulb" size={16} color={colors.accent} />
                <TelText variant="caption" color="onDark" style={styles.grow}>
                  {line}
                </TelText>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <TelButton label="¡Vamos!" variant="cream" iconRight="play" onPress={onStart} />
    </View>
  );
}

interface ResultProps {
  rounds: B215Round[];
  round: B215Round;
  item: Played;
  index: number;
  max: number;
  onNext: () => void;
}

const resultTones: Record<'great' | 'good' | 'low', { title: string; icon: IconName; bg: string; fg: string }> = {
  great: { title: '¡Muy bien!', icon: 'checkCircle', bg: '#1F5E43', fg: '#93DDB9' },
  good: { title: '¡Bien!', icon: 'checkCircle', bg: '#1F5E43', fg: '#93DDB9' },
  low: { title: '¡Buen intento!', icon: 'closeCircle', bg: '#6E2A2A', fg: colors.dangerLight },
};

// Al terminar la ronda: estrellas, puntos, qué pasó y la idea que queda. Con buen resultado, confeti.
function ResultCard({ rounds, round, item, index, max, onNext }: ResultProps) {
  const motion = useMotionEnabled();
  const great = item.ratio >= 0.85;
  const tone = resultTones[great ? 'great' : item.ratio >= 0.5 ? 'good' : 'low'];
  const stars = great ? 3 : item.ratio >= 0.5 ? 2 : item.ratio > 0 ? 1 : 0;
  const last = index + 1 >= rounds.length;
  return (
    <View style={styles.fill}>
      <ScrollView style={styles.fill} contentContainerStyle={styles.cardContent} showsVerticalScrollIndicator={false}>
        <View style={styles.cardBody}>
          <JourneyStrip rounds={rounds} current={index} finished />
          <TelText variant="overline" color="accent" align="center">
            Ronda {index + 1} de {rounds.length}
          </TelText>
          <View style={styles.stars} accessible accessibilityLabel={`${stars} de 3 estrellas`}>
            {[0, 1, 2].map((position) => (
              <Animated.View key={position} entering={motion ? ZoomIn.delay(100 + position * 130).springify().damping(10) : undefined}>
                <TelIcon name={position < stars ? 'starSolid' : 'star'} size={position === 1 ? 46 : 34} color={position < stars ? STAR : colors.slate} />
              </Animated.View>
            ))}
          </View>
          <View style={styles.headline}>
            <View style={[styles.resultIcon, { backgroundColor: tone.bg }]}>
              <TelIcon name={tone.icon} size={24} color={tone.fg} />
            </View>
            <TelText variant="title" color="cream" align="center">
              {tone.title}
            </TelText>
          </View>
          <View style={styles.scoreRow}>
            <TelText variant="display" color="cream" tabular>
              {item.points}
            </TelText>
            <TelText variant="label" color="accentSoft" tabular>
              / {max} puntos
            </TelText>
          </View>
          <TelText variant="label" color="accentSoft" align="center">
            {item.detail}
          </TelText>
          <View style={styles.learned}>
            <TelIcon name="lightbulb" size={20} color={colors.cream} />
            <TelText variant="caption" color="cream" style={styles.grow}>
              {round.learned}
            </TelText>
          </View>
        </View>
      </ScrollView>
      <TelButton label={last ? 'Ver resultado' : 'Siguiente ronda'} variant="cream" iconRight="arrowRight" onPress={onNext} />
      {great && <Celebration burstKey={index + 1} count={34} />}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    minHeight: 0,
    gap: spacing.sm,
  },
  stage: {
    flex: 1,
    minHeight: 0,
  },
  grow: {
    flex: 1,
  },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 34,
  },
  hudRound: {
    height: 30,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudBar: {
    flex: 1,
  },
  hudTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  hudUrgent: {
    backgroundColor: colors.danger,
  },
  hudPoints: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  journey: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    flex: 1,
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 212, 237, 0.25)',
  },
  cardContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  cardBody: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  roundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 24,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  hero: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadge: {
    position: 'absolute',
    right: -6,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primaryDeep,
  },
  titles: {
    alignItems: 'center',
    gap: 2,
  },
  goal: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
  },
  explain: {
    alignSelf: 'stretch',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  explainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  stars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  headline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  learned: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(244, 236, 215, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 236, 215, 0.25)',
  },
  summaryContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
