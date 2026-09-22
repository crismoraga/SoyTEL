import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelText } from '@/components/TelText';
import { quizQuestions } from '@/data/questions';
import { recordGameResult } from '@/storage/profile';
import { colors, radius, spacing } from '@/theme';

const prizeLadder = [100, 200, 300, 500, 800, 1200, 1800, 2600, 4000, 6000];

export default function MillionaireScreen() {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [lifelineUsed, setLifelineUsed] = useState(false);
  const [hiddenOptions, setHiddenOptions] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);
  const startedAt = useMemo(() => Date.now(), []);
  const question = quizQuestions[questionIndex];

  async function choose(index: number) {
    if (selected !== null) {
      return;
    }

    setSelected(index);
    if (index === question.answerIndex) {
      setCorrectAnswers((value) => value + 1);
      setScore((value) => value + prizeLadder[questionIndex]);
    }
  }

  function useFiftyFifty() {
    if (lifelineUsed || selected !== null) {
      return;
    }

    const wrong = [0, 1, 2, 3].filter((index) => index !== question.answerIndex);
    setHiddenOptions(wrong.slice(0, 2));
    setLifelineUsed(true);
  }

  async function next() {
    const failed = selected !== question.answerIndex;
    if (failed || questionIndex + 1 >= quizQuestions.length) {
      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      await recordGameResult({
        gameId: 'millionaire',
        score,
        accuracy: correctAnswers / quizQuestions.length,
        durationSeconds,
        completedAt: new Date().toISOString(),
        metadata: { correctAnswers },
      });
      setFinished(true);
      return;
    }

    setQuestionIndex((value) => value + 1);
    setSelected(null);
    setHiddenOptions([]);
  }

  if (finished) {
    return (
      <Screen dark contentStyle={styles.finished}>
        <Ionicons color={colors.accent} name="trophy" size={72} />
        <TelText variant="hero" color="white" align="center">{score} pts</TelText>
        <TelText color="accentSoft" align="center">
          Respondiste correctamente {correctAnswers} de {quizQuestions.length} preguntas. Cada explicación es una microlección para tu futura malla.
        </TelText>
        <TelButton label="Volver al inicio" onPress={() => router.replace('/home')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <TelText variant="overline" color="secondary">Quién quiere ser Telemático</TelText>
          <TelText variant="title" color="primary">Pregunta {questionIndex + 1}/10</TelText>
        </View>
        <TelCard tone="dark" style={styles.scoreCard}>
          <TelText variant="caption" color="accentSoft">Puntaje</TelText>
          <TelText variant="subtitle" color="white">{score}</TelText>
        </TelCard>
      </View>

      <View style={styles.ladder}>
        {prizeLadder.map((prize, index) => (
          <View
            key={prize}
            style={[
              styles.ladderStep,
              index === questionIndex && styles.ladderStepActive,
              index < questionIndex && styles.ladderStepDone,
            ]}
          >
            <TelText variant="caption" color={index <= questionIndex ? 'white' : 'muted'} align="center">
              {prize}
            </TelText>
          </View>
        ))}
      </View>

      <TelCard tone="dark">
        <View style={styles.questionMeta}>
          <TelText variant="caption" color="accentSoft">{question.area.toUpperCase()}</TelText>
          <TelText variant="caption" color="accentSoft">Dificultad {question.difficulty}/5</TelText>
        </View>
        <TelText variant="subtitle" color="white">{question.prompt}</TelText>
      </TelCard>

      <View style={styles.options}>
        {question.options.map((option, index) => {
          const hidden = hiddenOptions.includes(index);
          const isSelected = selected === index;
          const isCorrect = selected !== null && index === question.answerIndex;
          const isWrong = isSelected && index !== question.answerIndex;

          return (
            <TelButton
              key={option}
              label={option}
              disabled={hidden || selected !== null}
              variant={isCorrect ? 'secondary' : isWrong ? 'danger' : 'ghost'}
              onPress={() => void choose(index)}
            />
          );
        })}
      </View>

      {selected !== null && (
        <TelCard tone="cream">
          <TelText variant="bodyStrong" color="primary">
            {selected === question.answerIndex ? 'Respuesta correcta' : 'Respuesta incorrecta'}
          </TelText>
          <TelText color="primarySoft">{question.explanation}</TelText>
          <TelButton label={questionIndex + 1 >= quizQuestions.length || selected !== question.answerIndex ? 'Finalizar' : 'Siguiente'} onPress={() => void next()} />
        </TelCard>
      )}

      <TelButton
        label={lifelineUsed ? 'Comodín usado' : 'Usar 50:50'}
        variant="secondary"
        disabled={lifelineUsed || selected !== null}
        onPress={useFiftyFifty}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  scoreCard: {
    minWidth: 96,
    padding: spacing.sm,
    alignItems: 'center',
  },
  ladder: {
    flexDirection: 'row',
    gap: 4,
  },
  ladderStep: {
    flex: 1,
    minHeight: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  ladderStepActive: {
    backgroundColor: colors.secondary,
  },
  ladderStepDone: {
    backgroundColor: colors.accent,
  },
  questionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  options: {
    gap: spacing.xs,
  },
  finished: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
