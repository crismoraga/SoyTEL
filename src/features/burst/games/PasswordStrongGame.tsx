import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PressableScale } from '@/components/PressableScale';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { feedbackTap } from '@/lib/feedback';
import { colors, monoFamily, radius, spacing } from '@/theme';
import { passwordLevelLabels, passwordStrength, shuffle } from '../logic';
import type { MicroGameProps } from '../types';

type ChipKind = 'word' | 'number' | 'symbol' | 'bad';

interface Chip {
  id: string;
  text: string;
  kind: ChipKind;
}

const WORDS = ['nube', 'faro', 'cable', 'delfín', 'antena', 'mate', 'volcán', 'señal', 'cometa', 'brújula'];
const NUMBERS = ['4', '27', '2026', '9'];
const SYMBOLS = ['-', '!', '#', '.'];
const BAD = ['123456', 'password', 'qwerty', 'tu nombre'];
const meterColors = [colors.danger, colors.warning, colors.accent, '#6BC59A'];

// Microjuego 12: arma una contraseña con palabras al azar hasta llegar a «Muy fuerte».
export function PasswordStrongGame({ active, onAnswer }: MicroGameProps) {
  const chips = useMemo<Chip[]>(() => {
    const words = shuffle(WORDS).slice(0, 5).map((text) => ({ id: `w-${text}`, text, kind: 'word' as const }));
    const numbers = shuffle(NUMBERS).slice(0, 2).map((text) => ({ id: `n-${text}`, text, kind: 'number' as const }));
    const symbols = shuffle(SYMBOLS).slice(0, 2).map((text) => ({ id: `s-${text}`, text, kind: 'symbol' as const }));
    const bad = shuffle(BAD).slice(0, 2).map((text) => ({ id: `b-${text}`, text, kind: 'bad' as const }));
    return shuffle([...words, ...numbers, ...symbols, ...bad]);
  }, []);
  const [used, setUsed] = useState<Chip[]>([]);
  const [blocked, setBlocked] = useState<string | null>(null);
  const done = useRef(false);
  const password = used.map((chip) => chip.text).join('');
  const words = used.filter((chip) => chip.kind === 'word').length;
  const { level } = passwordStrength(password, words);

  function add(chip: Chip) {
    if (!active || done.current || used.includes(chip)) return;
    if (chip.kind === 'bad') {
      done.current = true;
      setBlocked(chip.text);
      onAnswer(false);
      return;
    }
    void feedbackTap();
    const next = [...used, chip];
    setUsed(next);
    const strength = passwordStrength(next.map((item) => item.text).join(''), next.filter((item) => item.kind === 'word').length);
    if (strength.level === 3) {
      done.current = true;
      onAnswer(true, Math.max(10, 60 - next.length * 5));
    }
  }

  function undo() {
    if (!active || done.current) return;
    setUsed((items) => items.slice(0, -1));
  }

  return (
    <View style={styles.container}>
      <View style={styles.field} accessibilityLabel={`Contraseña: ${password || 'vacía'}`}>
        <TelIcon name="key" size={20} color={colors.accent} />
        <TelText style={[styles.password, !password && styles.placeholder]} numberOfLines={2}>
          {password || 'toca las piezas…'}
        </TelText>
        <PressableScale accessibilityRole="button" accessibilityLabel="Borrar última pieza" onPress={undo} disabled={used.length === 0} hitSlop={8}>
          <TelIcon name="arrowLeft" size={20} color={used.length ? colors.cream : colors.slate} />
        </PressableScale>
      </View>
      <View style={styles.meter} accessibilityLabel={`Seguridad: ${passwordLevelLabels[level]}`}>
        {[0, 1, 2, 3].map((segment) => (
          <View key={segment} style={[styles.segment, segment <= level && used.length > 0 && { backgroundColor: meterColors[level] }]} />
        ))}
        <TelText variant="label" color="cream" style={styles.meterLabel}>
          {used.length ? passwordLevelLabels[level] : '—'}
        </TelText>
      </View>
      <View style={styles.chips}>
        {chips.map((chip) => {
          const isUsed = used.includes(chip);
          return (
            <PressableScale
              key={chip.id}
              accessibilityRole="button"
              accessibilityLabel={`Agregar ${chip.text}`}
              disabled={!active || isUsed || Boolean(blocked)}
              onPress={() => add(chip)}
              scaleTo={0.9}
              style={[styles.chip, isUsed && styles.chipUsed, blocked === chip.text && styles.chipBad]}
            >
              <TelText variant="bodyStrong" color={isUsed ? 'slate' : 'primary'}>
                {chip.text}
              </TelText>
            </PressableScale>
          );
        })}
      </View>
      <TelText variant="caption" color={blocked ? 'dangerSoft' : 'accentSoft'} align="center">
        {blocked ? `«${blocked}» está en todas las listas de ataque.` : 'Largo y al azar le gana a corto y con símbolos.'}
      </TelText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 60,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#051524',
    borderWidth: 1.5,
    borderColor: colors.secondary,
  },
  password: {
    flex: 1,
    fontFamily: monoFamily,
    fontSize: 17,
    color: colors.cream,
  },
  placeholder: {
    color: colors.slate,
    fontStyle: 'italic',
  },
  meter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  segment: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primarySoft,
  },
  meterLabel: {
    width: 90,
    textAlign: 'right',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  chip: {
    minHeight: 46,
    minWidth: 64,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipUsed: {
    backgroundColor: colors.primarySoft,
  },
  chipBad: {
    backgroundColor: colors.danger,
  },
});
