import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { FitBox } from '@/components/FitBox';
import { PressableScale } from '@/components/PressableScale';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { arcPath } from '@/graphics/shapes';
import { colors, radius } from '@/theme';
import { needlePosition } from '../logic';
import { GameFrame } from '../parts';
import type { MicroGameProps } from '../types';

// El dial se dibuja en 260 × 150 y se escala al espacio que sobra (el botón queda siempre a la vista).
const SIZE = 260;
const DIAL_H = SIZE / 2 + 20;
const START = 180;
const SPAN = 180;

// Microjuego 6: la aguja del dial oscila; detenla dentro de la zona de buena señal.
export function SignalTimingGame({ active, level, pace, onAnswer }: MicroGameProps) {
  const [zone] = useState(() => {
    const width = Math.max(0.12, 0.2 - level * 0.015);
    const center = 0.28 + Math.random() * 0.44;
    return { start: center - width / 2, end: center + width / 2, center, width };
  });
  const period = Math.round(Math.max(1100, 1800 - level * 120) * pace);
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
  const radiusDial = SIZE / 2 - 18;
  const zoneStart = START + zone.start * SPAN;
  const zoneEnd = START + zone.end * SPAN;
  const inZone = stopped !== null && stopped >= zone.start && stopped <= zone.end;

  return (
    <GameFrame>
      <FitBox aspectRatio={SIZE / DIAL_H} maxWidth={340}>
        {({ width }) => {
          const scale = width / SIZE;
          return (
            <View style={styles.dial} accessibilityLabel="Dial de sintonía">
              <Svg width={width} height={DIAL_H * scale} viewBox={`0 0 ${SIZE} ${DIAL_H}`}>
                <Path d={arcPath(center, center, radiusDial, START, START + SPAN)} stroke={colors.primarySoft} strokeWidth={22} fill="none" strokeLinecap="round" />
                <Path d={arcPath(center, center, radiusDial, zoneStart, zoneEnd)} stroke={colors.success} strokeWidth={22} fill="none" strokeLinecap="round" />
                {Array.from({ length: 11 }, (_, index) => {
                  const angle = START + (index * SPAN) / 10;
                  return <Path key={index} d={arcPath(center, center, radiusDial - 22, angle - 0.6, angle + 0.6)} stroke={colors.slate} strokeWidth={8} fill="none" />;
                })}
                <Circle cx={center} cy={center} r={14} fill={colors.cream} />
              </Svg>
              <Animated.View style={[styles.needleWrap, { left: (center - 3) * scale, height: center * scale, width: Math.max(4, 6 * scale) }, needleStyle]}>
                <View style={[styles.needle, { marginTop: 26 * scale }, stopped !== null && { backgroundColor: inZone ? colors.accent : colors.danger }]} />
              </Animated.View>
              <View style={[styles.antenna, { left: (SIZE / 2 - 15) * scale }]}>
                <TelIcon name="antenna" size={Math.max(22, Math.round(30 * scale))} color={colors.accent} />
              </View>
            </View>
          );
        }}
      </FitBox>
      {/* Botón ancho al pie: es lo único que se toca y el pulgar lo encuentra sin mirar. */}
      <PressableScale accessibilityRole="button" accessibilityLabel="Fijar señal" disabled={!active} haptic onPress={stop} scaleTo={0.96} style={styles.stopButton}>
        <TelIcon name="target" size={30} color={colors.primary} />
        <TelText variant="heading" color="primary">
          ¡Fijar!
        </TelText>
      </PressableScale>
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  dial: {
    flex: 1,
  },
  needleWrap: {
    position: 'absolute',
    top: 0,
    transformOrigin: 'bottom',
  },
  needle: {
    flex: 1,
    borderRadius: 3,
    backgroundColor: colors.cream,
  },
  antenna: {
    position: 'absolute',
    bottom: 0,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 76,
    borderRadius: radius.xl,
    backgroundColor: colors.cream,
    borderWidth: 4,
    borderColor: colors.accent,
  },
});
