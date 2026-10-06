import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, ZoomIn } from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { PressableScale } from '@/components/PressableScale';
import { TelButton } from '@/components/TelButton';
import type { IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { feedbackSuccess, feedbackTap, feedbackWarning } from '@/lib/feedback';
import { mulberry32 } from '@/route/random';
import { colors, font, radius, spacing } from '@/theme';
import { GameBoard, Hint, StageBanner, StationHud, StationSummary, useAskContinue, useDeadline, useNow, usePace, useSubmitOnce, type StationGameProps } from '../kit';
import {
  boardInfo,
  CHOOSE_MAX,
  CODE_MAX,
  codeBlocks,
  codeScore,
  pickScenarios,
  pins,
  requiredWires,
  simulate,
  SLOTS,
  WIRE_MAX,
  wireHint,
  wireScore,
  type BlockId,
  type BoardId,
  type Pin,
  type Terminal,
} from '../logic/maker';

type StageKey = 'choose' | 'wire' | 'code';

const STAGES: { key: StageKey; title: string; body: string; icon: IconName; seconds: number }[] = [
  { key: 'choose', title: 'Elige la placa', body: 'Arduino, ESP32 o Raspberry Pi: cada proyecto necesita la placa adecuada.', icon: 'board', seconds: 26 },
  { key: 'wire', title: 'Conecta el LED', body: 'Toca un pin de la placa y luego la pata del circuito. La resistencia va al pin 13 y el LED a tierra.', icon: 'plug', seconds: 22 },
  { key: 'code', title: 'Programa el parpadeo', body: 'Arma el loop() para que el LED se encienda y apague cada medio segundo.', icon: 'code', seconds: 30 },
];

const ACCENT = '#E0B84A';

// B213 · Hardware: Arduino, ESP32 y Raspberry Pi en tres desafíos rápidos.
export function MakerBoardsGame({ seed, deadline, onComplete }: StationGameProps) {
  const pace = usePace();
  const [cases] = useState(() => pickScenarios(mulberry32(seed ^ 0xb0a4)));
  const [stageIndex, setStageIndex] = useState(0);
  const [banner, setBanner] = useState(true);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [points, setPoints] = useState<Record<StageKey, number>>({ choose: 0, wire: 0, code: 0 });
  const [chooseHits, setChooseHits] = useState(0);
  const [finished, setFinished] = useState(false);
  const now = useNow(endsAt !== null, 250);
  const stage = STAGES[stageIndex];
  const total = points.choose + points.wire + points.code;

  const startStage = useCallback(() => {
    setBanner(false);
    setEndsAt(Date.now() + STAGES[stageIndex].seconds * pace * 1000);
  }, [pace, stageIndex]);

  const nextStage = useCallback(() => {
    setEndsAt(null);
    if (stageIndex < STAGES.length - 1) {
      setStageIndex(stageIndex + 1);
      setBanner(true);
    } else {
      setFinished(true);
    }
  }, [stageIndex]);

  const setStagePoints = useCallback((value: number) => setPoints((current) => ({ ...current, [stage.key]: value })), [stage.key]);
  const accuracy = (chooseHits / cases.length + points.wire / WIRE_MAX + points.code / CODE_MAX) / 3;
  const submit = useSubmitOnce(onComplete);
  useDeadline(deadline, () => submit({ score: total, accuracy }));

  if (finished) {
    return (
      <StationSummary
        title="Placas maker"
        total={total}
        message={points.code >= 300 ? '¡Tu LED parpadea! Ya programaste tu primera placa.' : 'Buen intento: el hardware se aprende probando.'}
        accent={ACCENT}
        rows={[
          { label: 'Placa correcta', value: points.choose, max: CHOOSE_MAX, icon: 'board' },
          { label: 'Circuito', value: points.wire, max: WIRE_MAX, icon: 'plug' },
          { label: 'Programa', value: points.code, max: CODE_MAX, icon: 'code' },
        ]}
        learned="Arduino es un microcontrolador simple, el ESP32 suma Wi-Fi y Bluetooth, y la Raspberry Pi es un computador con Linux. Un LED necesita resistencia y el código se repite en loop()."
        onSubmit={() => submit({ score: total, accuracy })}
      />
    );
  }

  const secondsLeft = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : null;

  return (
    <View style={styles.container}>
      <StationHud stage={stageIndex + 1} stages={STAGES.length} title={stage.title} score={total} secondsLeft={secondsLeft} totalSeconds={Math.round(stage.seconds * pace)} accent={ACCENT} />
      {endsAt && stage.key === 'choose' && (
        <ChooseStage
          cases={cases}
          endsAt={endsAt}
          onHit={() => {
            setChooseHits((value) => value + 1);
            setPoints((current) => ({ ...current, choose: current.choose + CHOOSE_MAX / cases.length }));
          }}
          onFinish={nextStage}
        />
      )}
      {endsAt && stage.key === 'wire' && <WireStage endsAt={endsAt} onPoints={setStagePoints} onFinish={nextStage} />}
      {endsAt && stage.key === 'code' && <CodeStage endsAt={endsAt} onPoints={setStagePoints} onFinish={nextStage} />}
      {banner && <StageBanner key={stage.key} index={stageIndex + 1} title={stage.title} body={stage.body} icon={stage.icon} accent={ACCENT} onDone={startStage} />}
      {banner && <View style={styles.bannerSpace} />}
    </View>
  );
}

function useStageTimeout(endsAt: number, onTimeout: () => void) {
  useEffect(() => {
    const timer = setTimeout(onTimeout, Math.max(0, endsAt - Date.now()));
    return () => clearTimeout(timer);
  }, [endsAt, onTimeout]);
}

function BoardArt({ board, size = 88 }: { board: BoardId; size?: number }) {
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

function ChooseStage({ cases, endsAt, onHit, onFinish }: { cases: ReturnType<typeof pickScenarios>; endsAt: number; onHit: () => void; onFinish: () => void }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<BoardId | null>(null);
  const done = useRef(false);
  const askContinue = useAskContinue();
  const current = cases[index];

  const timeout = useCallback(() => {
    if (done.current) return;
    done.current = true;
    askContinue(onFinish);
  }, [askContinue, onFinish]);
  useStageTimeout(endsAt, timeout);

  function choose(board: BoardId) {
    if (picked || done.current) return;
    setPicked(board);
    if (board === current.answer) {
      onHit();
      void feedbackSuccess();
    } else {
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

  return (
    <View style={styles.stageGap}>
      <Animated.View key={current.id} entering={FadeInDown.duration(200)} style={styles.scenario}>
        <TelText variant="small" color="secondary">
          PROYECTO {index + 1} DE {cases.length}
        </TelText>
        <TelText variant="heading" color="primary">
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
              <BoardArt board={board} size={84} />
              <TelText variant="label" color="cream" align="center">
                {boardInfo[board].name}
              </TelText>
            </PressableScale>
          );
        })}
      </View>
      <Hint tone={picked ? (picked === current.answer ? 'good' : 'bad') : 'info'}>{picked ? current.why : boardInfo.esp32.detail.replace('Microcontrolador', 'Pista: el ESP32 es un microcontrolador')}</Hint>
    </View>
  );
}

// ——— Etapa 2: cablear ———

const TERMINAL_LABEL: Record<Terminal, string> = { resistor: 'Resistencia 220 Ω', cathode: 'LED (−)' };

function WireStage({ endsAt, onPoints, onFinish }: { endsAt: number; onPoints: (value: number) => void; onFinish: () => void }) {
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [wires, setWires] = useState<Partial<Record<Terminal, Pin>>>({});
  const [mistakes, setMistakes] = useState(0);
  const [hint, setHint] = useState<{ text: string; tone: 'good' | 'bad' | 'info' }>({ text: 'Toca un pin de la placa y luego una pata del circuito.', tone: 'info' });
  const [spark, setSpark] = useState(false);
  const done = useRef(false);
  const askContinue = useAskContinue();

  const timeout = useCallback(() => {
    if (done.current) return;
    done.current = true;
    const correct = Object.keys(wires).length;
    onPoints(correct === 2 ? wireScore(mistakes) : correct * 60);
    askContinue(onFinish);
  }, [askContinue, mistakes, onFinish, onPoints, wires]);
  useStageTimeout(endsAt, timeout);

  function connect(terminal: Terminal) {
    if (done.current || wires[terminal]) return;
    if (!selectedPin) {
      setHint({ text: 'Primero elige un pin de la placa (izquierda).', tone: 'info' });
      return;
    }
    if (requiredWires[terminal] === selectedPin) {
      const next = { ...wires, [terminal]: selectedPin };
      setWires(next);
      setSelectedPin(null);
      void feedbackSuccess();
      if (Object.keys(next).length === 2) {
        done.current = true;
        onPoints(wireScore(mistakes));
        setHint({ text: '¡Circuito cerrado! Corriente: pin 13 → resistencia → LED → GND.', tone: 'good' });
        askContinue(onFinish);
      } else {
        setHint({ text: `¡Bien! ${TERMINAL_LABEL[terminal]} conectada a ${selectedPin}.`, tone: 'good' });
      }
    } else {
      setMistakes(mistakes + 1);
      setSpark(true);
      setTimeout(() => setSpark(false), 500);
      setHint({ text: wireHint(selectedPin, terminal), tone: 'bad' });
      setSelectedPin(null);
      void feedbackWarning();
    }
  }

  const complete = Object.keys(wires).length === 2;
  const pinY = (pin: Pin) => 36 + pins.indexOf(pin) * 50;
  const terminalPos: Record<Terminal, { x: number; y: number }> = { resistor: { x: 196, y: 70 }, cathode: { x: 250, y: 190 } };

  return (
    <View style={styles.stageGap}>
      <GameBoard style={styles.breadboard}>
        <Svg width={300} height={230} viewBox="0 0 300 230" style={styles.circuitSvg}>
          <Rect x={8} y={10} width={72} height={210} rx={10} fill={boardInfo.arduino.color} />
          {(Object.keys(wires) as Terminal[]).map((terminal) => {
            const pin = wires[terminal] as Pin;
            const target = terminalPos[terminal];
            return <Path key={terminal} d={`M86 ${pinY(pin)} C140 ${pinY(pin)} ${target.x - 60} ${target.y} ${target.x} ${target.y}`} stroke={terminal === 'cathode' ? '#222' : '#E0605A'} strokeWidth={5} fill="none" strokeLinecap="round" />;
          })}
          <Rect x={186} y={62} width={14} height={60} rx={5} fill="#D9B98A" />
          <Rect x={186} y={78} width={14} height={4} fill="#8A4B2A" />
          <Rect x={186} y={88} width={14} height={4} fill="#1E1E1E" />
          <Rect x={186} y={98} width={14} height={4} fill="#8A4B2A" />
          <Line x1={193} y1={122} x2={193} y2={150} stroke="#9AA5B1" strokeWidth={3} />
          <Circle cx={214} cy={164} r={22} fill={complete ? '#FF6B6B' : '#7A2F2F'} opacity={complete ? 0.95 : 0.8} />
          <Line x1={214} y1={186} x2={250} y2={190} stroke="#9AA5B1" strokeWidth={3} />
          {spark && <Path d="M150 110 l14 -18 l-4 14 l16 -6 l-18 22 l4 -14 z" fill="#FFD84A" />}
        </Svg>
        {pins.map((pin) => (
          <PressableScale
            key={pin}
            accessibilityRole="button"
            accessibilityLabel={`Pin ${pin}`}
            disabled={complete}
            onPress={() => {
              setSelectedPin(pin);
              void feedbackTap();
            }}
            style={[styles.pin, { top: pinY(pin) - 14 }, selectedPin === pin && styles.pinSelected]}
          >
            <TelText variant="small" color={selectedPin === pin ? 'primary' : 'cream'} style={font('bodyHeavy')}>
              {pin}
            </TelText>
          </PressableScale>
        ))}
        {(Object.keys(terminalPos) as Terminal[]).map((terminal) => (
          <PressableScale
            key={terminal}
            accessibilityRole="button"
            accessibilityLabel={`Conectar a ${TERMINAL_LABEL[terminal]}`}
            disabled={Boolean(wires[terminal]) || complete}
            onPress={() => connect(terminal)}
            style={[styles.terminal, { marginLeft: -150 + terminalPos[terminal].x - 22, top: terminalPos[terminal].y - 18 }, Boolean(wires[terminal]) && styles.terminalDone]}
          >
            <View style={styles.terminalDot} />
          </PressableScale>
        ))}
        <TelText variant="small" color="accentSoft" style={styles.resistorLabel}>
          220 Ω
        </TelText>
        <TelText variant="small" color="accentSoft" style={styles.ledLabel}>
          LED (−)
        </TelText>
      </GameBoard>
      <Hint tone={hint.tone}>{hint.text}</Hint>
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
  const [program, setProgram] = useState<BlockId[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<ReturnType<typeof simulate> | null>(null);
  const done = useRef(false);
  const askContinue = useAskContinue();

  const timeout = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onPoints(attempt > 0 ? codeScore(attempt, false) : 0);
    askContinue(onFinish, 'Ver resultado');
  }, [askContinue, attempt, onFinish, onPoints]);
  useStageTimeout(endsAt, timeout);

  function upload() {
    if (program.length < SLOTS || done.current) return;
    const outcome = simulate(program);
    const nextAttempt = attempt + 1;
    setAttempt(nextAttempt);
    setResult(outcome);
    if (outcome.blinks) {
      done.current = true;
      onPoints(codeScore(nextAttempt, true));
      void feedbackSuccess();
      askContinue(onFinish, 'Ver resultado');
    } else {
      void feedbackWarning();
      if (nextAttempt >= 2) {
        done.current = true;
        onPoints(codeScore(nextAttempt, false));
        askContinue(onFinish, 'Ver resultado');
      }
    }
  }

  const usedIds = new Set(program);

  return (
    <View style={styles.stageGap}>
      <View style={styles.editor}>
        <TelText variant="label" color="accent" style={font('bodyBold')}>
          {'void loop() {'}
        </TelText>
        {Array.from({ length: SLOTS }, (_, index) => {
          const block = program[index];
          const code = codeBlocks.find((item) => item.id === block)?.code;
          return (
            <View key={index} style={[styles.slotLine, block && styles.slotFilled]}>
              <TelText variant="label" color={block ? 'cream' : 'slate'} style={font('bodyBold')}>
                {code ?? `  // paso ${index + 1}`}
              </TelText>
            </View>
          );
        })}
        <TelText variant="label" color="accent" style={font('bodyBold')}>
          {'}'}
        </TelText>
      </View>
      <View style={styles.palette}>
        {codeBlocks.map((block) => (
          <PressableScale
            key={block.id}
            accessibilityRole="button"
            accessibilityLabel={`Agregar ${block.code}`}
            disabled={usedIds.has(block.id) || program.length >= SLOTS || Boolean(result?.blinks)}
            onPress={() => {
              setResult(null);
              setProgram([...program, block.id]);
              void feedbackTap();
            }}
            scaleTo={0.94}
            style={[styles.block, usedIds.has(block.id) && styles.blockUsed]}
          >
            <TelText variant="small" color={usedIds.has(block.id) ? 'slate' : 'primary'} style={font('bodyBold')}>
              {block.code}
            </TelText>
          </PressableScale>
        ))}
      </View>
      <View style={styles.codeActions}>
        <TelButton label="Borrar" variant="outlineLight" icon="refresh" size="sm" fullWidth={false} disabled={!program.length || Boolean(result?.blinks)} onPress={() => setProgram([])} />
        <View style={styles.flex}>
          <TelButton label="Subir a la placa" variant="cream" icon="send" size="sm" disabled={program.length < SLOTS || Boolean(result?.blinks)} onPress={upload} />
        </View>
        <BlinkingLed on={Boolean(result?.blinks)} />
      </View>
      {result && (
        <Animated.View entering={ZoomIn.duration(200)}>
          <Hint tone={result.blinks ? 'good' : 'bad'}>{result.message}</Hint>
        </Animated.View>
      )}
      {!result && (
        <Animated.View entering={FadeIn}>
          <Hint>Pista: encender, esperar, apagar, esperar.</Hint>
        </Animated.View>
      )}
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
  flex: {
    flex: 1,
  },
  stageGap: {
    gap: spacing.sm,
  },
  scenario: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.cream,
    gap: 4,
    minHeight: 96,
    justifyContent: 'center',
  },
  boards: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  boardCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
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
  breadboard: {
    height: 240,
    alignItems: 'center',
  },
  circuitSvg: {
    marginTop: 4,
  },
  pin: {
    position: 'absolute',
    left: '50%',
    marginLeft: -150 + 14,
    width: 60,
    height: 36,
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
    left: '50%',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: colors.cream,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
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
  resistorLabel: {
    position: 'absolute',
    top: 96,
    left: '50%',
    marginLeft: 58,
  },
  ledLabel: {
    position: 'absolute',
    top: 214,
    left: '50%',
    marginLeft: 4,
  },
  editor: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: '#07131D',
    gap: 6,
  },
  slotLine: {
    minHeight: 34,
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
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  block: {
    paddingHorizontal: 10,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.cream,
    justifyContent: 'center',
  },
  blockUsed: {
    backgroundColor: colors.primarySoft,
  },
  codeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  led: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FF4D4D',
    boxShadow: '0px 0px 18px rgba(255, 77, 77, 0.9)',
  },
});
