import { useRef, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { FitBox } from '@/components/FitBox';
import { PulseRings } from '@/components/feedback/PulseRings';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { feedbackTap } from '@/lib/feedback';
import { usePanHandlers } from '@/lib/usePanHandlers';
import { colors, radius, spacing } from '@/theme';
import { signalBars, wifiSignal, type Point } from '../logic';
import { GameFrame } from '../parts';
import type { MicroGameProps } from '../types';

const ROUTER = 54;
// La señal se calcula sobre una casa de referencia: la dificultad es la misma en cualquier pantalla.
const REF = { width: 320, height: 300 };

// Superficie que se arrastra: el navegador no debe desplazar ni ampliar la página mientras tanto.
const dragSurface = { touchAction: 'none', userSelect: 'none' } as ViewStyle;

const toRef = (point: Point): Point => ({ x: point.x * REF.width, y: point.y * REF.height });

// Microjuego 11: arrastra el router por la casa hasta dar señal completa al notebook (¡ojo con el microondas!).
export function WifiBoostGame({ active, onAnswer }: MicroGameProps) {
  const [layout] = useState(() => {
    const corners: Point[] = [
      { x: 0.16, y: 0.18 },
      { x: 0.84, y: 0.18 },
      { x: 0.16, y: 0.78 },
      { x: 0.84, y: 0.78 },
    ];
    const laptopIndex = Math.floor(Math.random() * 4);
    const microwaveIndex = (laptopIndex + 1 + Math.floor(Math.random() * 3)) % 4;
    return { laptop: corners[laptopIndex], microwave: corners[microwaveIndex] };
  });
  const [router, setRouter] = useState<Point>({ x: 0.5, y: 0.5 });
  const [won, setWon] = useState(false);
  const wonRef = useRef(false);

  const { strength, interference } = wifiSignal(toRef(router), toRef(layout.laptop), toRef(layout.microwave), REF);
  const bars = signalBars(strength);

  function move(next: Point) {
    setRouter(next);
    const result = wifiSignal(toRef(next), toRef(layout.laptop), toRef(layout.microwave), REF);
    if (result.strength >= 0.92 && !wonRef.current) {
      wonRef.current = true;
      setWon(true);
      onAnswer(true, 30);
    }
  }

  const lineColor = strength >= 0.92 ? colors.success : interference ? colors.danger : colors.accent;

  return (
    <GameFrame>
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
      <FitBox aspectRatio={REF.width / REF.height} maxWidth={440}>
        {({ width, height }) => (
          <House width={width} height={height} laptop={layout.laptop} microwave={layout.microwave} router={router} active={active} won={won} wonRef={wonRef} lineColor={lineColor} onMove={move} />
        )}
      </FitBox>
    </GameFrame>
  );
}

interface HouseProps {
  width: number;
  height: number;
  laptop: Point;
  microwave: Point;
  router: Point;
  active: boolean;
  won: boolean;
  wonRef: { current: boolean };
  lineColor: string;
  onMove: (point: Point) => void;
}

// La casa a la medida del espacio: posiciones en fracciones, dibujo en píxeles reales.
function House({ width, height, laptop, microwave, router, active, won, wonRef, lineColor, onMove }: HouseProps) {
  const dragStart = useRef<Point>(router);
  const px = (point: Point): Point => ({ x: point.x * width, y: point.y * height });
  const laptopPx = px(laptop);
  const microwavePx = px(microwave);
  const routerPx = px(router);

  const panHandlers = usePanHandlers({
    canStart: () => active && !wonRef.current,
    onGrant: () => {
      void feedbackTap();
      dragStart.current = router;
    },
    onMove: (_, gesture) => {
      const x = Math.max(0.06, Math.min(0.94, dragStart.current.x + gesture.dx / width));
      const y = Math.max(0.08, Math.min(0.92, dragStart.current.y + gesture.dy / height));
      onMove({ x, y });
    },
  });

  return (
    <View style={[styles.house, dragSurface]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Rect x={4} y={4} width={width - 8} height={height - 8} rx={14} stroke={colors.accentSoft} strokeOpacity={0.4} strokeWidth={3} fill="none" />
        <Line x1={width / 2} y1={4} x2={width / 2} y2={height * 0.38} stroke={colors.accentSoft} strokeOpacity={0.4} strokeWidth={3} />
        <Line x1={width / 2} y1={height * 0.62} x2={width / 2} y2={height - 4} stroke={colors.accentSoft} strokeOpacity={0.4} strokeWidth={3} />
        <Line x1={4} y1={height / 2} x2={width * 0.3} y2={height / 2} stroke={colors.accentSoft} strokeOpacity={0.4} strokeWidth={3} />
        <Line x1={width * 0.7} y1={height / 2} x2={width - 4} y2={height / 2} stroke={colors.accentSoft} strokeOpacity={0.4} strokeWidth={3} />
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
        {...panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Router Wi-Fi: arrástralo"
        style={[styles.router, dragSurface, { left: routerPx.x - ROUTER / 2, top: routerPx.y - ROUTER / 2 }]}
      >
        <PulseRings size={ROUTER * 2} color={lineColor} style={styles.rings} />
        <View style={styles.routerBody}>
          <TelIcon name="router" size={28} color={colors.primary} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    flex: 1,
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
