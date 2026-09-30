import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { PressableScale } from '@/components/PressableScale';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { feedbackTap } from '@/lib/feedback';
import { colors, spacing } from '@/theme';
import type { MicroGameProps } from '../types';

interface NodeInfo {
  id: string;
  label: string;
  icon: IconName;
  x: number;
  y: number;
  color: string;
}

const AREA = 280;
const NODE = 76;

const nodes: NodeInfo[] = [
  { id: 'router', label: 'Router', icon: 'router', x: 0.5, y: 0.14, color: colors.accent },
  { id: 'server', label: 'Servidor', icon: 'server', x: 0.86, y: 0.5, color: '#6BC59A' },
  { id: 'laptop', label: 'Notebook', icon: 'laptop', x: 0.5, y: 0.86, color: '#F2CE63' },
  { id: 'cloud', label: 'Nube', icon: 'cloud', x: 0.14, y: 0.5, color: '#E58A8A' },
];

const FLASH_MS = 520;
const GAP_MS = 200;

// Microjuego 7: memoriza la ruta que siguen los paquetes entre nodos y repítela.
export function SequenceMemoryGame({ active, level, onAnswer }: MicroGameProps) {
  const length = level >= 3 ? 4 : 3;
  const sequence = useMemo(() => {
    const result: string[] = [];
    while (result.length < length) {
      const candidate = nodes[Math.floor(Math.random() * nodes.length)].id;
      if (candidate !== result[result.length - 1]) result.push(candidate);
    }
    return result;
  }, [length]);
  const [lit, setLit] = useState<string | null>(null);
  const [showing, setShowing] = useState(true);
  const [input, setInput] = useState(0);
  const answered = useRef(false);

  useEffect(() => {
    if (!active) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    sequence.forEach((id, index) => {
      timers.push(setTimeout(() => setLit(id), 350 + index * (FLASH_MS + GAP_MS)));
      timers.push(setTimeout(() => setLit(null), 350 + index * (FLASH_MS + GAP_MS) + FLASH_MS));
    });
    timers.push(setTimeout(() => setShowing(false), 350 + sequence.length * (FLASH_MS + GAP_MS)));
    return () => timers.forEach(clearTimeout);
  }, [active, sequence]);

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
    <View style={styles.container}>
      <TelText variant="subtitle" color="cream" align="center">
        {showing ? 'Observa la ruta…' : `Repite la ruta (${input}/${sequence.length})`}
      </TelText>
      <View style={styles.area}>
        <Svg width={AREA} height={AREA} style={StyleSheet.absoluteFill}>
          {nodes.map((from, index) =>
            nodes.slice(index + 1).map((to) => (
              <Line key={`${from.id}-${to.id}`} x1={from.x * AREA} y1={from.y * AREA} x2={to.x * AREA} y2={to.y * AREA} stroke={colors.secondary} strokeWidth={2} strokeDasharray="5 7" />
            )),
          )}
        </Svg>
        {nodes.map((node) => {
          const on = lit === node.id;
          return (
            <PressableScale
              key={node.id}
              accessibilityRole="button"
              accessibilityLabel={node.label}
              disabled={!active || showing}
              onPress={() => tap(node.id)}
              scaleTo={0.9}
              style={[
                styles.node,
                { left: node.x * AREA - NODE / 2, top: node.y * AREA - NODE / 2, borderColor: node.color },
                on && { backgroundColor: node.color, transform: [{ scale: 1.08 }] },
                showing && !on && styles.nodeIdle,
              ]}
            >
              <TelIcon name={node.icon} size={30} color={on ? colors.primary : colors.cream} />
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
    gap: spacing.md,
  },
  area: {
    width: AREA,
    height: AREA,
  },
  node: {
    position: 'absolute',
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    borderWidth: 3,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeIdle: {
    opacity: 0.7,
  },
});
