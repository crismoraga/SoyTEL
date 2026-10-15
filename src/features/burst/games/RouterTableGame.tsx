import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming, ZoomIn } from 'react-native-reanimated';
import { FitBox, type FitSize } from '@/components/FitBox';
import { PressableScale } from '@/components/PressableScale';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { useAmbientMotion, useMotionEnabled } from '@/lib/motion';
import { colors, monoFamily, radius, spacing } from '@/theme';
import { bonusFor, routeLineLabel, routerRound, type RouteLine, type RouterRound } from '../packs/redes.logic';
import type { MicroGameProps } from '../types';

type RowState = 'idle' | 'ok' | 'bad' | 'dim';

// Vaivén decorativo del paquete: solo con animaciones completas.
function useBob(enabled: boolean) {
  const lift = useSharedValue(0);
  useEffect(() => {
    if (!enabled) return;
    lift.set(withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true));
    return () => cancelAnimation(lift);
  }, [enabled, lift]);
  return useAnimatedStyle(() => ({ transform: [{ translateY: -4 * lift.value }] }));
}

// Microjuego «¿Por dónde sale?»: un paquete llega al router con una IP de destino y hay que tocar
// la línea de la tabla que le corresponde (o «lo demás» si ninguna coincide).
export function RouterTableGame({ active, level, onAnswer }: MicroGameProps) {
  const motion = useMotionEnabled();
  const ambient = useAmbientMotion();
  const [round] = useState<RouterRound>(() => routerRound(level));
  const [chosen, setChosen] = useState<string | null>(null);
  const answered = useRef(false);

  function choose(line: RouteLine) {
    if (!active || answered.current) return;
    answered.current = true;
    setChosen(line.id);
    const correct = line.id === round.answer;
    onAnswer(correct, correct ? bonusFor(level, 20) : 0, correct ? undefined : round.note);
  }

  return (
    <View style={styles.root}>
      <PacketCard destination={round.destination} motion={motion} ambient={ambient} />
      <FitBox maxHeight={300}>
        {(size) => <RouteTable size={size} round={round} chosen={chosen} locked={!active || chosen !== null} motion={motion} onChoose={choose} />}
      </FitBox>
    </View>
  );
}

function PacketCard({ destination, motion, ambient }: { destination: string; motion: boolean; ambient: boolean }) {
  const bob = useBob(ambient);
  return (
    <Animated.View entering={motion ? ZoomIn.springify().damping(12) : undefined}>
      <Animated.View accessible accessibilityLabel={`Paquete con destino ${destination}`} style={[styles.packet, bob]}>
        <View style={styles.packetIcon}>
          <TelIcon name="packet" size={26} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <TelText variant="small" color="secondary" style={styles.kicker}>
            PAQUETE PARA
          </TelText>
          <TelText variant="title" color="primary" style={styles.address}>
            {destination}
          </TelText>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

interface TableProps {
  size: FitSize;
  round: RouterRound;
  chosen: string | null;
  locked: boolean;
  motion: boolean;
  onChoose: (line: RouteLine) => void;
}

function RouteTable({ size, round, chosen, locked, motion, onChoose }: TableProps) {
  const count = round.lines.length;
  const padding = 8;
  const gap = 6;
  const header = 26;
  const rowHeight = Math.max(46, Math.min(68, Math.floor((size.height - header - padding * 2 - gap * count) / count)));
  return (
    <View style={[styles.table, { width: size.width, padding }]}>
      <View style={[styles.tableHeader, { height: header }]}>
        <TelIcon name="routerTable" size={18} color={colors.accent} />
        <TelText variant="small" color="accentSoft" style={styles.kicker}>
          TABLA DEL ROUTER
        </TelText>
        <TelText variant="small" color="slate" style={styles.hint}>
          x = cualquiera
        </TelText>
      </View>
      {round.lines.map((line, index) => {
        const state: RowState = chosen === null ? 'idle' : line.id === round.answer ? 'ok' : line.id === chosen ? 'bad' : 'dim';
        return (
          <Animated.View key={line.id} entering={motion ? ZoomIn.delay(index * 70).springify().damping(13) : undefined}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={routeLineLabel(line)}
              disabled={locked}
              haptic
              onPress={() => onChoose(line)}
              scaleTo={0.96}
              style={[styles.row, { height: rowHeight }, state === 'ok' && styles.rowOk, state === 'bad' && styles.rowBad, state === 'dim' && styles.rowDim]}
            >
              <View style={styles.pattern}>
                {line.prefix ? (
                  <TelText variant="label" color="cream" style={styles.mono}>
                    {line.pattern}
                  </TelText>
                ) : (
                  <TelText variant="label" color="accentSoft">
                    {line.pattern}
                  </TelText>
                )}
              </View>
              <TelIcon name="arrowRight" size={18} color={colors.accent} />
              <View style={styles.exit}>
                <View style={styles.exitIcon}>
                  <TelIcon name={line.exit.icon} size={18} color={colors.primary} />
                </View>
                <TelText variant="label" color="cream" numberOfLines={2} style={styles.flex}>
                  {line.exit.label}
                </TelText>
              </View>
              {(state === 'ok' || state === 'bad') && (
                <Animated.View entering={motion ? ZoomIn.springify().damping(8) : undefined} style={[styles.verdict, state === 'ok' ? styles.verdictOk : styles.verdictBad]}>
                  <TelIcon name={state === 'ok' ? 'check' : 'close'} size={14} color={colors.white} strokeWidth={3} />
                </Animated.View>
              )}
            </PressableScale>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  kicker: {
    letterSpacing: 1.6,
  },
  packet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    borderBottomWidth: 4,
    borderBottomColor: colors.creamShade,
  },
  packetIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  address: {
    fontFamily: monoFamily,
    fontSize: 21,
    lineHeight: 27,
    letterSpacing: 0.2,
  },
  table: {
    gap: 6,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryDeep,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 212, 237, 0.3)',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  hint: {
    marginLeft: 'auto',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'rgba(167, 212, 237, 0.3)',
    backgroundColor: colors.primarySoft,
  },
  rowOk: {
    backgroundColor: '#1F5E43',
    borderColor: '#6BC59A',
  },
  rowBad: {
    backgroundColor: '#6E2A2A',
    borderColor: '#E58A8A',
  },
  rowDim: {
    opacity: 0.55,
  },
  pattern: {
    width: 86,
  },
  mono: {
    fontFamily: monoFamily,
    fontSize: 15,
  },
  exit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  exitIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verdict: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verdictOk: {
    backgroundColor: '#2E7D5B',
  },
  verdictBad: {
    backgroundColor: colors.danger,
  },
});
