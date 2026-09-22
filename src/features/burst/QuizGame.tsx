import { Pressable, StyleSheet, View } from 'react-native';
import { TelText } from '@/components/TelText';
import { colors, radius, spacing } from '@/theme';
import type { MicroGameProps } from './types';

interface QuizGameProps extends MicroGameProps {
  options: string[];
  answer: string;
}

export function QuizGame({ options, answer, active, onAnswer }: QuizGameProps) {
  return (
    <View style={styles.options}>
      {options.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="button"
          accessibilityLabel={option}
          disabled={!active}
          onPress={() => onAnswer(option === answer)}
          style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
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
  option: {
    minHeight: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.cream,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  optionPressed: {
    backgroundColor: colors.accentSoft,
    transform: [{ scale: 0.98 }],
  },
});
