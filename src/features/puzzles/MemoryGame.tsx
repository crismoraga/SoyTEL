import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { PressableScale } from '@/components/PressableScale';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { feedbackSuccess, feedbackTap } from '@/lib/feedback';
import { mulberry32 } from '@/route/random';
import { colors, radius, spacing } from '@/theme';
import { createMemoryDeck, getMemoryConcept, isMemoryMatch, memoryPairsForLevel, memoryScore } from './memory';
import type { PuzzleGameProps } from './types';

const COLUMNS = 4;
// Tiempo para mirar dos cartas que no calzan antes de que se den vuelta.
const LOOK_MS = 1500;

// Desafío "Parejas TEL": une cada concepto con lo que hace. Sin reloj: gana quien recuerda mejor.
export function MemoryGame({ level, seed, onSolved, say }: PuzzleGameProps) {
  const { width } = useWindowDimensions();
  const [deck] = useState(() => createMemoryDeck(level, mulberry32(seed)));
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [attempts, setAttempts] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pairs = memoryPairsForLevel(level);
  const cardWidth = Math.floor((Math.min(width - spacing.md * 2, 460) - spacing.xs * (COLUMNS - 1)) / COLUMNS);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function flip(index: number) {
    const card = deck[index];
    if (matched.includes(card.pair) || open.includes(index)) return;
    // Con dos cartas distintas a la vista, un toque las da vuelta de inmediato.
    const current = open.length === 2 ? [] : open;
    if (timer.current) clearTimeout(timer.current);
    void feedbackTap();
    if (current.length === 0) {
      setOpen([index]);
      return;
    }
    const first = deck[current[0]];
    const used = attempts + 1;
    setAttempts(used);
    if (isMemoryMatch(first, card)) {
      const found = [...matched, card.pair];
      const concept = getMemoryConcept(card.pair);
      setMatched(found);
      setOpen([]);
      void feedbackSuccess();
      if (concept) say(`¡Pareja! ${concept.term}: ${concept.clue.toLowerCase()}.`, 'good');
      if (found.length === pairs) {
        onSolved({ score: memoryScore(pairs, used), accuracy: Math.min(1, pairs / used), detail: `${used} intentos para ${pairs} parejas` });
      }
      return;
    }
    setOpen([current[0], index]);
    if (used === 1) say('No calzan. Míralas bien: se darán vuelta en un momento.', 'tip');
    timer.current = setTimeout(() => setOpen([]), LOOK_MS);
  }

  return (
    <View style={styles.container}>
      <View style={styles.stats}>
        <View style={styles.stat}>
          <TelIcon name="grid" size={16} color={colors.accent} />
          <TelText variant="label" color="cream" tabular>
            {matched.length}/{pairs} parejas
          </TelText>
        </View>
        <View style={styles.stat}>
          <TelIcon name="eye" size={16} color={colors.accent} />
          <TelText variant="label" color="cream" tabular>
            {attempts} intentos
          </TelText>
        </View>
      </View>
      <View style={styles.grid}>
        {deck.map((card, index) => {
          const concept = getMemoryConcept(card.pair);
          const done = matched.includes(card.pair);
          const shown = done || open.includes(index);
          return (
            <PressableScale
              key={card.key}
              accessibilityRole="button"
              accessibilityLabel={shown && concept ? (card.side === 'term' ? concept.term : concept.clue) : `Carta ${index + 1}, boca abajo`}
              accessibilityState={{ disabled: done }}
              disabled={done}
              onPress={() => flip(index)}
              scaleTo={0.94}
              style={[styles.card, { width: cardWidth, height: Math.round(cardWidth * 1.18) }, shown && styles.cardOpen, done && styles.cardDone]}
            >
              {!shown || !concept ? (
                <TelIcon name="sparkle" size={Math.round(cardWidth * 0.34)} color={colors.accent} />
              ) : card.side === 'term' ? (
                <>
                  <TelIcon name={concept.icon} size={Math.round(cardWidth * 0.36)} color={colors.primary} />
                  <TelText variant="small" color="primary" align="center" numberOfLines={2} style={styles.cardText}>
                    {concept.term}
                  </TelText>
                </>
              ) : (
                <TelText variant="small" color="primary" align="center" style={styles.cardText}>
                  {concept.clue}
                </TelText>
              )}
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 4,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 212, 237, 0.3)',
    backgroundColor: colors.primarySoft,
  },
  cardOpen: {
    borderColor: colors.accent,
    backgroundColor: colors.cream,
  },
  cardDone: {
    borderColor: colors.success,
    backgroundColor: '#DDF3E6',
  },
  cardText: {
    fontSize: 11,
    lineHeight: 14,
  },
});
