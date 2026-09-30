import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withTiming, ZoomIn } from 'react-native-reanimated';
import Svg, { Circle, Line, Polygon, Polyline, Rect } from 'react-native-svg';
import { PressableScale } from '@/components/PressableScale';
import { TelButton } from '@/components/TelButton';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { now as clockNow } from '@/lib/clock';
import { feedbackSuccess, feedbackTap, feedbackWarning } from '@/lib/feedback';
import { usePanHandlers } from '@/lib/usePanHandlers';
import { mulberry32 } from '@/route/random';
import { colors, font, radius, spacing } from '@/theme';
import { clamp, GameBoard, Hint, StageBanner, StationHud, StationSummary, useNow, type StationGameProps } from '../kit';
import {
  acceptanceAngle,
  ANGLE_MAX,
  ANGLES_MAX,
  BIT_MS,
  decodeBits,
  fiberLevels,
  levelScore,
  pickWord,
  PULSES_MAX,
  toBits,
  traceRay,
  type RayTrace,
} from '../logic/fiber';

type StageKey = 'angles' | 'pulses';

const STAGES: { key: StageKey; title: string; body: string; icon: IconName; seconds: number }[] = [
  {
    key: 'angles',
    title: 'Atrapa la luz',
    body: 'Apunta el láser dentro del cono de aceptación: si el ángulo es pequeño, la luz rebota adentro de la fibra (reflexión total interna).',
    icon: 'laser',
    seconds: 45,
  },
  {
    key: 'pulses',
    title: 'Transmite con pulsos',
    body: 'Envía el mensaje en binario: toca PULSO cuando un 1 pase por el láser y no toques en los 0.',
    icon: 'fiber',
    seconds: 30,
  },
];

const ACCENT = '#6FB3D9';
const LASER_RED = '#FF5A5A';

// B213 · Telecomunicaciones: fibra óptica, reflexión total interna y modulación on-off.
export function FiberLaserGame({ seed, onComplete }: StationGameProps) {
  const [word] = useState(() => pickWord(mulberry32(seed ^ 0xf1be)));
  const [stageIndex, setStageIndex] = useState(0);
  const [banner, setBanner] = useState(true);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [anglePoints, setAnglePoints] = useState(0);
  const [angleShots, setAngleShots] = useState({ ok: 0, total: 0 });
  const [pulse, setPulse] = useState({ points: 0, correct: 0, total: 0 });
  const [finished, setFinished] = useState(false);
  const now = useNow(endsAt !== null, 250);
  const stage = STAGES[stageIndex];

  const startStage = useCallback(() => {
    setBanner(false);
    setEndsAt(Date.now() + STAGES[stageIndex].seconds * 1000);
  }, [stageIndex]);

  const nextStage = useCallback(() => {
    setEndsAt(null);
    if (stageIndex < STAGES.length - 1) {
      setStageIndex(stageIndex + 1);
      setBanner(true);
    } else {
      setFinished(true);
    }
  }, [stageIndex]);

  const total = anglePoints + pulse.points;

  if (finished) {
    const accuracy = ((angleShots.total ? angleShots.ok / angleShots.total : 0) + (pulse.total ? pulse.correct / pulse.total : 0)) / 2;
    return (
      <StationSummary
        title="Viaje de la luz"
        total={total}
        message={pulse.total ? `Tasa de error de bits: ${Math.round((1 - pulse.correct / pulse.total) * 100)}%` : '¡La luz llegó a destino!'}
        accent={ACCENT}
        rows={[
          { label: 'Luz atrapada en la fibra', value: anglePoints, max: ANGLES_MAX, icon: 'laser' },
          { label: 'Bits transmitidos', value: pulse.points, max: PULSES_MAX, icon: 'fiber' },
        ]}
        learned="La fibra guía la luz porque su núcleo tiene mayor índice de refracción que el revestimiento: si el ángulo es pequeño, la luz rebota adentro. Los datos viajan como pulsos: luz = 1, sin luz = 0."
        onSubmit={() => onComplete({ score: total, accuracy })}
      />
    );
  }

  const secondsLeft = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : null;

  return (
    <View style={styles.container}>
      <StationHud stage={stageIndex + 1} stages={STAGES.length} title={stage.title} score={total} secondsLeft={secondsLeft} totalSeconds={stage.seconds} accent={ACCENT} />
      {endsAt && stage.key === 'angles' && (
        <AnglesStage
          endsAt={endsAt}
          onLevel={(points, ok) => {
            setAnglePoints((value) => value + points);
            setAngleShots((value) => ({ ok: value.ok + (ok ? 1 : 0), total: value.total + 1 }));
          }}
          onFinish={nextStage}
        />
      )}
      {endsAt && stage.key === 'pulses' && <PulsesStage word={word} endsAt={endsAt} onProgress={setPulse} onFinish={nextStage} />}
      {banner && <StageBanner key={stage.key} index={stageIndex + 1} title={stage.title} body={stage.body} icon={stage.icon} accent={ACCENT} onDone={startStage} />}
      {banner && <View style={styles.bannerSpace} />}
    </View>
  );
}

// ——— Etapa 1: ángulos ———

const BOARD_H = 210;
const CENTER_Y = 112;
const CORE_HALF = 17;

function AnglesStage({ endsAt, onLevel, onFinish }: { endsAt: number; onLevel: (points: number, ok: boolean) => void; onFinish: () => void }) {
  const [level, setLevel] = useState(0);
  const [angle, setAngle] = useState(24);
  const [width, setWidth] = useState(0);
  const [failed, setFailed] = useState(0);
  const [shot, setShot] = useState<RayTrace | null>(null);
  const [visible, setVisible] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const done = useRef(false);
  const dragStart = useRef(0);
  const config = fiberLevels[level];
  const acceptance = acceptanceAngle(config.cladding);

  const geometry = {
    laserX: 30,
    laserY: CENTER_Y + config.laserOffset,
    entryX: width * 0.32,
    exitX: width - 34,
    coreTop: CENTER_Y - CORE_HALF,
    coreBottom: CENTER_Y + CORE_HALF,
  };

  useEffect(() => {
    if (done.current) return;
    const timer = setTimeout(() => {
      done.current = true;
      onFinish();
    }, Math.max(0, endsAt - Date.now()));
    return () => clearTimeout(timer);
  }, [endsAt, onFinish]);

  // Dibuja el rayo por tramos para que se vea viajar.
  useEffect(() => {
    if (!shot) return;
    if (visible >= shot.points.length) return;
    const timer = setTimeout(() => setVisible((value) => value + 1), 70);
    return () => clearTimeout(timer);
  }, [shot, visible]);

  const handlers = usePanHandlers({
    canStart: () => !shot,
    onGrant: () => {
      dragStart.current = angle;
    },
    onMove: (_, gesture) => setAngle(clamp(Math.round((dragStart.current + gesture.dy * 0.12) * 2) / 2, -ANGLE_MAX, ANGLE_MAX)),
  });

  function fire() {
    if (shot || done.current || !width) return;
    const trace = traceRay(geometry, angle, config.cladding);
    setShot(trace);
    setVisible(1);
    const ok = trace.outcome === 'delivered';
    if (ok) {
      void feedbackSuccess();
      const ratio = (endsAt - clockNow()) / (endsAt - startedAt);
      onLevel(levelScore(failed, ratio), true);
      setTimeout(() => {
        if (level + 1 >= fiberLevels.length) {
          done.current = true;
          onFinish();
        } else {
          setLevel(level + 1);
          setFailed(0);
          setShot(null);
          setAngle(level % 2 === 0 ? -26 : 22);
          setStartedAt(clockNow());
        }
      }, 1500);
    } else {
      void feedbackWarning();
      setFailed(failed + 1);
      setTimeout(() => setShot(null), 1300);
    }
  }

  const rad = (value: number) => (value * Math.PI) / 180;
  const coneLength = Math.max(40, geometry.entryX - geometry.laserX - 10);
  const coneSpread = Math.tan(rad(acceptance)) * coneLength;
  const aimEnd = { x: geometry.entryX, y: geometry.laserY + Math.tan(rad(angle)) * (geometry.entryX - geometry.laserX) };
  const path = shot ? shot.points.slice(0, visible) : [];
  const delivered = shot?.outcome === 'delivered' && visible >= (shot?.points.length ?? 0);

  return (
    <View style={styles.stageGap}>
      <TelText variant="label" color="accentSoft" align="center">
        Nivel {level + 1} de {fiberLevels.length} · cono de aceptación ±{acceptance.toFixed(1)}°
      </TelText>
      <GameBoard>
        <View style={{ height: BOARD_H }} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)} {...handlers}>
          {width > 0 && (
            <Svg width={width} height={BOARD_H}>
              <Rect x={geometry.entryX} y={CENTER_Y - CORE_HALF - 12} width={geometry.exitX - geometry.entryX} height={(CORE_HALF + 12) * 2} rx={8} fill="#2B5E80" />
              <Rect x={geometry.entryX} y={geometry.coreTop} width={geometry.exitX - geometry.entryX} height={CORE_HALF * 2} fill="#9FD2EE" fillOpacity={0.35} />
              <Polygon
                points={`${geometry.entryX},${CENTER_Y} ${geometry.entryX - coneLength},${CENTER_Y - coneSpread} ${geometry.entryX - coneLength},${CENTER_Y + coneSpread}`}
                fill={colors.success}
                fillOpacity={0.16}
                stroke={colors.success}
                strokeOpacity={0.5}
                strokeDasharray="4 5"
              />
              {!shot && <Line x1={geometry.laserX} y1={geometry.laserY} x2={aimEnd.x} y2={aimEnd.y} stroke={LASER_RED} strokeWidth={2} strokeDasharray="5 6" />}
              {path.length > 1 && (
                <Polyline points={path.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={LASER_RED} strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round" />
              )}
              <Circle cx={geometry.exitX + 14} cy={CENTER_Y} r={13} fill={delivered ? colors.success : colors.primary} stroke={colors.cream} strokeWidth={2} />
              <Rect x={geometry.laserX - 22} y={geometry.laserY - 11} width={30} height={22} rx={5} fill={colors.cream} />
              <Circle cx={geometry.laserX + 8} cy={geometry.laserY} r={4} fill={LASER_RED} />
            </Svg>
          )}
          <View pointerEvents="none" style={styles.fiberLabels}>
            <TelText variant="small" color="accentSoft">
              Láser
            </TelText>
            <TelText variant="small" color="accentSoft">
              Receptor
            </TelText>
          </View>
        </View>
      </GameBoard>
      <View style={styles.angleRow}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Subir el láser" disabled={Boolean(shot)} onPress={() => setAngle((value) => clamp(value - 1, -ANGLE_MAX, ANGLE_MAX))} style={styles.stepper}>
          <TelIcon name="chevronUp" size={22} color={colors.primary} />
        </PressableScale>
        <View style={styles.angleValue} accessibilityLabel={`Ángulo ${angle} grados`}>
          <TelText variant="small" color="accentSoft">
            ÁNGULO
          </TelText>
          <TelText variant="title" color="cream" tabular>
            {angle > 0 ? '+' : ''}
            {angle.toFixed(1)}°
          </TelText>
        </View>
        <PressableScale accessibilityRole="button" accessibilityLabel="Bajar el láser" disabled={Boolean(shot)} onPress={() => setAngle((value) => clamp(value + 1, -ANGLE_MAX, ANGLE_MAX))} style={styles.stepper}>
          <TelIcon name="chevronDown" size={22} color={colors.primary} />
        </PressableScale>
      </View>
      <TelButton label="Encender láser" variant="cream" icon="bolt" disabled={Boolean(shot)} onPress={fire} />
      <Hint tone={shot ? (shot.outcome === 'delivered' ? 'good' : 'bad') : 'info'}>
        {shot
          ? shot.outcome === 'delivered'
            ? `¡La luz llegó con ${shot.bounces} ${shot.bounces === 1 ? 'rebote' : 'rebotes'} dentro del núcleo!`
            : shot.outcome === 'missed'
              ? 'El haz no entró al núcleo de la fibra: ajusta la puntería.'
              : 'Ángulo demasiado inclinado: la luz atravesó el revestimiento y se perdió.'
          : 'Arrastra sobre la fibra o usa las flechas para apuntar. El haz debe entrar por el cono verde.'}
      </Hint>
    </View>
  );
}

// ——— Etapa 2: pulsos ———

const CELL = 38;
const HIT_X = 60;
const TRACK_H = 70;
const LEAD_MS = 2200;

function PulsesStage({
  word,
  endsAt,
  onProgress,
  onFinish,
}: {
  word: string;
  endsAt: number;
  onProgress: (value: { points: number; correct: number; total: number }) => void;
  onFinish: () => void;
}) {
  const [bits] = useState(() => toBits(word));
  const [startAt] = useState(() => Date.now() + LEAD_MS);
  const [sent, setSent] = useState<boolean[]>(() => bits.map(() => false));
  const [flash, setFlash] = useState(0);
  const done = useRef(false);
  const now = useNow(true, 90);
  const progress = useSharedValue(0);
  const elapsed = now - startAt;
  const current = Math.floor(elapsed / BIT_MS);
  const evaluated = clamp(current, 0, bits.length);
  const correct = bits.slice(0, evaluated).filter((bit, index) => bit === (sent[index] ? 1 : 0)).length;
  const received = bits.slice(0, evaluated).map((_, index) => (sent[index] ? 1 : 0));

  useEffect(() => {
    const delay = Math.max(0, startAt - Date.now());
    const timer = setTimeout(() => {
      progress.set(withTiming(bits.length + 1, { duration: (bits.length + 1) * BIT_MS, easing: Easing.linear }));
    }, delay);
    return () => clearTimeout(timer);
  }, [bits.length, progress, startAt]);

  useEffect(() => {
    onProgress({ points: Math.round((correct / bits.length) * PULSES_MAX), correct, total: evaluated });
  }, [bits.length, correct, evaluated, onProgress]);

  useEffect(() => {
    if (done.current) return;
    const finishAt = Math.min(endsAt, startAt + (bits.length + 1) * BIT_MS + 900);
    const timer = setTimeout(() => {
      done.current = true;
      onFinish();
    }, Math.max(0, finishAt - Date.now()));
    return () => clearTimeout(timer);
  }, [bits.length, endsAt, onFinish, startAt]);

  const trackStyle = useAnimatedStyle(() => ({ transform: [{ translateX: HIT_X - progress.value * CELL }] }));

  function tap() {
    const index = Math.floor((clockNow() - startAt) / BIT_MS);
    setFlash((value) => value + 1);
    void feedbackTap();
    if (index < 0 || index >= bits.length || sent[index]) return;
    setSent((current) => current.map((value, position) => (position === index ? true : value)));
  }

  const countdown = elapsed < 0 ? Math.ceil(-elapsed / 1000) : null;

  return (
    <View style={styles.stageGap}>
      <View style={styles.wordRow}>
        {word.split('').map((character, index) => (
          <View key={index} style={styles.letter}>
            <TelText variant="heading" color="cream">
              {character}
            </TelText>
            <TelText variant="small" color="accentSoft" style={font('bodyBold')}>
              {character.charCodeAt(0).toString(2).padStart(8, '0')}
            </TelText>
          </View>
        ))}
      </View>
      <GameBoard style={styles.track}>
        <Animated.View style={[styles.cells, { width: bits.length * CELL }, trackStyle]}>
          {bits.map((bit, index) => {
            const past = index < evaluated;
            const ok = past && bit === (sent[index] ? 1 : 0);
            return (
              <View key={index} style={[styles.cell, bit ? styles.cellOne : styles.cellZero, past && (ok ? styles.cellOk : styles.cellBad)]}>
                <TelText variant="heading" color={bit ? 'primary' : 'slate'}>
                  {bit}
                </TelText>
              </View>
            );
          })}
        </Animated.View>
        <View pointerEvents="none" style={styles.hitZone}>
          <Animated.View key={flash} entering={FadeIn.duration(60)} style={[styles.beam, flash > 0 && styles.beamOn]} />
        </View>
        {countdown !== null && (
          <View pointerEvents="none" style={styles.countdown}>
            <Animated.View key={countdown} entering={ZoomIn.duration(200)}>
              <TelText variant="display" color="cream">
                {countdown}
              </TelText>
            </Animated.View>
          </View>
        )}
      </GameBoard>
      <View style={styles.receiver}>
        <TelText variant="small" color="accentSoft">
          RECEPTOR
        </TelText>
        <TelText variant="label" color="cream" style={font('bodyBold')} numberOfLines={2}>
          {received.join('') || '—'}
        </TelText>
        <TelText variant="heading" color="cream">
          {decodeBits(received) || '…'}
        </TelText>
      </View>
      <PressableScale accessibilityRole="button" accessibilityLabel="Enviar pulso de luz" onPressIn={tap} scaleTo={0.9} style={styles.pulseButton}>
        <TelIcon name="bolt" size={30} color={colors.primary} />
        <TelText variant="title" color="primary">
          PULSO
        </TelText>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    minHeight: 480,
  },
  bannerSpace: {
    height: 420,
  },
  stageGap: {
    gap: spacing.sm,
  },
  fiberLabels: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  angleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  stepper: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  angleValue: {
    minWidth: 110,
    alignItems: 'center',
  },
  wordRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  letter: {
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
  },
  track: {
    height: TRACK_H,
    justifyContent: 'center',
  },
  cells: {
    flexDirection: 'row',
    position: 'absolute',
    left: 0,
    top: (TRACK_H - 50) / 2,
  },
  cell: {
    width: CELL - 4,
    height: 50,
    marginRight: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellOne: {
    backgroundColor: colors.cream,
  },
  cellZero: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: 'rgba(167,212,237,0.25)',
  },
  cellOk: {
    opacity: 0.45,
  },
  cellBad: {
    backgroundColor: colors.danger,
  },
  hitZone: {
    position: 'absolute',
    left: HIT_X - 3,
    top: 4,
    bottom: 4,
    width: CELL + 2,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: LASER_RED,
    overflow: 'hidden',
  },
  beam: {
    flex: 1,
  },
  beamOn: {
    backgroundColor: 'rgba(255, 90, 90, 0.35)',
  },
  countdown: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7,31,49,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiver: {
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(7,31,49,0.6)',
    gap: 2,
    alignItems: 'center',
  },
  pulseButton: {
    height: 88,
    borderRadius: radius.xl,
    backgroundColor: LASER_RED,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    boxShadow: '0px 0px 24px rgba(255, 90, 90, 0.55)',
  },
});

