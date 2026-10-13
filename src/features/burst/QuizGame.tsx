import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { TelText } from '@/components/TelText';
import { colors, radius, spacing } from '@/theme';
import type { MicroGameProps } from './types';

interface QuizGameProps extends MicroGameProps {
  options: string[];
  answer: string;
}

// Bajo esta altura, cuatro opciones de 64 px casi no dejan margen con la barra de estado.
const COMPACT_HEIGHT = 700;

export function QuizGame({ options, answer, active, onAnswer }: QuizGameProps) {
  const { height } = useWindowDimensions();
  const compact = height < COMPACT_HEIGHT;

  return (
    <View style={[styles.options, compact && styles.optionsCompact]}>
      {options.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="button"
          accessibilityLabel={option}
          disabled={!active}
          onPress={() => onAnswer(option === answer)}
          style={({ pressed }) => [styles.option, compact && styles.optionCompact, pressed && styles.optionPressed]}
        >
          <TelText variant="bodyStrong" color="primary" align="center">{option}</TelText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: spacing.sm,
  },
  optionsCompact: {
    gap: spacing.xs,
  },
  option: {
    minHeight: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.cream,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  optionCompact: {
    minHeight: 52,
  },
  optionPressed: {
    backgroundColor: colors.accentSoft,
    transform: [{ scale: 0.98 }],
  },
});
