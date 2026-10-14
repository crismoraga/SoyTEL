import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming, ZoomIn } from 'react-native-reanimated';
import { FitBox, type FitSize } from '@/components/FitBox';
import { DeviceArt } from '@/components/graphics/DeviceArt';
import { PressableScale } from '@/components/PressableScale';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { useAmbientMotion, useMotionEnabled } from '@/lib/motion';
import { colors, monoFamily, radius, spacing } from '@/theme';
import { bonusFor, switchPortLabel, switchRound, type SwitchPort, type SwitchRound } from '../packs/redes.logic';
import type { MicroGameProps } from '../types';

type PortState = 'idle' | 'ok' | 'bad' | 'dim';

// Vaivén decorativo del sobre: solo con animaciones completas.
function useBob(enabled: boolean) {
  const lift = useSharedValue(0);
  useEffect(() => {
    if (!enabled) return;
    lift.set(withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true));
    return () => cancelAnimation(lift);
  }, [enabled, lift]);
  return useAnimatedStyle(() => ({ transform: [{ translateY: -4 * lift.value }] }));
}

// Microjuego «El switch reparte»: un sobre llega al switch y hay que tocar el puerto de su destinatario.
// Desde el nivel 2 el sobre y los puertos usan la dirección MAC en vez del nombre.
export function SwitchLearnGame({ active, level, onAnswer }: MicroGameProps) {
  const motion = useMotionEnabled();
  const ambient = useAmbientMotion();
  const [round] = useState<SwitchRound>(() => switchRound(level));
  const [chosen, setChosen] = useState<number | null>(null);
  const answered = useRef(false);

  function choose(port: SwitchPort) {
    if (!active || answered.current) return;
    answered.current = true;
    setChosen(port.port);
    const correct = port.port === round.answer;
    onAnswer(correct, correct ? bonusFor(level, 20) : 0, correct ? undefined : round.note);
  }

  return (
    <View style={styles.root}>
      <Envelope round={round} motion={motion} ambient={ambient} />
      <FitBox maxHeight={270}>
        {(size) => <SwitchPanel size={size} round={round} chosen={chosen} locked={!active || chosen !== null} motion={motion} onChoose={choose} />}
      </FitBox>
    </View>
  );
}

function Envelope({ round, motion, ambient }: { round: SwitchRound; motion: boolean; ambient: boolean }) {
  const bob = useBob(ambient);
  const target = round.ports[round.answer - 1];
  return (
    <Animated.View entering={motion ? ZoomIn.springify().damping(12) : undefined}>
      <Animated.View accessible accessibilityLabel={`Sobre para ${round.destination}`} style={[styles.envelope, bob]}>
        <View style={styles.stamp}>
          <TelIcon name="mail" size={24} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <TelText variant="small" color="secondary" style={styles.kicker}>
            {round.mode === 'mac' ? 'PARA ESTA MAC' : 'PARA'}
          </TelText>
          {round.mode === 'mac' ? (
            <TelText variant="subtitle" color="primary" style={styles.mac}>
              {round.destination}
            </TelText>
          ) : (
            <View style={styles.addressee}>
              <DeviceArt device={target.device.kind} size={30} color={colors.primary} />
              <TelText variant="subtitle" color="primary" style={styles.flex}>
                {round.destination}
              </TelText>
            </View>
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

interface PanelProps {
  size: FitSize;
  round: SwitchRound;
  chosen: number | null;
  locked: boolean;
  motion: boolean;
  onChoose: (port: SwitchPort) => void;
}

function SwitchPanel({ size, round, chosen, locked, motion, onChoose }: PanelProps) {
  const padding = 10;
  const gap = 8;
  const header = 30;
  const cellWidth = Math.floor((size.width - padding * 2 - gap) / 2);
  const cellHeight = Math.max(76, Math.min(112, Math.floor((size.height - header - padding * 2 - gap * 2) / 2)));
  const art = Math.max(26, Math.min(46, cellHeight - (round.mode === 'mac' ? 54 : 46)));
  return (
    <View style={[styles.panel, { width: size.width, padding }]}>
      <View style={[styles.panelHeader, { height: header }]}>
        <TelIcon name="switchPorts" size={20} color={colors.accent} />
        <TelText variant="small" color="accentSoft" style={styles.kicker}>
          SWITCH
        </TelText>
        <View style={styles.leds}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={styles.led} />
          ))}
        </View>
      </View>
      <View style={[styles.grid, { gap }]}>
        {round.ports.map((port, index) => {
          const state: PortState = chosen === null ? 'idle' : port.port === round.answer ? 'ok' : port.port === chosen ? 'bad' : 'dim';
          return (
            <Animated.View key={port.port} entering={motion ? ZoomIn.delay(index * 70).springify().damping(13) : undefined}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={switchPortLabel(port, round.mode)}
                disabled={locked}
                haptic
                onPress={() => onChoose(port)}
                scaleTo={0.94}
                style={[styles.port, { width: cellWidth, height: cellHeight }, state === 'ok' && styles.portOk, state === 'bad' && styles.portBad, state === 'dim' && styles.portDim]}
              >
                <View style={styles.portNumber}>
                  <TelText variant="small" color="primary">
                    {port.port}
                  </TelText>
                </View>
                {(state === 'ok' || state === 'bad') && (
                  <Animated.View entering={motion ? ZoomIn.springify().damping(8) : undefined} style={[styles.verdict, state === 'ok' ? styles.verdictOk : styles.verdictBad]}>
                    <TelIcon name={state === 'ok' ? 'check' : 'close'} size={14} color={colors.white} strokeWidth={3} />
                  </Animated.View>
                )}
                <DeviceArt device={port.device.kind} size={art} />
                {round.mode === 'mac' ? (
                  <View>
                    <TelText variant="small" color="cream" align="center" style={styles.macLine}>
                      {port.mac.slice(0, 8)}
                    </TelText>
                    <TelText variant="small" color="cream" align="center" style={styles.macLine}>
                      {port.mac.slice(9)}
                    </TelText>
                  </View>
                ) : (
                  <TelText variant="label" color="cream" align="center" numberOfLines={2}>
                    {port.device.name}
                  </TelText>
                )}
              </PressableScale>
            </Animated.View>
          );
        })}
      </View>
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
  envelope: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    borderBottomWidth: 4,
    borderBottomColor: colors.creamShade,
  },
  stamp: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    letterSpacing: 1.6,
  },
  addressee: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  mac: {
    fontFamily: monoFamily,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.4,
  },
  panel: {
    gap: 8,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryDeep,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 212, 237, 0.3)',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  leds: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 'auto',
  },
  led: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6BC59A',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  port: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 6,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'rgba(167, 212, 237, 0.3)',
    backgroundColor: colors.primarySoft,
  },
  portOk: {
    backgroundColor: '#1F5E43',
    borderColor: '#6BC59A',
  },
  portBad: {
    backgroundColor: '#6E2A2A',
    borderColor: '#E58A8A',
  },
  portDim: {
    opacity: 0.55,
  },
  portNumber: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verdict: {
    position: 'absolute',
    top: 6,
    right: 6,
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
  macLine: {
    fontFamily: monoFamily,
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 0.4,
  },
});
