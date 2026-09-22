import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TelText } from '@/components/TelText';
import { feedbackTap } from '@/lib/feedback';
import { colors, radius, spacing } from '@/theme';
import type { MicroGameProps } from './types';

const TARGET_TAPS = 12;

export function TapRaceGame({ active, onAnswer }: MicroGameProps) {
  const [taps, setTaps] = useState(0);
  const answeredRef = useRef(false);

  function tap() {
    if (!active || answeredRef.current) {
      return;
    }

    void feedbackTap();
    const next = taps + 1;
    setTaps(next);
    if (next >= TARGET_TAPS) {
      answeredRef.current = true;
      onAnswer(true, 40);
    }
  }

  const progress = Math.min(1, taps / TARGET_TAPS);

  return (
    <View style={styles.container}>
      <View style={styles.progressTrack} accessibilityLabel={`${taps} de ${TARGET_TAPS} paquetes enviados`}>
        <View style={[styles.progressFill, { width: `${Math.max(4, progress * 100)}%` }]} />
      </View>
      <TelText variant="subtitle" color="white" align="center">{taps}/{TARGET_TAPS} paquetes</TelText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Enviar paquete"
        disabled={!active}
        onPress={tap}
        style={({ pressed }) => [styles.tapButton, pressed && styles.tapPressed]}
      >
        <Ionicons color={colors.primary} name="send" size={44} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 16,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  tapButton: {
    width: 150,
    height: 150,
    borderRadius: radius.pill,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.accent,
  },
  tapPressed: {
    transform: [{ scale: 0.92 }],
    backgroundColor: colors.accentSoft,
  },
});
