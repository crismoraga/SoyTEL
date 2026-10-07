import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { PressableScale } from '@/components/PressableScale';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { feedbackSuccess, feedbackTap, feedbackWarning } from '@/lib/feedback';
import { mulberry32, seededShuffle } from '@/route/random';
import { colors, font, radius, spacing } from '@/theme';
import { GameBoard, Hint, StageBanner, StationHud, StationSummary, gameNow, useAskContinue, useDeadline, useGameTimeout, useNow, usePace, useSubmitOnce, type StationGameProps } from '../kit';
import {
  DIAL_MAX,
  dialScore,
  EXTENSION,
  JITTER_MAX,
  jitterScore,
  mosScore,
  PHRASE,
  schedulePackets,
  SIP_MAX,
  sipDecoys,
  sipFlow,
  sipScore,
  type SipMessage,
  type VoicePacket,
} from '../logic/voip';

type StageKey = 'dial' | 'sip' | 'jitter';

const STAGES: { key: StageKey; title: string; body: string; icon: IconName; seconds: number }[] = [
  { key: 'dial', title: 'Marca el anexo', body: `Usa el teléfono IP del proyecto: llama al anexo ${EXTENSION} de la sala B213.`, icon: 'phone', seconds: 15 },
  { key: 'sip', title: 'Señalización SIP', body: 'Antes de hablar, los teléfonos negocian la llamada. Toca los mensajes SIP en el orden correcto.', icon: 'network', seconds: 25 },
  { key: 'jitter', title: 'Jitter buffer', body: 'La voz viaja en paquetes que llegan desordenados. Tócalos en orden (1, 2, 3…) antes de que caduquen.', icon: 'sound', seconds: 30 },
];

const ACCENT = '#4FB38A';

// B213 · Redes: una llamada por IP desde un teléfono fijo, de la marcación al audio.
export function VoipCallGame({ seed, deadline, onComplete }: StationGameProps) {
  const pace = usePace();
  const [random] = useState(() => mulberry32(seed ^ 0x7011));
  const [stageIndex, setStageIndex] = useState(0);
  const [banner, setBanner] = useState(true);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [points, setPoints] = useState<Record<StageKey, number>>({ dial: 0, sip: 0, jitter: 0 });
  const [delivered, setDelivered] = useState(0);
  const [finished, setFinished] = useState(false);
  const now = useNow(endsAt !== null, 250);
  const stage = STAGES[stageIndex];
  const total = points.dial + points.sip + points.jitter;

  const startStage = useCallback(() => {
    setBanner(false);
    setEndsAt(gameNow() + STAGES[stageIndex].seconds * pace * 1000);
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
  const submit = useSubmitOnce(onComplete);
  useDeadline(deadline, () => submit({ score: total, accuracy: delivered / PHRASE.length }));

  if (finished) {
    return (
      <StationSummary
        title="Llamada IP"
        total={total}
        message={`Calidad de voz (MOS): ${mosScore(delivered).toFixed(1)} de 4,5`}
        accent={ACCENT}
        rows={[
          { label: 'Marcación', value: points.dial, max: DIAL_MAX, icon: 'phone' },
          { label: 'Señalización SIP', value: points.sip, max: SIP_MAX, icon: 'network' },
          { label: 'Voz sin cortes', value: points.jitter, max: JITTER_MAX, icon: 'sound' },
        ]}
        learned="En telefonía IP, SIP establece la llamada (INVITE, Ringing, OK, ACK) y la voz viaja en paquetes RTP. El jitter buffer los reordena para que escuches sin cortes."
        onSubmit={() => submit({ score: total, accuracy: delivered / PHRASE.length })}
      />
    );
  }

  const secondsLeft = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : null;

  return (
    <View style={styles.container}>
      <StationHud stage={stageIndex + 1} stages={STAGES.length} title={stage.title} score={total} secondsLeft={secondsLeft} totalSeconds={Math.round(stage.seconds * pace)} accent={ACCENT} />
      {endsAt && stage.key === 'dial' && <DialStage endsAt={endsAt} onPoints={setStagePoints} onFinish={nextStage} />}
      {endsAt && stage.key === 'sip' && <SipStage random={random} endsAt={endsAt} onPoints={setStagePoints} onFinish={nextStage} />}
      {endsAt && stage.key === 'jitter' && (
        <JitterStage random={random} endsAt={endsAt} onPoints={setStagePoints} onDelivered={setDelivered} onFinish={nextStage} />
      )}
      {banner && <StageBanner key={stage.key} index={stageIndex + 1} title={stage.title} body={stage.body} icon={stage.icon} accent={ACCENT} onDone={startStage} />}
      {banner && <View style={styles.bannerSpace} />}
    </View>
  );
}

// ——— Etapa 1: marcar ———

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

function DialStage({ endsAt, onPoints, onFinish }: { endsAt: number; onPoints: (value: number) => void; onFinish: () => void }) {
  const [typed, setTyped] = useState('');
  const [wrong, setWrong] = useState(0);
  const [calling, setCalling] = useState(false);
  const [startedAt] = useState(() => gameNow());
  const done = useRef(false);
  const askContinue = useAskContinue();
  const pace = usePace();

  const timeout = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onPoints(0);
    askContinue(onFinish);
  }, [askContinue, onFinish, onPoints]);
  useGameTimeout(endsAt, timeout);

  function call() {
    if (calling || done.current) return;
    if (typed === EXTENSION) {
      done.current = true;
      setCalling(true);
      onPoints(dialScore((gameNow() - startedAt) / pace, wrong));
      void feedbackSuccess();
      askContinue(onFinish);
    } else {
      setWrong(wrong + 1);
      setTyped('');
      void feedbackWarning();
    }
  }

  return (
    <View style={styles.stageGap}>
      <View style={styles.deskPhone}>
        <View style={styles.lcd}>
          <TelText variant="small" color="primary">
            {calling ? 'LLAMANDO…' : 'ANEXO'}
          </TelText>
          <TelText variant="hero" color="primary" style={font('display')} tabular>
            {typed || '—'}
          </TelText>
        </View>
        <View style={styles.keypad}>
          {KEYS.map((key) => (
            <PressableScale
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`Tecla ${key}`}
              disabled={calling}
              onPress={() => {
                setTyped((value) => (value + key).slice(0, 6));
                void feedbackTap();
              }}
              scaleTo={0.9}
              style={styles.key}
            >
              <TelText variant="title" color="primary">
                {key}
              </TelText>
            </PressableScale>
          ))}
        </View>
        <View style={styles.phoneActions}>
          <PressableScale accessibilityRole="button" accessibilityLabel="Borrar" disabled={calling} onPress={() => setTyped('')} style={[styles.phoneAction, styles.clear]}>
            <TelIcon name="close" size={24} color={colors.white} />
          </PressableScale>
          <PressableScale accessibilityRole="button" accessibilityLabel="Llamar" disabled={calling} onPress={call} style={[styles.phoneAction, styles.callButton]}>
            <TelIcon name="phone" size={26} color={colors.white} />
          </PressableScale>
        </View>
      </View>
      <Hint tone={calling ? 'good' : wrong ? 'bad' : 'info'}>
        {calling ? '¡Marcaste bien! Tu teléfono envía la invitación a la central.' : wrong ? `Ese no es el anexo. Recuerda: ${EXTENSION} (sala B213).` : `Marca ${EXTENSION} y presiona el botón verde.`}
      </Hint>
    </View>
  );
}

// ——— Etapa 2: SIP ———

function SipStage({ random, endsAt, onPoints, onFinish }: { random: () => number; endsAt: number; onPoints: (value: number) => void; onFinish: () => void }) {
  const [options] = useState(() => seededShuffle([...sipFlow, ...sipDecoys], random));
  const [step, setStep] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [hint, setHint] = useState<{ text: string; tone: 'good' | 'bad' | 'info' }>({ text: 'Primero, ¿qué envía tu teléfono para iniciar la llamada?', tone: 'info' });
  const [shake, setShake] = useState<string | null>(null);
  const done = useRef(false);
  const askContinue = useAskContinue();

  const timeout = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onPoints(Math.round((sipScore(mistakes) * step) / sipFlow.length));
    askContinue(onFinish);
  }, [askContinue, mistakes, onFinish, onPoints, step]);
  useGameTimeout(endsAt, timeout);

  function choose(message: SipMessage) {
    if (done.current) return;
    const expected = sipFlow[step];
    if (message.id === expected.id) {
      const next = step + 1;
      setStep(next);
      setHint({ text: `${message.label}: ${message.meaning}`, tone: 'good' });
      void feedbackTap();
      if (next >= sipFlow.length) {
        done.current = true;
        onPoints(sipScore(mistakes));
        void feedbackSuccess();
        askContinue(onFinish);
      }
    } else {
      setMistakes(mistakes + 1);
      setShake(message.id);
      setTimeout(() => setShake(null), 400);
      setHint({ text: sipDecoys.some((decoy) => decoy.id === message.id) ? message.meaning : `Todavía no: ${message.label} va más adelante.`, tone: 'bad' });
      void feedbackWarning();
    }
  }

  return (
    <View style={styles.stageGap}>
      <GameBoard style={styles.ladder}>
        <View style={styles.ladderHead}>
          <TelText variant="label" color="cream">
            Tu teléfono
          </TelText>
          <TelText variant="label" color="cream">
            Anexo {EXTENSION}
          </TelText>
        </View>
        <View style={styles.ladderBody}>
          <View style={[styles.lane, styles.laneLeft]} />
          <View style={[styles.lane, styles.laneRight]} />
          {sipFlow.slice(0, step).map((message) => (
            <Animated.View key={message.id} entering={FadeInDown.duration(220)} style={styles.arrowRow}>
              <View style={[styles.arrowLine, message.direction === 'in' && styles.arrowIn]}>
                <TelText variant="small" color="primary" style={styles.arrowLabel}>
                  {message.label}
                </TelText>
                <TelIcon name={message.direction === 'out' ? 'arrowRight' : 'arrowLeft'} size={16} color={colors.primary} />
              </View>
            </Animated.View>
          ))}
          {step >= sipFlow.length && (
            <Animated.View entering={FadeIn.delay(200)} style={styles.rtp}>
              <TelIcon name="sound" size={18} color={colors.cream} />
              <TelText variant="small" color="cream">
                Audio RTP ⇄
              </TelText>
            </Animated.View>
          )}
        </View>
      </GameBoard>
      <View style={styles.sipOptions}>
        {options.map((message) => {
          const used = sipFlow.slice(0, step).some((item) => item.id === message.id);
          return (
            <PressableScale
              key={message.id}
              accessibilityRole="button"
              accessibilityLabel={message.label}
              disabled={used}
              onPress={() => choose(message)}
              scaleTo={0.92}
              style={[styles.sipChip, used && styles.sipUsed, shake === message.id && styles.sipWrong]}
            >
              <TelText variant="label" color={used ? 'slate' : 'primary'} style={font('bodyBold')}>
                {message.label}
              </TelText>
            </PressableScale>
          );
        })}
      </View>
      <Hint tone={hint.tone}>{hint.text}</Hint>
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
  const [shake, setShake] = useState<number | null>(null);
  const done = useRef(false);
  const askContinue = useAskContinue();
  const now = useNow(true, 150);

  const delivered = Object.values(played).filter((value) => value === 'ok').length;

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onDelivered(delivered);
    onPoints(jitterScore(delivered, wrong));
    askContinue(onFinish, 'Ver resultado');
  }, [askContinue, delivered, onDelivered, onFinish, onPoints, wrong]);
  useGameTimeout(endsAt, finish);

  useEffect(() => {
    if (!done.current && expected > PHRASE.length) finish();
  }, [expected, finish]);

  // Si el paquete esperado caducó, se pierde y la voz sigue sin él.
  const awaited = expected <= PHRASE.length ? packets[expected - 1] : null;
  useGameTimeout(
    awaited ? awaited.expiresAt : null,
    () => {
      if (done.current) return;
      setPlayed((current) => ({ ...current, [expected]: 'lost' }));
      setExpected((value) => (value === expected ? value + 1 : value));
      void feedbackWarning();
    },
    expected,
  );

  useEffect(() => {
    onPoints(jitterScore(delivered, wrong));
  }, [delivered, onPoints, wrong]);

  function tap(packet: VoicePacket) {
    if (done.current || played[packet.seq]) return;
    if (packet.seq === expected) {
      setPlayed((current) => ({ ...current, [packet.seq]: 'ok' }));
      setExpected(expected + 1);
      void feedbackTap();
    } else {
      setWrong(wrong + 1);
      setShake(packet.seq);
      setTimeout(() => setShake(null), 350);
      void feedbackWarning();
    }
  }

  const visible = packets.filter((packet) => now >= packet.arrivesAt && now < packet.expiresAt && !played[packet.seq]);

  return (
    <View style={styles.stageGap}>
      <View style={styles.transcript}>
        <TelIcon name="sound" size={18} color={colors.cream} />
        <TelText variant="label" color="cream" style={styles.flex}>
          {PHRASE.map((word, index) => (played[index + 1] === 'ok' ? word : played[index + 1] === 'lost' ? '…' : '_')).join(' ')}
        </TelText>
      </View>
      <GameBoard style={styles.arrivals}>
        <TelText variant="small" color="accentSoft">
          LLEGANDO · SIGUIENTE: #{Math.min(expected, PHRASE.length)}
        </TelText>
        <View style={styles.packetGrid}>
          {visible.map((packet) => {
            const life = Math.max(0, (packet.expiresAt - now) / (packet.expiresAt - packet.arrivesAt));
            return (
              <Animated.View key={packet.seq} entering={ZoomIn.duration(160)} exiting={ZoomOut.duration(120)}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`Paquete ${packet.seq}`}
                  onPress={() => tap(packet)}
                  scaleTo={0.9}
                  style={[styles.voicePacket, packet.seq === expected && styles.voiceNext, shake === packet.seq && styles.voiceWrong]}
                >
                  <TelText variant="title" color="primary" tabular>
                    #{packet.seq}
                  </TelText>
                  <View style={styles.lifeTrack}>
                    <View style={[styles.lifeFill, { width: `${life * 100}%`, backgroundColor: life < 0.3 ? colors.danger : ACCENT }]} />
                  </View>
                </PressableScale>
              </Animated.View>
            );
          })}
          {visible.length === 0 && (
            <TelText variant="caption" color="accentSoft">
              Esperando paquetes…
            </TelText>
          )}
        </View>
      </GameBoard>
      <Hint tone={wrong ? 'bad' : 'info'}>
        {expected > PHRASE.length ? `Llamada completa · MOS ${mosScore(delivered).toFixed(1)}` : 'Un paquete que llega tarde ya no sirve: la voz se corta.'}
      </Hint>
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
  deskPhone: {
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: '#1B2B38',
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: '#2E4A5E',
  },
  lcd: {
    borderRadius: radius.md,
    backgroundColor: '#B7E3C8',
    paddingVertical: 8,
    alignItems: 'center',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  key: {
    width: '30%',
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  phoneAction: {
    flex: 1,
    height: 52,
    borderRadius: 16,
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
    padding: spacing.sm,
    minHeight: 250,
  },
  ladderHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  ladderBody: {
    marginTop: spacing.xs,
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: spacing.sm,
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
    left: 18,
  },
  laneRight: {
    right: 18,
  },
  arrowRow: {
    height: 30,
    justifyContent: 'center',
  },
  arrowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.cream,
  },
  arrowIn: {
    flexDirection: 'row-reverse',
    backgroundColor: colors.accentSoft,
  },
  arrowLabel: {
    letterSpacing: 0.5,
  },
  rtp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: ACCENT,
  },
  sipOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  sipChip: {
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.cream,
    justifyContent: 'center',
  },
  sipUsed: {
    backgroundColor: colors.primarySoft,
  },
  sipWrong: {
    backgroundColor: colors.danger,
  },
  transcript: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(7,31,49,0.6)',
    minHeight: 56,
  },
  arrivals: {
    padding: spacing.md,
    gap: spacing.sm,
    minHeight: 240,
  },
  packetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  voicePacket: {
    width: 88,
    height: 80,
    borderRadius: 18,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  voiceNext: {
    borderColor: ACCENT,
  },
  voiceWrong: {
    backgroundColor: colors.danger,
  },
  lifeTrack: {
    width: 60,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  lifeFill: {
    height: 5,
  },
});
