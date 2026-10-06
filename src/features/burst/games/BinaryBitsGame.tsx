import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PressableScale } from '@/components/PressableScale';
import { TelText } from '@/components/TelText';
import { feedbackTap } from '@/lib/feedback';
import { colors, font, radius, spacing } from '@/theme';
import { binaryRound, bitsValue } from '../logic';
import type { MicroGameProps } from '../types';

// Microjuego 13: enciende los bits que suman el número pedido (8 + 4 + 2 + 1).
export function BinaryBitsGame({ active, level, onAnswer }: MicroGameProps) {
  const [round] = useState(() => binaryRound(Math.random, level >= 3 ? 5 : 4));
  const [flags, setFlags] = useState<boolean[]>(() => Array.from({ length: round.bits }, () => false));
  const [taps, setTaps] = useState(0);
  const done = useRef(false);
  const value = bitsValue(flags);
  const solved = value === round.target;

  function toggle(index: number) {
    if (!active || done.current) return;
    void feedbackTap();
    const next = flags.map((on, position) => (position === index ? !on : on));
    setFlags(next);
    setTaps(taps + 1);
    if (bitsValue(next) === round.target) {
      done.current = true;
      // Menos toques de más, más bono.
      const needed = next.filter(Boolean).length;
      onAnswer(true, Math.max(10, 40 - Math.max(0, taps + 1 - needed) * 8));
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.target} accessibilityLabel={`Forma el número ${round.target}`}>
        <TelText variant="small" color="accentSoft">
          FORMA EL NÚMERO
        </TelText>
        <TelText variant="display" color="cream" tabular>
          {round.target}
        </TelText>
      </View>
      <View style={styles.bits}>
        {flags.map((on, index) => {
          const weight = 2 ** (round.bits - 1 - index);
          return (
            <PressableScale
              key={weight}
              accessibilityRole="switch"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`Bit de valor ${weight}`}
              onPress={() => toggle(index)}
              scaleTo={0.9}
              style={[styles.bit, on && styles.bitOn]}
            >
              <TelText variant="title" style={[font('display'), { color: on ? colors.primary : colors.slate }]}>
                {on ? '1' : '0'}
              </TelText>
              <TelText variant="small" style={{ color: on ? colors.primary : colors.accentSoft }}>
                {weight}
              </TelText>
            </PressableScale>
          );
        })}
      </View>
      <View style={[styles.sum, solved && styles.sumOk]}>
        <TelText variant="heading" color={solved ? 'white' : 'cream'} tabular>
          {flags.map((on) => (on ? '1' : '0')).join('')} = {value}
        </TelText>
      </View>
      <TelText variant="caption" color="accentSoft" align="center">
        Cada bit encendido suma su valor: {Array.from({ length: round.bits }, (_, index) => 2 ** (round.bits - 1 - index)).join(' + ')}.
      </TelText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    alignItems: 'center',
  },
  target: {
    alignItems: 'center',
  },
  bits: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignSelf: 'stretch',
  },
  bit: {
    flex: 1,
    minHeight: 92,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'rgba(167, 212, 237, 0.3)',
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  bitOn: {
    backgroundColor: colors.accent,
    borderColor: colors.cream,
  },
  sum: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  sumOk: {
    backgroundColor: '#1F5E43',
  },
});
