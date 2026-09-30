import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated from 'react-native-reanimated';
import { AppHeader } from '@/components/AppHeader';
import { Tag } from '@/components/Chips';
import { Celebration } from '@/components/feedback/Celebration';
import { SegmentedProgress } from '@/components/feedback/Progress';
import { Medallion } from '@/components/graphics/Medallion';
import { FeedbackPanel, OptionButton, type OptionState } from '@/components/Quiz';
import { Screen, ScreenFooter } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelText } from '@/components/TelText';
import { getCareerArea } from '@/data/career';
import { areaLabels, pickPracticeQuestions, shuffleOptions } from '@/data/questions';
import { feedbackSuccess, feedbackWarning } from '@/lib/feedback';
import { useEntering } from '@/lib/motion';
import { useScrollToEnd } from '@/lib/useScrollToEnd';
import { now } from '@/lib/clock';
import { recordGameResult } from '@/storage/profile';
import { spacing } from '@/theme';
import type { GameOutcome, KnowledgeArea } from '@/types/game';

const LETTERS = ['A', 'B', 'C', 'D'];
const AREAS: KnowledgeArea[] = ['redes', 'teleco', 'software', 'seguridad', 'hardware'];

function buildRound(area: KnowledgeArea) {
  return pickPracticeQuestions(area, 5).map((item) => shuffleOptions(item));
}

// Práctica rápida de 5 preguntas de un área, con explicación inmediata.
export default function PracticeScreen() {
  const entering = useEntering();
  const params = useLocalSearchParams<{ area?: string }>();
  const area: KnowledgeArea = AREAS.includes(params.area as KnowledgeArea) ? (params.area as KnowledgeArea) : 'redes';
  const info = getCareerArea(area);
  const [round, setRound] = useState(0);
  const [questions, setQuestions] = useState(() => buildRound(area));
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [outcome, setOutcome] = useState<GameOutcome | null>(null);
  const [done, setDone] = useState(false);
  const startedAt = useRef(0);
  const scroller = useScrollToEnd();

  useEffect(() => {
    startedAt.current = now();
  }, []);
  const question = questions[index];
  const isRight = answered && picked === question?.answerIndex;

  async function submit() {
    if (picked === null || !question) return;
    setAnswered(true);
    scroller.scrollToEnd();
    if (picked === question.answerIndex) {
      setCorrect((value) => value + 1);
      await feedbackSuccess();
    } else {
      await feedbackWarning();
    }
  }

  async function next() {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setPicked(null);
      setAnswered(false);
      return;
    }
    setDone(true);
    const result = await recordGameResult({
      gameId: 'practice',
      score: correct * 120,
      accuracy: correct / questions.length,
      durationSeconds: Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)),
      completedAt: new Date().toISOString(),
      metadata: { area, correct },
    });
    setOutcome(result);
  }

  function again() {
    setRound((value) => value + 1);
    setQuestions(buildRound(area));
    setIndex(0);
    setPicked(null);
    setAnswered(false);
    setCorrect(0);
    setDone(false);
    setOutcome(null);
    startedAt.current = Date.now();
  }

  if (done) {
    const great = correct >= 4;
    return (
      <Screen tone="dark" backdrop="orbits" header={<AppHeader transparent compact onBack={() => router.back()} />}>
        <Celebration burstKey={great ? round + 1 : null} />
        <View style={styles.summary}>
          <Medallion glyph={info?.glyph ?? 'star'} tier={correct === questions.length ? 'oro' : great ? 'plata' : 'bronce'} size={120} ribbon />
          <TelText variant="overline" color="accent" align="center">
            Práctica de {areaLabels[area]}
          </TelText>
          <TelText variant="hero" color="cream" align="center" tabular>
            {correct}/{questions.length} correctas
          </TelText>
          <TelText variant="body" color="onDark" align="center">
            {great ? '¡Tienes pasta de telemático! Sigue con otra área.' : 'Cada explicación es una microlección. ¡Inténtalo de nuevo!'}
          </TelText>
          {outcome && <Tag tone="glass" icon="sparkle" label={`+${outcome.xpGained} XP`} />}
        </View>
        <View style={styles.actions}>
          <TelButton label="Otra ronda" variant="cream" icon="refresh" onPress={again} />
          <TelButton label="Volver a Carrera" variant="outlineLight" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  if (!question) {
    return <Screen />;
  }

  return (
    <Screen
      scrollRef={scroller.ref}
      header={
        <AppHeader onBack={() => router.back()} kicker="Práctica rápida · 5 preguntas" title={info?.name ?? areaLabels[area]} art={info ? <Medallion glyph={info.glyph} size={64} /> : undefined}>
          <SegmentedProgress total={questions.length} done={index + (answered ? 1 : 0)} current={index} />
        </AppHeader>
      }
      footer={
        <ScreenFooter>
          {!answered ? (
            <TelButton label="Responder" disabled={picked === null} onPress={() => void submit()} />
          ) : (
            <TelButton label={index + 1 >= questions.length ? 'Ver resultado' : 'Siguiente'} iconRight="arrowRight" onPress={() => void next()} />
          )}
        </ScreenFooter>
      }
    >
      <Animated.View key={question.id} entering={entering.fadeUp()} style={styles.prompt}>
        <TelText variant="small" color="secondary" style={styles.kicker}>
          PREGUNTA {index + 1} DE {questions.length}
        </TelText>
        <TelText variant="heading" color="primary">
          {question.prompt}
        </TelText>
      </Animated.View>
      <View style={styles.options}>
        {question.options.map((option, optionIndex) => {
          let state: OptionState = 'idle';
          if (!answered && picked === optionIndex) state = 'selected';
          if (answered && optionIndex === question.answerIndex) state = 'correct';
          else if (answered && picked === optionIndex) state = 'wrong';
          else if (answered) state = 'dimmed';
          return (
            <OptionButton
              key={option}
              letter={LETTERS[optionIndex]}
              label={option}
              state={state}
              disabled={answered}
              onPress={() => setPicked(optionIndex)}
            />
          );
        })}
      </View>
      {answered && <FeedbackPanel kind={isRight ? 'success' : 'error'} title={isRight ? '¡Correcto!' : 'No era esa'} body={question.explanation} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  prompt: {
    gap: spacing.xs,
  },
  kicker: {
    letterSpacing: 1.2,
    fontSize: 11,
  },
  options: {
    gap: 10,
  },
  summary: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  actions: {
    gap: spacing.sm,
    marginTop: 'auto',
  },
});
