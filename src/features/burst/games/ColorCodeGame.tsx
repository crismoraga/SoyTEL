import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';
import { TelText } from '@/components/TelText';
import { colors, spacing } from '@/theme';
import { crimpRound, t568b, type Wire } from '../logic';
import { ChoiceTile, TileGrid, type TileState } from '../parts';
import type { MicroGameProps } from '../types';

function WireShape({ wire, x, height }: { wire: Wire; x: number; height: number }) {
  return (
    <G>
      <Rect x={x} y={0} width={14} height={height} rx={7} fill={wire.striped ? '#F7F4EC' : wire.color} />
      {wire.striped &&
        [0, 1, 2, 3, 4].map((band) => (
          <Path key={band} d={`M${x} ${14 + band * 22}l14 -9v8l-14 9z`} fill={wire.color} />
        ))}
    </G>
  );
}

// Microjuego 4: completa el orden de colores de un conector RJ45 según la norma T568B.
export function ColorCodeGame({ active, onAnswer }: MicroGameProps) {
  const round = useMemo(() => crimpRound(), []);
  const [chosen, setChosen] = useState<string | null>(null);
  const answer = t568b[round.missing];

  function choose(wire: Wire) {
    if (!active || chosen) return;
    setChosen(wire.id);
    onAnswer(wire.id === answer.id, 30);
  }

  const shown = chosen ? t568b.find((wire) => wire.id === chosen) : null;

  return (
    <View style={styles.container}>
      <TelText variant="subtitle" color="cream" align="center">
        ¿Qué cable va en el pin {round.missing + 1}?
      </TelText>
      <View style={styles.connector} accessibilityLabel={`Conector RJ45, falta el pin ${round.missing + 1}`}>
        <Svg width={220} height={150} viewBox="0 0 220 150">
          <Path d="M14 10h192v84c0 6-4 10-10 10H150v20H70v-20H24c-6 0-10-4-10-10Z" fill="rgba(167,212,237,0.18)" stroke={colors.accentSoft} strokeWidth={2} />
          {t568b.map((wire, index) => {
            const x = 26 + index * 22;
            if (index === round.missing) {
              return shown ? (
                <WireShape key={wire.id} wire={shown} x={x} height={118} />
              ) : (
                <Rect key={wire.id} x={x} y={0} width={14} height={118} rx={7} fill="none" stroke={colors.cream} strokeWidth={2} strokeDasharray="4 5" />
              );
            }
            return <WireShape key={wire.id} wire={wire} x={x} height={118} />;
          })}
        </Svg>
        <View style={styles.pins}>
          {t568b.map((wire, index) => (
            <TelText key={wire.id} variant="small" color={index === round.missing ? 'cream' : 'slate'} style={styles.pin}>
              {index + 1}
            </TelText>
          ))}
        </View>
      </View>
      <TileGrid>
        {round.options.map((wire) => {
          let state: TileState = 'idle';
          if (chosen) state = wire.id === answer.id ? 'correct' : wire.id === chosen ? 'wrong' : 'dimmed';
          return (
            <ChoiceTile key={wire.id} label={wire.label} state={state} disabled={!active || Boolean(chosen)} onPress={() => choose(wire)} style={styles.tile}>
              <Svg width={60} height={16} viewBox="0 0 60 16">
                <Rect x={0} y={1} width={60} height={14} rx={7} fill={wire.striped ? '#F7F4EC' : wire.color} />
                {wire.striped && [0, 1, 2].map((band) => <Path key={band} d={`M${9 + band * 16} 15l8 -14h6l-8 14z`} fill={wire.color} />)}
              </Svg>
            </ChoiceTile>
          );
        })}
      </TileGrid>
      <TelText variant="caption" color="accentSoft" align="center">
        Norma T568B, la más usada en cables de red.
      </TelText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  connector: {
    alignItems: 'center',
  },
  pins: {
    flexDirection: 'row',
    width: 220,
    paddingLeft: 22,
  },
  pin: {
    width: 22,
    fontSize: 11,
  },
  tile: {
    minHeight: 76,
  },
});
