import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { PressableScale } from '@/components/PressableScale';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { arcPath } from '@/graphics/shapes';
import { colors, spacing } from '@/theme';
import { needlePosition } from '../logic';
import type { MicroGameProps } from '../types';

const SIZE = 260;
const START = 180;
const SPAN = 180;

// Microjuego 6: la aguja del dial oscila; detenla dentro de la zona de buena señal.
export function SignalTimingGame({ active, level, onAnswer }: MicroGameProps) {
  const [zone] = useState(() => {
    const width = Math.max(0.12, 0.2 - level * 0.015);
    const center = 0.28 + Math.random() * 0.44;
    return { start: center - width / 2, end: center + width / 2, center, width };
  });
  const period = Math.max(1100, 1800 - level * 120);
  const sweep = useSharedValue(0);
  const startedAt = useRef(0);
  const answered = useRef(false);
  const [stopped, setStopped] = useState<number | null>(null);

  useEffect(() => {
    if (!active) {
      cancelAnimation(sweep);
      return;
    }
    startedAt.current = Date.now();
    sweep.set(0);
    sweep.set(withRepeat(withTiming(1, { duration: period / 2, easing: Easing.linear }), -1, true));
    return () => cancelAnimation(sweep);
  }, [active, period, sweep]);

  const needleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-90 + sweep.value * SPAN}deg` }],
  }));

  function stop() {
    if (!active || answered.current) return;
    answered.current = true;
    const value = needlePosition(Date.now() - startedAt.current, period);
    cancelAnimation(sweep);
    sweep.set(value);
    setStopped(value);
    const inZone = value >= zone.start && value <= zone.end;
    const precision = Math.max(0, 1 - Math.abs(value - zone.center) / (zone.width / 2));
    onAnswer(inZone, inZone ? Math.round(precision * 60) : 0);
  }

  const center = SIZE / 2;
  const radius = SIZE / 2 - 18;
  const zoneStart = START + zone.start * SPAN;
  const zoneEnd = START + zone.end * SPAN;
  const inZone = stopped !== null && stopped >= zone.start && stopped <= zone.end;

  return (
    <View style={styles.container}>
      <View style={styles.dial} accessibilityLabel="Dial de sintonía">
        <Svg width={SIZE} height={SIZE / 2 + 20} viewBox={`0 0 ${SIZE} ${SIZE / 2 + 20}`}>
          <Path d={arcPath(center, center, radius, START, START + SPAN)} stroke={colors.primarySoft} strokeWidth={22} fill="none" strokeLinecap="round" />
          <Path d={arcPath(center, center, radius, zoneStart, zoneEnd)} stroke={colors.success} strokeWidth={22} fill="none" strokeLinecap="round" />
          {Array.from({ length: 11 }, (_, index) => {
            const angle = START + (index * SPAN) / 10;
            return <Path key={index} d={arcPath(center, center, radius - 22, angle - 0.6, angle + 0.6)} stroke={colors.slate} strokeWidth={8} fill="none" />;
          })}
          <Circle cx={center} cy={center} r={14} fill={colors.cream} />
        </Svg>
        <Animated.View style={[styles.needleWrap, { left: center - 3, top: 0, height: center }, needleStyle]}>
          <View style={[styles.needle, stopped !== null && { backgroundColor: inZone ? colors.accent : colors.danger }]} />
        </Animated.View>
        <View style={styles.antenna}>
          <TelIcon name="antenna" size={30} color={colors.accent} />
        </View>
      </View>
      <PressableScale accessibilityRole="button" accessibilityLabel="Fijar señal" disabled={!active} haptic onPress={stop} scaleTo={0.92} style={styles.stopButton}>
        <TelIcon name="target" size={34} color={colors.primary} />
        <TelText variant="button" color="primary">
          ¡Fijar!
        </TelText>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  dial: {
    width: SIZE,
    height: SIZE / 2 + 20,
  },
  needleWrap: {
    position: 'absolute',
    width: 6,
    transformOrigin: 'bottom',
  },
  needle: {
    flex: 1,
    marginTop: 26,
    borderRadius: 3,
    backgroundColor: colors.cream,
  },
  antenna: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    left: SIZE / 2 - 15,
  },
  stopButton: {
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: colors.cream,
    borderWidth: 5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
});
