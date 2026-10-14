import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Celebration } from '@/components/feedback/Celebration';
import { FitBox } from '@/components/FitBox';
import { PressableScale } from '@/components/PressableScale';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { feedbackSuccess, feedbackTap, feedbackWarning } from '@/lib/feedback';
import { useMotionEnabled } from '@/lib/motion';
import { mulberry32 } from '@/route/random';
import { colors, font, radius, spacing } from '@/theme';
import { GameBoard, Hint, ScorePop, StageBanner, StationHud, StationSummary, clamp, gameNow, useAskContinue, useDeadline, useFlash, useGameTimeout, useNow, usePace, usePop, useStageFlow, useSubmitOnce, type StationGameProps } from '../kit';
import {
  DIAL_MAX,
  dialLayout,
  dialScore,
  EXTENSION,
  JITTER_MAX,
  jitterScore,
  mosScore,
  PHRASE,
  schedulePackets,
  SIP_MAX,
  sipOptions,
  sipProgressScore,
  sipSteps,
  type SipOption,
  type VoicePacket,
} from '../logic/voip';

type StageKey = 'dial' | 'sip' | 'jitter';

// Cada etapa: la meta en una frase y la idea en dos líneas cortas.
const STAGES: { key: StageKey; title: string; goal: string; body: string; icon: IconName; seconds: number }[] = [
  {
    key: 'dial',
    title: 'Marca el anexo',
    goal: `Marca el anexo ${EXTENSION} y presiona el botón verde.`,
    body: 'Un teléfono IP manda tu voz por la red de datos, como un mensaje de chat.\nPrimero hay que marcar el anexo: el número interno de la sala.',
    icon: 'phone',
    seconds: 20,
  },
  {
    key: 'sip',
    title: 'Señalización SIP',
    goal: 'Elige el mensaje correcto en cada paso de la llamada.',
    body: 'Antes de hablar, los teléfonos se ponen de acuerdo con mensajes SIP.\nCada paso cuenta qué pasó: toca el mensaje que corresponde.',
    icon: 'handshake',
    seconds: 40,
  },
  {
    key: 'jitter',
    title: 'Jitter buffer',
    goal: 'Toca los paquetes en orden (#1, #2, #3…) antes de que caduquen.',
    body: 'La voz viaja en paquetes que llegan con retraso y desordenados.\nEl jitter buffer los espera y los ordena para que la voz se oiga bien.',
    icon: 'sound',
    seconds: 30,
  },
];

const SECONDS = STAGES.map((item) => item.seconds);
const ACCENT = '#4FB38A';
// Puntos de cada paquete que llega a tiempo (JITTER_MAX repartido entre las palabras).
const PACKET_POINTS = Math.round(JITTER_MAX / PHRASE.length);

// B213 · Redes: una llamada por IP desde un teléfono fijo, de la marcación al audio.
export function VoipCallGame({ seed, deadline, onComplete }: StationGameProps) {
  const pace = usePace();
  const [random] = useState(() => mulberry32(seed ^ 0x7011));
  const flow = useStageFlow(SECONDS, pace);
  const [points, setPoints] = useState({ dial: 0, sip: 0, jitter: 0 });
  const [delivered, setDelivered] = useState(0);
  const now = useNow(flow.endsAt !== null, 250);
  const stage = STAGES[flow.index];
  const total = points.dial + points.sip + points.jitter;
  const accuracy = clamp(total / 1000, 0, 1);
  const submit = useSubmitOnce(onComplete);
  // Si el stand cierra el proyecto antes, se entrega lo logrado hasta ese momento.
  useDeadline(deadline, () => submit({ score: total, accuracy }));

  // Callbacks estables: cada etapa los usa en efectos y no deben cambiar en cada render.
  const setDial = useCallback((value: number) => setPoints((current) => (current.dial === value ? current : { ...current, dial: value })), []);
  const setSip = useCallback((value: number) => setPoints((current) => (current.sip === value ? current : { ...current, sip: value })), []);
  const setJitter = useCallback((value: number) => setPoints((current) => (current.jitter === value ? current : { ...current, jitter: value })), []);

  if (flow.finished) {
    return (
      <StationSummary
        title="Llamada IP"
        total={total}
        message={`Calidad de voz (MOS): ${mosScore(delivered).toFixed(1).replace('.', ',')} de 4,5`}
        accent={ACCENT}
        rows={[
          { label: 'Marcación', value: points.dial, max: DIAL_MAX, icon: 'phone' },
          { label: 'Señalización SIP', value: points.sip, max: SIP_MAX, icon: 'handshake' },
          { label: 'Voz sin cortes', value: points.jitter, max: JITTER_MAX, icon: 'sound' },
        ]}
        learned="En una llamada IP, SIP arma la llamada (INVITE, Ringing, OK, ACK) y la voz viaja en paquetes RTP que el jitter buffer ordena."
        onSubmit={() => submit({ score: total, accuracy })}
      />
    );
  }

  const secondsLeft = flow.endsAt !== null ? clamp(Math.ceil((flow.endsAt - now) / 1000), 0, Math.round(stage.seconds * pace)) : null;

  return (
    <View style={styles.root}>
      <StationHud stage={flow.index + 1} stages={STAGES.length} title={stage.title} score={total} secondsLeft={secondsLeft} totalSeconds={Math.round(stage.seconds * pace)} accent={ACCENT} />
      {flow.endsAt !== null && stage.key === 'dial' && <DialStage endsAt={flow.endsAt} onPoints={setDial} onFinish={() => flow.finish(0)} />}
      {flow.endsAt !== null && stage.key === 'sip' && <SipStage random={random} endsAt={flow.endsAt} onPoints={setSip} onFinish={() => flow.finish(1)} />}
      {flow.endsAt !== null && stage.key === 'jitter' && <JitterStage random={random} endsAt={flow.endsAt} onPoints={setJitter} onDelivered={setDelivered} onFinish={() => flow.finish(2)} />}
      {flow.banner && <StageBanner key={stage.key} index={flow.index + 1} title={stage.title} goal={stage.goal} body={stage.body} icon={stage.icon} accent={ACCENT} onDone={flow.start} />}
    </View>
  );
}

// ——— Etapa 1: marcar ———

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

function DialStage({ endsAt, onPoints, onFinish }: { endsAt: number; onPoints: (value: number) => void; onFinish: () => void }) {
  const [typed, setTyped] = useState('');
  const [wrong, setWrong] = useState(0);
  const [status, setStatus] = useState<'idle' | 'wrong' | 'calling'>('idle');
  const [startedAt] = useState(() => gameNow());
  const [confetti, setConfetti] = useState<number | null>(null);
  const [pop, showPop] = usePop();
  const done = useRef(false);
  const askContinue = useAskContinue();
  const pace = usePace();

  const timeout = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onPoints(0);
    askContinue(onFinish, 'Tiempo agotado · Seguir');
  }, [askContinue, onFinish, onPoints]);
  useGameTimeout(endsAt, timeout);

  function press(key: string) {
    if (done.current) return;
    setTyped((value) => (value + key).slice(0, 6));
    setStatus('idle');
    void feedbackTap();
  }

  function call() {
    if (done.current) return;
    if (typed === EXTENSION) {
      done.current = true;
      setStatus('calling');
      const points = dialScore((gameNow() - startedAt) / pace, wrong);
      onPoints(points);
      showPop(`+${points}`);
      setConfetti(1);
      void feedbackSuccess();
      askContinue(onFinish);
    } else {
      setWrong((value) => value + 1);
      setTyped('');
      setStatus('wrong');
      showPop('−20', 'bad');
      void feedbackWarning();
    }
  }

  const caption = status === 'calling' ? `✓ Llamando al ${EXTENSION}…` : status === 'wrong' ? `✗ Ese no es: marca ${EXTENSION}` : `Marca el anexo ${EXTENSION}`;

  return (
    <View style={styles.stage}>
      <FitBox maxWidth={360}>
        {(size) => {
          const layout = dialLayout({ width: size.width - 16, height: size.height - 16 });
          const lcdWidth = layout.width - 48 - 56 - 2 * layout.gap;
          return (
            <View style={[styles.deskPhone, { width: layout.width + 16, gap: layout.gap }]}>
              <View style={[styles.lcdRow, { height: layout.lcdH, gap: layout.gap }]}>
                <View style={[styles.lcd, status === 'wrong' && styles.lcdWrong, status === 'calling' && styles.lcdCalling, { width: lcdWidth }]}>
                  <TelText variant="small" color="primary" numberOfLines={1}>
                    {caption}
                  </TelText>
                  <TelText variant="title" color="primary" style={font('display')} tabular numberOfLines={1}>
                    {typed || '—'}
                  </TelText>
                </View>
                <PressableScale accessibilityRole="button" accessibilityLabel="Borrar" disabled={status === 'calling'} onPress={() => setTyped('')} style={[styles.sideKey, styles.clear, { width: 48 }]}>
                  <TelIcon name="close" size={24} color={colors.white} />
                </PressableScale>
                <PressableScale accessibilityRole="button" accessibilityLabel="Llamar" disabled={status === 'calling'} onPress={call} style={[styles.sideKey, styles.callButton, { width: 56 }]}>
                  <TelIcon name="phone" size={26} color={colors.white} />
                </PressableScale>
              </View>
              <View style={[styles.keypad, { width: layout.width, gap: layout.gap }]}>
                {KEYS.map((key) => (
                  <PressableScale
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={`Tecla ${key}`}
                    disabled={status === 'calling'}
                    onPress={() => press(key)}
                    scaleTo={0.9}
                    style={[styles.key, { width: layout.keyW, height: layout.keyH }]}
                  >
                    <TelText variant="title" color="primary">
                      {key}
                    </TelText>
                  </PressableScale>
                ))}
              </View>
            </View>
          );
        }}
      </FitBox>
      <ScorePop pop={pop} />
      <Celebration burstKey={confetti} count={22} />
    </View>
  );
}

// ——— Etapa 2: SIP ———

function SipStage({ random, endsAt, onPoints, onFinish }: { random: () => number; endsAt: number; onPoints: (value: number) => void; onFinish: () => void }) {
  const motion = useMotionEnabled();
  // Las tres opciones de cada paso, mezcladas una sola vez con la semilla.
  const [options] = useState(() => sipSteps.map((item) => sipOptions(item, random)));
  const [step, setStep] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [hint, setHint] = useState<{ text: string; tone: 'good' | 'bad' | 'info' } | null>(null);
  const [shake, flashShake] = useFlash<string>(400);
  const [pop, showPop] = usePop();
  const [confetti, setConfetti] = useState<number | null>(null);
  const done = useRef(false);
  const askContinue = useAskContinue();
  const complete = step >= sipSteps.length;
  const at = Math.min(step, sipSteps.length - 1);
  const current = sipSteps[at];

  // Los puntos suben con cada paso correcto y bajan con cada error.
  useEffect(() => {
    onPoints(sipProgressScore(step, mistakes));
  }, [mistakes, onPoints, step]);

  const timeout = useCallback(() => {
    if (done.current) return;
    done.current = true;
    askContinue(onFinish, 'Tiempo agotado · Seguir');
  }, [askContinue, onFinish]);
  useGameTimeout(endsAt, timeout);

  function choose(option: SipOption) {
    if (done.current) return;
    if (option.correct) {
      const next = step + 1;
      setStep(next);
      setHint({ text: `${option.label}: ${option.why}`, tone: 'good' });
      showPop(`+${Math.round(300 / sipSteps.length)}`);
      if (next >= sipSteps.length) {
        done.current = true;
        setConfetti(1);
        void feedbackSuccess();
        askContinue(onFinish);
      } else {
        void feedbackTap();
      }
    } else {
      setMistakes((value) => value + 1);
      flashShake(option.id);
      setHint({ text: option.why, tone: 'bad' });
      showPop('−45', 'bad');
      void feedbackWarning();
    }
  }

  return (
    <View style={styles.stage}>
      <GameBoard style={styles.ladder}>
        <View style={styles.ladderHead}>
          <TelText variant="small" color="cream">
            Tu teléfono
          </TelText>
          <TelText variant="small" color="cream">
            {`Anexo ${EXTENSION}`}
          </TelText>
        </View>
        <View style={styles.ladderBody}>
          <View style={[styles.lane, styles.laneLeft]} />
          <View style={[styles.lane, styles.laneRight]} />
          {sipSteps.map((item, index) => {
            const state = index < step ? 'done' : index === step && !complete ? 'now' : 'todo';
            return (
              <View key={item.message.id} style={styles.ladderRow}>
                {state === 'done' ? (
                  <Animated.View entering={motion ? FadeInDown.duration(220) : undefined} style={[styles.pill, item.message.direction === 'in' && styles.pillIn]}>
                    <TelText variant="small" color="primary">
                      {item.message.label}
                    </TelText>
                    <TelIcon name={item.message.direction === 'out' ? 'arrowRight' : 'arrowLeft'} size={14} color={colors.primary} />
                  </Animated.View>
                ) : (
                  <View style={[styles.pill, styles.pillEmpty, state === 'now' && styles.pillNow]}>
                    <TelText variant="small" color={state === 'now' ? 'cream' : 'slate'}>
                      {state === 'now' ? '¿?' : `${index + 1}`}
                    </TelText>
                  </View>
                )}
              </View>
            );
          })}
          <View style={styles.ladderRow}>
            {complete ? (
              <Animated.View entering={motion ? FadeIn.delay(150) : undefined} style={[styles.pill, styles.rtp]}>
                <TelIcon name="sound" size={14} color={colors.cream} />
                <TelText variant="small" color="cream">
                  Audio RTP ⇄
                </TelText>
              </Animated.View>
            ) : (
              <View style={[styles.pill, styles.pillEmpty]}>
                <TelText variant="small" color="slate">
                  Audio
                </TelText>
              </View>
            )}
          </View>
        </View>
      </GameBoard>
      <TelText variant="label" color="cream" align="center" style={styles.prompt}>
        {complete ? '¡Llamada establecida! Ya pueden hablar.' : current.prompt}
      </TelText>
      <View style={styles.optionRow}>
        {options[at].map((option) => (
          <PressableScale key={option.id} accessibilityRole="button" accessibilityLabel={option.label} disabled={complete} onPress={() => choose(option)} scaleTo={0.94} style={[styles.option, complete && styles.optionOff, shake === option.id && styles.optionWrong]}>
            <TelText variant="label" color="primary" align="center" numberOfLines={2}>
              {option.label}
            </TelText>
          </PressableScale>
        ))}
      </View>
      <Hint tone={hint ? hint.tone : 'info'}>{hint ? hint.text : 'Cada mensaje SIP tiene su momento: lee la pregunta y elige.'}</Hint>
      <ScorePop pop={pop} />
      <Celebration burstKey={confetti} count={22} />
    </View>
  );
}

// ——— Etapa 3: jitter buffer ———

function JitterStage({
  random,
  endsAt,
  onPoints,
  onDelivered,
  onFinish,
}: {
  random: () => number;
  endsAt: number;
  onPoints: (value: number) => void;
  onDelivered: (value: number) => void;
  onFinish: () => void;
}) {
  const pace = usePace();
  const [packets] = useState<VoicePacket[]>(() => schedulePackets(random, gameNow() + 900, pace));
  const [expected, setExpected] = useState(1);
  const [played, setPlayed] = useState<Record<number, 'ok' | 'lost'>>({});
  const [wrong, setWrong] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hint, setHint] = useState<{ text: string; tone: 'good' | 'bad' } | null>(null);
  const [shake, flashShake] = useFlash<number>(350);
  const [pop, showPop] = usePop();
  const [confetti, setConfetti] = useState<number | null>(null);
  const done = useRef(false);
  const askContinue = useAskContinue();
  const now = useNow(true, 150);

  const delivered = Object.values(played).filter((value) => value === 'ok').length;
  const finished = expected > PHRASE.length;

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    askContinue(onFinish, 'Ver resultado');
  }, [askContinue, onFinish]);
  useGameTimeout(endsAt, finish);

  useEffect(() => {
    if (expected > PHRASE.length) finish();
  }, [expected, finish]);

  // El puntaje y los paquetes entregados se informan al instante: si el stand cierra el juego, cuentan.
  useEffect(() => {
    onPoints(jitterScore(delivered, wrong));
    onDelivered(delivered);
  }, [delivered, onDelivered, onPoints, wrong]);

  // Si el paquete esperado caduca, se pierde y la voz sigue sin él.
  const awaited = finished ? null : packets[expected - 1];
  useGameTimeout(
    awaited ? awaited.expiresAt : null,
    () => {
      if (done.current) return;
      setPlayed((current) => ({ ...current, [expected]: 'lost' }));
      setExpected((value) => (value === expected ? value + 1 : value));
      setStreak(0);
      setHint({ text: `Se perdió el #${expected}: llegó tarde y la voz se corta.`, tone: 'bad' });
      void feedbackWarning();
    },
    expected,
  );

  function tap(packet: VoicePacket) {
    if (done.current || played[packet.seq]) return;
    if (packet.seq === expected) {
      setPlayed((current) => ({ ...current, [packet.seq]: 'ok' }));
      setExpected(expected + 1);
      const next = streak + 1;
      setStreak(next);
      showPop(next >= 3 ? `¡x${next}! +${PACKET_POINTS}` : `+${PACKET_POINTS}`);
      setHint({ text: `Se oye «${packet.word}»: el #${packet.seq} llegó a tiempo.`, tone: 'good' });
      if (packet.seq === PHRASE.length && delivered + 1 >= 8) setConfetti(1);
      void feedbackTap();
    } else {
      setWrong((value) => value + 1);
      setStreak(0);
      flashShake(packet.seq);
      showPop('−15', 'bad');
      setHint({ text: `Todavía no: primero va el #${expected}.`, tone: 'bad' });
      void feedbackWarning();
    }
  }

  return (
    <View style={styles.stage}>
      <View style={styles.transcript}>
        <TelIcon name="sound" size={18} color={colors.cream} />
        <TelText variant="label" color="cream" style={styles.flex}>
          {PHRASE.map((word, index) => (played[index + 1] === 'ok' ? word : played[index + 1] === 'lost' ? '…' : '_')).join(' ')}
        </TelText>
      </View>
      <GameBoard style={styles.arrivals}>
        <TelText variant="small" color="accentSoft" align="center">
          {finished ? 'LLAMADA COMPLETA' : `SIGUIENTE: #${expected}`}
        </TelText>
        <FitBox maxHeight={200}>
          {({ width, height }) => {
            const gap = 6;
            const cell = Math.max(44, Math.floor(Math.min((width - 4 * gap) / 5, (height - gap) / 2, 78)));
            return (
              <View style={[styles.slotGrid, { width: 5 * cell + 4 * gap, gap }]}>
                {packets.map((packet) => {
                  const result = played[packet.seq];
                  const ready = !result && now >= packet.arrivesAt && now < packet.expiresAt;
                  const late = !result && now >= packet.expiresAt;
                  const life = clamp((packet.expiresAt - now) / (packet.expiresAt - packet.arrivesAt), 0, 1);
                  return (
                    <PressableScale
                      key={packet.seq}
                      accessibilityRole="button"
                      accessibilityLabel={`Paquete ${packet.seq}`}
                      accessibilityState={{ disabled: !ready }}
                      disabled={!ready}
                      onPress={() => tap(packet)}
                      scaleTo={0.9}
                      style={[
                        styles.slot,
                        { width: cell, height: cell },
                        ready && styles.slotReady,
                        ready && packet.seq === expected && styles.slotNext,
                        result === 'ok' && styles.slotOk,
                        (result === 'lost' || late) && styles.slotLost,
                        shake === packet.seq && styles.slotWrong,
                      ]}
                    >
                      {result === 'ok' ? (
                        <TelIcon name="check" size={22} color={colors.white} />
                      ) : result === 'lost' || late ? (
                        <TelIcon name="close" size={20} color={colors.white} />
                      ) : null}
                      <TelText variant={ready ? 'heading' : 'label'} color={ready ? 'primary' : result ? 'white' : 'slate'} tabular>
                        {ready || result || late ? `#${packet.seq}` : '…'}
                      </TelText>
                      {ready ? (
                        <View style={styles.lifeTrack}>
                          <View style={[styles.lifeFill, { width: `${life * 100}%`, backgroundColor: life < 0.3 ? colors.danger : ACCENT }]} />
                        </View>
                      ) : null}
                    </PressableScale>
                  );
                })}
              </View>
            );
          }}
        </FitBox>
      </GameBoard>
      <Hint tone={hint ? hint.tone : 'info'}>
        {finished ? `Llamada completa · MOS ${mosScore(delivered).toFixed(1).replace('.', ',')}` : hint ? hint.text : 'Un paquete que llega tarde ya no sirve: la voz se corta.'}
      </Hint>
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
  deskPhone: {
    padding: 8,
    borderRadius: radius.xl,
    backgroundColor: '#1B2B38',
    borderWidth: 2,
    borderColor: '#2E4A5E',
  },
  lcdRow: {
    flexDirection: 'row',
  },
  lcd: {
    borderRadius: radius.md,
    backgroundColor: '#B7E3C8',
    paddingHorizontal: 10,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  lcdWrong: {
    backgroundColor: '#F2B8B8',
  },
  lcdCalling: {
    backgroundColor: '#8EE3B0',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  key: {
    borderRadius: 14,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideKey: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clear: {
    backgroundColor: colors.danger,
  },
  callButton: {
    backgroundColor: colors.success,
  },
  ladder: {
    flex: 1,
    padding: spacing.xs,
  },
  ladderHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  ladderBody: {
    flex: 1,
    minHeight: 0,
    marginTop: 4,
    gap: 2,
    paddingBottom: 4,
  },
  lane: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.accentSoft,
    opacity: 0.4,
  },
  laneLeft: {
    left: '11%',
  },
  laneRight: {
    right: '11%',
  },
  ladderRow: {
    flex: 1,
    minHeight: 18,
    maxHeight: 34,
    justifyContent: 'center',
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: '11%',
    borderRadius: radius.pill,
    backgroundColor: colors.cream,
  },
  pillIn: {
    flexDirection: 'row-reverse',
    backgroundColor: colors.accentSoft,
  },
  pillEmpty: {
    backgroundColor: 'rgba(167, 212, 237, 0.08)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(167, 212, 237, 0.3)',
  },
  pillNow: {
    borderColor: ACCENT,
    borderStyle: 'solid',
    borderWidth: 2,
  },
  rtp: {
    backgroundColor: ACCENT,
  },
  prompt: {
    minHeight: 40,
  },
  optionRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  option: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 6,
    borderRadius: 14,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionOff: {
    opacity: 0.5,
  },
  optionWrong: {
    backgroundColor: '#F2A0A0',
  },
  transcript: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: 'rgba(7,31,49,0.6)',
    minHeight: 48,
  },
  arrivals: {
    flex: 1,
    padding: spacing.xs,
    gap: 4,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  slot: {
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  slotReady: {
    backgroundColor: colors.cream,
  },
  slotNext: {
    borderColor: ACCENT,
  },
  slotOk: {
    backgroundColor: '#1F8A5B',
  },
  slotLost: {
    backgroundColor: '#6E2A2A',
  },
  slotWrong: {
    backgroundColor: '#F2A0A0',
  },
  lifeTrack: {
    width: '70%',
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  lifeFill: {
    height: 5,
  },
});
