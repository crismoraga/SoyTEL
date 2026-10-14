import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { FitBox } from '@/components/FitBox';
import { PressableScale } from '@/components/PressableScale';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { clamp, GameBoard, gameNow, Hint, useGameTimeout } from '@/features/stations/kit';
import { feedbackSuccess, feedbackWarning } from '@/lib/feedback';
import { useMotionEnabled } from '@/lib/motion';
import { colors, radius, spacing } from '@/theme';
import type { RoundProps } from '../types';
import {
  assignLanes,
  describeScenario,
  explainChannel,
  feedbackWait,
  hillPoints,
  HILL_HALF,
  makeWifiScenarios,
  polygonPath,
  scoreRound,
  signalBars,
  SPECTRUM_MAX,
  SPECTRUM_MIN,
  streakOf,
  STRENGTH_HEIGHT,
  WIFI_CHANNELS,
  WIFI_PROMPT,
  WIFI_PROMPT_FIRST,
  type WifiChoice,
  type WifiScenario,
} from './red.logic';

// Ronda del circuito B215 · Wi-Fi: 3 escenarios; en cada uno hay que elegir el canal (1, 6 u 11) con menos
// redes vecinas encima. El gráfico es el espectro de 2,4 GHz: cada vecina es una colina de 5 canales de ancho.
// Al elegir, lo que se pisa se pinta en rojo y el medidor de señal muestra cómo quedaría tu Wi-Fi.

type ButtonState = 'idle' | 'right' | 'wrong' | 'reveal' | 'dimmed';

const GOOD = '#2E7D5B';
const BAD = '#C73E3E';
const GOOD_LIGHT = '#6BC59A';
const BAD_LIGHT = '#E58A8A';
const OVERLAP = '#FF5A5A';
const HILL_COLORS = ['#E58A5A', '#4FB38A', '#9B8AE6', '#E5C95A'];

const PAD_X = 6;
const PAD_TOP = 8;
const AXIS_H = 30;
const LABEL_W = 84;

export function WifiChannelRound({ seed, level, pace, timeUp, onDone }: RoundProps) {
  const motion = useMotionEnabled();
  const [data] = useState(() => makeWifiScenarios(seed, level));
  const [picks, setPicks] = useState<WifiChoice[]>([]);
  // true mientras se ve la reacción a la última respuesta.
  const [reviewing, setReviewing] = useState(false);
  const [advanceAt, setAdvanceAt] = useState<number | null>(null);

  const finished = useRef(false);
  const latestDone = useRef(onDone);
  useEffect(() => {
    latestDone.current = onDone;
  });

  const total = data.length;
  const hits = picks.map((pick, position) => pick === data[position].best);
  const correct = hits.filter(Boolean).length;
  const streak = streakOf(hits);
  const index = reviewing ? picks.length - 1 : picks.length;
  const scenario = data[Math.min(index, total - 1)];
  const picked = reviewing ? picks[picks.length - 1] : null;
  const ok = picked !== null && picked === scenario.best;
  const bars = picked !== null ? signalBars(scenario, picked) : 0;
  const locked = timeUp || reviewing;

  const finish = useCallback(
    (hitCount: number, attempts: number) => {
      if (finished.current) return;
      finished.current = true;
      latestDone.current(scoreRound(hitCount, attempts, total, 'canales bien elegidos'));
    },
    [total],
  );

  // Se acabó el tiempo: se entrega de inmediato lo logrado hasta ahí.
  useEffect(() => {
    if (timeUp) finish(correct, picks.length);
  }, [timeUp, correct, picks.length, finish]);

  function advance() {
    if (finished.current) return;
    setAdvanceAt(null);
    if (picks.length >= total) finish(correct, picks.length);
    else setReviewing(false);
  }
  useGameTimeout(advanceAt, advance, advanceAt);

  function choose(channel: WifiChoice) {
    if (finished.current || locked) return;
    const right = channel === scenario.best;
    setPicks([...picks, channel]);
    setReviewing(true);
    setAdvanceAt(gameNow() + feedbackWait(right ? 1000 : 2500, pace));
    void (right ? feedbackSuccess() : feedbackWarning());
  }

  const hintText = picked !== null ? explainChannel(scenario, picked, streak) : index === 0 ? WIFI_PROMPT_FIRST : WIFI_PROMPT;
  const stateOf = (channel: WifiChoice): ButtonState => {
    if (picked === null) return 'idle';
    if (channel === picked) return ok ? 'right' : 'wrong';
    return !ok && channel === scenario.best ? 'reveal' : 'dimmed';
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <TelIcon name="channel" size={18} color={colors.accent} />
          <TelText variant="small" color="accentSoft" style={styles.kicker} numberOfLines={1}>
            TU WI-FI
          </TelText>
        </View>
        <View style={styles.headerRight}>
          <SignalMeter key={`${index}-${bars}`} bars={bars} motion={motion} />
          <View style={styles.pips} accessibilityLabel={`Escenario ${Math.min(index + 1, total)} de ${total}`}>
            {data.map((item, position) => {
              const result = picks[position];
              const hit = result !== undefined && result === item.best;
              return <View key={position} style={[styles.pip, position === index && result === undefined && styles.pipNow, result !== undefined && (hit ? styles.pipOk : styles.pipBad)]} />;
            })}
          </View>
        </View>
      </View>
      <FitBox style={styles.board} maxHeight={340}>
        {(size) => <SpectrumChart key={index} width={size.width} height={size.height} scenario={scenario} picked={picked} />}
      </FitBox>
      <Pressable accessible={false} onPress={reviewing ? advance : undefined}>
        <View style={styles.hintSlot} accessibilityLiveRegion="polite">
          <Hint key={`${index}-${picked === null ? 'p' : 'r'}`} tone={picked === null ? 'info' : ok ? 'good' : 'bad'}>
            {hintText}
          </Hint>
        </View>
      </Pressable>
      <View style={styles.choices}>
        {WIFI_CHANNELS.map((channel) => (
          <ChannelButton key={channel} channel={channel} state={stateOf(channel)} disabled={locked} motion={motion} onPress={() => choose(channel)} />
        ))}
      </View>
    </View>
  );
}

// Barras de señal: se apagan hasta que eliges y entonces suben según qué tan libre está el canal.
function SignalMeter({ bars, motion }: { bars: number; motion: boolean }) {
  const tint = bars >= 4 ? GOOD_LIGHT : bars === 3 ? '#B7D96B' : bars === 2 ? '#E5C95A' : BAD_LIGHT;
  return (
    <Animated.View entering={motion && bars > 0 ? ZoomIn.springify().damping(9) : undefined} accessible accessibilityLabel={bars > 0 ? `Señal ${bars} de 4` : 'Señal sin medir'} style={styles.meter}>
      {[1, 2, 3, 4].map((bar) => (
        <View key={bar} style={[styles.bar, { height: 6 + bar * 4 }, bar <= bars && { backgroundColor: tint }]} />
      ))}
    </Animated.View>
  );
}

interface ChartProps {
  width: number;
  height: number;
  scenario: WifiScenario;
  picked: WifiChoice | null;
}

// Espectro de 2,4 GHz: tres bandas de 5 canales (1, 6 y 11, que no se pisan) y las redes vecinas como colinas.
// Al elegir, lo que cae dentro de la banda elegida se pinta en rojo: es la interferencia.
function SpectrumChart({ width, height, scenario, picked }: ChartProps) {
  const motion = useMotionEnabled();
  const baseY = height - AXIS_H;
  const plotW = width - PAD_X * 2;
  const plotH = Math.max(40, baseY - PAD_TOP);
  const unit = plotW / (SPECTRUM_MAX - SPECTRUM_MIN);
  const toX = (channel: number) => PAD_X + (channel - SPECTRUM_MIN) * unit;
  const toY = (value: number) => baseY - value * plotH;
  const bandW = HILL_HALF * 2 * unit;
  const lanes = assignLanes(scenario.neighbors, 78 / unit);
  const drawOrder = scenario.neighbors.map((_, position) => position).sort((a, b) => scenario.neighbors[b].strength - scenario.neighbors[a].strength);
  const missed = picked !== null && picked !== scenario.best;

  return (
    <GameBoard style={{ width, height }}>
      <View accessible accessibilityRole="image" accessibilityLabel={describeScenario(scenario)} style={StyleSheet.absoluteFill}>
        <Svg width={width} height={height}>
          {WIFI_CHANNELS.map((channel, position) => (
            <Rect key={`band-${channel}`} x={toX(channel - HILL_HALF)} y={PAD_TOP} width={bandW} height={baseY - PAD_TOP} fill={position % 2 === 0 ? 'rgba(167, 212, 237, 0.06)' : 'rgba(167, 212, 237, 0.14)'} />
          ))}
          {drawOrder.map((position) => {
            const neighbor = scenario.neighbors[position];
            const color = HILL_COLORS[position % HILL_COLORS.length];
            return (
              <Path key={`hill-${position}`} d={polygonPath(hillPoints(neighbor.channel, neighbor.strength), toX, toY, baseY)} fill={color} fillOpacity={0.5} stroke={color} strokeWidth={2} strokeLinejoin="round" />
            );
          })}
          <Line x1={PAD_X} y1={baseY} x2={width - PAD_X} y2={baseY} stroke={colors.accentSoft} strokeWidth={1.5} />
          {Array.from({ length: 11 }, (_, position) => position + 1).map((channel) => (
            <Line key={`tick-${channel}`} x1={toX(channel)} y1={baseY} x2={toX(channel)} y2={baseY + (channel === 1 || channel === 6 || channel === 11 ? 6 : 4)} stroke={colors.accentSoft} strokeWidth={1.5} />
          ))}
        </Svg>
        {picked !== null && (
          <Animated.View pointerEvents="none" entering={motion ? FadeIn.duration(240) : undefined} style={StyleSheet.absoluteFill}>
            <Svg width={width} height={height}>
              {scenario.neighbors.map((neighbor, position) => {
                const d = polygonPath(hillPoints(neighbor.channel, neighbor.strength, picked - HILL_HALF, picked + HILL_HALF), toX, toY, baseY);
                return d ? <Path key={`hit-${position}`} d={d} fill={OVERLAP} fillOpacity={0.8} /> : null;
              })}
              <Rect x={toX(picked - HILL_HALF) + 1} y={PAD_TOP + 1} width={bandW - 2} height={baseY - PAD_TOP - 1} rx={6} fill="none" stroke={colors.cream} strokeWidth={2} strokeDasharray="6 4" />
              {missed && <Rect x={toX(scenario.best - HILL_HALF) + 1} y={PAD_TOP + 1} width={bandW - 2} height={baseY - PAD_TOP - 1} rx={6} fill="none" stroke={GOOD_LIGHT} strokeWidth={2.5} />}
            </Svg>
          </Animated.View>
        )}
        {Array.from({ length: 11 }, (_, position) => position + 1).map((channel) => {
          const main = channel === 1 || channel === 6 || channel === 11;
          const mine = picked === channel;
          const best = missed && channel === scenario.best;
          return (
            <View key={`num-${channel}`} pointerEvents="none" style={[styles.tick, { left: toX(channel) - (main ? 13 : 10), top: baseY + 5, width: main ? 26 : 20 }, mine && styles.tickMine, best && styles.tickBest]}>
              <TelText variant={main ? 'label' : 'small'} maxFontSizeMultiplier={1.2} style={{ color: mine ? colors.primary : best ? colors.white : main ? colors.cream : colors.accentSoft, opacity: main || mine || best ? 1 : 0.75 }}>
                {channel}
              </TelText>
            </View>
          );
        })}
        {scenario.neighbors.map((neighbor, position) => {
          const top = Math.min(toY(STRENGTH_HEIGHT[neighbor.strength]) + 3 + lanes[position] * 16, baseY - 20);
          return (
            <View key={`name-${position}`} pointerEvents="none" style={[styles.labelWrap, { left: clamp(toX(neighbor.channel) - LABEL_W / 2, 0, Math.max(0, width - LABEL_W)), top }]}>
              <View style={[styles.labelPill, { borderColor: HILL_COLORS[position % HILL_COLORS.length] }]}>
                <TelText variant="small" color="cream" maxFontSizeMultiplier={1.2} numberOfLines={1}>
                  {neighbor.name}
                </TelText>
              </View>
            </View>
          );
        })}
      </View>
    </GameBoard>
  );
}

function ChannelButton({ channel, state, disabled, motion, onPress }: { channel: WifiChoice; state: ButtonState; disabled: boolean; motion: boolean; onPress: () => void }) {
  const badge = state === 'right' || state === 'reveal' ? 'check' : state === 'wrong' ? 'close' : null;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Canal ${channel}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.94}
      style={[styles.channel, state === 'right' && styles.channelRight, state === 'wrong' && styles.channelWrong, state === 'reveal' && styles.channelReveal, state === 'dimmed' && styles.channelDim]}
    >
      <TelText variant="small" color="accentSoft">
        CANAL
      </TelText>
      <TelText variant="number" color="cream" tabular>
        {channel}
      </TelText>
      {badge && (
        <Animated.View entering={motion ? ZoomIn.springify().damping(9) : undefined} style={[styles.badge, { backgroundColor: badge === 'close' ? colors.white : colors.cream }]}>
          <TelIcon name={badge} size={14} color={badge === 'close' ? BAD : GOOD} />
        </Animated.View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    minHeight: 0,
    gap: 6,
  },
  header: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  kicker: {
    letterSpacing: 1.2,
    flexShrink: 1,
  },
  meter: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  bar: {
    width: 6,
    borderRadius: 2,
    backgroundColor: 'rgba(167, 212, 237, 0.25)',
  },
  pips: {
    flexDirection: 'row',
    gap: 4,
  },
  pip: {
    width: 22,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primarySoft,
  },
  pipNow: {
    backgroundColor: colors.cream,
  },
  pipOk: {
    backgroundColor: GOOD_LIGHT,
  },
  pipBad: {
    backgroundColor: BAD_LIGHT,
  },
  board: {
    minHeight: 120,
  },
  hintSlot: {
    minHeight: 48,
    justifyContent: 'center',
  },
  choices: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  channel: {
    flex: 1,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 212, 237, 0.4)',
    backgroundColor: colors.primarySoft,
  },
  channelRight: {
    backgroundColor: '#1F5E43',
    borderColor: GOOD_LIGHT,
  },
  channelWrong: {
    backgroundColor: '#6E2A2A',
    borderColor: BAD_LIGHT,
  },
  channelReveal: {
    borderColor: GOOD_LIGHT,
    borderWidth: 2.5,
  },
  channelDim: {
    opacity: 0.45,
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: {
    position: 'absolute',
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickMine: {
    backgroundColor: colors.cream,
  },
  tickBest: {
    backgroundColor: GOOD,
  },
  labelWrap: {
    position: 'absolute',
    width: LABEL_W,
    alignItems: 'center',
  },
  labelPill: {
    paddingHorizontal: 5,
    borderRadius: 7,
    borderWidth: 1,
    backgroundColor: 'rgba(7, 31, 49, 0.72)',
  },
});
