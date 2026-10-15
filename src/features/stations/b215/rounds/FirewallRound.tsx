import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { SlideInRight, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming, ZoomIn } from 'react-native-reanimated';
import { PressableScale } from '@/components/PressableScale';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { gameNow, Hint, useGameTimeout } from '@/features/stations/kit';
import { feedbackSuccess, feedbackWarning } from '@/lib/feedback';
import { useMotionEnabled } from '@/lib/motion';
import { colors, radius, spacing } from '@/theme';
import type { RoundProps } from '../types';
import {
  decide,
  feedbackWait,
  firewallPrompt,
  makeFirewallRound,
  reactionLine,
  ruleText,
  scoreRound,
  SERVICES,
  streakOf,
  type Connection,
  type Decision,
  type FirewallAction,
  type FirewallRule,
} from './red.logic';

// Ronda del circuito B215 · Firewall: llegan 6 conexiones y hay que decidir si pasan o se bloquean según las reglas.
// Las reglas se leen de arriba hacia abajo; al responder, la regla que decidió se ilumina y la conexión recibe su sello.

interface Answer {
  choice: FirewallAction;
  ok: boolean;
}

type ButtonState = 'idle' | 'right' | 'wrong' | 'reveal' | 'dimmed';

const GOOD = '#2E7D5B';
const BAD = '#C73E3E';
const GOOD_LIGHT = '#6BC59A';
const BAD_LIGHT = '#E58A8A';

export function FirewallRound({ seed, level, pace, timeUp, onDone }: RoundProps) {
  const motion = useMotionEnabled();
  const [data] = useState(() => makeFirewallRound(seed, level));
  const [answers, setAnswers] = useState<Answer[]>([]);
  // true mientras se ve la reacción a la última respuesta.
  const [reviewing, setReviewing] = useState(false);
  const [advanceAt, setAdvanceAt] = useState<number | null>(null);
  const [roomy, setRoomy] = useState(false);

  const finished = useRef(false);
  const latestDone = useRef(onDone);
  useEffect(() => {
    latestDone.current = onDone;
  });

  const total = data.connections.length;
  const correct = answers.filter((item) => item.ok).length;
  const streak = streakOf(answers.map((item) => item.ok));
  const index = reviewing ? answers.length - 1 : answers.length;
  const connection = data.connections[Math.min(index, total - 1)];
  const answer = reviewing ? answers[answers.length - 1] : undefined;
  const decision = decide(data.rules, connection);
  const locked = timeUp || reviewing;

  const finish = useCallback(
    (ok: number, attempts: number) => {
      if (finished.current) return;
      finished.current = true;
      latestDone.current(scoreRound(ok, attempts, total, 'conexiones bien decididas'));
    },
    [total],
  );

  // Se acabó el tiempo: se entrega de inmediato lo logrado hasta ahí.
  useEffect(() => {
    if (timeUp) finish(correct, answers.length);
  }, [timeUp, correct, answers.length, finish]);

  function advance() {
    if (finished.current) return;
    setAdvanceAt(null);
    if (answers.length >= total) finish(correct, answers.length);
    else setReviewing(false);
  }
  useGameTimeout(advanceAt, advance, advanceAt);

  function choose(choice: FirewallAction) {
    if (finished.current || locked) return;
    const ok = decision.action === choice;
    setAnswers([...answers, { choice, ok }]);
    setReviewing(true);
    setAdvanceAt(gameNow() + feedbackWait(ok ? 800 : 2300, pace));
    void (ok ? feedbackSuccess() : feedbackWarning());
  }

  const hintText = answer ? reactionLine(answer.ok, streak, data.rules, connection, decision) : firewallPrompt(level);
  const stateOf = (kind: FirewallAction): ButtonState => {
    if (!answer) return 'idle';
    if (answer.choice === kind) return answer.ok ? 'right' : 'wrong';
    return answer.ok ? 'dimmed' : 'reveal';
  };

  return (
    <View style={styles.root} onLayout={(event: LayoutChangeEvent) => setRoomy(event.nativeEvent.layout.height >= 480)}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View style={styles.topTitle}>
            <TelIcon name="firewallWall" size={18} color={colors.accent} />
            <TelText variant="small" color="accentSoft" style={styles.kicker} numberOfLines={1}>
              FIREWALL
            </TelText>
          </View>
          <View style={styles.topRight}>
            {streak >= 2 && (
              <Animated.View key={streak} entering={motion ? ZoomIn.springify().damping(9) : undefined} accessible accessibilityLabel={`Racha de ${streak}`} style={styles.streak}>
                <TelIcon name="flame" size={16} color={colors.warning} />
                <TelText variant="label" color="cream" tabular>
                  {streak}
                </TelText>
              </Animated.View>
            )}
            <View style={styles.pips} accessibilityLabel={`Conexión ${Math.min(index + 1, total)} de ${total}`}>
              {data.connections.map((item, position) => {
                const result = answers[position];
                return <View key={item.id} style={[styles.pip, position === index && !result && styles.pipNow, result && (result.ok ? styles.pipOk : styles.pipBad)]} />;
              })}
            </View>
          </View>
        </View>
        <RulesPanel rules={data.rules} highlight={answer && decision.ruleIndex >= 0 ? decision.ruleIndex : null} roomy={roomy} />
        <View style={styles.stage}>
          <ConnectionCard key={connection.id} connection={connection} decision={answer ? decision : null} answer={answer} exception={data.exceptionIp !== null} roomy={roomy} motion={motion} />
        </View>
        <Pressable accessible={false} onPress={reviewing ? advance : undefined}>
          <View style={styles.hintSlot} accessibilityLiveRegion="polite">
            <Hint key={`${index}-${answer ? 'r' : 'p'}`} tone={answer ? (answer.ok ? 'good' : 'bad') : 'info'}>
              {hintText}
            </Hint>
          </View>
        </Pressable>
      </ScrollView>
      <View style={styles.actions}>
        <DecisionButton kind="allow" state={stateOf('allow')} disabled={locked} motion={motion} onPress={() => choose('allow')} />
        <DecisionButton kind="deny" state={stateOf('deny')} disabled={locked} motion={motion} onPress={() => choose('deny')} />
      </View>
    </View>
  );
}

function RulesPanel({ rules, highlight, roomy }: { rules: FirewallRule[]; highlight: number | null; roomy: boolean }) {
  return (
    <View style={styles.rules}>
      {rules.map((rule, position) => {
        const allow = rule.action === 'allow';
        const on = highlight === position;
        return (
          <View
            key={position}
            accessible
            accessibilityLabel={`Regla ${position + 1}: ${allow ? 'permitir' : 'bloquear'} ${ruleText(rule)}`}
            style={[styles.rule, roomy && styles.ruleRoomy, on && { backgroundColor: allow ? 'rgba(46, 125, 91, 0.42)' : 'rgba(199, 62, 62, 0.42)', borderColor: allow ? GOOD_LIGHT : BAD_LIGHT }]}
          >
            <View style={styles.ruleNo}>
              <TelText variant="small" color="accentSoft">
                {position + 1}
              </TelText>
            </View>
            <View style={[styles.ruleAction, { backgroundColor: allow ? GOOD : BAD }]}>
              <TelIcon name={allow ? 'check' : 'close'} size={14} color={colors.white} />
            </View>
            <TelText variant="caption" color="cream" style={styles.flex}>
              {ruleText(rule)}
            </TelText>
          </View>
        );
      })}
    </View>
  );
}

interface CardProps {
  connection: Connection;
  decision: Decision | null;
  answer: Answer | undefined;
  exception: boolean;
  roomy: boolean;
  motion: boolean;
}

function ConnectionCard({ connection, decision, answer, exception, roomy, motion }: CardProps) {
  const service = SERVICES[connection.service];
  const allow = decision?.action === 'allow';
  const shake = useSharedValue(0);
  const pop = useSharedValue(1);
  // Sacudida si se equivocó, saltito si acertó (solo adorno: el puntaje no depende de esto).
  useEffect(() => {
    if (!motion || !answer) return;
    if (answer.ok) pop.set(withSequence(withTiming(1.05, { duration: 110 }), withSpring(1, { damping: 8 })));
    else shake.set(withSequence(withTiming(-7, { duration: 60 }), withTiming(7, { duration: 90 }), withTiming(-4, { duration: 80 }), withTiming(0, { duration: 60 })));
  }, [answer, motion, pop, shake]);
  const reaction = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }, { scale: pop.value }] }));

  return (
    <Animated.View entering={motion ? SlideInRight.duration(220) : undefined}>
      <Animated.View
        accessible
        accessibilityLabel={`Conexión de ${connection.originName}, dirección ${connection.originIp}. Quiere usar ${service.name}, puerto ${service.port}.`}
        style={[styles.card, roomy && styles.cardRoomy, { borderColor: answer ? (answer.ok ? GOOD_LIGHT : BAD_LIGHT) : colors.accent }, reaction]}
      >
        <View style={styles.cardMain}>
          <View style={styles.cardIcon}>
            <TelIcon name={service.icon} size={26} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <TelText variant="bodyStrong" color="cream">
              {service.name}
            </TelText>
            <TelText variant="caption" color="accent">
              puerto {service.port}
            </TelText>
          </View>
        </View>
        <TelText variant="small" color={exception ? 'cream' : 'accentSoft'}>
          De: {connection.originName} · {connection.originIp}
        </TelText>
        {decision && (
          <Animated.View pointerEvents="none" entering={motion ? ZoomIn.springify().damping(8) : undefined} style={styles.stampWrap}>
            <View style={[styles.stamp, { backgroundColor: allow ? GOOD : BAD }]}>
              <TelIcon name={allow ? 'check' : 'close'} size={16} color={colors.white} />
              <TelText variant="label" color="white">
                {allow ? 'PASA' : 'BLOQUEADO'}
              </TelText>
            </View>
          </Animated.View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

function DecisionButton({ kind, state, disabled, motion, onPress }: { kind: FirewallAction; state: ButtonState; disabled: boolean; motion: boolean; onPress: () => void }) {
  const allow = kind === 'allow';
  const label = allow ? 'Permitir' : 'Bloquear';
  const badge = state === 'right' || state === 'reveal' ? 'check' : state === 'wrong' ? 'close' : null;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.95}
      style={[styles.button, { backgroundColor: allow ? GOOD : BAD }, state === 'dimmed' && styles.buttonDim, state === 'wrong' && styles.buttonWrong, (state === 'right' || state === 'reveal') && styles.buttonRight]}
    >
      <TelIcon name={allow ? 'check' : 'close'} size={22} color={colors.white} />
      <TelText variant="button" color="white">
        {label}
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
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    minHeight: 0,
  },
  content: {
    flexGrow: 1,
    gap: 6,
  },
  topBar: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  topTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  kicker: {
    letterSpacing: 1.2,
    flexShrink: 1,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  streak: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: 'rgba(212, 160, 23, 0.22)',
  },
  pips: {
    flexDirection: 'row',
    gap: 4,
  },
  pip: {
    width: 14,
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
  rules: {
    gap: 2,
    padding: 6,
    borderRadius: radius.md,
    backgroundColor: 'rgba(7, 31, 49, 0.6)',
  },
  rule: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  ruleRoomy: {
    minHeight: 34,
  },
  ruleNo: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(167, 212, 237, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleAction: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    flex: 1,
    minHeight: 88,
    justifyContent: 'center',
  },
  card: {
    gap: 4,
    padding: 8,
    minHeight: 84,
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 2,
    backgroundColor: colors.primarySoft,
  },
  cardRoomy: {
    minHeight: 104,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampWrap: {
    position: 'absolute',
    top: -15,
    right: 8,
    transform: [{ rotate: '-4deg' }],
  },
  stamp: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.white,
  },
  hintSlot: {
    minHeight: 48,
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  buttonDim: {
    opacity: 0.4,
  },
  buttonWrong: {
    opacity: 0.7,
    borderColor: colors.white,
  },
  buttonRight: {
    borderColor: colors.cream,
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
});
