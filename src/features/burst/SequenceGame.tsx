import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { TelText } from '@/components/TelText';
import { colors, radius, spacing } from '@/theme';
import type { MicroGameProps } from './types';

interface Pad {
  id: string;
  label: string;
  color: string;
}

const pads: Pad[] = [
  { id: 'azul', label: 'Azul', color: colors.accent },
  { id: 'verde', label: 'Verde', color: colors.success },
  { id: 'ambar', label: 'Ámbar', color: colors.warning },
  { id: 'rojo', label: 'Rojo', color: colors.danger },
];

const FLASH_MS = 550;
const GAP_MS = 220;

export function SequenceGame({ active, onAnswer }: MicroGameProps) {
  const sequence = useMemo(() => {
    const shuffled = [...pads].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3).map((pad) => pad.id);
  }, []);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [inputCount, setInputCount] = useState(0);
  const [showing, setShowing] = useState(true);
  const answeredRef = useRef(false);

  useEffect(() => {
    if (!active) {
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    sequence.forEach((padId, index) => {
      timers.push(setTimeout(() => setHighlighted(padId), index * (FLASH_MS + GAP_MS)));
      timers.push(setTimeout(() => setHighlighted(null), index * (FLASH_MS + GAP_MS) + FLASH_MS));
    });
    timers.push(setTimeout(() => setShowing(false), sequence.length * (FLASH_MS + GAP_MS)));

    return () => timers.forEach(clearTimeout);
  }, [active, sequence]);

  function tap(padId: string) {
    if (!active || showing || answeredRef.current) {
      return;
    }

    if (padId === sequence[inputCount]) {
      const nextCount = inputCount + 1;
      setInputCount(nextCount);
      if (nextCount >= sequence.length) {
        answeredRef.current = true;
        onAnswer(true, 40);
      }
      return;
    }

    answeredRef.current = true;
    onAnswer(false);
  }

  return (
    <View style={styles.container}>
      <TelText variant="bodyStrong" color="accentSoft" align="center">
        {showing ? 'Memoriza la ruta…' : `Repite la ruta (${inputCount}/${sequence.length})`}
      </TelText>
      <View style={styles.grid}>
        {pads.map((pad) => (
          <Pressable
            key={pad.id}
            accessibilityRole="button"
            accessibilityLabel={`Nodo ${pad.label}`}
            disabled={!active || showing}
            onPress={() => tap(pad.id)}
            style={({ pressed }) => [
              styles.pad,
              { backgroundColor: pad.color },
              (highlighted === pad.id || pressed) && styles.padActive,
              highlighted === pad.id && styles.padHighlighted,
            ]}
          >
            <TelText variant="bodyStrong" color="white" align="center">{pad.label}</TelText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  pad: {
    flexBasis: '46%',
    minHeight: 96,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.45,
  },
  padActive: {
    opacity: 1,
  },
  padHighlighted: {
    transform: [{ scale: 1.05 }],
    borderWidth: 3,
    borderColor: colors.white,
  },
});
