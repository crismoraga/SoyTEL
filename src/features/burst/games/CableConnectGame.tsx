import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { FitBox } from '@/components/FitBox';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { feedbackSuccess, feedbackTap, feedbackWarning } from '@/lib/feedback';
import { usePanHandlers } from '@/lib/usePanHandlers';
import { colors, radius, spacing } from '@/theme';
import { shuffle } from '../logic';
import { GameFrame } from '../parts';
import type { MicroGameProps } from '../types';

interface Cable {
  id: string;
  label: string;
  color: string;
}

interface Point {
  x: number;
  y: number;
}

const ALL_CABLES: Cable[] = [
  { id: 'orange', label: 'naranja', color: '#E8833A' },
  { id: 'blue', label: 'azul', color: '#3B6FD6' },
  { id: 'green', label: 'verde', color: '#3FA66B' },
  { id: 'brown', label: 'marrón', color: '#A0694A' },
];

const EDGE = 44;
const HIT = 46;

// Superficie que se arrastra: en la web el navegador no debe desplazar ni ampliar la página mientras tanto.
const dragSurface = { touchAction: 'none', userSelect: 'none' } as ViewStyle;

function cablePath(x1: number, y1: number, x2: number, y2: number): string {
  const bend = Math.max(40, Math.abs(x2 - x1) * 0.45);
  return `M${x1} ${y1}C${x1 + bend} ${y1} ${x2 - bend} ${y2} ${x2} ${y2}`;
}

const rowY = (index: number, count: number, height: number) => (height * (index + 1)) / (count + 1);

// Microjuego 9: arrastra cada cable hasta el puerto del mismo color (o toca cable y luego puerto).
export function CableConnectGame({ active, level, onAnswer }: MicroGameProps) {
  const [cables] = useState(() => ALL_CABLES.slice(0, level >= 3 ? 4 : 3));
  const [ports] = useState(() => shuffle(cables));
  const [connections, setConnections] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [errors, setErrors] = useState(0);
  const done = useRef(false);

  function attempt(cableId: string, portIndex: number) {
    if (!active || done.current || connections[cableId] !== undefined) return;
    if (Object.values(connections).includes(portIndex)) return;
    if (ports[portIndex].id !== cableId) {
      const nextErrors = errors + 1;
      setErrors(nextErrors);
      void feedbackWarning();
      if (nextErrors >= 2) {
        done.current = true;
        onAnswer(false);
      }
      return;
    }
    const updated = { ...connections, [cableId]: portIndex };
    setConnections(updated);
    void feedbackSuccess();
    if (Object.keys(updated).length >= cables.length) {
      done.current = true;
      onAnswer(true, errors === 0 ? 40 : 15);
    }
  }

  return (
    <GameFrame>
      <View style={styles.header}>
        <TelText variant="label" color="accentSoft">
          Switch
        </TelText>
        <TelText variant="label" color="accentSoft">
          Patch panel
        </TelText>
      </View>
      <FitBox maxWidth={440} maxHeight={380}>
        {({ width, height }) => (
          <CableBoard
            width={width}
            height={height}
            cables={cables}
            ports={ports}
            active={active}
            connections={connections}
            selected={selected}
            onSelect={setSelected}
            onAttempt={attempt}
          />
        )}
      </FitBox>
      <TelText variant="caption" color="accentSoft" align="center">
        {errors > 0 ? '¡Ojo! Un error más y se cae el enlace.' : 'Arrastra o toca un cable y luego su puerto.'}
      </TelText>
    </GameFrame>
  );
}

interface BoardProps {
  width: number;
  height: number;
  cables: Cable[];
  ports: Cable[];
  active: boolean;
  connections: Record<string, number>;
  selected: string | null;
  onSelect: (cableId: string | null) => void;
  onAttempt: (cableId: string, portIndex: number) => void;
}

// Tablero a la medida que dejó la pantalla: las filas se reparten el alto y los enchufes se achican si hace falta.
function CableBoard({ width, height, cables, ports, active, connections, selected, onSelect, onAttempt }: BoardProps) {
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const row = height / (cables.length + 1);
  const plugSize = Math.max(40, Math.min(48, Math.floor(row - 6)));
  const portSize = plugSize + 4;
  const plugPos = (index: number): Point => ({ x: EDGE, y: rowY(index, cables.length, height) });
  const portPos = (index: number): Point => ({ x: width - EDGE, y: rowY(index, ports.length, height) });
  const dragging = drag ? cables.findIndex((cable) => cable.id === drag.id) : -1;

  function drop(cableId: string, end: Point | null) {
    setDrag(null);
    if (!end) return;
    const target = ports.findIndex((_, portIndex) => {
      const pos = portPos(portIndex);
      return Math.hypot(pos.x - end.x, pos.y - end.y) < HIT;
    });
    if (target >= 0) onAttempt(cableId, target);
  }

  return (
    <View style={styles.board}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
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
      {cables.map((cable, index) => (
        <Plug
          key={cable.id}
          cable={cable}
          origin={plugPos(index)}
          size={plugSize}
          active={active}
          connected={connections[cable.id] !== undefined}
          selected={selected === cable.id}
          onDrag={(point) => setDrag({ id: cable.id, ...point })}
          onDrop={(point) => drop(cable.id, point)}
          onTap={() => onSelect(selected === cable.id ? null : cable.id)}
        />
      ))}
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
                onAttempt(selected, index);
                onSelect(null);
              }
            }}
            style={[styles.port, { width: portSize, height: portSize, left: pos.x - portSize / 2, top: pos.y - portSize / 2, borderColor: port.color }, taken && { backgroundColor: port.color }]}
          >
            <View style={styles.portHole} />
          </Pressable>
        );
      })}
    </View>
  );
}

interface PlugProps {
  cable: Cable;
  origin: Point;
  size: number;
  active: boolean;
  connected: boolean;
  selected: boolean;
  onDrag: (point: Point) => void;
  onDrop: (point: Point | null) => void;
  onTap: () => void;
}

function Plug({ cable, origin, size, active, connected, selected, onDrag, onDrop, onTap }: PlugProps) {
  const panHandlers = usePanHandlers({
    canStart: () => active && !connected,
    onGrant: () => {
      void feedbackTap();
      onDrag(origin);
    },
    onMove: (_, gesture) => onDrag({ x: origin.x + gesture.dx, y: origin.y + gesture.dy }),
    onRelease: (_, gesture) => {
      if (Math.hypot(gesture.dx, gesture.dy) < 8) {
        onDrop(null);
        onTap();
        return;
      }
      onDrop({ x: origin.x + gesture.dx, y: origin.y + gesture.dy });
    },
    onTerminate: () => onDrop(null),
  });

  return (
    <View
      {...panHandlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`Cable ${cable.label}${connected ? ', conectado' : selected ? ', seleccionado' : ''}`}
      style={[
        styles.plug,
        dragSurface,
        { left: origin.x - size / 2, top: origin.y - size / 2, width: size, height: size, backgroundColor: cable.color },
        selected && styles.plugSelected,
        connected && styles.plugDone,
      ]}
    >
      <TelIcon name="plug" size={22} color={colors.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  board: {
    flex: 1,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(18, 61, 92, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(167, 212, 237, 0.2)',
  },
  plug: {
    position: 'absolute',
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
