import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TelText } from '@/components/TelText';
import { colors, radius, spacing } from '@/theme';
import type { MicroGameProps } from './types';

const ZONE_START = 0.55;
const ZONE_END = 0.78;
const ZONE_CENTER = (ZONE_START + ZONE_END) / 2;

export function TimingGame({ durationSeconds, active, onAnswer }: MicroGameProps) {
  const [progress, setProgress] = useState(0);
  const answeredRef = useRef(false);
  const onAnswerRef = useRef(onAnswer);
  onAnswerRef.current = onAnswer;

  useEffect(() => {
    if (!active) {
      return;
    }

    const startedAt = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const value = elapsed / durationSeconds;
      if (value >= 1) {
        clearInterval(interval);
        if (!answeredRef.current) {
          answeredRef.current = true;
          onAnswerRef.current(false);
        }
        return;
      }
      setProgress(value);
    }, 40);

    return () => clearInterval(interval);
  }, [active, durationSeconds]);

  function stop() {
    if (!active || answeredRef.current) {
      return;
    }

    answeredRef.current = true;
    const inZone = progress >= ZONE_START && progress <= ZONE_END;
    const precision = Math.max(0, 1 - Math.abs(progress - ZONE_CENTER) / ((ZONE_END - ZONE_START) / 2));
    onAnswer(inZone, inZone ? Math.round(precision * 60) : 0);
  }

  return (
    <View style={styles.container}>
      <View
        accessibilityLabel={`Indicador de señal al ${Math.round(progress * 100)} por ciento`}
        style={styles.track}
      >
        <View style={[styles.zone, { left: `${ZONE_START * 100}%`, width: `${(ZONE_END - ZONE_START) * 100}%` }]} />
        <View style={[styles.needle, { left: `${progress * 100}%` }]} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fijar señal"
        disabled={!active}
        onPress={stop}
        style={({ pressed }) => [styles.stopButton, pressed && styles.stopPressed]}
      >
        <Ionicons color={colors.white} name="radio" size={40} />
        <TelText variant="bodyStrong" color="white">¡Fijar!</TelText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
    alignItems: 'center',
  },
  track: {
    width: '100%',
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  zone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(56,161,105,0.65)',
  },
  needle: {
    position: 'absolute',
    width: 5,
    top: 2,
    bottom: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.cream,
  },
  stopButton: {
    width: 148,
    height: 148,
    borderRadius: radius.pill,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 4,
    borderColor: colors.accent,
  },
  stopPressed: {
    transform: [{ scale: 0.94 }],
    backgroundColor: colors.primarySoft,
  },
});
