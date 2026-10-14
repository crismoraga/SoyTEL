import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';
import { FitBox } from '@/components/FitBox';
import { TelText } from '@/components/TelText';
import { colors } from '@/theme';
import { crimpRound, t568b, type Wire } from '../logic';
import { ChoiceTile, GameFrame, TileGrid, type TileState } from '../parts';
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

// Medidas del conector dibujado: el dibujo se escala para caber en el espacio que sobra.
const CONNECTOR_W = 220;
const CONNECTOR_H = 150;
const PIN_ROW = 16;

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
    <GameFrame>
      <TelText variant="subtitle" color="cream" align="center">
        ¿Qué cable va en el pin {round.missing + 1}?
      </TelText>
      <FitBox maxHeight={CONNECTOR_H + PIN_ROW}>
        {(size) => {
          const scale = Math.min(1, size.width / CONNECTOR_W, size.height / (CONNECTOR_H + PIN_ROW));
          const width = Math.round(CONNECTOR_W * scale);
          return (
            <View style={styles.connector} accessibilityLabel={`Conector RJ45, falta el pin ${round.missing + 1}`}>
              <Svg width={width} height={Math.round(CONNECTOR_H * scale)} viewBox={`0 0 ${CONNECTOR_W} ${CONNECTOR_H}`}>
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
              <View style={{ flexDirection: 'row', width, paddingLeft: 22 * scale }}>
                {t568b.map((wire, index) => (
                  <TelText key={wire.id} variant="small" color={index === round.missing ? 'cream' : 'slate'} style={{ width: 22 * scale, fontSize: 11 }}>
                    {index + 1}
                  </TelText>
                ))}
              </View>
            </View>
          );
        }}
      </FitBox>
      <TileGrid>
        {round.options.map((wire) => {
          let state: TileState = 'idle';
          if (chosen) state = wire.id === answer.id ? 'correct' : wire.id === chosen ? 'wrong' : 'dimmed';
          return (
            <ChoiceTile key={wire.id} label={wire.label} state={state} disabled={!active || Boolean(chosen)} onPress={() => choose(wire)}>
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
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  connector: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
