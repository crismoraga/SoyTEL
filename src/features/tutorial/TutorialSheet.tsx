import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Rutix } from '@/components/graphics/Rutix';
import { IconButton } from '@/components/IconButton';
import { PressableScale } from '@/components/PressableScale';
import { Sheet } from '@/components/Sheet';
import { TelButton } from '@/components/TelButton';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { colors, radius, spacing } from '@/theme';
import type { Tutorial, TutorialStep } from './tutorials';

interface TutorialSheetProps {
  tutorial: Tutorial;
  visible: boolean;
  onClose: () => void;
  // Paso extra al inicio (por ejemplo, de qué trata este juego en particular).
  intro?: TutorialStep;
  doneLabel?: string;
}

// "Cómo se juega": Rutix explica el juego paso a paso, una idea por pantalla.
export function TutorialSheet({ tutorial, visible, onClose, intro, doneLabel = '¡Entendido, a jugar!' }: TutorialSheetProps) {
  const [index, setIndex] = useState(0);
  const steps = intro ? [intro, ...tutorial.steps] : tutorial.steps;
  const current = Math.min(index, steps.length - 1);
  const step = steps[current];
  const last = current === steps.length - 1;

  function close() {
    setIndex(0);
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={close} tone="dark" accessibilityLabel={tutorial.title}>
      <View style={styles.head}>
        <Rutix size={76} expression={last ? 'happy' : 'wink'} pose={last ? 'thumbsUp' : 'point'} reactKey={current} animated={false} />
        <View style={styles.flex}>
          <TelText variant="overline" color="accent">
            Paso {current + 1} de {steps.length}
          </TelText>
          <TelText variant="heading" color="cream">
            {tutorial.title}
          </TelText>
        </View>
      </View>
      <View style={styles.card} accessible accessibilityLiveRegion="polite" accessibilityLabel={`${step.title}. ${step.text}`}>
        <View style={styles.icon}>
          <TelIcon name={step.icon} size={30} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <TelText variant="subtitle" color="primary">
            {step.title}
          </TelText>
          <TelText variant="body" color="primary">
            {step.text}
          </TelText>
        </View>
      </View>
      <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {steps.map((item, position) => (
          <View key={item.title} style={[styles.dot, position === current && styles.dotOn, position < current && styles.dotDone]} />
        ))}
      </View>
      <View style={styles.actions}>
        {current > 0 && <IconButton icon="chevronLeft" tone="dark" size={52} accessibilityLabel="Paso anterior" onPress={() => setIndex(current - 1)} />}
        <View style={styles.flex}>
          {last ? (
            <TelButton label={doneLabel} variant="cream" iconRight="check" onPress={close} />
          ) : (
            <TelButton label="Siguiente" variant="accent" iconRight="arrowRight" onPress={() => setIndex(current + 1)} />
          )}
        </View>
      </View>
      {!last && (
        <PressableScale accessibilityRole="button" onPress={close} style={styles.skip}>
          <TelText variant="label" color="accentSoft" align="center">
            Saltar explicación
          </TelText>
        </PressableScale>
      )}
    </Sheet>
  );
}

// Botón de ayuda para volver a ver el tutorial.
export function HelpButton({ onPress, label = 'Cómo se juega' }: { onPress: () => void; label?: string }) {
  return <IconButton icon="help" tone="dark" accessibilityLabel={label} onPress={onPress} />;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    gap: 2,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    minHeight: 132,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.cream,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondary,
  },
  dotOn: {
    width: 24,
    backgroundColor: colors.cream,
  },
  dotDone: {
    backgroundColor: colors.accent,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  skip: {
    minHeight: 40,
    justifyContent: 'center',
  },
});
