import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSpring, withTiming, ZoomIn } from 'react-native-reanimated';
import { PressableScale } from '@/components/PressableScale';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { now as clockNow } from '@/lib/clock';
import { feedbackSuccess, feedbackTap, feedbackWarning } from '@/lib/feedback';
import { usePanHandlers } from '@/lib/usePanHandlers';
import { mulberry32 } from '@/route/random';
import { colors, radius, spacing } from '@/theme';
import { clamp, Hint, StageBanner, StationHud, StationSummary, useNow, type StationGameProps } from '../kit';
import {
  CARD_SECONDS,
  channelInfo,
  DECISION_POINTS,
  FLAG_POINTS,
  maxScore,
  pickCards,
  segmentCard,
  type Segment,
  type SecurityCard,
} from '../logic/security';

const ACCENT = '#E58A5A';
const SWIPE = 90;

// B213 · Software (Shielded): decide qué mensajes bloquear y detecta las señales de alerta.
export function ShieldedGame({ seed, onComplete }: StationGameProps) {
  const [cards] = useState(() => pickCards(mulberry32(seed ^ 0x5e1d)));
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [cardStartedAt, setCardStartedAt] = useState(0);
  const [found, setFound] = useState<Record<string, number[]>>({});
  const [results, setResults] = useState<{ id: string; ok: boolean; threat: boolean }[]>([]);
  const [feedback, setFeedback] = useState<{ ok: boolean; title: string; body: string } | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const busy = useRef(false);
  const card = cards[index];
  const now = useNow(started && !feedback && !finished, 200);
  const remaining = started ? clamp(1 - (now - cardStartedAt) / (CARD_SECONDS * 1000), 0, 1) : 1;

  const flagsFound = Object.values(found).reduce((sum, list) => sum + list.length, 0);
  const raw = results.filter((result) => result.ok).length * DECISION_POINTS + flagsFound * FLAG_POINTS;
  const score = Math.round((raw / maxScore(cards)) * 1000);

  const decide = useCallback(
    (block: boolean | null) => {
      if (busy.current || finished) return;
      busy.current = true;
      const ok = block !== null && block === card.threat;
      setResults((current) => [...current, { id: card.id, ok, threat: card.threat }]);
      setTip(null);
      setFeedback({
        ok,
        title: block === null ? '¡Se acabó el tiempo!' : ok ? (card.threat ? '¡Amenaza bloqueada!' : '¡Bien! Era confiable') : card.threat ? 'Era una amenaza' : 'Era confiable',
        body: card.explanation,
      });
      if (ok) void feedbackSuccess();
      else void feedbackWarning();
      setTimeout(() => {
        busy.current = false;
        setFeedback(null);
        if (index + 1 >= cards.length) {
          setFinished(true);
        } else {
          setIndex(index + 1);
          setCardStartedAt(clockNow());
        }
      }, 1700);
    },
    [card, cards.length, finished, index],
  );

  const beginCards = useCallback(() => {
    setStarted(true);
    setCardStartedAt(clockNow());
  }, []);

  // Tiempo límite por mensaje.
  useEffect(() => {
    if (!started || feedback || finished) return;
    const timer = setTimeout(() => decide(null), Math.max(0, cardStartedAt + CARD_SECONDS * 1000 - Date.now()));
    return () => clearTimeout(timer);
  }, [cardStartedAt, decide, feedback, finished, started]);

  function spot(flag: number) {
    if (feedback) return;
    const list = found[card.id] ?? [];
    if (list.includes(flag)) return;
    setFound({ ...found, [card.id]: [...list, flag] });
    setTip(`+${FLAG_POINTS} · ${card.flags[flag].why}`);
    void feedbackTap();
  }

  if (finished) {
    const threats = results.filter((result) => result.threat);
    const blocked = threats.filter((result) => result.ok).length;
    const trusted = results.filter((result) => !result.threat && result.ok).length;
    const totalFlags = cards.reduce((sum, item) => sum + item.flags.length, 0);
    return (
      <StationSummary
        title="Escudo digital"
        total={score}
        message={`Bloqueaste ${blocked} de ${threats.length} amenazas.`}
        accent={ACCENT}
        rows={[
          { label: 'Amenazas bloqueadas', value: blocked, max: threats.length, icon: 'shieldCheck' },
          { label: 'Mensajes confiables', value: trusted, max: results.length - threats.length, icon: 'checkCircle' },
          { label: 'Señales de alerta', value: flagsFound, max: totalFlags, icon: 'alert' },
        ]}
        learned="Como enseña Shielded: desconfía de la urgencia, los premios y los dominios raros; revisa permisos y nunca conectes un USB desconocido. Ante la duda, bloquea y verifica por otro canal."
        onSubmit={() => onComplete({ score, accuracy: results.filter((result) => result.ok).length / results.length })}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StationHud stage={Math.min(index + 1, cards.length)} stages={cards.length} title="Bandeja de entrada" score={score} secondsLeft={null} accent={ACCENT} />
      <View style={styles.timerTrack}>
        <View style={[styles.timerFill, { width: `${remaining * 100}%`, backgroundColor: remaining < 0.3 ? colors.danger : ACCENT }]} />
      </View>
      {started && card && (
        <SwipeCard key={card.id} card={card} found={found[card.id] ?? []} disabled={Boolean(feedback)} onSpot={spot} onDecide={decide} />
      )}
      {feedback ? (
        <Animated.View entering={ZoomIn.duration(180)} exiting={FadeOut.duration(150)} style={[styles.feedback, { backgroundColor: feedback.ok ? '#1F5E43' : '#6E2A2A' }]}>
          <TelIcon name={feedback.ok ? 'shieldCheck' : 'alert'} size={26} color={colors.white} />
          <View style={styles.flex}>
            <TelText variant="subtitle" color="white">
              {feedback.title}
            </TelText>
            <TelText variant="caption" color="white">
              {feedback.body}
            </TelText>
          </View>
        </Animated.View>
      ) : tip ? (
        <Hint tone="good">{tip}</Hint>
      ) : (
        <Hint>Toca las partes sospechosas del mensaje (+{FLAG_POINTS}) y luego decide. También puedes deslizar la tarjeta.</Hint>
      )}
      <View style={styles.actions}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Bloquear" disabled={Boolean(feedback) || !started} onPress={() => decide(true)} scaleTo={0.93} style={[styles.action, styles.block]}>
          <TelIcon name="shieldLock" size={26} color={colors.white} />
          <TelText variant="heading" color="white">
            Bloquear
          </TelText>
        </PressableScale>
        <PressableScale accessibilityRole="button" accessibilityLabel="Confiar" disabled={Boolean(feedback) || !started} onPress={() => decide(false)} scaleTo={0.93} style={[styles.action, styles.trust]}>
          <TelIcon name="checkCircle" size={26} color={colors.white} />
          <TelText variant="heading" color="white">
            Confiar
          </TelText>
        </PressableScale>
      </View>
      {!started && (
        <StageBanner
          index={1}
          title="Escudo digital"
          body="Te llegarán mensajes, redes y permisos. Toca lo sospechoso y decide: ¿bloquear o confiar? Tienes 9 segundos por tarjeta."
          icon="shieldCheck"
          accent={ACCENT}
          onDone={beginCards}
        />
      )}
    </View>
  );
}

function SwipeCard({
  card,
  found,
  disabled,
  onSpot,
  onDecide,
}: {
  card: SecurityCard;
  found: number[];
  disabled: boolean;
  onSpot: (flag: number) => void;
  onDecide: (block: boolean) => void;
}) {
  const offset = useSharedValue(0);
  const segments = segmentCard(card);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }, { rotate: `${offset.value / 22}deg` }] }));
  const info = channelInfo[card.channel];
  const handlers = usePanHandlers({
    canStart: () => !disabled,
    onMove: (_, gesture) => offset.set(gesture.dx),
    onRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) > SWIPE) {
        offset.set(withTiming(Math.sign(gesture.dx) * 420, { duration: 220 }));
        onDecide(gesture.dx < 0);
      } else {
        offset.set(withSpring(0));
      }
    },
    onTerminate: () => offset.set(withSpring(0)),
  });

  return (
    <Animated.View entering={FadeIn.duration(200)} style={[styles.card, style]} {...handlers}>
      <View style={styles.cardHead}>
        <View style={styles.channelIcon}>
          <TelIcon name={info.icon} size={20} color={colors.white} />
        </View>
        <View style={styles.flex}>
          <TelText variant="small" color="muted">
            {info.label.toUpperCase()}
          </TelText>
          <TelText variant="label" color="primary" numberOfLines={2}>
            <FlagText segments={segments.from} found={found} onSpot={onSpot} variant="label" />
          </TelText>
        </View>
      </View>
      <TelText variant="body" color="ink" style={styles.cardBody}>
        <FlagText segments={segments.body} found={found} onSpot={onSpot} variant="body" />
      </TelText>
      <View style={styles.swipeHints}>
        <TelText variant="small" color="danger">
          ← Bloquear
        </TelText>
        <TelText variant="small" color="success">
          Confiar →
        </TelText>
      </View>
    </Animated.View>
  );
}

// Texto con tramos tocables: cada señal de alerta encontrada suma puntos.
function FlagText({ segments, found, onSpot, variant }: { segments: Segment[]; found: number[]; onSpot: (flag: number) => void; variant: 'body' | 'label' }) {
  return (
    <>
      {segments.map((segment, position) =>
        segment.flag === null ? (
          <TelText key={position} variant={variant} color={variant === 'label' ? 'primary' : 'ink'}>
            {segment.text}
          </TelText>
        ) : (
          <TelText
            key={position}
            variant={variant === 'label' ? 'label' : 'bodyStrong'}
            color={found.includes(segment.flag) ? 'white' : 'ink'}
            onPress={() => onSpot(segment.flag as number)}
            accessibilityRole="button"
            accessibilityHint="Marcar como sospechoso"
            style={found.includes(segment.flag) ? styles.flagFound : styles.flag}
          >
            {segment.text}
          </TelText>
        ),
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    minHeight: 520,
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  timerTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
  },
  timerFill: {
    height: 8,
    borderRadius: radius.pill,
  },
  card: {
    minHeight: 220,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    boxShadow: '0px 14px 30px rgba(0, 0, 0, 0.35)',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  channelIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    fontSize: 17,
    lineHeight: 26,
  },
  flag: {
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
    textDecorationColor: colors.muted,
  },
  flagFound: {
    backgroundColor: colors.danger,
    borderRadius: 4,
  },
  swipeHints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
  },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  action: {
    flex: 1,
    height: 64,
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
