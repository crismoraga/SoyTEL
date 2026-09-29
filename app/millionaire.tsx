import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import { AppHeader } from '@/components/AppHeader';
import { Tag } from '@/components/Chips';
import { Celebration } from '@/components/feedback/Celebration';
import { Illustration } from '@/components/graphics/Illustration';
import { Medallion } from '@/components/graphics/Medallion';
import { Telix } from '@/components/graphics/Telix';
import { PressableScale } from '@/components/PressableScale';
import { FeedbackPanel, OptionButton, type OptionState } from '@/components/Quiz';
import { Screen, ScreenFooter } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { getAchievement } from '@/data/achievements';
import { areaLabels, pickMillionaireQuestions, shuffleOptions, type QuizQuestion } from '@/data/questions';
import { feedbackHeavy, feedbackSuccess, feedbackWarning } from '@/lib/feedback';
import { formatNumber } from '@/lib/format';
import { useEntering } from '@/lib/motion';
import { useScrollToEnd } from '@/lib/useScrollToEnd';
import { recordGameResult } from '@/storage/profile';
import { colors, radius, spacing } from '@/theme';
import type { GameOutcome } from '@/types/game';

const LADDER = [100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000];
const SAFE_INDEX = 4;
const LETTERS = ['A', 'B', 'C', 'D'];

type Phase = 'intro' | 'playing' | 'finished';
type Reveal = 'idle' | 'locking' | 'revealed';
type Lifeline = 'fifty' | 'telix' | 'audience';

interface TelixHint {
  index: number;
  confidence: number;
}

export default function MillionaireScreen() {
  const entering = useEntering();
  const [phase, setPhase] = useState<Phase>('intro');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [reveal, setReveal] = useState<Reveal>('idle');
  const [used, setUsed] = useState<Record<Lifeline, boolean>>({ fifty: false, telix: false, audience: false });
  const [hidden, setHidden] = useState<number[]>([]);
  const [hint, setHint] = useState<TelixHint | null>(null);
  const [poll, setPoll] = useState<number[] | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [endReason, setEndReason] = useState<'won' | 'wrong' | 'retired'>('won');
  const [outcome, setOutcome] = useState<GameOutcome | null>(null);
  const startedAt = useRef(Date.now());
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scroller = useScrollToEnd();
  const question = questions[index];

  useEffect(() => () => {
    if (lockTimer.current) clearTimeout(lockTimer.current);
  }, []);

  function start() {
    setQuestions(pickMillionaireQuestions().map((item) => shuffleOptions(item)));
    setIndex(0);
    setPicked(null);
    setReveal('idle');
    setUsed({ fifty: false, telix: false, audience: false });
    setHidden([]);
    setHint(null);
    setPoll(null);
    setCorrectCount(0);
    setOutcome(null);
    startedAt.current = Date.now();
    setPhase('playing');
  }

  function confirm() {
    if (picked === null || !question) return;
    setReveal('locking');
    void feedbackHeavy();
    lockTimer.current = setTimeout(() => {
      setReveal('revealed');
      scroller.scrollToEnd();
      if (picked === question.answerIndex) {
        setCorrectCount((value) => value + 1);
        void feedbackSuccess();
      } else {
        void feedbackWarning();
      }
    }, 1100);
  }

  async function finish(reason: 'won' | 'wrong' | 'retired', correct: number) {
    const banked = correct > 0 ? LADDER[correct - 1] : 0;
    const score = reason === 'wrong' ? (correct > SAFE_INDEX ? LADDER[SAFE_INDEX] : 0) : banked;
    setFinalScore(score);
    setEndReason(reason);
    setPhase('finished');
    const result = await recordGameResult({
      gameId: 'millionaire',
      score,
      accuracy: correct / LADDER.length,
      durationSeconds: Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)),
      completedAt: new Date().toISOString(),
      metadata: { correctAnswers: correct, reason },
    });
    setOutcome(result);
  }

  function next() {
    if (!question) return;
    const wasCorrect = picked === question.answerIndex;
    if (!wasCorrect) {
      void finish('wrong', correctCount);
      return;
    }
    if (index + 1 >= questions.length) {
      void finish('won', correctCount);
      return;
    }
    setIndex(index + 1);
    setPicked(null);
    setReveal('idle');
    setHidden([]);
    setHint(null);
    setPoll(null);
  }

  function applyLifeline(kind: Lifeline) {
    if (!question || used[kind] || reveal !== 'idle') return;
    setUsed((value) => ({ ...value, [kind]: true }));
    const wrong = [0, 1, 2, 3].filter((option) => option !== question.answerIndex && !hidden.includes(option));
    if (kind === 'fifty') {
      const shuffled = wrong.sort(() => Math.random() - 0.5);
      setHidden((value) => [...value, ...shuffled.slice(0, 2)]);
      return;
    }
    if (kind === 'telix') {
      const accuracy = 0.92 - (question.difficulty - 1) * 0.07;
      const right = Math.random() < accuracy;
      const guess = right ? question.answerIndex : wrong[Math.floor(Math.random() * wrong.length)];
      setHint({ index: guess, confidence: Math.round((right ? 70 : 45) + Math.random() * 25) });
      return;
    }
    const available = [0, 1, 2, 3].filter((option) => !hidden.includes(option));
    const correctShare = Math.round(72 - question.difficulty * 6 + Math.random() * 12);
    let remaining = 100 - correctShare;
    const others = available.filter((option) => option !== question.answerIndex);
    const values = [0, 0, 0, 0];
    values[question.answerIndex] = correctShare;
    others.forEach((option, position) => {
      const share = position === others.length - 1 ? remaining : Math.round(remaining * (0.2 + Math.random() * 0.5));
      values[option] = share;
      remaining -= share;
    });
    setPoll(values);
  }

  if (phase === 'intro') {
    return (
      <Screen tone="dark" backdrop="signal" header={<AppHeader transparent onBack={() => router.back()} compact />}>
        <Animated.View entering={entering.pop()} style={styles.introArt}>
          <Illustration name="quiz" width={260} tone="dark" />
        </Animated.View>
        <View style={styles.introText}>
          <TelText variant="overline" color="accent" align="center">
            El concurso de la carrera
          </TelText>
          <TelText variant="hero" color="cream" align="center">
            ¿Quién quiere ser Telemático?
          </TelText>
          <TelText variant="body" color="onDark" align="center">
            Diez preguntas que suben de dificultad. Si fallas después de la quinta, conservas 1.000 puntos.
          </TelText>
        </View>
        <View style={styles.rules}>
          <Rule icon="hash" text="50:50 elimina dos alternativas incorrectas." />
          <Rule icon="robot" text="Pregunta a Telix: te dice qué cree (no siempre acierta)." />
          <Rule icon="users" text="Consulta al público: mira cómo votaría la sala." />
          <Rule icon="flag" text="Plántate cuando quieras para asegurar tus puntos." />
        </View>
        <TelButton label="Comenzar el concurso" variant="cream" size="lg" iconRight="arrowRight" onPress={start} />
      </Screen>
    );
  }

  if (phase === 'finished') {
    const good = correctCount >= 5;
    const unlocked = outcome?.newAchievements.map((id) => getAchievement(id)).filter(Boolean) ?? [];
    return (
      <Screen tone="dark" backdrop="orbits" header={<AppHeader transparent compact />}>
        <Celebration burstKey={good ? correctCount : null} count={correctCount === 10 ? 44 : 28} />
        <View style={styles.finishHero}>
          <Telix size={170} expression={correctCount === 10 ? 'celebrate' : good ? 'happy' : 'sad'} pose={good ? 'celebrate' : 'idle'} signal={good ? 4 : 2} />
          <TelText variant="overline" color="accent" align="center">
            {endReason === 'won' ? '¡Respondiste todo!' : endReason === 'retired' ? 'Te plantaste' : 'Fin del concurso'}
          </TelText>
          <TelText variant="display" color="cream" align="center" tabular>
            {formatNumber(finalScore)}
          </TelText>
          <TelText variant="label" color="accentSoft" align="center">
            puntos · {correctCount} de {LADDER.length} correctas
          </TelText>
          {outcome && (
            <View style={styles.rewards}>
              <Tag tone="glass" icon="sparkle" label={`+${outcome.xpGained} XP`} />
              {outcome.leveledUp && <Tag tone="cream" icon="rocket" label={`Nivel ${outcome.profile.level}`} />}
            </View>
          )}
          {unlocked.map((achievement) =>
            achievement ? (
              <View key={achievement.id} style={styles.unlock}>
                <Medallion glyph={achievement.glyph} tier={achievement.tier} size={44} />
                <View style={styles.flex}>
                  <TelText variant="small" color="accent">
                    LOGRO DESBLOQUEADO
                  </TelText>
                  <TelText variant="label" color="cream">
                    {achievement.title}
                  </TelText>
                </View>
              </View>
            ) : null,
          )}
        </View>
        <View style={styles.finishActions}>
          <TelButton label="Jugar otra vez" variant="cream" icon="refresh" onPress={start} />
          <TelButton label="Volver" variant="outlineLight" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  if (!question) {
    return <Screen tone="dark" />;
  }

  const revealed = reveal === 'revealed';
  const wasCorrect = revealed && picked === question.answerIndex;

  return (
    <Screen
      tone="dark"
      backdrop="signal"
      scrollRef={scroller.ref}
      header={
        <AppHeader
          transparent
          compact
          onBack={() => router.back()}
          right={
            reveal === 'idle' && index > 0 ? (
              <TelButton label={`Plantarme (${formatNumber(LADDER[index - 1])})`} variant="outlineLight" size="sm" icon="flag" fullWidth={false} onPress={() => void finish('retired', correctCount)} />
            ) : undefined
          }
        />
      }
      footer={
        <ScreenFooter tone="dark">
          {!revealed && (
            <TelButton
              label={reveal === 'locking' ? '¿Será correcta…?' : '¿Respuesta final?'}
              variant="cream"
              loading={reveal === 'locking'}
              disabled={picked === null}
              onPress={confirm}
            />
          )}
          {revealed && (
            <TelButton
              label={!wasCorrect ? 'Ver resultado' : index + 1 >= questions.length ? '¡Ganar el concurso!' : 'Siguiente pregunta'}
              variant="cream"
              iconRight="arrowRight"
              onPress={next}
            />
          )}
        </ScreenFooter>
      }
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ladder} style={styles.ladderScroll}>
        {LADDER.map((prize, step) => {
          const done = step < index;
          const current = step === index;
          return (
            <View
              key={prize}
              accessibilityLabel={`Pregunta ${step + 1}: ${prize} puntos${step === SAFE_INDEX ? ', seguro' : ''}`}
              style={[styles.rung, done && styles.rungDone, current && styles.rungCurrent, step === SAFE_INDEX && styles.rungSafe]}
            >
              <TelText variant="small" color={current ? 'primary' : done ? 'primary' : 'accentSoft'} tabular>
                {formatNumber(prize)}
              </TelText>
            </View>
          );
        })}
      </ScrollView>

      <Animated.View key={question.id} entering={entering.fadeUp()} style={styles.questionCard}>
        <View style={styles.questionMeta}>
          <Tag tone="glass" label={`PREGUNTA ${index + 1}`} />
          <Tag tone="glass" label={areaLabels[question.area].toUpperCase()} />
          <View style={styles.difficulty} accessibilityLabel={`Dificultad ${question.difficulty} de 5`}>
            {[1, 2, 3, 4, 5].map((level) => (
              <View key={level} style={[styles.diffDot, level <= question.difficulty && styles.diffDotOn]} />
            ))}
          </View>
        </View>
        <TelText variant="heading" color="cream">
          {question.prompt}
        </TelText>
      </Animated.View>

      <View style={styles.options}>
        {question.options.map((option, optionIndex) => {
          let state: OptionState = 'idle';
          if (hidden.includes(optionIndex)) state = 'hidden';
          else if (revealed && optionIndex === question.answerIndex) state = 'correct';
          else if (revealed && picked === optionIndex) state = 'wrong';
          else if (picked === optionIndex) state = 'selected';
          else if (revealed) state = 'dimmed';
          return (
            <View key={option}>
              <OptionButton
                tone="dark"
                letter={LETTERS[optionIndex]}
                label={option}
                state={state}
                disabled={reveal !== 'idle'}
                onPress={() => setPicked(optionIndex)}
              />
              {poll && !hidden.includes(optionIndex) && (
                <View style={styles.pollRow} accessibilityLabel={`${poll[optionIndex]}% del público`}>
                  <View style={[styles.pollBar, { width: `${Math.max(4, poll[optionIndex])}%` }]} />
                  <TelText variant="small" color="accentSoft" tabular>
                    {poll[optionIndex]}%
                  </TelText>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {hint && !revealed && (
        <Animated.View entering={entering.fadeUp()} style={styles.hint}>
          <Telix size={64} expression="think" animated={false} />
          <TelText variant="bodyStrong" color="primary" style={styles.flex}>
            Mmm… creo que es la {LETTERS[hint.index]}. Estoy {hint.confidence}% seguro.
          </TelText>
        </Animated.View>
      )}

      {revealed && (
        <FeedbackPanel
          kind={wasCorrect ? 'success' : 'error'}
          title={wasCorrect ? `¡Correcto! Llevas ${formatNumber(LADDER[index])} pts` : 'Respuesta incorrecta'}
          body={question.explanation}
        />
      )}

      {reveal === 'idle' && (
        <View style={styles.lifelines}>
          <LifelineButton icon="hash" label="50:50" used={used.fifty} onPress={() => applyLifeline('fifty')} />
          <LifelineButton icon="robot" label="Telix" used={used.telix} onPress={() => applyLifeline('telix')} />
          <LifelineButton icon="users" label="Público" used={used.audience} onPress={() => applyLifeline('audience')} />
        </View>
      )}
    </Screen>
  );
}

function Rule({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.rule}>
      <View style={styles.ruleIcon}>
        <TelIcon name={icon} size={18} color={colors.primary} />
      </View>
      <TelText variant="caption" color="onDark" style={styles.flex}>
        {text}
      </TelText>
    </View>
  );
}

function LifelineButton({ icon, label, used, onPress }: { icon: IconName; label: string; used: boolean; onPress: () => void }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Comodín ${label}${used ? ', usado' : ''}`}
      accessibilityState={{ disabled: used }}
      disabled={used}
      haptic
      onPress={onPress}
      style={[styles.lifeline, used && styles.lifelineUsed]}
    >
      <TelIcon name={used ? 'close' : icon} size={20} color={used ? colors.slate : colors.cream} />
      <TelText variant="small" color={used ? 'slate' : 'cream'}>
        {label}
      </TelText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  introArt: {
    alignItems: 'center',
  },
  introText: {
    gap: spacing.sm,
  },
  rules: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(18, 61, 92, 0.8)',
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ruleIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ladderScroll: {
    marginHorizontal: -spacing.md,
    flexGrow: 0,
  },
  ladder: {
    gap: 6,
    paddingHorizontal: spacing.md,
  },
  rung: {
    minWidth: 58,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 212, 237, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rungDone: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  rungCurrent: {
    backgroundColor: colors.cream,
    borderColor: colors.cream,
  },
  rungSafe: {
    borderColor: '#F2CE63',
  },
  questionCard: {
    gap: spacing.sm,
    padding: 18,
    borderRadius: radius.xl,
    backgroundColor: colors.primarySoft,
    borderWidth: 1.5,
    borderColor: 'rgba(111, 179, 217, 0.45)',
    boxShadow: '0px 0px 30px rgba(111, 179, 217, 0.18)',
  },
  questionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  difficulty: {
    flexDirection: 'row',
    gap: 3,
    marginLeft: 'auto',
  },
  diffDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  diffDotOn: {
    backgroundColor: colors.accent,
  },
  options: {
    gap: 10,
  },
  pollRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginLeft: 46,
  },
  pollBar: {
    height: 6,
    maxWidth: '75%',
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.cream,
  },
  lifelines: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  lifeline: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 212, 237, 0.4)',
    backgroundColor: 'rgba(18, 61, 92, 0.85)',
  },
  lifelineUsed: {
    opacity: 0.5,
  },
  finishHero: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  rewards: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  unlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignSelf: 'stretch',
  },
  finishActions: {
    gap: spacing.sm,
    marginTop: 'auto',
  },
});
