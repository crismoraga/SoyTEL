import { useRef, useState, type ComponentType, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { TelText } from '@/components/TelText';
import { feedbackSuccess, feedbackWarning } from '@/lib/feedback';
import { colors, spacing } from '@/theme';
import { ChoiceTile, TileGrid, type TileState } from './parts';
import type { MicroGameProps } from './types';

// Microjuegos de "elige la buena": un dibujo o dato, una pregunta y 2–4 opciones con una sola correcta.
export interface QuickRound {
  visual?: ReactNode;
  prompt: string;
  options: string[];
  // Índice de la correcta en `options` (el motor las mezcla).
  answer: number;
  // Qué había que ver, en una línea (se muestra si falla).
  note: string;
}

export type QuickGenerator = (level: number, random: () => number) => QuickRound;

export function shuffleRound(round: QuickRound, random: () => number): QuickRound {
  const order = round.options.map((_, index) => index);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [order[index], order[other]] = [order[other], order[index]];
  }
  return { ...round, options: order.map((index) => round.options[index]), answer: order.indexOf(round.answer) };
}

export function makeQuickGame(generate: QuickGenerator, name: string): ComponentType<MicroGameProps> {
  function QuickGame({ active, level, onAnswer }: MicroGameProps) {
    const [round] = useState(() => shuffleRound(generate(level, Math.random), Math.random));
    const [picked, setPicked] = useState<number | null>(null);
    const answered = useRef(false);

    function choose(index: number) {
      if (!active || answered.current) return;
      answered.current = true;
      setPicked(index);
      if (index === round.answer) {
        void feedbackSuccess();
        onAnswer(true, 30);
      } else {
        void feedbackWarning();
        onAnswer(false, 0, round.note);
      }
    }

    const state = (index: number): TileState => (picked === null ? 'idle' : index === round.answer ? 'correct' : index === picked ? 'wrong' : 'dimmed');
    return (
      <View style={styles.root}>
        {round.visual ? <View style={styles.visual}>{round.visual}</View> : null}
        <TelText variant="bodyStrong" color="cream" align="center">
          {round.prompt}
        </TelText>
        <TileGrid>
          {round.options.map((option, index) => (
            <ChoiceTile key={option} label={option} state={state(index)} disabled={picked !== null} onPress={() => choose(index)} />
          ))}
        </TileGrid>
      </View>
    );
  }
  QuickGame.displayName = name;
  return QuickGame;
}

// ——— Dibujos simples ———

const WAVE_W = 260;

// Una onda (o varias apiladas) con `cycles` vueltas, amplitud variable (AM), frecuencia variable (FM) o ruido.
export function Waves({ waves }: { waves: { label?: string; cycles: number; noise?: number; am?: boolean; fm?: boolean; seed?: number }[] }) {
  const rowH = 46;
  const height = waves.length * rowH;
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${WAVE_W + 24} ${height}`}>
      {waves.map((wave, row) => {
        const mid = row * rowH + rowH / 2;
        let seed = (wave.seed ?? row + 1) * 9301;
        const rnd = () => {
          seed = (seed * 9301 + 49297) % 233280;
          return seed / 233280 - 0.5;
        };
        let d = '';
        for (let x = 0; x <= WAVE_W; x += 2) {
          const t = x / WAVE_W;
          const freq = wave.fm ? wave.cycles * (0.5 + 1.2 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2))) : wave.cycles;
          const amp = wave.am ? 6 + 12 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2)) : 16;
          const phase = wave.fm ? 2 * Math.PI * wave.cycles * t + 1.2 * wave.cycles * Math.sin(t * Math.PI * 2) * 0.3 : 2 * Math.PI * freq * t;
          const y = mid - amp * Math.sin(phase) + (wave.noise ?? 0) * 26 * rnd();
          d += `${x === 0 ? 'M' : 'L'}${x + 20} ${y.toFixed(1)} `;
        }
        return (
          <G key={row}>
            <Line x1={20} y1={mid} x2={WAVE_W + 20} y2={mid} stroke="rgba(167,212,237,0.25)" strokeWidth={1} />
            {wave.label ? (
              <SvgText x={4} y={mid + 5} fill={colors.accent} fontSize={14} fontWeight="bold">
                {wave.label}
              </SvgText>
            ) : null}
            <Path d={d} stroke={colors.cream} strokeWidth={2.2} fill="none" strokeLinejoin="round" />
          </G>
        );
      })}
    </Svg>
  );
}

// Barras con etiqueta (gráficos y canales).
export function Bars({ values, labels }: { values: number[]; labels: string[] }) {
  const top = Math.max(...values, 1);
  const width = values.length * 44;
  return (
    <Svg width="100%" height={110} viewBox={`0 0 ${width} 110`}>
      {values.map((value, index) => {
        const h = 10 + (value / top) * 70;
        return (
          <G key={labels[index]}>
            <Rect x={index * 44 + 8} y={88 - h} width={28} height={h} rx={5} fill={colors.accent} />
            <SvgText x={index * 44 + 22} y={84 - h} fill={colors.cream} fontSize={11} textAnchor="middle">
              {value}
            </SvgText>
            <SvgText x={index * 44 + 22} y={104} fill={colors.accentSoft} fontSize={11} textAnchor="middle">
              {labels[index]}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

// Un bloque de texto monoespaciado (terminal, código, tablas).
export function Mono({ lines }: { lines: string[] }) {
  return (
    <View style={styles.mono}>
      {lines.map((line, index) => (
        <TelText key={index} variant="caption" color="cream" style={styles.monoText}>
          {line}
        </TelText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: spacing.sm, justifyContent: 'center' },
  visual: { alignItems: 'center', alignSelf: 'stretch' },
  mono: { alignSelf: 'stretch', borderRadius: 10, padding: spacing.sm, backgroundColor: 'rgba(0,0,0,0.28)', gap: 2 },
  monoText: { fontFamily: 'monospace' },
});
