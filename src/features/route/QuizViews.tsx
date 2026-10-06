import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { ProgressBar } from '@/components/feedback/Progress';
import { PressableScale } from '@/components/PressableScale';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { formatNumber } from '@/lib/format';
import { answerStyles } from '@/route/content';
import type { PublicPlayer, PublicQuiz } from '@/route/types';
import { colors, radius, spacing } from '@/theme';
import { Leaderboard } from './Podium';

export function AnswerShape({ index, size = 22, color = colors.white }: { index: number; size?: number; color?: string }) {
  const shape = answerStyles[index % 4].shape;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {shape === 'triangle' && <Path d="M12 3 22 20H2z" fill={color} />}
      {shape === 'diamond' && <Path d="M12 2 22 12 12 22 2 12z" fill={color} />}
      {shape === 'circle' && <Circle cx={12} cy={12} r={10} fill={color} />}
      {shape === 'square' && <Rect x={3} y={3} width={18} height={18} rx={2} fill={color} />}
    </Svg>
  );
}

interface QuestionProps {
  quiz: PublicQuiz;
  hostNow: number;
  chosen: number | null;
  answeredCount: number;
  playerCount: number;
  onAnswer?: (option: number) => void;
  // Qué pasó con la respuesta propia (enviando, registrada, perdida). Sin texto en la pantalla del stand.
  note?: string | null;
  large?: boolean;
}

// Pregunta en vivo estilo Kahoot: mientras más rápido respondes, más puntos.
export function QuizQuestion({ quiz, hostNow, chosen, answeredCount, playerCount, onAnswer, note = null, large = false }: QuestionProps) {
  const waiting = hostNow < quiz.startsAt;
  const total = quiz.endsAt - quiz.startsAt;
  const left = Math.max(0, quiz.endsAt - hostNow);
  const seconds = Math.ceil((waiting ? quiz.startsAt - hostNow : left) / 1000);
  return (
    <View style={styles.question}>
      <View style={styles.qHead}>
        <TelText variant="overline" color="accent">
          Pregunta {quiz.index + 1} de {quiz.total}
        </TelText>
        <View style={[styles.qTimer, !waiting && seconds <= 5 && styles.qTimerUrgent]}>
          <TelIcon name="timer" size={16} color={colors.cream} />
          <TelText variant="label" color="cream" tabular>
            {waiting ? 'Prepárate' : `${seconds}s`}
          </TelText>
        </View>
      </View>
      <ProgressBar progress={waiting ? 1 : left / total} color={seconds <= 5 ? colors.danger : colors.accent} trackColor={colors.primarySoft} height={6} />
      <Animated.View key={quiz.question.id} entering={FadeInDown.duration(260)} style={styles.prompt}>
        <TelText variant={large ? 'title' : 'heading'} color="primary" align="center">
          {quiz.question.prompt}
        </TelText>
      </Animated.View>
      {waiting ? (
        <Animated.View key={`${quiz.index}-${seconds}`} entering={ZoomIn.duration(200)} style={styles.getReady}>
          <TelText variant="display" color="cream" align="center">
            {seconds}
          </TelText>
        </Animated.View>
      ) : (
        <View style={styles.options}>
          {quiz.question.options.map((option, index) => {
            const style = answerStyles[index];
            const dim = chosen !== null && chosen !== index;
            return (
              <PressableScale
                key={option}
                accessibilityRole="button"
                accessibilityLabel={`${style.label}: ${option}`}
                accessibilityState={{ selected: chosen === index, disabled: chosen !== null || !onAnswer }}
                disabled={chosen !== null || !onAnswer}
                onPress={() => onAnswer?.(index)}
                scaleTo={0.94}
                haptic
                style={[styles.option, { backgroundColor: style.color }, dim && styles.optionDim, chosen === index && styles.optionChosen, large && styles.optionLarge]}
              >
                <AnswerShape index={index} size={large ? 30 : 22} />
                <TelText variant={large ? 'heading' : 'label'} color="white" style={styles.flex}>
                  {option}
                </TelText>
              </PressableScale>
            );
          })}
        </View>
      )}
      <TelText variant="caption" color="accentSoft" align="center" accessibilityLiveRegion="polite">
        {note ? `${note} ` : ''}
        {answeredCount} de {playerCount} respondieron
      </TelText>
    </View>
  );
}

interface RevealProps {
  quiz: PublicQuiz;
  players: PublicPlayer[];
  meId?: string | null;
  large?: boolean;
}

export function QuizReveal({ quiz, players, meId, large = false }: RevealProps) {
  const reveal = quiz.reveal;
  if (!reveal) return null;
  const mine = meId ? reveal.gains[meId] : undefined;
  const max = Math.max(1, ...reveal.counts);
  return (
    <View style={styles.question}>
      <TelText variant="overline" color="accent" align="center">
        Pregunta {quiz.index + 1} de {quiz.total}
      </TelText>
      <TelText variant={large ? 'title' : 'subtitle'} color="cream" align="center">
        {quiz.question.prompt}
      </TelText>
      {mine && (
        <Animated.View entering={ZoomIn.springify().damping(12)} style={[styles.result, { backgroundColor: mine.correct ? colors.success : mine.option === null ? colors.secondary : colors.danger }]}>
          <TelIcon name={mine.correct ? 'checkCircle' : mine.option === null ? 'clock' : 'closeCircle'} size={30} color={colors.white} />
          <View style={styles.flex}>
            <TelText variant="heading" color="white">
              {mine.correct ? `¡Correcto! +${formatNumber(mine.points)}` : mine.option === null ? 'Sin respuesta' : 'Incorrecto'}
            </TelText>
            {mine.correct && mine.rank !== null && mine.rank <= 3 && (
              <TelText variant="caption" color="white">
                {mine.rank === 1 ? '¡Fuiste el primero en acertar! Bono máximo.' : `Fuiste el ${mine.rank}º en acertar: bono de rapidez.`}
              </TelText>
            )}
          </View>
        </Animated.View>
      )}
      <View style={styles.bars}>
        {quiz.question.options.map((option, index) => {
          const correct = index === reveal.correct;
          return (
            <View key={option} style={[styles.barRow, !correct && styles.barDim]}>
              <View style={[styles.barIcon, { backgroundColor: answerStyles[index].color }]}>
                <AnswerShape index={index} size={16} />
              </View>
              <View style={styles.flex}>
                <TelText variant={large ? 'subtitle' : 'label'} color="cream" numberOfLines={2}>
                  {option}
                </TelText>
                <View style={styles.barTrack}>
                  <Animated.View entering={FadeIn.delay(150 * index)} style={[styles.barFill, { width: `${(reveal.counts[index] / max) * 100}%`, backgroundColor: answerStyles[index].color }]} />
                </View>
              </View>
              <TelText variant="label" color="cream" tabular>
                {reveal.counts[index]}
              </TelText>
              {correct && <TelIcon name="check" size={20} color={colors.success} />}
            </View>
          );
        })}
      </View>
      <View style={styles.explanation}>
        <TelIcon name="lightbulb" size={18} color={colors.cream} />
        <TelText variant="caption" color="cream" style={styles.flex}>
          {reveal.explanation}
        </TelText>
      </View>
      <TelText variant="small" color="accentSoft">
        TOP 5
      </TelText>
      <Leaderboard players={players} meId={meId} limit={5} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  question: {
    gap: spacing.sm,
  },
  qHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  qTimerUrgent: {
    backgroundColor: colors.danger,
  },
  prompt: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.cream,
    minHeight: 110,
    justifyContent: 'center',
  },
  getReady: {
    paddingVertical: spacing.lg,
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.lg,
  },
  optionLarge: {
    minHeight: 84,
  },
  optionDim: {
    opacity: 0.35,
  },
  optionChosen: {
    borderWidth: 3,
    borderColor: colors.cream,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  bars: {
    gap: 8,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 8,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  barDim: {
    opacity: 0.6,
  },
  barIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    overflow: 'hidden',
    marginTop: 4,
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  explanation: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(244,236,215,0.1)',
  },
});
