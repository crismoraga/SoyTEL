import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, ZoomIn } from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { Celebration } from '@/components/feedback/Celebration';
import { FitBox } from '@/components/FitBox';
import { PressableScale } from '@/components/PressableScale';
import { TelButton } from '@/components/TelButton';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { feedbackSuccess, feedbackTap, feedbackWarning } from '@/lib/feedback';
import { useMotionEnabled } from '@/lib/motion';
import { mulberry32 } from '@/route/random';
import { colors, monoFamily, radius, spacing } from '@/theme';
import { GameBoard, Hint, ScorePop, StageBanner, StationHud, StationSummary, clamp, useAskContinue, useDeadline, useFlash, useGameTimeout, useNow, usePace, usePop, useStageFlow, useSubmitOnce, type StationGameProps } from '../kit';
import {
  blockCode,
  boardInfo,
  CHOOSE_MAX,
  CODE_MAX,
  codeScore,
  paletteBlocks,
  pickScenarios,
  pins,
  requiredWires,
  simulate,
  SLOTS,
  WIRE_MAX,
  wireHint,
  wireLayout,
  wirePoints,
  type BlockId,
  type BoardId,
  type Pin,
  type Scenario,
  type Terminal,
} from '../logic/maker';

type StageKey = 'choose' | 'wire' | 'code';

// Cada etapa: la meta en una frase y la idea en dos líneas cortas.
const STAGES: { key: StageKey; title: string; goal: string; body: string; icon: IconName; seconds: number }[] = [
  {
    key: 'choose',
    title: 'Elige la placa',
    goal: 'Elige la placa más simple que sirve para cada proyecto.',
    body: 'Arduino controla LEDs y motores; el ESP32 suma Wi-Fi y Bluetooth.\nLa Raspberry Pi es un mini computador con Linux, para cosas más pesadas.',
    icon: 'board',
    seconds: 40,
  },
  {
    key: 'wire',
    title: 'Conecta el LED',
    goal: 'Une D13 a la resistencia y la pata (−) del LED a GND.',
    body: 'Sin resistencia le llega demasiada corriente al LED y se quema.\nLa corriente sale del pin D13, pasa por la resistencia y el LED, y vuelve a GND.',
    icon: 'circuit',
    seconds: 30,
  },
  {
    key: 'code',
    title: 'Programa el parpadeo',
    goal: 'Arma loop() para que el LED se prenda y apague cada 0,5 s.',
    body: 'loop() se repite sin parar mientras la placa tiene energía.\nPara parpadear: prender, esperar, apagar y esperar.',
    icon: 'code',
    seconds: 40,
  },
];

const SECONDS = STAGES.map((item) => item.seconds);
const ACCENT = '#E0B84A';
const TERMINAL_LABEL: Record<Terminal, string> = { resistor: 'Resistencia 220 Ω', cathode: 'LED (−)' };

// B213 · Hardware: Arduino, ESP32 y Raspberry Pi en tres desafíos rápidos.
export function MakerBoardsGame({ seed, deadline, onComplete }: StationGameProps) {
  const pace = usePace();
  const [cases] = useState(() => pickScenarios(mulberry32(seed ^ 0xb0a4)));
  const flow = useStageFlow(SECONDS, pace);
  const [chooseHits, setChooseHits] = useState(0);
  const [points, setPoints] = useState({ wire: 0, code: 0 });
  const now = useNow(flow.endsAt !== null, 250);
  const stage = STAGES[flow.index];
  const choosePoints = Math.round((chooseHits * CHOOSE_MAX) / cases.length);
  const total = choosePoints + points.wire + points.code;
  const accuracy = clamp((chooseHits / cases.length + points.wire / WIRE_MAX + points.code / CODE_MAX) / 3, 0, 1);
  const submit = useSubmitOnce(onComplete);
  // Si el stand cierra el proyecto antes, se entrega lo logrado hasta ese momento.
  useDeadline(deadline, () => submit({ score: total, accuracy }));

  // Callbacks estables: cada etapa los usa en efectos y no deben cambiar en cada render.
  const addHit = useCallback(() => setChooseHits((value) => value + 1), []);
  const setWire = useCallback((value: number) => setPoints((current) => (current.wire === value ? current : { ...current, wire: value })), []);
  const setCode = useCallback((value: number) => setPoints((current) => (current.code === value ? current : { ...current, code: value })), []);

  if (flow.finished) {
    return (
      <StationSummary
        title="Placas maker"
        total={total}
        message={points.code >= 300 ? '¡Tu LED parpadea! Ya programaste tu primera placa.' : 'Buen intento: el hardware se aprende probando.'}
        accent={ACCENT}
        rows={[
          { label: 'Placa correcta', value: choosePoints, max: CHOOSE_MAX, icon: 'board' },
          { label: 'Circuito', value: points.wire, max: WIRE_MAX, icon: 'circuit' },
          { label: 'Programa', value: points.code, max: CODE_MAX, icon: 'code' },
        ]}
        learned="Cada proyecto pide su placa (Arduino para lo simple, ESP32 con Wi-Fi o Bluetooth, Raspberry Pi para un computador) y un LED necesita resistencia y un loop() con delay para parpadear."
        onSubmit={() => submit({ score: total, accuracy })}
      />
    );
  }

  const secondsLeft = flow.endsAt !== null ? clamp(Math.ceil((flow.endsAt - now) / 1000), 0, Math.round(stage.seconds * pace)) : null;

  return (
    <View style={styles.root}>
      <StationHud stage={flow.index + 1} stages={STAGES.length} title={stage.title} score={total} secondsLeft={secondsLeft} totalSeconds={Math.round(stage.seconds * pace)} accent={ACCENT} />
      {flow.endsAt !== null && stage.key === 'choose' && <ChooseStage cases={cases} endsAt={flow.endsAt} onHit={addHit} onFinish={() => flow.finish(0)} />}
      {flow.endsAt !== null && stage.key === 'wire' && <WireStage endsAt={flow.endsAt} onPoints={setWire} onFinish={() => flow.finish(1)} />}
      {flow.endsAt !== null && stage.key === 'code' && <CodeStage endsAt={flow.endsAt} onPoints={setCode} onFinish={() => flow.finish(2)} />}
      {flow.banner && <StageBanner key={stage.key} index={flow.index + 1} title={stage.title} goal={stage.goal} body={stage.body} icon={stage.icon} accent={ACCENT} onDone={flow.start} />}
    </View>
  );
}

function BoardArt({ board, size }: { board: BoardId; size: number }) {
  const color = boardInfo[board].color;
  return (
    <Svg width={size} height={size * 0.7} viewBox="0 0 100 70">
      <Rect x={2} y={4} width={96} height={62} rx={6} fill={color} />
      <Rect x={38} y={22} width={24} height={24} rx={3} fill="#111820" />
      {board === 'arduino' && (
        <>
          {Array.from({ length: 10 }, (_, index) => (
            <Rect key={index} x={10 + index * 8} y={8} width={5} height={5} fill="#E9EEF2" />
          ))}
          <Rect x={4} y={40} width={16} height={14} rx={2} fill="#C9D1D8" />
        </>
      )}
      {board === 'esp32' && (
        <>
          <Path d="M70 12h20v6h-16v6h16v6h-16v6h16" stroke="#E0B84A" strokeWidth={2.5} fill="none" />
          <Rect x={8} y={12} width={22} height={40} rx={2} fill="#3B4654" />
        </>
      )}
      {board === 'rpi' && (
        <>
          <Rect x={72} y={10} width={24} height={18} rx={2} fill="#C9D1D8" />
          <Rect x={72} y={34} width={24} height={14} rx={2} fill="#C9D1D8" />
          {Array.from({ length: 8 }, (_, index) => (
            <Circle key={index} cx={12 + index * 7} cy={10} r={2.2} fill="#E0B84A" />
          ))}
        </>
      )}
    </Svg>
  );
}

// ——— Etapa 1: elegir placa ———

function ChooseStage({ cases, endsAt, onHit, onFinish }: { cases: Scenario[]; endsAt: number; onHit: () => void; onFinish: () => void }) {
  const motion = useMotionEnabled();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<BoardId | null>(null);
  const [pop, showPop] = usePop();
  const done = useRef(false);
  const askContinue = useAskContinue();
  const current = cases[index];
  // El dibujo de la placa se ajusta al ancho de cada tarjeta (3 en fila).
  const art = clamp(Math.floor((width - 32 - 16) / 3) - 16, 48, 96);

  const timeout = useCallback(() => {
    if (done.current) return;
    done.current = true;
    askContinue(onFinish, 'Tiempo agotado · Seguir');
  }, [askContinue, onFinish]);
  useGameTimeout(endsAt, timeout);

  function choose(board: BoardId) {
    if (picked || done.current) return;
    setPicked(board);
    if (board === current.answer) {
      onHit();
      showPop(`+${Math.round(CHOOSE_MAX / cases.length)}`);
      void feedbackSuccess();
    } else {
      showPop('¡Casi!', 'bad');
      void feedbackWarning();
    }
    // La explicación de la placa queda en pantalla hasta que el jugador sigue.
    const last = index + 1 >= cases.length;
    askContinue(() => {
      if (done.current) return;
      if (last) {
        done.current = true;
        onFinish();
      } else {
        setIndex(index + 1);
        setPicked(null);
      }
    }, last ? 'Continuar' : 'Siguiente proyecto');
  }

  const hint = picked ? (picked === current.answer ? `¡Bien! ${current.why}` : `Era otra placa. ${current.why}`) : 'Arduino: lo básico · ESP32: + Wi-Fi y Bluetooth · Pi: mini PC con Linux';
  return (
    <View style={styles.stage}>
      <Animated.View key={current.id} entering={motion ? FadeInDown.duration(200) : undefined} style={styles.scenario}>
        <TelText variant="small" color="secondary">
          {`PROYECTO ${index + 1} DE ${cases.length}`}
        </TelText>
        <TelText variant="subtitle" color="primary">
          {current.text}
        </TelText>
      </Animated.View>
      <View style={styles.boards}>
        {(Object.keys(boardInfo) as BoardId[]).map((board) => {
          const state = picked ? (board === current.answer ? 'right' : board === picked ? 'wrong' : 'idle') : 'idle';
          return (
            <PressableScale
              key={board}
              accessibilityRole="button"
              accessibilityLabel={boardInfo[board].name}
              disabled={Boolean(picked)}
              onPress={() => choose(board)}
              scaleTo={0.93}
              style={[styles.boardCard, state === 'right' && styles.boardRight, state === 'wrong' && styles.boardWrong]}
            >
              <BoardArt board={board} size={art} />
              <TelText variant="label" color="cream" align="center">
                {boardInfo[board].name}
              </TelText>
              {state !== 'idle' ? (
                <View style={[styles.boardBadge, { backgroundColor: state === 'right' ? colors.success : colors.danger }]}>
                  <TelIcon name={state === 'right' ? 'check' : 'close'} size={14} color={colors.white} />
                </View>
              ) : null}
            </PressableScale>
          );
        })}
      </View>
      <Hint tone={picked ? (picked === current.answer ? 'good' : 'bad') : 'info'}>{hint}</Hint>
      <ScorePop pop={pop} />
    </View>
  );
}

// ——— Etapa 2: cablear ———

function WireStage({ endsAt, onPoints, onFinish }: { endsAt: number; onPoints: (value: number) => void; onFinish: () => void }) {
  const [pinSel, setPinSel] = useState<Pin | null>(null);
  const [termSel, setTermSel] = useState<Terminal | null>(null);
  const [wires, setWires] = useState<Partial<Record<Terminal, Pin>>>({});
  const [mistakes, setMistakes] = useState(0);
  const [hint, setHint] = useState<{ text: string; tone: 'good' | 'bad' | 'info' } | null>(null);
  const [spark, flashSpark] = useFlash<boolean>(500);
  const [pop, showPop] = usePop();
  const [confetti, setConfetti] = useState<number | null>(null);
  const done = useRef(false);
  const askContinue = useAskContinue();
  const connected = Object.keys(wires).length;
  const complete = connected === 2;

  // Los puntos suben con cada cable bien puesto y bajan con cada error.
  useEffect(() => {
    onPoints(wirePoints(connected, mistakes));
  }, [connected, mistakes, onPoints]);

  const timeout = useCallback(() => {
    if (done.current) return;
    done.current = true;
    askContinue(onFinish, 'Tiempo agotado · Seguir');
  }, [askContinue, onFinish]);
  useGameTimeout(endsAt, timeout);

  function attempt(pin: Pin, terminal: Terminal) {
    setPinSel(null);
    setTermSel(null);
    if (requiredWires[terminal] === pin) {
      const next = { ...wires, [terminal]: pin };
      setWires(next);
      if (Object.keys(next).length === 2) {
        done.current = true;
        setHint({ text: '¡Circuito cerrado! D13 → resistencia → LED → GND.', tone: 'good' });
        showPop(`+${wirePoints(2, mistakes)}`);
        setConfetti(1);
        void feedbackSuccess();
        askContinue(onFinish);
      } else {
        setHint({ text: `¡Bien! ${TERMINAL_LABEL[terminal]} va a ${pin}.`, tone: 'good' });
        showPop('+60');
        void feedbackSuccess();
      }
    } else {
      setMistakes((value) => value + 1);
      flashSpark(true);
      setHint({ text: wireHint(pin, terminal), tone: 'bad' });
      showPop('−50', 'bad');
      void feedbackWarning();
    }
  }

  // Se puede empezar por el pin o por el extremo del circuito: el segundo toque cierra el cable.
  function pickPin(pin: Pin) {
    if (done.current) return;
    void feedbackTap();
    if (termSel) {
      attempt(pin, termSel);
    } else {
      setPinSel(pin);
      setHint({ text: `Pin ${pin}: ahora toca la resistencia o el LED (−).`, tone: 'info' });
    }
  }

  function pickTerminal(terminal: Terminal) {
    if (done.current || wires[terminal]) return;
    void feedbackTap();
    if (pinSel) {
      attempt(pinSel, terminal);
    } else {
      setTermSel(terminal);
      setHint({ text: `${TERMINAL_LABEL[terminal]}: ahora toca un pin de la placa.`, tone: 'info' });
    }
  }

  return (
    <View style={styles.stage}>
      <GameBoard style={styles.wireBoard}>
        <FitBox>
          {(size) => {
            const layout = wireLayout(size);
            const tx = layout.terminalX;
            const top = layout.terminalY.resistor;
            const bottom = layout.terminalY.cathode;
            const resistorY = top + (bottom - top) * 0.32;
            const ledY = top + (bottom - top) * 0.68;
            const wireStartX = layout.pad + layout.pinW;
            return (
              <View style={{ width: layout.width, height: layout.height }}>
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  <Svg width={layout.width} height={layout.height}>
                    <Rect x={0} y={0} width={layout.boardW} height={layout.height} rx={10} fill={boardInfo.arduino.color} />
                    <Line x1={tx} y1={top} x2={tx} y2={bottom} stroke="#9AA5B1" strokeWidth={3} />
                    <Rect x={tx - 9} y={resistorY - 20} width={18} height={40} rx={5} fill="#D9B98A" />
                    <Rect x={tx - 9} y={resistorY - 10} width={18} height={4} fill="#8A4B2A" />
                    <Rect x={tx - 9} y={resistorY} width={18} height={4} fill="#1E1E1E" />
                    <Rect x={tx - 9} y={resistorY + 10} width={18} height={4} fill="#8A4B2A" />
                    {complete ? <Circle cx={tx} cy={ledY} r={26} fill="#FF6B6B" opacity={0.28} /> : null}
                    <Circle cx={tx} cy={ledY} r={15} fill={complete ? '#FF6B6B' : '#7A2F2F'} stroke="#C9D1D8" strokeWidth={2} />
                    {(Object.keys(wires) as Terminal[]).map((terminal) => {
                      const pin = wires[terminal] as Pin;
                      const startY = layout.pinTop[pin] + layout.pinH / 2;
                      const endY = layout.terminalY[terminal];
                      const midX = (wireStartX + tx) / 2;
                      return <Path key={terminal} d={`M${wireStartX} ${startY} C${midX} ${startY} ${midX} ${endY} ${tx - 22} ${endY}`} stroke={terminal === 'cathode' ? '#F4ECD7' : '#FF8A80'} strokeWidth={5} fill="none" strokeLinecap="round" />;
                    })}
                    {spark ? <Path d={`M${layout.width / 2 - 10} ${layout.height / 2 - 24} l16 -2 l-6 16 l18 -4 l-24 30 l4 -18 z`} fill="#FFD84A" /> : null}
                  </Svg>
                </View>
                {pins.map((pin) => (
                  <PressableScale
                    key={pin}
                    accessibilityRole="button"
                    accessibilityLabel={`Pin ${pin}`}
                    disabled={complete}
                    onPress={() => pickPin(pin)}
                    style={[styles.pin, { left: layout.pad, top: layout.pinTop[pin], width: layout.pinW, height: layout.pinH }, pinSel === pin && styles.pinSelected]}
                  >
                    <TelText variant="label" color={pinSel === pin ? 'primary' : 'cream'}>
                      {pin}
                    </TelText>
                  </PressableScale>
                ))}
                {(Object.keys(layout.terminalY) as Terminal[]).map((terminal) => (
                  <PressableScale
                    key={terminal}
                    accessibilityRole="button"
                    accessibilityLabel={`Conectar a ${TERMINAL_LABEL[terminal]}`}
                    disabled={Boolean(wires[terminal]) || complete}
                    onPress={() => pickTerminal(terminal)}
                    style={[styles.terminal, { left: tx - layout.terminalSize / 2, top: layout.terminalY[terminal] - layout.terminalSize / 2, width: layout.terminalSize, height: layout.terminalSize }, termSel === terminal && styles.terminalSelected, Boolean(wires[terminal]) && styles.terminalDone]}
                  >
                    <View style={styles.terminalDot} />
                  </PressableScale>
                ))}
                <TelText variant="small" color="accentSoft" style={[styles.partLabel, { left: tx + 16, top: resistorY - 8 }]}>
                  220 Ω
                </TelText>
                <TelText variant="small" color="accentSoft" style={[styles.partLabel, { left: tx + 22, top: ledY - 8 }]}>
                  LED
                </TelText>
              </View>
            );
          }}
        </FitBox>
      </GameBoard>
      <Hint tone={hint ? hint.tone : 'info'}>{hint ? hint.text : 'Toca un pin de la placa y luego un extremo del circuito (o al revés).'}</Hint>
      <ScorePop pop={pop} />
      <Celebration burstKey={confetti} count={24} />
    </View>
  );
}

// ——— Etapa 3: programar ———

function BlinkingLed({ on }: { on: boolean }) {
  const glow = useSharedValue(0.25);
  useEffect(() => {
    if (!on) {
      glow.set(0.25);
      return;
    }
    glow.set(withRepeat(withSequence(withTiming(1, { duration: 80 }), withTiming(1, { duration: 420 }), withTiming(0.25, { duration: 80 }), withTiming(0.25, { duration: 420 })), -1));
  }, [glow, on]);
  const style = useAnimatedStyle(() => ({ opacity: glow.value }));
  return <Animated.View style={[styles.led, style]} />;
}

function CodeStage({ endsAt, onPoints, onFinish }: { endsAt: number; onPoints: (value: number) => void; onFinish: () => void }) {
  const motion = useMotionEnabled();
  const [program, setProgram] = useState<BlockId[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<ReturnType<typeof simulate> | null>(null);
  const [pop, showPop] = usePop();
  const [confetti, setConfetti] = useState<number | null>(null);
  const done = useRef(false);
  const askContinue = useAskContinue();

  const timeout = useCallback(() => {
    if (done.current) return;
    done.current = true;
    askContinue(onFinish, 'Tiempo agotado · Seguir');
  }, [askContinue, onFinish]);
  useGameTimeout(endsAt, timeout);

  function add(id: BlockId) {
    if (done.current || program.length >= SLOTS) return;
    setResult(null);
    setProgram([...program, id]);
    void feedbackTap();
  }

  function undo() {
    if (done.current || !program.length) return;
    setResult(null);
    setProgram(program.slice(0, -1));
    void feedbackTap();
  }

  function upload() {
    if (program.length < SLOTS || done.current) return;
    const outcome = simulate(program);
    const nextAttempt = attempt + 1;
    setAttempt(nextAttempt);
    setResult(outcome);
    const points = codeScore(nextAttempt, outcome.blinks);
    onPoints(points);
    if (outcome.blinks) {
      done.current = true;
      showPop(`+${points}`);
      setConfetti(1);
      void feedbackSuccess();
      askContinue(onFinish, 'Ver resultado');
    } else {
      showPop('¡Casi!', 'bad');
      void feedbackWarning();
      // Hay dos intentos: tras el segundo se cierra la etapa.
      if (nextAttempt >= 2) {
        done.current = true;
        askContinue(onFinish, 'Ver resultado');
      }
    }
  }

  const blinking = Boolean(result?.blinks);
  return (
    <View style={styles.stage}>
      <View style={styles.editor}>
        <View style={styles.editorHead}>
          <TelText variant="small" color="accent" style={styles.mono}>
            {'void loop() {'}
          </TelText>
          <BlinkingLed on={blinking} />
        </View>
        {Array.from({ length: SLOTS }, (_, index) => {
          const block = program[index];
          return (
            <View key={index} style={[styles.slotLine, block && styles.slotFilled]}>
              <TelText variant="small" color={block ? 'cream' : 'slate'} style={styles.mono} numberOfLines={1}>
                {block ? `${index + 1}  ${blockCode(block)}` : `${index + 1}  // paso ${index + 1}`}
              </TelText>
            </View>
          );
        })}
        <TelText variant="small" color="accent" style={styles.mono}>
          {'}'}
        </TelText>
      </View>
      <View style={styles.palette}>
        {paletteBlocks.map((block) => (
          <PressableScale
            key={block.id}
            accessibilityRole="button"
            accessibilityLabel={`Agregar ${block.code}`}
            disabled={program.length >= SLOTS || blinking}
            onPress={() => add(block.id)}
            scaleTo={0.92}
            style={styles.block}
          >
            <TelIcon name={block.icon} size={18} color={colors.primary} />
            <TelText variant="small" color="primary" numberOfLines={1} maxFontSizeMultiplier={1.15}>
              {block.label}
            </TelText>
          </PressableScale>
        ))}
      </View>
      <View style={styles.codeActions}>
        <TelButton label="Deshacer" variant="outlineLight" icon="refresh" fullWidth={false} disabled={!program.length || blinking} onPress={undo} />
        <View style={styles.flex}>
          <TelButton label="Subir a la placa" variant="cream" icon="send" disabled={program.length < SLOTS || blinking} onPress={upload} />
        </View>
      </View>
      {result ? (
        <Animated.View entering={motion ? ZoomIn.duration(200) : undefined}>
          <Hint tone={result.blinks ? 'good' : 'bad'}>{result.message}</Hint>
        </Animated.View>
      ) : (
        <Hint>Pista: prender, esperar, apagar y esperar. Tienes 2 intentos.</Hint>
      )}
      <ScorePop pop={pop} />
      <Celebration burstKey={confetti} count={26} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    gap: 6,
  },
  stage: {
    flex: 1,
    minHeight: 0,
    gap: 6,
  },
  flex: {
    flex: 1,
  },
  mono: {
    fontFamily: monoFamily,
  },
  scenario: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.lg,
    backgroundColor: colors.cream,
    gap: 2,
    justifyContent: 'center',
  },
  boards: {
    flex: 1,
    minHeight: 0,
    maxHeight: 200,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  boardCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 6,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  boardRight: {
    borderColor: '#6BC59A',
    backgroundColor: '#1F5E43',
  },
  boardWrong: {
    borderColor: '#E58A8A',
    backgroundColor: '#6E2A2A',
  },
  boardBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wireBoard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pin: {
    position: 'absolute',
    borderRadius: 10,
    backgroundColor: '#0E5A60',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinSelected: {
    backgroundColor: colors.cream,
    borderColor: colors.cream,
  },
  terminal: {
    position: 'absolute',
    borderRadius: 22,
    borderWidth: 3,
    borderColor: colors.cream,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  terminalSelected: {
    backgroundColor: 'rgba(244, 236, 215, 0.25)',
  },
  terminalDone: {
    borderStyle: 'solid',
    borderColor: '#6BC59A',
  },
  terminalDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.cream,
  },
  partLabel: {
    position: 'absolute',
  },
  editor: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.lg,
    backgroundColor: '#07131D',
    gap: 3,
  },
  editorHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 20,
  },
  slotLine: {
    flex: 1,
    minHeight: 20,
    maxHeight: 40,
    borderRadius: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(167,212,237,0.3)',
    marginLeft: 12,
  },
  slotFilled: {
    borderStyle: 'solid',
    backgroundColor: 'rgba(111,179,217,0.18)',
  },
  palette: {
    flexDirection: 'row',
    gap: 4,
  },
  block: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 12,
    backgroundColor: colors.cream,
  },
  codeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  led: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF4D4D',
    boxShadow: '0px 0px 14px rgba(255, 77, 77, 0.9)',
  },
});
