import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { FitBox } from '@/components/FitBox';
import { PressableScale } from '@/components/PressableScale';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { feedbackTap } from '@/lib/feedback';
import { colors } from '@/theme';
import { GameFrame } from '../parts';
import type { MicroGameProps } from '../types';

interface NodeInfo {
  id: string;
  label: string;
  icon: IconName;
  x: number;
  y: number;
  color: string;
}

// Medida de referencia del dibujo de las líneas (se escala con el tablero).
const AREA = 280;

const nodes: NodeInfo[] = [
  { id: 'router', label: 'Router', icon: 'router', x: 0.5, y: 0.14, color: colors.accent },
  { id: 'server', label: 'Servidor', icon: 'server', x: 0.86, y: 0.5, color: '#6BC59A' },
  { id: 'laptop', label: 'Notebook', icon: 'laptop', x: 0.5, y: 0.86, color: '#F2CE63' },
  { id: 'cloud', label: 'Nube', icon: 'cloud', x: 0.14, y: 0.5, color: '#E58A8A' },
];

const FLASH_MS = 520;
const GAP_MS = 200;

// Microjuego 7: memoriza la ruta que siguen los paquetes entre nodos y repítela.
export function SequenceMemoryGame({ active, level, pace, onAnswer }: MicroGameProps) {
  const length = level >= 3 ? 4 : 3;
  const [sequence] = useState(() => {
    const result: string[] = [];
    while (result.length < length) {
      const candidate = nodes[Math.floor(Math.random() * nodes.length)].id;
      if (candidate !== result[result.length - 1]) result.push(candidate);
    }
    return result;
  });
  const [lit, setLit] = useState<string | null>(null);
  const [showing, setShowing] = useState(true);
  const [input, setInput] = useState(0);
  const answered = useRef(false);

  useEffect(() => {
    if (!active) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const flash = FLASH_MS * pace;
    const step = (FLASH_MS + GAP_MS) * pace;
    sequence.forEach((id, index) => {
      timers.push(setTimeout(() => setLit(id), 350 + index * step));
      timers.push(setTimeout(() => setLit(null), 350 + index * step + flash));
    });
    timers.push(setTimeout(() => setShowing(false), 350 + sequence.length * step));
    return () => timers.forEach(clearTimeout);
  }, [active, pace, sequence]);

  function tap(id: string) {
    if (!active || showing || answered.current) return;
    void feedbackTap();
    setLit(id);
    setTimeout(() => setLit((value) => (value === id ? null : value)), 180);
    if (id !== sequence[input]) {
      answered.current = true;
      onAnswer(false);
      return;
    }
    const next = input + 1;
    setInput(next);
    if (next >= sequence.length) {
      answered.current = true;
      onAnswer(true, 20 + length * 10);
    }
  }

  return (
    <GameFrame>
      <TelText variant="subtitle" color="cream" align="center">
        {showing ? 'Observa la ruta…' : `Repite la ruta (${input}/${sequence.length})`}
      </TelText>
      <FitBox aspectRatio={1} maxWidth={340}>
        {({ width }) => {
          // Los nodos se achican con el tablero, sin bajar de un tamaño cómodo para el dedo.
          const node = Math.max(54, Math.min(76, Math.round(width * 0.27)));
          return (
            <View style={styles.area}>
              <Svg width={width} height={width} viewBox={`0 0 ${AREA} ${AREA}`} style={StyleSheet.absoluteFill}>
                {nodes.map((from, index) =>
                  nodes.slice(index + 1).map((to) => (
                    <Line key={`${from.id}-${to.id}`} x1={from.x * AREA} y1={from.y * AREA} x2={to.x * AREA} y2={to.y * AREA} stroke={colors.secondary} strokeWidth={2} strokeDasharray="5 7" />
                  )),
                )}
              </Svg>
              {nodes.map((item) => {
                const on = lit === item.id;
                return (
                  <PressableScale
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    disabled={!active || showing}
                    onPress={() => tap(item.id)}
                    scaleTo={0.9}
                    style={[
                      styles.node,
                      { width: node, height: node, borderRadius: node / 2, left: item.x * width - node / 2, top: item.y * width - node / 2, borderColor: item.color },
                      on && { backgroundColor: item.color, transform: [{ scale: 1.08 }] },
                      showing && !on && styles.nodeIdle,
                    ]}
                  >
                    <TelIcon name={item.icon} size={Math.round(node * 0.4)} color={on ? colors.primary : colors.cream} />
                  </PressableScale>
                );
              })}
            </View>
          );
        }}
      </FitBox>
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  area: {
    flex: 1,
  },
  node: {
    position: 'absolute',
    borderWidth: 3,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeIdle: {
    opacity: 0.7,
  },
});
