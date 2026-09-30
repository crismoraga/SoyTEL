import { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { PulseRings } from '@/components/feedback/PulseRings';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { feedbackTap } from '@/lib/feedback';
import { colors, radius, spacing } from '@/theme';
import { signalBars, wifiSignal, type Point } from '../logic';
import type { MicroGameProps } from '../types';

const HEIGHT = 300;
const ROUTER = 54;

// Microjuego 11: arrastra el router por la casa hasta dar señal completa al notebook (¡ojo con el microondas!).
export function WifiBoostGame({ active, onAnswer }: MicroGameProps) {
  const [width, setWidth] = useState(320);
  const layout = useMemo(() => {
    const corners: Point[] = [
      { x: 0.16, y: 0.18 },
      { x: 0.84, y: 0.18 },
      { x: 0.16, y: 0.78 },
      { x: 0.84, y: 0.78 },
    ];
    const laptopIndex = Math.floor(Math.random() * 4);
    const microwaveIndex = (laptopIndex + 1 + Math.floor(Math.random() * 3)) % 4;
    return { laptop: corners[laptopIndex], microwave: corners[microwaveIndex] };
  }, []);
  const [router, setRouter] = useState<Point>({ x: 0.5, y: 0.5 });
  const [won, setWon] = useState(false);
  const state = useRef({ active, width, won: false, start: router, router });
  state.current = { ...state.current, active, width, router };

  const toPx = (point: Point) => ({ x: point.x * width, y: point.y * HEIGHT });
  const laptopPx = toPx(layout.laptop);
  const microwavePx = toPx(layout.microwave);
  const routerPx = toPx(router);
  const { strength, interference } = wifiSignal(routerPx, laptopPx, microwavePx, { width, height: HEIGHT });
  const bars = signalBars(strength);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => state.current.active && !state.current.won,
        onMoveShouldSetPanResponder: () => state.current.active && !state.current.won,
        onPanResponderGrant: () => {
          void feedbackTap();
          state.current.start = state.current.router;
        },
        onPanResponderMove: (_, gesture) => {
          const w = state.current.width;
          const start = state.current.start;
          const x = Math.max(0.06, Math.min(0.94, start.x + gesture.dx / w));
          const y = Math.max(0.08, Math.min(0.92, start.y + gesture.dy / HEIGHT));
          setRouter({ x, y });
          const result = wifiSignal({ x: x * w, y: y * HEIGHT }, { x: layout.laptop.x * w, y: layout.laptop.y * HEIGHT }, { x: layout.microwave.x * w, y: layout.microwave.y * HEIGHT }, { width: w, height: HEIGHT });
          if (result.strength >= 0.92 && !state.current.won) {
            state.current.won = true;
            setWon(true);
            onAnswer(true, 30);
          }
        },
      }),
    // El responder lee el estado desde la ref para no recrearse en cada movimiento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout],
  );

  function onLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  const lineColor = strength >= 0.92 ? colors.success : interference ? colors.danger : colors.accent;

  return (
    <View style={styles.container}>
      <View style={styles.meter}>
        <View style={styles.bars} accessibilityLabel={`Señal ${Math.round(strength * 100)} por ciento`}>
          {[1, 2, 3, 4].map((bar) => (
            <View key={bar} style={[styles.bar, { height: 6 + bar * 6 }, bar <= bars && { backgroundColor: bars === 4 ? colors.success : colors.accent }]} />
          ))}
        </View>
        <TelText variant="heading" color="cream" tabular>
          {Math.round(strength * 100)}%
        </TelText>
        <TelText variant="caption" color={interference ? 'dangerSoft' : 'accentSoft'} style={styles.meterText}>
          {won ? '¡Señal completa!' : interference ? '¡Interferencia del microondas!' : 'Acerca el router al notebook'}
        </TelText>
      </View>
      <View style={styles.house} onLayout={onLayout}>
        <Svg width={width} height={HEIGHT} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Rect x={4} y={4} width={width - 8} height={HEIGHT - 8} rx={14} stroke={colors.accentSoft} strokeOpacity={0.4} strokeWidth={3} fill="none" />
          <Line x1={width / 2} y1={4} x2={width / 2} y2={HEIGHT * 0.38} stroke={colors.accentSoft} strokeOpacity={0.4} strokeWidth={3} />
          <Line x1={width / 2} y1={HEIGHT * 0.62} x2={width / 2} y2={HEIGHT - 4} stroke={colors.accentSoft} strokeOpacity={0.4} strokeWidth={3} />
          <Line x1={4} y1={HEIGHT / 2} x2={width * 0.3} y2={HEIGHT / 2} stroke={colors.accentSoft} strokeOpacity={0.4} strokeWidth={3} />
          <Line x1={width * 0.7} y1={HEIGHT / 2} x2={width - 4} y2={HEIGHT / 2} stroke={colors.accentSoft} strokeOpacity={0.4} strokeWidth={3} />
          <Line x1={routerPx.x} y1={routerPx.y} x2={laptopPx.x} y2={laptopPx.y} stroke={lineColor} strokeWidth={2.5} strokeDasharray="4 7" strokeLinecap="round" />
        </Svg>
        <View style={[styles.item, { left: microwavePx.x - 26, top: microwavePx.y - 26 }]} accessibilityLabel="Microondas">
          <View style={[styles.itemIcon, styles.microwave]}>
            <TelIcon name="wave" size={24} color={colors.white} />
          </View>
          <TelText variant="small" color="accentSoft" style={styles.itemLabel}>
            Microondas
          </TelText>
        </View>
        <View style={[styles.item, { left: laptopPx.x - 26, top: laptopPx.y - 26 }]} accessibilityLabel="Notebook">
          <View style={[styles.itemIcon, won && styles.laptopWon]}>
            <TelIcon name="laptop" size={26} color={colors.primary} />
          </View>
          <TelText variant="small" color="accentSoft" style={styles.itemLabel}>
            Notebook
          </TelText>
        </View>
        <View
          {...responder.panHandlers}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Router Wi-Fi: arrástralo"
          style={[styles.router, { left: routerPx.x - ROUTER / 2, top: routerPx.y - ROUTER / 2 }]}
        >
          <PulseRings size={ROUTER * 2} color={lineColor} style={styles.rings} />
          <View style={styles.routerBody}>
            <TelIcon name="router" size={28} color={colors.primary} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  meter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  meterText: {
    flex: 1,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  bar: {
    width: 7,
    borderRadius: 2,
    backgroundColor: colors.primarySoft,
  },
  house: {
    height: HEIGHT,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(18, 61, 92, 0.6)',
  },
  item: {
    position: 'absolute',
    width: 52,
    alignItems: 'center',
  },
  itemIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  microwave: {
    backgroundColor: colors.danger,
  },
  laptopWon: {
    backgroundColor: '#6BC59A',
  },
  itemLabel: {
    width: 90,
    textAlign: 'center',
    marginTop: 2,
  },
  router: {
    position: 'absolute',
    width: ROUTER,
    height: ROUTER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rings: {
    position: 'absolute',
  },
  routerBody: {
    width: ROUTER,
    height: ROUTER,
    borderRadius: ROUTER / 2,
    backgroundColor: colors.accent,
    borderWidth: 3,
    borderColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
