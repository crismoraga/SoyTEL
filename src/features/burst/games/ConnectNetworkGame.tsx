import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { colors, radius } from '@/theme';
import { pick, shuffle } from '../logic';
import { ChoiceTile, GameFrame, TileGrid, useGameDensity, type GameDensity, type TileState } from '../parts';
import type { MicroGameProps } from '../types';

interface Device {
  id: string;
  label: string;
  icon: IconName;
}

interface Scenario {
  question: string;
  left: Device;
  right: Device;
  answer: Device;
  distractors: Device[];
}

const router: Device = { id: 'router', label: 'Router', icon: 'router' };
const switchDevice: Device = { id: 'switch', label: 'Switch', icon: 'grid' };
const firewall: Device = { id: 'firewall', label: 'Firewall', icon: 'shieldCheck' };
const accessPoint: Device = { id: 'ap', label: 'Punto de acceso Wi-Fi', icon: 'wifi' };
const monitor: Device = { id: 'monitor', label: 'Monitor', icon: 'laptop' };
const printer: Device = { id: 'disk', label: 'Disco duro', icon: 'database' };
const cable: Device = { id: 'hdmi', label: 'Cable HDMI', icon: 'plug' };
const speaker: Device = { id: 'speaker', label: 'Parlante', icon: 'sound' };

const scenarios: Scenario[] = [
  {
    question: '¿Qué une tu red local con Internet?',
    left: { id: 'lan', label: 'Red local', icon: 'laptop' },
    right: { id: 'internet', label: 'Internet', icon: 'cloud' },
    answer: router,
    distractors: [switchDevice, monitor, speaker],
  },
  {
    question: '¿Cómo llega el notebook al router sin cables?',
    left: { id: 'notebook', label: 'Notebook', icon: 'laptop' },
    right: { id: 'router', label: 'Router', icon: 'router' },
    answer: accessPoint,
    distractors: [cable, printer, speaker],
  },
  {
    question: '¿Qué filtra el tráfico antes del servidor?',
    left: { id: 'internet', label: 'Internet', icon: 'globe' },
    right: { id: 'server', label: 'Servidor', icon: 'server' },
    answer: firewall,
    distractors: [monitor, speaker, cable],
  },
  {
    question: '¿Qué conecta muchos PCs de un laboratorio?',
    left: { id: 'pcs', label: '30 PCs', icon: 'laptop' },
    right: { id: 'router', label: 'Router', icon: 'router' },
    answer: switchDevice,
    distractors: [printer, speaker, cable],
  },
];

// Tamaño de los círculos del diagrama según el espacio.
const SIZES: Record<GameDensity, { node: number; slot: number; glyph: number }> = {
  compact: { node: 46, slot: 54, glyph: 24 },
  regular: { node: 58, slot: 66, glyph: 28 },
  roomy: { node: 64, slot: 72, glyph: 30 },
};

// Microjuego 1: diagrama con un equipo faltante; toca el que completa la red.
export function ConnectNetworkGame({ active, onAnswer }: MicroGameProps) {
  const density = useGameDensity();
  const scenario = useMemo(() => pick(scenarios), []);
  const options = useMemo(() => shuffle([scenario.answer, ...scenario.distractors]), [scenario]);
  const [chosen, setChosen] = useState<string | null>(null);
  const solved = chosen === scenario.answer.id;
  const sizes = SIZES[density];

  function choose(device: Device) {
    if (!active || chosen) return;
    setChosen(device.id);
    onAnswer(device.id === scenario.answer.id, 20);
  }

  const slot = chosen ? options.find((item) => item.id === chosen) : null;

  return (
    <GameFrame>
      <TelText variant="subtitle" color="cream" align="center">
        {scenario.question}
      </TelText>
      <View style={styles.diagram}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Line x1="18%" y1="40%" x2="82%" y2="40%" stroke={solved ? colors.accent : colors.slate} strokeWidth={3} strokeDasharray={solved ? undefined : '6 8'} strokeLinecap="round" />
        </Svg>
        <Node device={scenario.left} size={sizes.node} glyph={sizes.glyph} />
        <View style={[styles.slot, { width: sizes.slot, height: sizes.slot, borderRadius: sizes.slot / 2 }, slot && (solved ? styles.slotRight : styles.slotWrong)]}>
          {slot ? <TelIcon name={slot.icon} size={sizes.glyph + 2} color={colors.primary} /> : <TelText variant="title" color="accent">?</TelText>}
        </View>
        <Node device={scenario.right} size={sizes.node} glyph={sizes.glyph} />
      </View>
      <TileGrid>
        {options.map((device) => {
          let state: TileState = 'idle';
          if (chosen) state = device.id === scenario.answer.id ? 'correct' : device.id === chosen ? 'wrong' : 'dimmed';
          return <ChoiceTile key={device.id} label={device.label} icon={device.icon} state={state} disabled={!active || Boolean(chosen)} onPress={() => choose(device)} />;
        })}
      </TileGrid>
    </GameFrame>
  );
}

function Node({ device, size, glyph }: { device: Device; size: number; glyph: number }) {
  return (
    <View style={styles.node}>
      <View style={[styles.nodeIcon, { width: size, height: size }]}>
        <TelIcon name={device.icon} size={glyph} color={colors.cream} />
      </View>
      <TelText variant="small" color="accentSoft" align="center">
        {device.label}
      </TelText>
    </View>
  );
}

const styles = StyleSheet.create({
  diagram: {
    flex: 1,
    minHeight: 76,
    maxHeight: 128,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  node: {
    width: 84,
    alignItems: 'center',
    gap: 4,
  },
  nodeIcon: {
    borderRadius: radius.md,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slot: {
    borderWidth: 2.5,
    borderStyle: 'dashed',
    borderColor: colors.accent,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotRight: {
    borderStyle: 'solid',
    backgroundColor: colors.accent,
  },
  slotWrong: {
    borderStyle: 'solid',
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
});
