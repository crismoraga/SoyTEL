import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';
import { FitBox, type FitSize } from '@/components/FitBox';
import { PressableScale } from '@/components/PressableScale';
import { TelButton } from '@/components/TelButton';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { feedbackSuccess, feedbackTap, feedbackWarning } from '@/lib/feedback';
import { useMotionEnabled } from '@/lib/motion';
import { usePanHandlers } from '@/lib/usePanHandlers';
import { colors, radius, spacing } from '@/theme';
import { Hint, StageBanner, StationHud, StationSummary, clamp, gameNow, useAskContinue, useDeadline, useGameTimeout, useNow, useSubmitOnce, type StationGameProps } from '../kit';
import {
  ANGLE_MAX,
  ANGLE_STEP,
  buildPlan,
  charBits,
  couplingBand,
  decodeBits,
  DEG,
  elevationFromPoint,
  emptyProgress,
  fiberTotals,
  fitScene,
  groupBits,
  HOLD_MS,
  isGuided,
  laserPoint,
  LIGHT_COUNT,
  LIGHT_MAX,
  MESSAGE_MAX,
  OFFSET_MAX,
  OFFSET_STEP,
  SCENE_W,
  sceneLayout,
  SPLICE_COUNT,
  SPLICE_LOCK,
  SPLICE_MAX,
  spliceCoupling,
  TILT_MAX,
  TILT_STEP,
  traceRay,
  type FiberPlan,
  type FiberProgress,
  type LightTarget,
  type RayPoint,
  type SpliceTarget,
} from '../logic/fiber';

type StageKey = 'light' | 'splice' | 'message';
type Tone = 'info' | 'good' | 'bad';

const STAGES: { key: StageKey; title: string; body: string; icon: IconName }[] = [
  {
    key: 'light',
    title: 'Mete la luz en la fibra',
    body: 'Lleva la luz al receptor.\nLa fibra guía la luz rebotando por dentro; si entra muy inclinada, se escapa.',
    icon: 'angle',
  },
  {
    key: 'splice',
    title: 'Empalma la fibra',
    body: 'Alinea los dos extremos.\nSi los núcleos no coinciden, se pierde luz. Llega al 90 %.',
    icon: 'fiber',
  },
  {
    key: 'message',
    title: 'Envía un mensaje con luz',
    body: 'Envía la letra bit por bit.\nLuz es 1 y apagado es 0: así viajan los datos.',
    icon: 'modulation',
  },
];

const ACCENT = '#6FB3D9';
const LASER = '#FF5A5A';
const CLAD = '#1D4B6B';
const CLAD_EDGE = '#4F8DB5';
const CORE = '#7FC4EC';
const LIT = '#7CF0B0';
const PULSE_MS = 420;

// El tablero se arrastra con el dedo: en la web hay que impedir que el navegador desplace o haga zoom.
const NO_TOUCH = (Platform.OS === 'web' ? { touchAction: 'none', userSelect: 'none' } : {}) as unknown as ViewStyle;

const fmt1 = (value: number) => value.toFixed(1).replace('.', ',');
const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0');

// B213 · Telecomunicaciones: la luz en la fibra (reflexión total interna), empalmes y mensajes en bits.
// Por turnos y sin ritmo: todo lo que se anota sale de `logic/fiber`, las animaciones solo decoran.
export function FiberLaserGame({ seed, deadline, onComplete }: StationGameProps) {
  const [plan] = useState(() => buildPlan(seed));
  const [stageIndex, setStageIndex] = useState(0);
  const [banner, setBanner] = useState(true);
  const [finished, setFinished] = useState(false);
  const [progress, setProgress] = useState(() => emptyProgress(plan.word.length * 8));
  const totals = fiberTotals(progress);
  const stage = STAGES[stageIndex];
  const submit = useSubmitOnce(onComplete);
  useDeadline(deadline, () => submit({ score: totals.total, accuracy: totals.accuracy }));

  const patch = useCallback((change: Partial<FiberProgress>) => setProgress((current) => ({ ...current, ...change })), []);
  const advance = useCallback(() => {
    if (stageIndex < STAGES.length - 1) {
      setStageIndex(stageIndex + 1);
      setBanner(true);
    } else {
      setFinished(true);
    }
  }, [stageIndex]);

  if (finished) {
    const errors = progress.messageErrors;
    return (
      <ScrollView style={styles.flex} contentContainerStyle={styles.summaryScroll} showsVerticalScrollIndicator={false}>
        <StationSummary
          title="Viaje de la luz"
          total={totals.total}
          message={progress.messageBits >= progress.messageTotal ? `Mensaje recibido: ${plan.word} · ${errors} ${errors === 1 ? 'error' : 'errores'} de bits` : '¡La luz llegó a destino!'}
          accent={ACCENT}
          rows={[
            { label: 'Luz en la fibra', value: totals.light, max: LIGHT_MAX, icon: 'angle' },
            { label: 'Empalmes', value: totals.splice, max: SPLICE_MAX, icon: 'fiber' },
            { label: 'Mensaje con luz', value: totals.message, max: MESSAGE_MAX, icon: 'modulation' },
          ]}
          learned="La fibra guía la luz por reflexión total interna, un empalme exige alinear bien los núcleos y los datos viajan como luz (1) y apagado (0)."
          onSubmit={() => submit({ score: totals.total, accuracy: totals.accuracy })}
        />
      </ScrollView>
    );
  }

  return (
    <View style={styles.root}>
      <StationHud stage={stageIndex + 1} stages={STAGES.length} title={stage.title} score={totals.total} secondsLeft={null} accent={ACCENT} />
      {!banner && stage.key === 'light' && <LightStage plan={plan} onProgress={patch} onFinish={advance} />}
      {!banner && stage.key === 'splice' && <SpliceStage plan={plan} onProgress={patch} onFinish={advance} />}
      {!banner && stage.key === 'message' && <MessageStage plan={plan} onProgress={patch} onFinish={advance} />}
      {banner && <StageBanner key={stage.key} index={stageIndex + 1} title={stage.title} body={stage.body} icon={stage.icon} accent={ACCENT} onDone={() => setBanner(false)} />}
    </View>
  );
}

interface StageProps {
  plan: FiberPlan;
  onProgress: (change: Partial<FiberProgress>) => void;
  onFinish: () => void;
}

// ——— Piezas compartidas ———

function HintBox({ tone, children }: { tone: Tone; children: string }) {
  return (
    <View style={styles.hintBox}>
      <Hint tone={tone}>{children}</Hint>
    </View>
  );
}

function StepButton({ icon, label, caption, disabled, flip, wide, onPress }: { icon: IconName; label: string; caption?: string; disabled?: boolean; flip?: boolean; wide?: boolean; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} haptic onPress={onPress} scaleTo={0.92} style={[wide ? styles.stepWide : styles.step, disabled && styles.stepOff]}>
      <TelIcon name={icon} size={24} color={colors.primary} strokeWidth={2.4} style={flip ? styles.flip : undefined} />
      {caption ? (
        <TelText variant="label" color="primary" maxFontSizeMultiplier={1.3}>
          {caption}
        </TelText>
      ) : null}
    </PressableScale>
  );
}

// Insignia de acierto (verde) o error (rojo) dibujada sobre el tablero.
function Badge({ x, y, ok }: { x: number; y: number; ok: boolean }) {
  return (
    <G>
      <Circle cx={x} cy={y} r={9} fill={ok ? colors.success : colors.danger} stroke={colors.cream} strokeWidth={1.5} />
      {ok ? (
        <Polyline points={`${x - 4},${y} ${x - 1},${y + 3.5} ${x + 4.5},${y - 3}`} fill="none" stroke={colors.white} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <Path d={`M ${x - 3.5} ${y - 3.5} L ${x + 3.5} ${y + 3.5} M ${x + 3.5} ${y - 3.5} L ${x - 3.5} ${y + 3.5}`} stroke={colors.white} strokeWidth={2} strokeLinecap="round" />
      )}
    </G>
  );
}

// ——— Etapa 1: meter la luz en la fibra ———

function LightStage({ plan, onProgress, onFinish }: StageProps) {
  const [index, setIndex] = useState(0);
  const target = plan.light[index];
  const [angle, setAngle] = useState(target.startAngle);
  const [wrong, setWrong] = useState(0);
  const [solved, setSolved] = useState(false);
  const [moved, setMoved] = useState(false);
  const [verdict, setVerdict] = useState<'ok' | 'bad' | null>(null);
  const [holdAt, setHoldAt] = useState<number | null>(null);
  const [done, setDone] = useState<number[]>([]);
  const settled = useRef(false);
  const askContinue = useAskContinue();
  const last = index + 1 >= plan.light.length;
  const guided = isGuided(target, angle);

  // La luz se confirma sola si el ángulo bueno se mantiene un momento; el reloj es el del juego (con pausa).
  const now = useNow(holdAt !== null && !solved, 60);
  const hold = holdAt === null ? 0 : clamp((now - holdAt) / HOLD_MS, 0, 1);

  function moveTo(next: number) {
    const value = clamp(next, -ANGLE_MAX, ANGLE_MAX);
    if (solved || value === angle) return;
    const entering = isGuided(target, value);
    const at = gameNow();
    setAngle(value);
    setMoved(true);
    setVerdict(null);
    setHoldAt((current) => (entering ? (current ?? at) : null));
  }

  function confirm() {
    if (settled.current) return;
    if (isGuided(target, angle)) {
      settled.current = true;
      const next = [...done, wrong];
      setDone(next);
      setSolved(true);
      setHoldAt(null);
      setVerdict('ok');
      onProgress({ lightWrong: next });
      void feedbackSuccess();
      if (last) askContinue(onFinish);
    } else {
      setWrong(wrong + 1);
      setVerdict('bad');
      void feedbackWarning();
    }
  }
  useGameTimeout(holdAt !== null && !solved ? holdAt + HOLD_MS : null, confirm, holdAt);

  function nextTarget() {
    const upcoming = plan.light[index + 1];
    settled.current = false;
    setIndex(index + 1);
    setAngle(upcoming.startAngle);
    setWrong(0);
    setSolved(false);
    setMoved(false);
    setVerdict(null);
    setHoldAt(null);
  }

  let hint: { tone: Tone; text: string };
  if (solved) hint = { tone: 'good', text: '¡La luz rebota dentro del núcleo y llega al receptor!' };
  else if (verdict === 'bad') hint = { tone: 'bad', text: `Se escapó: pasa de ±${fmt1(target.cone)}°. Entra por el cono verde.` };
  else if (guided) hint = { tone: 'good', text: '¡Entra! Mantén el ángulo o toca "Enviar luz".' };
  else if (!moved) hint = { tone: 'info', text: index === 0 ? 'Mueve el láser con − y + o arrastrándolo hasta el cono verde.' : 'Esta fibra acepta un cono más estrecho: busca el ángulo.' };
  else hint = { tone: 'info', text: 'Muy inclinado: la luz se escapa por el revestimiento.' };

  return (
    <View style={styles.stage}>
      <FitBox>{(size) => <OpticsBoard size={size} target={target} index={index} angle={angle} solved={solved} verdict={verdict} hold={hold} onAngle={moveTo} />}</FitBox>
      {!(solved && last) && (
        <View style={styles.controlRow}>
          <StepButton icon="minus" label="Bajar el ángulo del láser" disabled={solved} onPress={() => moveTo(angle - ANGLE_STEP)} />
          {solved ? (
            <TelButton label="Siguiente fibra" variant="cream" iconRight="arrowRight" fullWidth={false} style={styles.flex} onPress={nextTarget} />
          ) : (
            <TelButton label="Enviar luz" variant="cream" icon="laser" fullWidth={false} style={styles.flex} onPress={confirm} />
          )}
          <StepButton icon="plus" label="Subir el ángulo del láser" disabled={solved} onPress={() => moveTo(angle + ANGLE_STEP)} />
        </View>
      )}
      <HintBox tone={hint.tone}>{hint.text}</HintBox>
    </View>
  );
}

interface OpticsBoardProps {
  size: FitSize;
  target: LightTarget;
  index: number;
  angle: number;
  solved: boolean;
  verdict: 'ok' | 'bad' | null;
  hold: number;
  onAngle: (angle: number) => void;
}

function OpticsBoard({ size, target, index, angle, solved, verdict, hold, onAngle }: OpticsBoardProps) {
  const scene = fitScene(size, 150, 230);
  const layout = sceneLayout(target, scene.H);
  const { faceX: fx, axisY: ay, orbit, length, receiverX } = layout;
  const h = target.coreHalf;
  const t = target.cladding;
  const trace = traceRay({ nCore: target.nCore, nClad: target.nClad, coreHalf: h, cladding: t, length }, angle);
  const guided = trace.outcome === 'guided';
  const laser = laserPoint(layout, angle);
  const grab = useRef<RayPoint>({ x: 0, y: 0 });
  const motion = useMotionEnabled();
  // Camino del punto de luz decorativo (en píxeles): del láser, por los rebotes, hasta el receptor.
  const runPath = [laser, { x: fx, y: ay }, ...trace.points.slice(1).map((point) => ({ x: fx + point.x, y: ay + point.y }))].map((point) => ({ x: point.x * scene.scale, y: point.y * scene.scale }));

  // Arrastrar mueve el láser siguiendo al dedo; se proyecta sobre su arco alrededor de la fibra.
  const handlers = usePanHandlers({
    canStart: () => !solved,
    onGrant: () => {
      grab.current = laserPoint(layout, angle);
    },
    onMove: (_, gesture) => onAngle(elevationFromPoint(layout, grab.current.x + gesture.dx / scene.scale, grab.current.y + gesture.dy / scene.scale)),
  });

  const arcTop = laserPoint(layout, ANGLE_MAX);
  const arcBottom = laserPoint(layout, -ANGLE_MAX);
  const coneR = orbit * 0.94;
  const coneX = fx - coneR * Math.cos(target.cone * DEG);
  const coneDy = coneR * Math.sin(target.cone * DEG);
  const toPoint = (p: RayPoint) => `${fx + p.x},${ay + p.y}`;
  const beam = { stroke: LASER, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  const leak = trace.escape[0];

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${target.name}. Láser a ${signed(angle)} grados: ${guided ? 'la luz llega al receptor' : 'la luz se escapa'}.`}
      style={[styles.board, { width: scene.width, height: scene.height }, NO_TOUCH]}
      {...handlers}
    >
      <Svg width={scene.width} height={scene.height} viewBox={`0 0 ${SCENE_W} ${scene.H}`} pointerEvents="none">
        <Path d={`M ${arcTop.x} ${arcTop.y} A ${orbit} ${orbit} 0 0 0 ${arcBottom.x} ${arcBottom.y}`} fill="none" stroke={colors.accentSoft} strokeOpacity={0.35} strokeWidth={2} strokeDasharray="2 6" strokeLinecap="round" />
        <Path
          d={`M ${fx} ${ay} L ${coneX} ${ay - coneDy} A ${coneR} ${coneR} 0 0 0 ${coneX} ${ay + coneDy} Z`}
          fill={LIT}
          fillOpacity={0.16}
          stroke={LIT}
          strokeOpacity={0.7}
          strokeWidth={1.2}
          strokeDasharray="4 4"
        />
        <Rect x={fx} y={ay - h - t} width={length} height={2 * (h + t)} rx={3} fill={CLAD} stroke={CLAD_EDGE} strokeWidth={1} />
        <Rect x={fx} y={ay - h} width={length} height={2 * h} fill={CORE} fillOpacity={guided ? 0.5 : 0.28} />
        <Line x1={fx} y1={ay - h - t} x2={fx} y2={ay + h + t} stroke={colors.accentSoft} strokeWidth={2} />
        <Rect x={receiverX + 3} y={ay - 18} width={24} height={36} rx={7} fill={colors.primaryDeep} stroke={guided ? LIT : CLAD_EDGE} strokeWidth={1.5} />
        {guided && <Circle cx={receiverX + 15} cy={ay} r={15} fill={LIT} fillOpacity={0.22} />}
        <Circle cx={receiverX + 15} cy={ay} r={guided ? 9 : 6} fill={guided ? LIT : '#27465E'} />
        <Rect x={receiverX + 3} y={ay + 22} width={24} height={3} rx={1.5} fill={colors.primarySoft} />
        {hold > 0 && <Rect x={receiverX + 3} y={ay + 22} width={24 * hold} height={3} rx={1.5} fill={LIT} />}
        <Line x1={laser.x} y1={laser.y} x2={fx} y2={ay} {...beam} strokeOpacity={0.28} strokeWidth={6} />
        <Line x1={laser.x} y1={laser.y} x2={fx} y2={ay} {...beam} strokeWidth={2.2} />
        <Polyline points={trace.points.map(toPoint).join(' ')} fill="none" {...beam} strokeOpacity={0.28} strokeWidth={6} />
        <Polyline points={trace.points.map(toPoint).join(' ')} fill="none" {...beam} strokeWidth={2.2} />
        {trace.escape.length > 2 && (
          <>
            <Polyline points={trace.escape.slice(0, 2).map(toPoint).join(' ')} fill="none" {...beam} strokeWidth={2.2} />
            <Polyline points={trace.escape.slice(1).map(toPoint).join(' ')} fill="none" {...beam} strokeOpacity={0.5} strokeWidth={2} strokeDasharray="3 4" />
          </>
        )}
        {trace.points.slice(1, 1 + trace.bounces).map((point, bounce) => (
          <Circle key={bounce} cx={fx + point.x} cy={ay + point.y} r={2.8} fill={colors.cream} />
        ))}
        <G transform={`translate(${laser.x} ${laser.y}) rotate(${angle})`}>
          {!solved && <Circle r={17} fill={colors.accent} fillOpacity={0.16} stroke={colors.accentSoft} strokeOpacity={0.7} strokeDasharray="3 3" />}
          <Rect x={-17} y={-7} width={22} height={14} rx={4} fill={colors.cream} />
          <Rect x={-17} y={-7} width={7} height={14} rx={3} fill={colors.secondary} />
          <Circle cx={5} cy={0} r={3.2} fill={LASER} />
        </G>
        {verdict === 'ok' && <Badge x={receiverX + 15} y={ay - 30} ok />}
        {verdict === 'bad' && leak && <Badge x={leak.x + fx + 6} y={ay + leak.y + Math.sign(leak.y) * 14} ok={false} />}
      </Svg>
      {motion && verdict === 'ok' && (
        <>
          <Burst key={`burst-${index}`} x={(receiverX + 15) * scene.scale} y={ay * scene.scale} size={46 * scene.scale} color={LIT} />
          <RayRunner key={`run-${index}`} points={runPath} />
        </>
      )}
      <View pointerEvents="none" style={styles.overlayTop}>
        <TelText variant="small" color="accentSoft" align="right" maxFontSizeMultiplier={1.2}>
          {target.name} · {index + 1} de {LIGHT_COUNT}
        </TelText>
        <TelText variant="label" align="right" maxFontSizeMultiplier={1.2} style={{ color: LIT }}>
          Cono ±{fmt1(target.cone)}°
        </TelText>
      </View>
      <View pointerEvents="none" style={styles.overlayBottom}>
        <TelText variant="subtitle" color="cream" align="right" tabular maxFontSizeMultiplier={1.2}>
          Ángulo {signed(angle)}°
        </TelText>
        <TelText variant="small" color="accentSoft" align="right" maxFontSizeMultiplier={1.2}>
          {guided ? (trace.bounces === 1 ? '1 rebote' : `${trace.bounces} rebotes`) : 'la luz se escapa'}
        </TelText>
      </View>
    </View>
  );
}

// ——— Etapa 2: empalmar la fibra ———

function SpliceStage({ plan, onProgress, onFinish }: StageProps) {
  const [index, setIndex] = useState(0);
  const target = plan.splices[index];
  const [offset, setOffset] = useState(target.startOffset);
  const [tilt, setTilt] = useState(target.startTilt);
  const [locked, setLocked] = useState(false);
  const [moved, setMoved] = useState(false);
  const [done, setDone] = useState<number[]>([]);
  const askContinue = useAskContinue();
  const last = index + 1 >= plan.splices.length;
  const coupling = spliceCoupling(offset, tilt, target);
  const band = couplingBand(coupling);

  function move(nextOffset: number, nextTilt: number) {
    if (locked) return;
    setOffset(clamp(Math.round(nextOffset), -OFFSET_MAX, OFFSET_MAX));
    setTilt(clamp(nextTilt, -TILT_MAX, TILT_MAX));
    setMoved(true);
  }

  function lockIn() {
    if (locked || coupling < SPLICE_LOCK) return;
    const next = [...done, coupling];
    setDone(next);
    setLocked(true);
    onProgress({ spliceCouplings: next });
    void feedbackSuccess();
    if (last) askContinue(onFinish);
  }

  function nextSplice() {
    const upcoming = plan.splices[index + 1];
    setIndex(index + 1);
    setOffset(upcoming.startOffset);
    setTilt(upcoming.startTilt);
    setLocked(false);
    setMoved(false);
  }

  const pct = Math.round(coupling * 100);
  let hint: { tone: Tone; text: string };
  if (locked) hint = { tone: 'good', text: `¡Empalme fijado! Pasa el ${pct} % de la luz.` };
  else if (band === 'ok') hint = { tone: 'good', text: '¡Ya pasa más del 90 %! Fíjalo o afina para ganar más puntos.' };
  else if (band === 'mid') hint = { tone: 'info', text: 'Casi: sigue afinando hasta pasar el 90 %.' };
  else if (!moved) hint = { tone: 'info', text: target.tilts ? 'Ahora también está girado: corrige la altura y el giro.' : 'Sube o baja el extremo hasta que los núcleos coincidan.' };
  else hint = { tone: 'info', text: 'Se pierde mucha luz: los núcleos casi no se tocan.' };

  return (
    <View style={styles.stage}>
      <FitBox>{(size) => <SpliceBoard size={size} target={target} index={index} offset={offset} tilt={tilt} locked={locked} coupling={coupling} onMove={move} />}</FitBox>
      {!(locked && last) && (
        <>
          <View style={styles.controlRow}>
            <StepButton icon="chevronUp" label="Subir el extremo" caption={target.tilts ? undefined : 'Subir'} wide disabled={locked} onPress={() => move(offset - OFFSET_STEP, tilt)} />
            <StepButton icon="chevronDown" label="Bajar el extremo" caption={target.tilts ? undefined : 'Bajar'} wide disabled={locked} onPress={() => move(offset + OFFSET_STEP, tilt)} />
            {target.tilts && <StepButton icon="refresh" flip label="Girar a la izquierda" wide disabled={locked} onPress={() => move(offset, tilt - TILT_STEP)} />}
            {target.tilts && <StepButton icon="refresh" label="Girar a la derecha" wide disabled={locked} onPress={() => move(offset, tilt + TILT_STEP)} />}
          </View>
          {locked ? (
            <TelButton label="Siguiente empalme" variant="cream" iconRight="arrowRight" onPress={nextSplice} />
          ) : (
            <TelButton label="Fijar empalme" variant={band === 'ok' ? 'success' : 'cream'} icon="check" disabled={band !== 'ok'} onPress={lockIn} />
          )}
        </>
      )}
      <HintBox tone={hint.tone}>{hint.text}</HintBox>
    </View>
  );
}

// Los dos núcleos vistos de frente: la luz solo pasa por la zona en que se superponen.
function EndView({ ratio }: { ratio: number }) {
  const r = 8;
  const d = clamp(ratio, 0, 1) * 2 * r;
  const half = Math.sqrt(Math.max(0, r * r - (d / 2) * (d / 2)));
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      {d < 0.05 ? (
        <Circle cx={12} cy={12} r={r} fill={LASER} fillOpacity={0.85} />
      ) : d < 2 * r ? (
        <Path d={`M ${12 - half} 12 A ${r} ${r} 0 0 1 ${12 + half} 12 A ${r} ${r} 0 0 1 ${12 - half} 12 Z`} fill={LASER} fillOpacity={0.85} />
      ) : null}
      <Circle cx={12} cy={12 - d / 2} r={r} fill="none" stroke={colors.accentSoft} strokeWidth={1.5} />
      <Circle cx={12} cy={12 + d / 2} r={r} fill="none" stroke={CORE} strokeWidth={1.5} />
    </Svg>
  );
}

interface SpliceBoardProps {
  size: FitSize;
  target: SpliceTarget;
  index: number;
  offset: number;
  tilt: number;
  locked: boolean;
  coupling: number;
  onMove: (offset: number, tilt: number) => void;
}

function SpliceBoard({ size, target, index, offset, tilt, locked, coupling, onMove }: SpliceBoardProps) {
  const scene = fitScene(size, 150, 230);
  const yc = scene.H / 2 + 6;
  const r = target.coreDiameter / 2;
  const c = target.cladding;
  const leftEnd = 148;
  const gap = locked ? 0 : 24;
  const rightStart = leftEnd + gap;
  const reach = SCENE_W - rightStart + 60;
  const grab = useRef(0);
  const motion = useMotionEnabled();

  // Arrastrar hacia arriba o abajo mueve el extremo derecho 1:1 (el giro se ajusta con los botones).
  const handlers = usePanHandlers({
    canStart: () => !locked,
    onGrant: () => {
      grab.current = offset;
    },
    onMove: (_, gesture) => onMove(grab.current + gesture.dy / scene.scale, tilt),
  });

  const top = Math.max(yc - r, yc + offset - r);
  const bottom = Math.min(yc + r, yc + offset + r);
  const spillFrom = offset >= 0 ? yc - r : Math.max(yc + offset + r, yc - r);
  const spillTo = offset >= 0 ? Math.min(yc + offset - r, yc + r) : yc + r;
  const pct = Math.round(coupling * 100);
  const meterColor = coupling >= SPLICE_LOCK ? LIT : coupling >= 0.6 ? colors.warning : colors.danger;
  // Al fijar el empalme, un punto de luz recorre la fibra ya unida (decorativo).
  const flowPath = [
    { x: 0, y: yc },
    { x: leftEnd, y: yc },
    { x: SCENE_W, y: yc + offset },
  ].map((point) => ({ x: point.x * scene.scale, y: point.y * scene.scale }));

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Empalme ${index + 1} de ${SPLICE_COUNT}. Pasa el ${pct} % de la luz.`}
      style={[styles.board, { width: scene.width, height: scene.height }, NO_TOUCH]}
      {...handlers}
    >
      <Svg width={scene.width} height={scene.height} viewBox={`0 0 ${SCENE_W} ${scene.H}`} pointerEvents="none">
        <Line x1={leftEnd} y1={yc - r} x2={SCENE_W} y2={yc - r} stroke={colors.accentSoft} strokeOpacity={0.35} strokeDasharray="4 4" />
        <Line x1={leftEnd} y1={yc + r} x2={SCENE_W} y2={yc + r} stroke={colors.accentSoft} strokeOpacity={0.35} strokeDasharray="4 4" />
        <Rect x={-6} y={yc - r - c} width={leftEnd + 6} height={2 * (r + c)} rx={3} fill={CLAD} stroke={CLAD_EDGE} strokeWidth={1} />
        <Rect x={-6} y={yc - r} width={leftEnd + 6} height={2 * r} fill={LASER} fillOpacity={0.5} />
        <Line x1={-6} y1={yc} x2={leftEnd} y2={yc} stroke={LASER} strokeWidth={2.2} strokeOpacity={0.9} />
        {gap > 0 && bottom > top && <Rect x={leftEnd} y={top} width={gap} height={bottom - top} fill={LASER} fillOpacity={0.6} />}
        {gap > 0 && spillTo > spillFrom && <Rect x={leftEnd} y={spillFrom} width={gap * 0.6} height={spillTo - spillFrom} fill="#FFB04D" fillOpacity={0.6 * (1 - coupling)} />}
        <G transform={`translate(${rightStart} ${yc + offset}) rotate(${tilt})`}>
          <Rect x={0} y={-(r + c)} width={reach} height={2 * (r + c)} rx={3} fill={CLAD} stroke={CLAD_EDGE} strokeWidth={1} />
          <Rect x={0} y={-r} width={reach} height={2 * r} fill={LASER} fillOpacity={0.12 + 0.45 * coupling} />
          <Line x1={0} y1={0} x2={reach} y2={0} stroke={LASER} strokeWidth={2.2} strokeOpacity={coupling} />
          {!locked && (
            <>
              <Polygon points="104,-16 112,-6 96,-6" fill={colors.cream} fillOpacity={0.85} />
              <Polygon points="104,16 112,6 96,6" fill={colors.cream} fillOpacity={0.85} />
            </>
          )}
        </G>
        {locked && (
          <>
            <Circle cx={leftEnd} cy={yc} r={13} fill={colors.cream} fillOpacity={0.3} />
            <Circle cx={leftEnd} cy={yc} r={5} fill={colors.cream} />
            <Badge x={leftEnd} y={yc - r - c - 14} ok />
          </>
        )}
      </Svg>
      {motion && locked && (
        <>
          <Burst key="joint" x={leftEnd * scene.scale} y={yc * scene.scale} size={46 * scene.scale} color={colors.cream} />
          <RayRunner key="flow" points={flowPath} />
        </>
      )}
      <View pointerEvents="none" style={styles.chip}>
        <TelText variant="small" color="accentSoft" maxFontSizeMultiplier={1.2}>
          Empalme {index + 1} de {SPLICE_COUNT}
        </TelText>
      </View>
      <View pointerEvents="none" style={styles.meter}>
        <View style={styles.meterRow}>
          <EndView ratio={Math.abs(offset) / target.coreDiameter} />
          <TelText variant="heading" color="cream" tabular maxFontSizeMultiplier={1.2}>
            Pasa {pct} %
          </TelText>
        </View>
        <View style={styles.meterTrack}>
          <View style={[styles.meterFill, { width: `${pct}%`, backgroundColor: meterColor }]} />
          <View style={styles.meterMark} />
        </View>
      </View>
    </View>
  );
}

// ——— Etapa 3: enviar un mensaje con luz ———

interface PulseInfo {
  id: number;
  bit: number;
  ok: boolean;
}

function MessageStage({ plan, onProgress, onFinish }: StageProps) {
  const letters = plan.word.split('');
  const [level, setLevel] = useState(0);
  const [received, setReceived] = useState<number[]>([]);
  const [decoded, setDecoded] = useState('');
  const [bitsOk, setBitsOk] = useState(0);
  const [errors, setErrors] = useState(0);
  const [last, setLast] = useState<{ bit: number; ok: boolean } | null>(null);
  const [taps, setTaps] = useState(0);
  const [pulses, setPulses] = useState<PulseInfo[]>([]);
  const [finished, setFinished] = useState(false);
  const [hint, setHint] = useState<{ tone: Tone; text: string }>({ tone: 'info', text: 'Mira los bits de la letra y envíalos uno por uno.' });
  const askContinue = useAskContinue();
  const letter = letters[level];
  const bits = charBits(letter);
  const cursor = received.length;
  const failed = last !== null && !last.ok;

  function send(bit: 0 | 1) {
    if (finished) return;
    const expected = bits[cursor];
    const id = taps + 1;
    setTaps(id);
    setPulses((list) => [...list.slice(-4), { id, bit, ok: bit === expected }]);
    if (bit !== expected) {
      // Un bit equivocado cuenta como error y no avanza: el receptor lo descarta y hay que reenviarlo.
      const next = errors + 1;
      setErrors(next);
      setLast({ bit, ok: false });
      setHint({ tone: 'bad', text: `Ahí iba un ${expected}: ${expected === 1 ? 'luz encendida' : 'apagado'}.` });
      onProgress({ messageErrors: next });
      void feedbackWarning();
      return;
    }
    const nextReceived = [...received, bit];
    const nextOk = bitsOk + 1;
    setBitsOk(nextOk);
    setLast({ bit, ok: true });
    onProgress({ messageBits: nextOk });
    if (nextReceived.length < bits.length) {
      const left = bits.length - nextReceived.length;
      setReceived(nextReceived);
      setHint({ tone: 'good', text: `Llegó un ${bit}. ${left === 1 ? 'Falta 1 bit.' : `Faltan ${left} bits.`}` });
      void feedbackTap();
      return;
    }
    const nextDecoded = decoded + decodeBits(nextReceived);
    setDecoded(nextDecoded);
    void feedbackSuccess();
    if (level + 1 < letters.length) {
      setLevel(level + 1);
      setReceived([]);
      setHint({ tone: 'good', text: `¡Llegó la ${letter}! Ahora envía la ${letters[level + 1]}.` });
    } else {
      setReceived(nextReceived);
      setFinished(true);
      setHint({ tone: 'good', text: `¡Mensaje recibido: ${nextDecoded}!` });
      askContinue(onFinish, 'Ver resultado');
    }
  }

  return (
    <View style={styles.stage}>
      <View style={styles.scriptRow} accessible accessibilityLabel={`Letra ${letter}, bits ${bits.join(' ')}. Vas en el bit ${Math.min(cursor + 1, bits.length)} de ${bits.length}.`}>
        <View style={styles.letterBox}>
          <TelText variant="heading" color="primary" maxFontSizeMultiplier={1.2}>
            {letter}
          </TelText>
          <TelText variant="small" color="primary" maxFontSizeMultiplier={1.2}>
            {level + 1}/{letters.length}
          </TelText>
        </View>
        <View style={styles.cells}>
          {bits.map((bit, position) => {
            const sent = position < cursor || finished;
            const current = position === cursor && !finished;
            return (
              <View key={position} style={[styles.cell, sent && styles.cellDone, current && (failed ? styles.cellBad : styles.cellNow)]}>
                <TelText variant="heading" color={sent ? 'cream' : 'primary'} maxFontSizeMultiplier={1.1}>
                  {bit}
                </TelText>
              </View>
            );
          })}
        </View>
      </View>
      <FitBox>{(size) => <MessageBoard size={size} received={received} letters={letters} decoded={decoded} last={last} pulses={pulses} />}</FitBox>
      <View style={styles.controlRow}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Enviar luz: bit 1" accessibilityState={{ disabled: finished }} disabled={finished} haptic={false} onPress={() => send(1)} scaleTo={0.94} style={[styles.bitButton, styles.bitOn, finished && styles.stepOff]}>
          <TelIcon name="bolt" size={22} color={colors.primary} strokeWidth={2.4} />
          <TelText variant="button" color="primary" maxFontSizeMultiplier={1.3}>
            Luz · 1
          </TelText>
        </PressableScale>
        <PressableScale accessibilityRole="button" accessibilityLabel="Apagado: bit 0" accessibilityState={{ disabled: finished }} disabled={finished} haptic={false} onPress={() => send(0)} scaleTo={0.94} style={[styles.bitButton, styles.bitOff, finished && styles.stepOff]}>
          <TelIcon name="moon" size={22} color={colors.cream} strokeWidth={2.4} />
          <TelText variant="button" color="cream" maxFontSizeMultiplier={1.3}>
            Apagado · 0
          </TelText>
        </PressableScale>
      </View>
      <HintBox tone={hint.tone}>{hint.text}</HintBox>
    </View>
  );
}

const PULSE_FROM = 44;
const PULSE_TO = 218;

interface MessageBoardProps {
  size: FitSize;
  received: number[];
  letters: string[];
  decoded: string;
  last: { bit: number; ok: boolean } | null;
  pulses: PulseInfo[];
}

// Láser a la izquierda, fibra en el medio y receptor a la derecha, que imprime los bits que le llegan.
function MessageBoard({ size, received, letters, decoded, last, pulses }: MessageBoardProps) {
  const motion = useMotionEnabled();
  const scene = fitScene(size, 100, 180);
  const ay = scene.H / 2;
  const s = scene.scale;
  const lit = last !== null && last.ok && last.bit === 1;
  const failed = last !== null && !last.ok;
  const slots = letters.map((_, position) => decoded[position] ?? '_').join(' ');

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Receptor: bits ${received.join(' ') || 'ninguno'}. Mensaje: ${slots}.`}
      style={[styles.board, { width: scene.width, height: scene.height }]}
    >
      <Svg width={scene.width} height={scene.height} viewBox={`0 0 ${SCENE_W} ${scene.H}`} pointerEvents="none">
        <Rect x={6} y={ay - 11} width={36} height={22} rx={5} fill={colors.cream} />
        <Rect x={6} y={ay - 11} width={10} height={22} rx={4} fill={colors.secondary} />
        <Circle cx={42} cy={ay} r={4} fill={LASER} />
        <Rect x={PULSE_FROM} y={ay - 14} width={PULSE_TO - PULSE_FROM + 4} height={28} rx={4} fill={CLAD} stroke={CLAD_EDGE} strokeWidth={1} />
        <Rect x={PULSE_FROM} y={ay - 8} width={PULSE_TO - PULSE_FROM + 4} height={16} fill={CORE} fillOpacity={lit ? 0.5 : 0.25} />
        {lit && <Line x1={PULSE_FROM} y1={ay} x2={PULSE_TO + 4} y2={ay} stroke={LASER} strokeWidth={2.2} strokeOpacity={0.9} />}
        <Rect x={PULSE_TO + 4} y={8} width={SCENE_W - PULSE_TO - 10} height={scene.H - 16} rx={8} fill={colors.primaryDeep} stroke={failed ? colors.danger : lit ? LIT : CLAD_EDGE} strokeWidth={1.5} />
        <Circle cx={PULSE_TO + 15} cy={20} r={5} fill={failed ? colors.danger : lit ? LIT : '#27465E'} />
      </Svg>
      <View pointerEvents="none" style={[styles.receiver, { left: (PULSE_TO + 8) * s, top: 8 * s, width: (SCENE_W - PULSE_TO - 18) * s, height: (scene.H - 16) * s }]}>
        <TelText variant="small" align="center" maxFontSizeMultiplier={1.1} style={{ color: failed ? colors.dangerLight : colors.accentSoft }}>
          {failed && last ? `ERROR: llegó un ${last.bit}` : 'RECIBIDO'}
        </TelText>
        <TelText variant="caption" color="cream" align="center" tabular numberOfLines={1} maxFontSizeMultiplier={1.1}>
          {received.length ? groupBits(received) : '—'}
        </TelText>
        <TelText variant="heading" color="cream" align="center" numberOfLines={1} maxFontSizeMultiplier={1.1}>
          {slots}
        </TelText>
      </View>
      {motion && decoded.length > 0 && <Burst key={decoded.length} x={(PULSE_TO + 52) * s} y={ay * s} size={50 * s} color={LIT} />}
      {motion && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {pulses.map((pulse) => (
            <Pulse key={pulse.id} bit={pulse.bit} ok={pulse.ok} from={PULSE_FROM * s} to={PULSE_TO * s} y={ay * s} r={7 * s} />
          ))}
        </View>
      )}
    </View>
  );
}

// Pulso decorativo que viaja por la fibra: brillante para un 1, un anillo tenue para un 0.
function Pulse({ bit, ok, from, to, y, r }: { bit: number; ok: boolean; from: number; to: number; y: number; r: number }): ReactNode {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.quad) }));
  }, [progress]);
  const animated = useAnimatedStyle(() => ({
    opacity: progress.value < 0.8 ? 1 : (1 - progress.value) * 5,
    transform: [{ translateX: progress.value * (to - from) }],
  }));
  return <Animated.View style={[styles.pulse, bit === 1 ? styles.pulseOn : styles.pulseOff, !ok && styles.pulseBad, { left: from - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: r }, animated]} />;
}

// Anillo decorativo que se expande y se desvanece (luz recibida, empalme fijado, letra completa).
function Burst({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) }));
  }, [progress]);
  const animated = useAnimatedStyle(() => ({ opacity: 1 - progress.value, transform: [{ scale: 0.4 + progress.value * 1.6 }] }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: color }, animated]} />;
}

// Punto de luz decorativo que recorre un camino (por ejemplo, el rayo rebotando hasta el receptor).
function RayRunner({ points }: { points: RayPoint[] }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }));
  }, [progress]);
  const times: number[] = [0];
  points.slice(1).forEach((point, position) => {
    times.push(times[position] + Math.max(0.01, Math.hypot(point.x - points[position].x, point.y - points[position].y)));
  });
  const stops = times.map((time) => time / times[times.length - 1]);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const animated = useAnimatedStyle(() => ({
    opacity: progress.value > 0.9 ? (1 - progress.value) * 10 : 1,
    transform: [{ translateX: interpolate(progress.value, stops, xs) }, { translateY: interpolate(progress.value, stops, ys) }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.runner, animated]} />;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  root: {
    flex: 1,
    gap: spacing.xs,
  },
  stage: {
    flex: 1,
    minHeight: 0,
    gap: spacing.xs,
  },
  chip: {
    position: 'absolute',
    left: 8,
    bottom: 6,
  },
  runner: {
    position: 'absolute',
    left: -6,
    top: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.white,
    boxShadow: '0px 0px 12px rgba(255, 90, 90, 1)',
  },
  summaryScroll: {
    flexGrow: 1,
    paddingBottom: spacing.sm,
  },
  board: {
    borderRadius: radius.lg,
    backgroundColor: 'rgba(18, 61, 92, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(167, 212, 237, 0.2)',
    overflow: 'hidden',
  },
  overlayTop: {
    position: 'absolute',
    right: 8,
    top: 6,
    alignItems: 'flex-end',
  },
  overlayBottom: {
    position: 'absolute',
    right: 8,
    bottom: 6,
    alignItems: 'flex-end',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  step: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepWide: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    gap: 6,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepOff: {
    opacity: 0.4,
  },
  flip: {
    transform: [{ scaleX: -1 }],
  },
  hintBox: {
    minHeight: 52,
    justifyContent: 'center',
  },
  meter: {
    position: 'absolute',
    left: 8,
    top: 6,
    width: '46%',
    gap: 2,
  },
  meterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meterTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
  },
  meterFill: {
    height: 5,
  },
  meterMark: {
    position: 'absolute',
    left: '90%',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.cream,
  },
  scriptRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
    padding: 6,
    borderRadius: radius.md,
    backgroundColor: 'rgba(7, 31, 49, 0.6)',
  },
  letterBox: {
    width: 40,
    borderRadius: 10,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cells: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  cell: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.cream,
    borderWidth: 3,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellDone: {
    backgroundColor: '#1F5E43',
  },
  cellNow: {
    borderColor: ACCENT,
  },
  cellBad: {
    borderColor: colors.danger,
    backgroundColor: '#FBE2E2',
  },
  receiver: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  bitButton: {
    flex: 1,
    height: 60,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  bitOn: {
    backgroundColor: LASER,
  },
  bitOff: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 212, 237, 0.55)',
  },
  pulse: {
    position: 'absolute',
  },
  pulseOn: {
    backgroundColor: LASER,
    boxShadow: '0px 0px 10px rgba(255, 90, 90, 0.9)',
  },
  pulseOff: {
    borderWidth: 2,
    borderColor: 'rgba(167, 212, 237, 0.7)',
  },
  pulseBad: {
    borderColor: colors.danger,
  },
});
