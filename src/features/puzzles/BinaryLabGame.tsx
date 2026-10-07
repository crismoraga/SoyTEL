import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedProgress } from '@/components/feedback/Progress';
import { PressableScale } from '@/components/PressableScale';
import { TelButton } from '@/components/TelButton';
import { TelText } from '@/components/TelText';
import { feedbackSuccess, feedbackTap, feedbackWarning } from '@/lib/feedback';
import { mulberry32 } from '@/route/random';
import { colors, font, monoFamily, radius, spacing } from '@/theme';
import { BINARY_ROUNDS, binaryChallenges, binaryPoints, explainBinary, toBitString } from './codes';
import type { PuzzleGameProps } from './types';

// Desafío "Binario": pasar de decimal a bits y de bits a decimal, sin reloj.
export function BinaryLabGame({ level, seed, onSolved, say }: PuzzleGameProps) {
  const [challenges] = useState(() => binaryChallenges(level, mulberry32(seed)));
  const [index, setIndex] = useState(0);
  const [flags, setFlags] = useState<boolean[]>(() => Array.from({ length: challenges[0].bits }, () => false));
  const [wrongOptions, setWrongOptions] = useState<number[]>([]);
  const [solved, setSolved] = useState(false);
  const score = useRef(0);
  const wrong = useRef(0);
  const wrongHere = useRef(0);
  const challenge = challenges[index];
  const weights = Array.from({ length: challenge.bits }, (_, position) => 2 ** (challenge.bits - 1 - position));
  const sum = flags.reduce((total, on, position) => total + (on ? weights[position] : 0), 0);

  function win() {
    void feedbackSuccess();
    score.current += binaryPoints(wrongHere.current, index);
    setSolved(true);
    say(`¡Correcto! ${explainBinary(challenge.value, challenge.bits)}`, 'good');
  }

  function miss(message: string) {
    void feedbackWarning();
    wrong.current += 1;
    wrongHere.current += 1;
    say(message, 'bad');
  }

  function check() {
    if (solved) return;
    if (sum === challenge.value) win();
    else miss(sum > challenge.value ? `Te pasaste por ${sum - challenge.value}. Apaga algún bit.` : `Te faltan ${challenge.value - sum}. Enciende otro bit.`);
  }

  function choose(option: number) {
    if (solved || wrongOptions.includes(option)) return;
    if (option === challenge.value) {
      win();
      return;
    }
    setWrongOptions([...wrongOptions, option]);
    miss('No era ese. Suma el valor de cada bit que está en 1.');
  }

  function next() {
    if (index + 1 >= challenges.length) {
      const total = wrong.current + BINARY_ROUNDS;
      onSolved({
        score: Math.min(1000, score.current),
        accuracy: BINARY_ROUNDS / total,
        detail: wrong.current === 0 ? 'Sin errores' : `${wrong.current} ${wrong.current === 1 ? 'intento fallido' : 'intentos fallidos'}`,
      });
      return;
    }
    const upcoming = challenges[index + 1];
    setIndex(index + 1);
    setFlags(Array.from({ length: upcoming.bits }, () => false));
    setWrongOptions([]);
    setSolved(false);
    wrongHere.current = 0;
    say(upcoming.kind === 'toBits' ? `Ahora forma el ${upcoming.value} con bits.` : '¿Qué número forman estos bits?', 'tip');
  }

  const bitString = toBitString(challenge.value, challenge.bits);

  return (
    <View style={styles.container}>
      <SegmentedProgress total={challenges.length} done={index + (solved ? 1 : 0)} current={index} />
      <View style={styles.card}>
        <TelText variant="small" color="accentSoft">
          {challenge.kind === 'toBits' ? 'ESCRIBE EN BINARIO' : '¿QUÉ NÚMERO ES?'}
        </TelText>
        {challenge.kind === 'toBits' ? (
          <TelText variant="display" color="cream" tabular>
            {challenge.value}
          </TelText>
        ) : (
          <TelText variant="hero" color="cream" style={styles.mono}>
            {bitString.replace(/(.{4})(?=.)/g, '$1 ')}
          </TelText>
        )}
      </View>

      <View style={styles.bits}>
        {weights.map((weight, position) => {
          const on = challenge.kind === 'toBits' ? flags[position] : bitString[position] === '1';
          return (
            <PressableScale
              key={weight}
              accessibilityRole={challenge.kind === 'toBits' ? 'switch' : 'text'}
              accessibilityState={challenge.kind === 'toBits' ? { checked: on } : undefined}
              accessibilityLabel={`Bit de valor ${weight}: ${on ? 1 : 0}`}
              disabled={challenge.kind !== 'toBits' || solved}
              onPress={() => {
                void feedbackTap();
                setFlags(flags.map((value, bit) => (bit === position ? !value : value)));
              }}
              scaleTo={0.9}
              style={[styles.bit, on && styles.bitOn]}
            >
              <TelText variant="heading" style={[font('display'), { color: on ? colors.primary : colors.slate }]}>
                {on ? '1' : '0'}
              </TelText>
              <TelText variant="small" style={[styles.weight, { color: on ? colors.primary : colors.accentSoft }]}>
                {weight}
              </TelText>
            </PressableScale>
          );
        })}
      </View>

      {challenge.kind === 'toBits' ? (
        <View style={[styles.sum, sum === challenge.value && styles.sumOk]}>
          <TelText variant="label" color="cream" tabular>
            Suma actual: {sum}
          </TelText>
        </View>
      ) : (
        <View style={styles.options}>
          {challenge.options.map((option) => {
            const isWrong = wrongOptions.includes(option);
            const isRight = solved && option === challenge.value;
            return (
              <PressableScale
                key={option}
                accessibilityRole="button"
                accessibilityLabel={`${option}`}
                disabled={solved || isWrong}
                haptic
                onPress={() => choose(option)}
                style={[styles.option, isRight && styles.optionRight, isWrong && styles.optionWrong]}
              >
                <TelText variant="heading" color={isWrong ? 'slate' : 'cream'} tabular>
                  {option}
                </TelText>
              </PressableScale>
            );
          })}
        </View>
      )}

      {solved ? (
        <TelButton label={index + 1 >= challenges.length ? 'Ver resultado' : 'Siguiente'} variant="cream" iconRight="arrowRight" onPress={next} />
      ) : challenge.kind === 'toBits' ? (
        <TelButton label="Comprobar" variant="cream" icon="check" onPress={check} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  card: {
    alignItems: 'center',
    gap: 4,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(167, 212, 237, 0.25)',
  },
  mono: {
    fontFamily: monoFamily,
    letterSpacing: 2,
  },
  bits: {
    flexDirection: 'row',
    gap: 5,
  },
  bit: {
    flex: 1,
    minHeight: 76,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'rgba(167, 212, 237, 0.3)',
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bitOn: {
    backgroundColor: colors.accent,
    borderColor: colors.cream,
  },
  weight: {
    fontSize: 11,
  },
  sum: {
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  sumOk: {
    backgroundColor: '#1F5E43',
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  option: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 60,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 212, 237, 0.3)',
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionRight: {
    backgroundColor: '#1F5E43',
    borderColor: '#6BC59A',
  },
  optionWrong: {
    opacity: 0.45,
  },
});
