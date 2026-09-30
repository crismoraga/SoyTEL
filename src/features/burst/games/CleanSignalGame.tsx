import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { TelText } from '@/components/TelText';
import { seededRandom } from '@/graphics/shapes';
import { colors, spacing } from '@/theme';
import { shuffle } from '../logic';
import { ChoiceTile, TileGrid, type TileState } from '../parts';
import type { MicroGameProps } from '../types';

interface WaveOption {
  id: string;
  label: string;
  cycles: number;
  noise: number;
}

function wavePath(cycles: number, noise: number, seed: number, width = 120, height = 44): string {
  const random = seededRandom(seed);
  const points: string[] = [];
  for (let x = 0; x <= width; x += 2) {
    const base = Math.sin((x / width) * cycles * Math.PI * 2) * (height * 0.32);
    const jitter = (random() - 0.5) * noise * height * 0.7;
    points.push(`${x === 0 ? 'M' : 'L'}${x} ${(height / 2 + base + jitter).toFixed(1)}`);
  }
  return points.join(' ');
}

const noiseRound: WaveOption[] = [
  { id: 'fibra', label: 'Fibra óptica', cycles: 3, noise: 0 },
  { id: 'utp', label: 'Cable UTP', cycles: 3, noise: 0.35 },
  { id: 'wifi', label: 'Wi-Fi saturado', cycles: 3, noise: 0.85 },
  { id: 'bt', label: 'Bluetooth antiguo', cycles: 3, noise: 0.65 },
];

// Microjuego 2: compara señales. Dos variantes: menos ruido o mayor frecuencia.
export function CleanSignalGame({ active, onAnswer }: MicroGameProps) {
  const [round] = useState(() => {
    const mode: 'noise' | 'frequency' = Math.random() < 0.5 ? 'noise' : 'frequency';
    if (mode === 'noise') {
      return { mode, prompt: '¿Qué medio entrega la señal más limpia?', answer: 'fibra', options: shuffle(noiseRound) };
    }
    const cycles = shuffle([1.5, 3, 4.5, 6.5]);
    const letters = ['A', 'B', 'C', 'D'];
    const options = cycles.map((value, index) => ({ id: `f${value}`, label: `Señal ${letters[index]}`, cycles: value, noise: 0 }));
    const answer = options.reduce((best, item) => (item.cycles > best.cycles ? item : best), options[0]).id;
    return { mode, prompt: '¿Qué señal tiene mayor frecuencia?', answer, options };
  });
  const [chosen, setChosen] = useState<string | null>(null);

  function choose(option: WaveOption) {
    if (!active || chosen) return;
    setChosen(option.id);
    onAnswer(option.id === round.answer, 20);
  }

  return (
    <View style={styles.container}>
      <TelText variant="subtitle" color="cream" align="center">
        {round.prompt}
      </TelText>
      <TileGrid>
        {round.options.map((option, index) => {
          let state: TileState = 'idle';
          if (chosen) state = option.id === round.answer ? 'correct' : option.id === chosen ? 'wrong' : 'dimmed';
          return (
            <ChoiceTile key={option.id} label={option.label} state={state} disabled={!active || Boolean(chosen)} onPress={() => choose(option)}>
              <Svg width={120} height={44} viewBox="0 0 120 44">
                <Path d={wavePath(option.cycles, option.noise, index * 31 + 7)} stroke={colors.accent} strokeWidth={2.4} fill="none" strokeLinejoin="round" />
              </Svg>
            </ChoiceTile>
          );
        })}
      </TileGrid>
      {round.mode === 'frequency' && (
        <TelText variant="caption" color="accentSoft" align="center">
          Frecuencia = cuántas oscilaciones hay en el mismo tiempo.
        </TelText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
});
