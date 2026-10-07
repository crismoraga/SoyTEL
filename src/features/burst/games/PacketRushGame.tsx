import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeOut, ReduceMotion, SlideOutUp } from 'react-native-reanimated';
import { ProgressBar } from '@/components/feedback/Progress';
import { PressableScale } from '@/components/PressableScale';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { feedbackTap } from '@/lib/feedback';
import { useMotionEnabled } from '@/lib/motion';
import { colors, spacing } from '@/theme';
import { packetRushTarget } from '../packets';
import type { MicroGameProps } from '../types';

// Microjuego 8: toca lo más rápido posible para despachar los paquetes hacia el servidor.
export function PacketRushGame({ active, level, onAnswer }: MicroGameProps) {
  const target = packetRushTarget(level);
  const motion = useMotionEnabled();
  const [taps, setTaps] = useState(0);
  const [flying, setFlying] = useState<number[]>([]);
  const answered = useRef(false);

  function tap() {
    if (!active || answered.current) return;
    void feedbackTap();
    const next = taps + 1;
    setTaps(next);
    setFlying((items) => [...items.slice(-5), next]);
    setTimeout(() => setFlying((items) => items.filter((item) => item !== next)), 60);
    if (next >= target) {
      answered.current = true;
      onAnswer(true, 40);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.server}>
        <TelIcon name="server" size={40} color={colors.cream} />
        <TelText variant="small" color="accentSoft">
          SERVIDOR
        </TelText>
      </View>
      <View style={styles.lane}>
        {flying.map((id) => (
          <Animated.View
            key={id}
            exiting={motion ? SlideOutUp.duration(380).reduceMotion(ReduceMotion.System) : FadeOut}
            style={[styles.packet, { left: `${20 + ((id * 37) % 60)}%` }]}
          >
            <TelIcon name="packet" size={22} color={colors.primary} />
          </Animated.View>
        ))}
      </View>
      <ProgressBar progress={taps / target} color={colors.accent} trackColor={colors.primarySoft} height={14} style={styles.bar} accessibilityLabel={`${taps} de ${target} paquetes enviados`} />
      <TelText variant="subtitle" color="cream" align="center" tabular>
        {taps}/{target} paquetes
      </TelText>
      <PressableScale accessibilityRole="button" accessibilityLabel="Enviar paquete" disabled={!active} onPress={tap} scaleTo={0.88} style={styles.button}>
        <TelIcon name="send" size={46} color={colors.primary} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.md,
  },
  server: {
    alignItems: 'center',
    gap: 4,
    padding: spacing.sm,
    borderRadius: 18,
    backgroundColor: colors.secondary,
    width: 96,
  },
  lane: {
    height: 60,
    alignSelf: 'stretch',
  },
  bar: {
    alignSelf: 'stretch',
  },
  packet: {
    position: 'absolute',
    bottom: 0,
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.cream,
    borderWidth: 6,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
