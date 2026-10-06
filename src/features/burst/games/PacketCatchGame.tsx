import { memo, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, ZoomOut } from 'react-native-reanimated';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { feedbackSuccess } from '@/lib/feedback';
import { colors, radius, spacing } from '@/theme';
import type { MicroGameProps } from '../types';

interface Falling {
  id: number;
  lane: number;
  bad: boolean;
  duration: number;
}

const HEIGHT = 320;
const SIZE = 56;
const LANES = 4;
const NEED = 5;

// Microjuego 10: caen paquetes; atrapa los sanos y no toques los infectados.
export function PacketCatchGame({ active, level, pace, onAnswer }: MicroGameProps) {
  const [width, setWidth] = useState(300);
  const [packets, setPackets] = useState<Falling[]>([]);
  const [caught, setCaught] = useState(0);
  const done = useRef(false);
  const nextId = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    if (!active) return;
    const pending = timers.current;
    const spawn = () => {
      nextId.current += 1;
      const id = nextId.current;
      const duration = Math.round(Math.max(1500, 2500 - level * 170) * pace);
      setPackets((items) => [...items, { id, lane: Math.floor(Math.random() * LANES), bad: Math.random() < 0.3 + level * 0.03, duration }]);
      const timer = setTimeout(() => {
        pending.delete(timer);
        setPackets((items) => items.filter((item) => item.id !== id));
      }, duration + 60);
      pending.add(timer);
    };
    spawn();
    const interval = setInterval(spawn, Math.round(Math.max(360, 600 - level * 40) * pace));
    return () => {
      clearInterval(interval);
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, [active, level, pace]);

  function catchPacket(packet: Falling) {
    if (!active || done.current) return;
    setPackets((items) => items.filter((item) => item.id !== packet.id));
    if (packet.bad) {
      done.current = true;
      onAnswer(false);
      return;
    }
    void feedbackSuccess();
    const next = caught + 1;
    setCaught(next);
    if (next >= NEED) {
      done.current = true;
      onAnswer(true, 40);
    }
  }

  function onLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  const laneWidth = width / LANES;

  return (
    <View style={styles.container}>
      <View style={styles.counter} accessibilityLabel={`${caught} de ${NEED} paquetes atrapados`}>
        {Array.from({ length: NEED }, (_, index) => (
          <View key={index} style={[styles.slot, index < caught && styles.slotOn]}>
            <TelIcon name="packet" size={16} color={index < caught ? colors.primary : colors.slate} />
          </View>
        ))}
      </View>
      <View style={styles.field} onLayout={onLayout}>
        {Array.from({ length: LANES - 1 }, (_, index) => (
          <View key={index} style={[styles.laneLine, { left: laneWidth * (index + 1) }]} />
        ))}
        {packets.map((packet) => (
          <FallingPacket key={packet.id} packet={packet} left={packet.lane * laneWidth + (laneWidth - SIZE) / 2} onPress={() => catchPacket(packet)} />
        ))}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.mini, styles.good]}>
            <TelIcon name="check" size={12} color={colors.primary} strokeWidth={3} />
          </View>
          <TelText variant="caption" color="accentSoft">
            Paquete sano
          </TelText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.mini, styles.bad]}>
            <TelIcon name="bug" size={12} color={colors.white} />
          </View>
          <TelText variant="caption" color="accentSoft">
            Infectado: ¡no lo toques!
          </TelText>
        </View>
      </View>
    </View>
  );
}

const FallingPacket = memo(function FallingPacket({ packet, left, onPress }: { packet: Falling; left: number; onPress: () => void }) {
  const drop = useSharedValue(-SIZE);
  useEffect(() => {
    drop.value = withTiming(HEIGHT, { duration: packet.duration, easing: Easing.linear });
  }, [drop, packet.duration]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: drop.value }] }));
  return (
    <Animated.View exiting={ZoomOut.duration(160)} style={[styles.packetWrap, { left }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={packet.bad ? 'Paquete infectado' : 'Paquete sano'}
        onPressIn={onPress}
        hitSlop={8}
        style={[styles.packet, packet.bad ? styles.bad : styles.good]}
      >
        <TelIcon name={packet.bad ? 'bug' : 'packet'} size={28} color={packet.bad ? colors.white : colors.primary} />
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  counter: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  slot: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotOn: {
    backgroundColor: colors.accent,
  },
  field: {
    height: HEIGHT,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(5, 21, 36, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(167, 212, 237, 0.2)',
    overflow: 'hidden',
  },
  laneLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(167, 212, 237, 0.08)',
  },
  packetWrap: {
    position: 'absolute',
    top: 0,
  },
  packet: {
    width: SIZE,
    height: SIZE,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  good: {
    backgroundColor: colors.cream,
    borderColor: colors.accent,
  },
  bad: {
    backgroundColor: colors.danger,
    borderColor: '#E58A8A',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mini: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
