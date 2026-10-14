import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Celebration } from '@/components/feedback/Celebration';
import { PressableScale } from '@/components/PressableScale';
import { TelButton } from '@/components/TelButton';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { feedbackSuccess, feedbackWarning } from '@/lib/feedback';
import { useMotionEnabled } from '@/lib/motion';
import { mulberry32 } from '@/route/random';
import { colors, radius, spacing } from '@/theme';
import { Hint, ScorePop, StageBanner, StationHud, StationSummary, clamp, gameNow, useCompact, useDeadline, useFlash, useGameTimeout, useNow, usePace, usePop, useSubmitOnce, type StationGameProps } from '../kit';
import { CARD_SECONDS, cardRows, channelInfo, DECISION_POINTS, FALSE_ALARM_POINTS, FLAG_POINTS, pickCards, tally, type CardRow } from '../logic/security';

const ACCENT = '#E58A5A';

interface Feedback {
  ok: boolean;
  // Segundos que quedaban al decidir (la barra superior se queda con ese valor).
  left: number;
  title: string;
  body: string;
}

interface Stamp {
  id: string;
  ok: boolean;
  label: string;
}

type RowState = 'idle' | 'found' | 'normal' | 'missed';

// B213 · Software (Shielded): ¿bloquear o confiar? Toca lo que te dé desconfianza y decide a tiempo.
export function ShieldedGame({ seed, deadline, onComplete }: StationGameProps) {
  const pace = usePace();
  const motion = useMotionEnabled();
  const compact = useCompact();
  const [cards] = useState(() => pickCards(mulberry32(seed ^ 0x5e1d)));
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [cardStartedAt, setCardStartedAt] = useState(0);
  // Filas tocadas por mensaje y decisión de cada uno (true = acertó).
  const [taps, setTaps] = useState<Record<string, string[]>>({});
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [tip, setTip] = useState<{ text: string; tone: 'good' | 'bad' } | null>(null);
  const [finished, setFinished] = useState(false);
  const [streak, setStreak] = useState(0);
  const [confetti, setConfetti] = useState<number | null>(null);
  const [pop, showPop] = usePop();
  const [stamp, flashStamp] = useFlash<Stamp>(1500);
  const busy = useRef(false);
  const card = cards[index];
  const cardMs = CARD_SECONDS * pace * 1000;
  const totalSeconds = Math.ceil(cardMs / 1000);
  const now = useNow(started && !feedback && !finished, 250);

  // La misma cuenta para la barra superior, el resumen y el cierre forzado.
  const result = tally(cards, decisions, taps);
  const accuracy = result.decided ? result.correct / result.decided : 0;
  const submit = useSubmitOnce(onComplete);
  useDeadline(deadline, () => submit({ score: result.score, accuracy }));

  const decide = useCallback(
    (block: boolean | null) => {
      if (busy.current || finished || !card) return;
      busy.current = true;
      const ok = block !== null && block === card.threat;
      const left = clamp(Math.ceil((cardStartedAt + cardMs - gameNow()) / 1000), 0, totalSeconds);
      setDecisions((current) => ({ ...current, [card.id]: ok }));
      setTip(null);
      const title = block === null ? '¡Se acabó el tiempo!' : ok ? (card.threat ? '¡Amenaza bloqueada!' : '¡Bien! Era confiable') : card.threat ? 'Era una amenaza' : 'Era confiable';
      setFeedback({ ok, left, title, body: block === null ? `${card.threat ? 'Era una amenaza. ' : 'Era confiable. '}${card.explanation}` : card.explanation });
      flashStamp({ id: card.id, ok, label: block === null ? 'SIN TIEMPO' : block ? 'BLOQUEADO' : 'CONFIADO' });
      if (ok) {
        const next = streak + 1;
        setStreak(next);
        showPop(next >= 2 ? `¡Racha x${next}! +${DECISION_POINTS}` : `+${DECISION_POINTS}`);
        if (next % 3 === 0) setConfetti((value) => (value ?? 0) + 1);
        void feedbackSuccess();
      } else {
        setStreak(0);
        void feedbackWarning();
      }
    },
    [card, cardMs, cardStartedAt, finished, flashStamp, showPop, streak, totalSeconds],
  );

  // La explicación queda a la vista hasta que el jugador pasa al siguiente mensaje.
  const advance = useCallback(() => {
    busy.current = false;
    setFeedback(null);
    setTip(null);
    if (index + 1 >= cards.length) {
      setFinished(true);
    } else {
      setIndex(index + 1);
      setCardStartedAt(gameNow());
    }
  }, [cards.length, index]);

  const beginCards = useCallback(() => {
    setStarted(true);
    setCardStartedAt(gameNow());
  }, []);

  // Tiempo límite por mensaje (con el reloj del juego: en pausa no corre).
  useGameTimeout(!started || feedback || finished ? null : cardStartedAt + cardMs, () => decide(null), index);

  function tapRow(row: CardRow) {
    if (feedback || !started || finished || !card) return;
    if ((taps[card.id] ?? []).includes(row.key)) return;
    setTaps((current) => ({ ...current, [card.id]: [...(current[card.id] ?? []), row.key] }));
    if (row.flags.length) {
      const points = row.flags.length * FLAG_POINTS;
      setTip({ tone: 'good', text: `+${points} · ${row.flags.map((flag) => card.flags[flag].why).join(' ')}` });
      showPop(`+${points}`);
      void feedbackSuccess();
    } else {
      setTip({ tone: 'bad', text: `Esa parte es normal: −${FALSE_ALARM_POINTS}. Busca lo que no encaja.` });
      showPop(`−${FALSE_ALARM_POINTS}`, 'bad');
      void feedbackWarning();
    }
  }

  if (finished) {
    const threats = cards.filter((item) => item.threat);
    const legit = cards.filter((item) => !item.threat);
    const blocked = threats.filter((item) => decisions[item.id] === true).length;
    const trusted = legit.filter((item) => decisions[item.id] === true).length;
    const totalFlags = cards.reduce((sum, item) => sum + item.flags.length, 0);
    return (
      <StationSummary
        title="Escudo digital"
        total={result.score}
        message={`Bloqueaste ${blocked} de ${threats.length} amenazas.`}
        accent={ACCENT}
        rows={[
          { label: 'Amenazas bloqueadas', value: blocked, max: threats.length, icon: 'shieldCheck' },
          { label: 'Mensajes confiables', value: trusted, max: legit.length, icon: 'checkCircle' },
          { label: 'Señales de alerta', value: result.found, max: totalFlags, icon: 'alert' },
        ]}
        learned="Desconfía de la urgencia, los premios, los dominios raros y los permisos de más: ante la duda, bloquea y verifica por otro canal."
        onSubmit={() => submit({ score: result.score, accuracy })}
      />
    );
  }

  const secondsLeft = !started ? totalSeconds : feedback ? feedback.left : clamp(Math.ceil((cardStartedAt + cardMs - now) / 1000), 0, totalSeconds);
  const rows = card ? cardRows(card) : [];
  const channel = card ? channelInfo[card.channel] : null;
  const last = index + 1 >= cards.length;

  function stateOf(row: CardRow): RowState {
    if ((taps[card.id] ?? []).includes(row.key)) return row.flags.length ? 'found' : 'normal';
    if (feedback && row.flags.length) return 'missed';
    return 'idle';
  }

  return (
    <View style={styles.root}>
      <StationHud stage={Math.min(index + 1, cards.length)} stages={cards.length} unit="MENSAJE" title="Bandeja de entrada" score={result.score} secondsLeft={secondsLeft} totalSeconds={totalSeconds} accent={ACCENT} />
      <View style={styles.cardArea}>
        {started && card && channel ? (
          <ScrollView style={styles.cardScroll} contentContainerStyle={styles.cardScrollContent} showsVerticalScrollIndicator={false}>
            <Animated.View key={card.id} entering={motion ? FadeIn.duration(200) : undefined} style={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.channelIcon}>
                  <TelIcon name={channel.icon} size={18} color={colors.white} />
                </View>
                <TelText variant="small" color="muted" style={styles.flex}>
                  {channel.label.toUpperCase()}
                </TelText>
                {streak >= 2 ? (
                  <View style={styles.streak}>
                    <TelIcon name="flame" size={14} color={colors.white} />
                    <TelText variant="small" color="white">{`Racha x${streak}`}</TelText>
                  </View>
                ) : null}
              </View>
              {rows.map((row) => (
                <RowButton key={row.key} row={row} state={stateOf(row)} locked={Boolean(feedback)} compact={compact} onPress={() => tapRow(row)} />
              ))}
            </Animated.View>
          </ScrollView>
        ) : null}
        {stamp ? (
          <Animated.View key={stamp.id} pointerEvents="none" entering={motion ? ZoomIn.springify().damping(8) : undefined} style={[styles.stamp, { borderColor: stamp.ok ? '#6BC59A' : '#FF9C9C' }]}>
            <TelIcon name={stamp.ok ? 'check' : 'close'} size={22} color={stamp.ok ? '#9BE3BC' : '#FFB0B0'} />
            <TelText variant="heading" style={{ color: stamp.ok ? '#9BE3BC' : '#FFB0B0' }}>
              {stamp.label}
            </TelText>
          </Animated.View>
        ) : null}
        <ScorePop pop={pop} />
      </View>
      {feedback ? (
        <Animated.View entering={motion ? ZoomIn.duration(180) : undefined} style={[styles.feedback, { backgroundColor: feedback.ok ? '#1F5E43' : '#6E2A2A' }]} accessibilityLiveRegion="polite">
          <TelIcon name={feedback.ok ? 'check' : 'close'} size={24} color={colors.white} />
          <View style={styles.flex}>
            <TelText variant="label" color="white">
              {feedback.title}
            </TelText>
            <TelText variant="caption" color="white">
              {feedback.body}
            </TelText>
          </View>
        </Animated.View>
      ) : tip ? (
        <Hint tone={tip.tone}>{tip.text}</Hint>
      ) : (
        <Hint>{`Toca lo que te dé desconfianza (+${FLAG_POINTS}). Luego decide.`}</Hint>
      )}
      {feedback ? (
        <TelButton label={last ? 'Ver resultado' : 'Siguiente mensaje'} variant="cream" iconRight="arrowRight" onPress={advance} />
      ) : (
        <View style={styles.actions}>
          <PressableScale accessibilityRole="button" accessibilityLabel="Bloquear" disabled={!started} onPress={() => decide(true)} scaleTo={0.93} style={[styles.action, styles.block]}>
            <TelIcon name="shieldLock" size={24} color={colors.white} />
            <TelText variant="heading" color="white">
              Bloquear
            </TelText>
          </PressableScale>
          <PressableScale accessibilityRole="button" accessibilityLabel="Confiar" disabled={!started} onPress={() => decide(false)} scaleTo={0.93} style={[styles.action, styles.trust]}>
            <TelIcon name="checkCircle" size={24} color={colors.white} />
            <TelText variant="heading" color="white">
              Confiar
            </TelText>
          </PressableScale>
        </View>
      )}
      <Celebration burstKey={confetti} count={26} />
      {!started && (
        <StageBanner
          index={1}
          title="Escudo digital"
          goal="Bloquea las amenazas y confía en los mensajes seguros."
          body={`Los estafadores mandan mensajes falsos para robar tus claves o instalar virus.\nToca lo que te dé desconfianza (+${FLAG_POINTS}) y decide. Tienes ${totalSeconds} segundos por mensaje.`}
          icon="phishing"
          accent={ACCENT}
          onDone={beginCards}
        />
      )}
    </View>
  );
}

// Una fila del mensaje: todas se ven igual hasta que se tocan (nada delata cuáles son las señales reales).
function RowButton({ row, state, locked, compact, onPress }: { row: CardRow; state: RowState; locked: boolean; compact: boolean; onPress: () => void }) {
  const found = state === 'found';
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${row.kind === 'from' ? 'Remitente' : 'Mensaje'}: ${row.text}`}
      accessibilityHint="Toca si te parece sospechoso"
      accessibilityState={{ disabled: locked }}
      disabled={locked}
      onPress={onPress}
      scaleTo={0.98}
      style={[styles.row, found && styles.rowFound, state === 'normal' && styles.rowNormal, state === 'missed' && styles.rowMissed]}
    >
      <View style={styles.flex}>
        {row.kind === 'from' ? (
          <TelText variant="small" color={found ? 'white' : 'muted'}>
            DE
          </TelText>
        ) : null}
        <TelText variant={row.kind === 'from' || compact ? 'label' : 'body'} color={found ? 'white' : 'primary'}>
          {row.text}
        </TelText>
      </View>
      {found ? <TelIcon name="alert" size={20} color={colors.white} /> : null}
      {state === 'normal' ? <TelIcon name="checkCircle" size={20} color={colors.success} /> : null}
      {state === 'missed' ? <TelIcon name="alert" size={20} color={colors.danger} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    gap: 6,
  },
  flex: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  cardArea: {
    flex: 1,
    minHeight: 0,
  },
  cardScroll: {
    flex: 1,
  },
  cardScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.sm,
    gap: 6,
    backgroundColor: colors.white,
    boxShadow: '0px 10px 24px rgba(0, 0, 0, 0.3)',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 30,
  },
  channelIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: '#E2672B',
  },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#EEF4FA',
  },
  rowFound: {
    backgroundColor: colors.danger,
  },
  rowNormal: {
    backgroundColor: '#E3F1EA',
  },
  rowMissed: {
    backgroundColor: '#FBEAEA',
    borderColor: colors.danger,
  },
  stamp: {
    position: 'absolute',
    alignSelf: 'center',
    top: '34%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 3,
    backgroundColor: 'rgba(7, 31, 49, 0.94)',
    transform: [{ rotate: '-8deg' }],
    zIndex: 12,
  },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    minHeight: 52,
    borderRadius: radius.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  action: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  block: {
    backgroundColor: colors.danger,
  },
  trust: {
    backgroundColor: colors.success,
  },
});
