import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedProgress } from '@/components/feedback/Progress';
import { IconButton } from '@/components/IconButton';
import { TelButton } from '@/components/TelButton';
import { TelText } from '@/components/TelText';
import { feedbackSuccess, feedbackTap, feedbackWarning } from '@/lib/feedback';
import { mulberry32 } from '@/route/random';
import { colors, monoFamily, radius, spacing } from '@/theme';
import { ALPHABET, caesar, CIPHER_ROUNDS, cipherPoints, cipherRounds } from './codes';
import type { PuzzleGameProps } from './types';

// Desafío "Mensaje cifrado": se prueba cada desplazamiento del alfabeto hasta leer el mensaje (César).
export function CipherGame({ level, seed, onSolved, say }: PuzzleGameProps) {
  const [rounds] = useState(() => cipherRounds(level, mulberry32(seed)));
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState(0);
  const [solved, setSolved] = useState(false);
  const score = useRef(0);
  const wrong = useRef(0);
  const wrongHere = useRef(0);
  const round = rounds[index];
  const decoded = caesar(round.cipher, -guess);
  // Muestra cómo queda el alfabeto con el desplazamiento elegido.
  const sample = ALPHABET.slice(0, 6)
    .split('')
    .map((letter) => `${caesar(letter, guess)}→${letter}`)
    .join('  ');

  function move(delta: number) {
    if (solved) return;
    void feedbackTap();
    setGuess((((guess + delta) % 26) + 26) % 26);
  }

  function check() {
    if (solved) return;
    if (guess === round.shift) {
      void feedbackSuccess();
      score.current += cipherPoints(wrongHere.current, index);
      setSolved(true);
      say(`¡Descifrado! Cada letra estaba corrida ${round.shift} ${round.shift === 1 ? 'lugar' : 'lugares'}.`, 'good');
      return;
    }
    void feedbackWarning();
    wrong.current += 1;
    wrongHere.current += 1;
    say('Todavía no se lee. Sigue probando: cuando aparezca una palabra real, la tienes.', 'bad');
  }

  function next() {
    if (index + 1 >= rounds.length) {
      onSolved({
        score: Math.min(1000, score.current),
        accuracy: CIPHER_ROUNDS / (CIPHER_ROUNDS + wrong.current),
        detail: wrong.current === 0 ? 'Sin comprobaciones fallidas' : `${wrong.current} ${wrong.current === 1 ? 'comprobación fallida' : 'comprobaciones fallidas'}`,
      });
      return;
    }
    setIndex(index + 1);
    setGuess(0);
    setSolved(false);
    wrongHere.current = 0;
    say('Mensaje nuevo, clave nueva. Prueba desplazamientos hasta que se lea.', 'tip');
  }

  return (
    <View style={styles.container}>
      <SegmentedProgress total={rounds.length} done={index + (solved ? 1 : 0)} current={index} />
      <View style={styles.card}>
        <TelText variant="small" color="accentSoft">
          MENSAJE INTERCEPTADO
        </TelText>
        <TelText variant="title" color="slate" align="center" style={styles.mono} accessibilityLabel={`Texto cifrado: ${round.cipher.split('').join(' ')}`}>
          {round.cipher}
        </TelText>
      </View>
      <View style={[styles.card, styles.decoded, solved && styles.decodedOk]}>
        <TelText variant="small" color={solved ? 'white' : 'accent'}>
          {solved ? 'MENSAJE ORIGINAL' : `CON DESPLAZAMIENTO ${guess}`}
        </TelText>
        <TelText variant="title" color="cream" align="center" style={styles.mono} accessibilityLiveRegion="polite">
          {decoded}
        </TelText>
      </View>

      <View style={styles.dial}>
        <IconButton icon="minus" tone="dark" size={56} accessibilityLabel="Un desplazamiento menos" onPress={() => move(-1)} disabled={solved} />
        <View style={styles.shift}>
          <TelText variant="small" color="accentSoft">
            DESPLAZAMIENTO
          </TelText>
          <TelText variant="hero" color="cream" tabular>
            {guess}
          </TelText>
          <TelText variant="small" color="slate" style={styles.sample}>
            {sample}
          </TelText>
        </View>
        <IconButton icon="plus" tone="dark" size={56} accessibilityLabel="Un desplazamiento más" onPress={() => move(1)} disabled={solved} />
      </View>

      {solved ? (
        <TelButton label={index + 1 >= rounds.length ? 'Ver resultado' : 'Siguiente mensaje'} variant="cream" iconRight="arrowRight" onPress={next} />
      ) : (
        <TelButton label="¡Lo descifré!" variant="cream" icon="unlock" onPress={check} />
      )}
      <TelText variant="caption" color="accentSoft" align="center">
        La clave está entre 1 y {round.maxShift}. Probarlas todas es un ataque de «fuerza bruta».
      </TelText>
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
  decoded: {
    backgroundColor: colors.primaryDeep,
    borderColor: colors.accent,
  },
  decodedOk: {
    backgroundColor: '#1F5E43',
    borderColor: '#6BC59A',
  },
  mono: {
    fontFamily: monoFamily,
    letterSpacing: 3,
  },
  dial: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  shift: {
    alignItems: 'center',
    minWidth: 170,
  },
  sample: {
    fontFamily: monoFamily,
    fontSize: 10,
  },
});
