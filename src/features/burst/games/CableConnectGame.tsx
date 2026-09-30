import { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { feedbackSuccess, feedbackTap, feedbackWarning } from '@/lib/feedback';
import { colors, radius, spacing } from '@/theme';
import { shuffle } from '../logic';
import type { MicroGameProps } from '../types';

interface Cable {
  id: string;
  label: string;
  color: string;
}

const ALL_CABLES: Cable[] = [
  { id: 'orange', label: 'naranja', color: '#E8833A' },
  { id: 'blue', label: 'azul', color: '#3B6FD6' },
  { id: 'green', label: 'verde', color: '#3FA66B' },
  { id: 'brown', label: 'marrón', color: '#A0694A' },
];

const HEIGHT = 300;
const EDGE = 44;
const HIT = 46;

function cablePath(x1: number, y1: number, x2: number, y2: number): string {
  const bend = Math.max(40, Math.abs(x2 - x1) * 0.45);
  return `M${x1} ${y1}C${x1 + bend} ${y1} ${x2 - bend} ${y2} ${x2} ${y2}`;
}

// Microjuego 9: arrastra cada cable hasta el puerto del mismo color (o toca cable y luego puerto).
export function CableConnectGame({ active, level, onAnswer }: MicroGameProps) {
  const cables = useMemo(() => ALL_CABLES.slice(0, level >= 3 ? 4 : 3), [level]);
  const ports = useMemo(() => shuffle(cables), [cables]);
  const [width, setWidth] = useState(320);
  const [connections, setConnections] = useState<Record<string, number>>({});
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [errors, setErrors] = useState(0);
  const state = useRef({ connections, errors, active, width, done: false });
  state.current = { ...state.current, connections, errors, active, width };

  const rowY = (index: number, count: number) => (HEIGHT * (index + 1)) / (count + 1);
  const plugPos = (index: number) => ({ x: EDGE, y: rowY(index, cables.length) });
  const portPos = (index: number) => ({ x: width - EDGE, y: rowY(index, ports.length) });

  function attempt(cableId: string, portIndex: number) {
    const current = state.current;
    if (!current.active || current.done || current.connections[cableId] !== undefined) return;
    if (Object.values(current.connections).includes(portIndex)) return;
    if (ports[portIndex].id !== cableId) {
      const nextErrors = current.errors + 1;
      setErrors(nextErrors);
      void feedbackWarning();
      if (nextErrors >= 2) {
        state.current.done = true;
        onAnswer(false);
      }
      return;
    }
    const updated = { ...current.connections, [cableId]: portIndex };
    setConnections(updated);
    void feedbackSuccess();
    if (Object.keys(updated).length >= cables.length) {
      state.current.done = true;
      onAnswer(true, current.errors === 0 ? 40 : 15);
    }
  }

  const responders = useMemo(
    () =>
      cables.map((cable, index) =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => state.current.active && state.current.connections[cable.id] === undefined,
          onMoveShouldSetPanResponder: () => state.current.active,
          onPanResponderGrant: () => {
            void feedbackTap();
            const start = { x: EDGE, y: (HEIGHT * (index + 1)) / (cables.length + 1) };
            setDrag({ id: cable.id, ...start });
          },
          onPanResponderMove: (_, gesture) => {
            const start = { x: EDGE, y: (HEIGHT * (index + 1)) / (cables.length + 1) };
            setDrag({ id: cable.id, x: start.x + gesture.dx, y: start.y + gesture.dy });
          },
          onPanResponderRelease: (_, gesture) => {
            setDrag(null);
            if (Math.hypot(gesture.dx, gesture.dy) < 8) {
              setSelected((value) => (value === cable.id ? null : cable.id));
              return;
            }
            const start = { x: EDGE, y: (HEIGHT * (index + 1)) / (cables.length + 1) };
            const end = { x: start.x + gesture.dx, y: start.y + gesture.dy };
            const target = ports.findIndex((_, portIndex) => {
              const pos = { x: state.current.width - EDGE, y: (HEIGHT * (portIndex + 1)) / (ports.length + 1) };
              return Math.hypot(pos.x - end.x, pos.y - end.y) < HIT;
            });
            if (target >= 0) attempt(cable.id, target);
          },
          onPanResponderTerminate: () => setDrag(null),
        }),
      ),
    // attempt usa refs; los responders solo dependen de la disposición.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cables, ports],
  );

  function onLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  const dragging = drag ? cables.findIndex((cable) => cable.id === drag.id) : -1;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TelText variant="label" color="accentSoft">
          Switch
        </TelText>
        <TelText variant="label" color="accentSoft">
          Patch panel
        </TelText>
      </View>
      <View style={styles.board} onLayout={onLayout}>
        <Svg width={width} height={HEIGHT} style={StyleSheet.absoluteFill} pointerEvents="none">
          {cables.map((cable, index) => {
            const port = connections[cable.id];
            if (port === undefined) return null;
            const from = plugPos(index);
            const to = portPos(port);
            return <Path key={cable.id} d={cablePath(from.x, from.y, to.x, to.y)} stroke={cable.color} strokeWidth={9} strokeLinecap="round" fill="none" />;
          })}
          {drag && dragging >= 0 && (
            <Path d={cablePath(plugPos(dragging).x, plugPos(dragging).y, drag.x, drag.y)} stroke={cables[dragging].color} strokeWidth={9} strokeLinecap="round" fill="none" opacity={0.85} />
          )}
        </Svg>
        {cables.map((cable, index) => {
          const pos = plugPos(index);
          const connected = connections[cable.id] !== undefined;
          return (
            <View
              key={cable.id}
              {...responders[index].panHandlers}
              accessible
              accessibilityRole="button"
              accessibilityLabel={`Cable ${cable.label}${connected ? ', conectado' : selected === cable.id ? ', seleccionado' : ''}`}
              style={[
                styles.plug,
                { left: pos.x - 24, top: pos.y - 24, backgroundColor: cable.color },
                selected === cable.id && styles.plugSelected,
                connected && styles.plugDone,
              ]}
            >
              <TelIcon name="plug" size={22} color={colors.white} />
            </View>
          );
        })}
        {ports.map((port, index) => {
          const pos = portPos(index);
          const taken = Object.values(connections).includes(index);
          return (
            <Pressable
              key={port.id}
              accessibilityRole="button"
              accessibilityLabel={`Puerto ${port.label}${taken ? ', ocupado' : ''}`}
              disabled={!active || taken}
              onPress={() => {
                if (selected) {
                  attempt(selected, index);
                  setSelected(null);
                }
              }}
              style={[styles.port, { left: pos.x - 26, top: pos.y - 26, borderColor: port.color }, taken && { backgroundColor: port.color }]}
            >
              <View style={styles.portHole} />
            </Pressable>
          );
        })}
      </View>
      <TelText variant="caption" color="accentSoft" align="center">
        {errors > 0 ? '¡Ojo! Un error más y se cae el enlace.' : 'Arrastra o toca un cable y luego su puerto.'}
      </TelText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  board: {
    height: HEIGHT,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(18, 61, 92, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(167, 212, 237, 0.2)',
  },
  plug: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  plugSelected: {
    borderColor: colors.cream,
    transform: [{ scale: 1.12 }],
  },
  plugDone: {
    opacity: 0.85,
  },
  port: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 4,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portHole: {
    width: 22,
    height: 16,
    borderRadius: 3,
    backgroundColor: '#051524',
  },
});
