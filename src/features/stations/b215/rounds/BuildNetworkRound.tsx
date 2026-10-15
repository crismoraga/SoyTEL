import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { FitBox, type FitSize } from '@/components/FitBox';
import { DeviceArt } from '@/components/graphics/DeviceArt';
import { PressableScale } from '@/components/PressableScale';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { clamp, GameBoard, gameNow, Hint, useFlash, useGameTimeout } from '@/features/stations/kit';
import { feedbackSuccess, feedbackTap, feedbackWarning } from '@/lib/feedback';
import { useMotionEnabled } from '@/lib/motion';
import { colors, radius } from '@/theme';
import type { RoundProps } from '../types';
import {
  correctSlots,
  DEVICES,
  feedbackWait,
  isComplete,
  makeNetworkRound,
  onlineState,
  placementResult,
  scoreRound,
  slotLabel,
  stepCaption,
  topologyLayout,
  type DeviceId,
  type Placed,
  type SlotId,
} from './red.logic';

// Ronda del circuito B215 · Arma la red: Internet — [hueco] — [hueco] — 3 PCs por cable, y un hueco para el Wi-Fi
// de 2 celulares. Se toca un hueco y luego el equipo (o al revés); cada acierto enciende los enlaces hacia afuera.

interface Reaction {
  id: number;
  tone: 'info' | 'good' | 'bad';
  text: string;
}

const GOOD = '#2E7D5B';
const GOOD_LIGHT = '#6BC59A';
const BAD_LIGHT = '#E58A8A';
const START_LINE = 'Conecta los PCs y los celulares a Internet.';
const DONE_LINE = '¡Red lista! Todos tienen Internet.';
const OFF_LINE = 'rgba(167, 212, 237, 0.3)';

export function BuildNetworkRound({ seed, level, pace, timeUp, onDone }: RoundProps) {
  const [data] = useState(() => makeNetworkRound(seed, level));
  const [placed, setPlaced] = useState<Placed>({});
  const [attempts, setAttempts] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<SlotId | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<DeviceId | null>(null);
  // Hueco y equipo del último error: se ven en rojo un momento.
  const [flash, setFlash] = useFlash<{ slot: SlotId; device: DeviceId }>(650);
  const [doneAt, setDoneAt] = useState<number | null>(null);
  const [line, setLine] = useState<Reaction>({ id: 0, tone: 'info', text: START_LINE });

  const finished = useRef(false);
  const latestDone = useRef(onDone);
  useEffect(() => {
    latestDone.current = onDone;
  });

  const total = data.slots.length;
  const correct = correctSlots(placed, data.slots);
  const locked = timeUp || doneAt !== null;
  const used = new Set<DeviceId>(Object.values(placed).filter((device): device is DeviceId => device !== undefined));

  const finish = useCallback(
    (hits: number, tries: number) => {
      if (finished.current) return;
      finished.current = true;
      latestDone.current(scoreRound(hits, tries, total, 'equipos en su lugar'));
    },
    [total],
  );

  // Se acabó el tiempo: se entrega de inmediato lo logrado hasta ahí.
  useEffect(() => {
    if (timeUp) finish(correct, attempts);
  }, [timeUp, correct, attempts, finish]);

  // Red completa: se deja ver el final un momento y se entrega.
  useGameTimeout(doneAt, () => finish(correct, attempts), doneAt);

  function say(tone: Reaction['tone'], text: string) {
    setLine((current) => ({ id: current.id + 1, tone, text }));
  }

  function attempt(slot: SlotId, device: DeviceId) {
    const result = placementResult(slot, device);
    setSelectedSlot(null);
    setSelectedDevice(null);
    setAttempts(attempts + 1);
    if (result.ok) {
      const next: Placed = { ...placed, [slot]: device };
      setPlaced(next);
      const complete = isComplete(next, data.slots);
      say('good', complete ? DONE_LINE : result.text);
      if (complete) setDoneAt(gameNow() + feedbackWait(1400, pace));
      void feedbackSuccess();
    } else {
      setFlash({ slot, device });
      say('bad', result.text);
      void feedbackWarning();
    }
  }

  function pickSlot(slot: SlotId) {
    if (finished.current || locked) return;
    const device = placed[slot];
    if (device) {
      // Un hueco ya lleno vuelve a mostrar qué hace ese equipo.
      say('info', DEVICES[device].role);
      return;
    }
    if (selectedDevice) {
      attempt(slot, selectedDevice);
      return;
    }
    void feedbackTap();
    setSelectedSlot(selectedSlot === slot ? null : slot);
  }

  function pickDevice(device: DeviceId) {
    if (finished.current || locked || used.has(device)) return;
    if (selectedSlot) {
      attempt(selectedSlot, device);
      return;
    }
    void feedbackTap();
    setSelectedDevice(selectedDevice === device ? null : device);
  }

  // Hasta 4 equipos van en una sola fila; con 5 (nivel 2) se reparten en dos filas.
  const trayRows = data.tray.length <= 4 ? [data.tray] : [data.tray.slice(0, 3), data.tray.slice(3)];

  return (
    <View style={styles.root}>
      <View style={styles.step} accessibilityLiveRegion="polite">
        <TelIcon name="topology" size={18} color={colors.accent} />
        <TelText variant="label" color="accentSoft">
          {stepCaption(selectedSlot, selectedDevice)}
        </TelText>
      </View>
      <FitBox style={styles.board} maxHeight={320}>
        {(size) => <Topology size={size} slots={data.slots} placed={placed} selectedSlot={selectedSlot} flashSlot={flash ? flash.slot : null} onSlot={pickSlot} />}
      </FitBox>
      <View style={styles.hintSlot} accessibilityLiveRegion="polite">
        <Hint key={line.id} tone={line.tone}>
          {line.text}
        </Hint>
      </View>
      <View style={styles.tray}>
        {trayRows.map((row, position) => (
          <View key={position} style={styles.trayRow}>
            {row.map((device) => (
              <TrayChip key={device} device={device} selected={selectedDevice === device} used={used.has(device)} flashing={flash?.device === device} disabled={locked} onPress={() => pickDevice(device)} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

interface TopologyProps {
  size: FitSize;
  slots: SlotId[];
  placed: Placed;
  selectedSlot: SlotId | null;
  flashSlot: SlotId | null;
  onSlot: (slot: SlotId) => void;
}

// El dibujo de la red. Los enlaces se encienden desde Internet hacia afuera a medida que se completan los huecos
// y, cuando una parte queda conectada, sus equipos saltan.
function Topology({ size, slots, placed, selectedSlot, flashSlot, onSlot }: TopologyProps) {
  const motion = useMotionEnabled();
  const layout = topologyLayout(size.width, size.height, slots);
  const online = onlineState(placed, slots);
  const everything = slots.every((slot) => online.slots[slot]);
  const nodeOf = (id: string) => layout.nodes.find((node) => node.id === id);
  const isOnline = (id: string): boolean => {
    if (id === 'internet') return true;
    if (id.startsWith('slot:')) return online.slots[id.slice(5) as SlotId];
    return id.startsWith('pc:') ? online.pcs : online.phones;
  };
  const cables = layout.links.filter((link) => link.kind === 'cable');
  const litCables = cables.filter((link) => isOnline(link.to));
  const litKey = layout.nodes
    .filter((node) => node.kind !== 'internet' && isOnline(node.id))
    .map((node) => node.id)
    .join(',');
  const arc = (radiusPx: number) => {
    const angle = 0.95;
    const dx = radiusPx * Math.sin(angle);
    const dy = radiusPx * Math.cos(angle);
    return `M${layout.wifi.x - dx} ${layout.wifi.y + dy} A${radiusPx} ${radiusPx} 0 0 0 ${layout.wifi.x + dx} ${layout.wifi.y + dy}`;
  };
  const label = (point: { x: number; y: number }) => ({ left: clamp(point.x - 34, 0, Math.max(0, size.width - 68)), top: point.y });

  return (
    <GameBoard style={{ width: size.width, height: size.height }}>
      <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill} pointerEvents="none">
        {cables.map((link) => {
          const from = nodeOf(link.from);
          const to = nodeOf(link.to);
          if (!from || !to) return null;
          return <Line key={`${link.from}-${link.to}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={OFF_LINE} strokeWidth={2.5} strokeDasharray="5 6" strokeLinecap="round" />;
        })}
        {layout.wifi.radii.map((radiusPx) => (
          <Path key={radiusPx} d={arc(radiusPx)} fill="none" stroke={OFF_LINE} strokeWidth={2.5} strokeLinecap="round" strokeDasharray="3 5" />
        ))}
      </Svg>
      {(litCables.length > 0 || online.phones) && (
        <Animated.View key={litKey} pointerEvents="none" entering={motion ? FadeIn.duration(260) : undefined} style={StyleSheet.absoluteFill}>
          <Svg width={size.width} height={size.height}>
            {litCables.map((link) => {
              const from = nodeOf(link.from);
              const to = nodeOf(link.to);
              if (!from || !to) return null;
              return <Line key={`${link.from}-${link.to}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={colors.accent} strokeWidth={3.5} strokeLinecap="round" />;
            })}
            {online.phones && layout.wifi.radii.map((radiusPx) => <Path key={radiusPx} d={arc(radiusPx)} fill="none" stroke={colors.accent} strokeWidth={2.5} strokeLinecap="round" />)}
          </Svg>
        </Animated.View>
      )}
      {layout.nodes.map((node) => {
        const box = { left: node.x - node.w / 2, top: node.y - node.h / 2, width: node.w, height: node.h };
        if (node.kind === 'internet') {
          return (
            <View key={node.id} accessible accessibilityLabel="Internet" style={[styles.internet, box, everything && styles.internetOn]}>
              <TelIcon name="cloud" size={Math.round(node.w * 0.55)} color={colors.cream} />
              {everything && (
                <Animated.View entering={motion ? ZoomIn.springify().damping(8) : undefined} style={styles.netBadge}>
                  <TelIcon name="check" size={12} color={colors.white} />
                </Animated.View>
              )}
            </View>
          );
        }
        if (node.kind === 'pc' || node.kind === 'phone') {
          const on = node.kind === 'pc' ? online.pcs : online.phones;
          const order = Number(node.id.split(':')[1]);
          return (
            <Animated.View key={`${node.id}-${on}`} entering={motion && on ? ZoomIn.delay(order * 70).springify().damping(10) : undefined} style={[styles.abs, box]}>
              {node.kind === 'pc' ? <PcGlyph w={node.w} h={node.h} on={on} /> : <PhoneGlyph w={node.w} h={node.h} on={on} />}
            </Animated.View>
          );
        }
        const slot = node.slot as SlotId;
        const device = placed[slot];
        return (
          <PressableScale
            key={node.id}
            accessibilityRole="button"
            accessibilityLabel={slotLabel(slot, slots, placed)}
            accessibilityState={{ selected: selectedSlot === slot }}
            onPress={() => onSlot(slot)}
            scaleTo={0.92}
            style={[styles.slot, box, device ? styles.slotFilled : selectedSlot === slot ? styles.slotSelected : null, flashSlot === slot && styles.slotWrong]}
          >
            {device ? (
              <Animated.View entering={motion ? ZoomIn.springify().damping(12) : undefined}>
                <DeviceArt device={DEVICES[device].art} size={Math.max(28, node.w - 14)} />
              </Animated.View>
            ) : (
              <TelText variant="heading" color={selectedSlot === slot ? 'cream' : 'accentSoft'}>
                ?
              </TelText>
            )}
          </PressableScale>
        );
      })}
      <View pointerEvents="none" style={[styles.caption, label(layout.labels.internet)]}>
        <TelText variant="small" color="accentSoft" maxFontSizeMultiplier={1.15}>
          Internet
        </TelText>
      </View>
      <View pointerEvents="none" style={[styles.caption, label(layout.labels.pcs)]}>
        <TelText variant="small" color="accentSoft" maxFontSizeMultiplier={1.15}>
          por cable
        </TelText>
      </View>
      <View pointerEvents="none" style={[styles.caption, label(layout.labels.phones)]}>
        <TelText variant="small" color="accentSoft" maxFontSizeMultiplier={1.15}>
          por Wi-Fi
        </TelText>
      </View>
    </GameBoard>
  );
}

function PcGlyph({ w, h, on }: { w: number; h: number; on: boolean }) {
  const stroke = on ? colors.cream : colors.slate;
  return (
    <Svg width={w} height={h} viewBox="0 0 28 23">
      <Rect x={2} y={2} width={24} height={14} rx={2.5} stroke={stroke} strokeWidth={2} fill={on ? 'rgba(111, 179, 217, 0.4)' : 'none'} />
      <Path d="M9 21h10M14 16v5" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function PhoneGlyph({ w, h, on }: { w: number; h: number; on: boolean }) {
  const stroke = on ? colors.cream : colors.slate;
  return (
    <Svg width={w} height={h} viewBox="0 0 15 25">
      <Rect x={1.5} y={1.5} width={12} height={22} rx={3} stroke={stroke} strokeWidth={2} fill={on ? 'rgba(111, 179, 217, 0.4)' : 'none'} />
      <Path d="M5.5 19.5h4" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

interface ChipProps {
  device: DeviceId;
  selected: boolean;
  used: boolean;
  flashing: boolean;
  disabled: boolean;
  onPress: () => void;
}

function TrayChip({ device, selected, used, flashing, disabled, onPress }: ChipProps) {
  const motion = useMotionEnabled();
  const info = DEVICES[device];
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Elegir ${info.name}`}
      accessibilityState={{ selected, disabled: disabled || used }}
      disabled={disabled || used}
      onPress={onPress}
      scaleTo={0.94}
      style={[styles.chip, selected && styles.chipSelected, flashing && styles.chipWrong, used && styles.chipUsed]}
    >
      <DeviceArt device={info.art} size={34} />
      <TelText variant="small" color="cream" align="center" numberOfLines={2} maxFontSizeMultiplier={1.15}>
        {info.name}
      </TelText>
      {used && (
        <Animated.View entering={motion ? ZoomIn.springify().damping(9) : undefined} style={styles.badge}>
          <TelIcon name="check" size={14} color={GOOD} />
        </Animated.View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    minHeight: 0,
    gap: 6,
  },
  step: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  board: {
    minHeight: 128,
  },
  hintSlot: {
    minHeight: 48,
    justifyContent: 'center',
  },
  tray: {
    gap: 6,
  },
  trayRow: {
    flexDirection: 'row',
    gap: 6,
  },
  abs: {
    position: 'absolute',
  },
  internet: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.accentSoft,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  internetOn: {
    borderColor: GOOD_LIGHT,
  },
  netBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: GOOD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slot: {
    position: 'absolute',
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.accentSoft,
    backgroundColor: 'rgba(7, 31, 49, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotSelected: {
    borderStyle: 'solid',
    borderColor: colors.cream,
    backgroundColor: 'rgba(244, 236, 215, 0.2)',
  },
  slotFilled: {
    borderStyle: 'solid',
    borderColor: GOOD_LIGHT,
    backgroundColor: 'rgba(46, 125, 91, 0.4)',
  },
  slotWrong: {
    borderStyle: 'solid',
    borderColor: BAD_LIGHT,
    backgroundColor: 'rgba(199, 62, 62, 0.5)',
  },
  caption: {
    position: 'absolute',
    width: 68,
    alignItems: 'center',
  },
  chip: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 2,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 212, 237, 0.35)',
    backgroundColor: colors.primarySoft,
  },
  chipSelected: {
    borderColor: colors.cream,
    borderWidth: 2.5,
    backgroundColor: colors.secondary,
  },
  chipWrong: {
    borderColor: BAD_LIGHT,
    borderWidth: 2.5,
    backgroundColor: '#6E2A2A',
  },
  chipUsed: {
    opacity: 0.45,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
