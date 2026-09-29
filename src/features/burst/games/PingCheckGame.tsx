import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { colors, monoFamily, radius, spacing } from '@/theme';
import { pick, pingLines, type PingScenario } from '../logic';
import { ChoiceTile, TileGrid, type TileState } from '../parts';
import type { MicroGameProps } from '../types';

// Microjuego 3: una terminal ejecuta ping; decide si hay conectividad.
export function PingCheckGame({ active, onAnswer }: MicroGameProps) {
  const scenario = useMemo<PingScenario>(() => pick(['ok', 'ok', 'timeout', 'unreachable']), []);
  const host = useMemo(() => pick(['usm.cl', 'servidor-lab', '8.8.8.8', 'intranet.campus']), []);
  const lines = useMemo(() => pingLines(scenario, host), [host, scenario]);
  const [visible, setVisible] = useState(1);
  const [chosen, setChosen] = useState<'yes' | 'no' | null>(null);
  const answer = scenario === 'ok' ? 'yes' : 'no';

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setVisible((value) => Math.min(lines.length, value + 1)), 420);
    return () => clearInterval(timer);
  }, [active, lines.length]);

  function choose(value: 'yes' | 'no') {
    if (!active || chosen) return;
    setChosen(value);
    onAnswer(value === answer, visible < lines.length ? 30 : 10);
  }

  const tileState = (value: 'yes' | 'no'): TileState => (!chosen ? 'idle' : value === answer ? 'correct' : value === chosen ? 'wrong' : 'dimmed');

  return (
    <View style={styles.container}>
      <View style={styles.terminal} accessibilityLabel={lines.slice(0, visible).join('. ')}>
        <View style={styles.terminalBar}>
          <View style={[styles.light, { backgroundColor: '#E58A8A' }]} />
          <View style={[styles.light, { backgroundColor: '#F2CE63' }]} />
          <View style={[styles.light, { backgroundColor: '#6BC59A' }]} />
          <TelIcon name="terminal" size={14} color={colors.slate} style={styles.terminalIcon} />
        </View>
        {lines.slice(0, visible).map((line, index) => (
          <TelText key={`${line}-${index}`} style={[styles.line, { color: index === 0 ? colors.accent : colors.onDark }]}>
            {line}
          </TelText>
        ))}
        {visible < lines.length && <TelText style={[styles.line, { color: colors.accent }]}>▌</TelText>}
      </View>
      <TileGrid>
        <ChoiceTile label="Hay conexión" icon="wifi" state={tileState('yes')} disabled={!active || Boolean(chosen)} onPress={() => choose('yes')} />
        <ChoiceTile label="Sin conexión" icon="wifiOff" state={tileState('no')} disabled={!active || Boolean(chosen)} onPress={() => choose('no')} />
      </TileGrid>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  terminal: {
    minHeight: 150,
    borderRadius: radius.md,
    backgroundColor: '#051524',
    borderWidth: 1,
    borderColor: 'rgba(167, 212, 237, 0.2)',
    padding: spacing.sm,
    gap: 4,
  },
  terminalBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  terminalIcon: {
    marginLeft: 'auto',
  },
  light: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  line: {
    fontFamily: monoFamily,
    fontSize: 12,
    lineHeight: 17,
  },
});
