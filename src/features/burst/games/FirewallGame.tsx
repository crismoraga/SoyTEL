import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { SlideInRight } from 'react-native-reanimated';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { feedbackTap } from '@/lib/feedback';
import { useMotionEnabled } from '@/lib/motion';
import { colors, radius, spacing } from '@/theme';
import { firewallRound, type Packet } from '../logic';
import { ChoiceTile, TileGrid } from '../parts';
import type { MicroGameProps } from '../types';

// Microjuego 5: llegan paquetes uno a uno; permite los legítimos y bloquea los maliciosos.
export function FirewallGame({ active, level, onAnswer }: MicroGameProps) {
  const motion = useMotionEnabled();
  const packets = useMemo(() => firewallRound(level >= 3 ? 5 : 4), [level]);
  const [index, setIndex] = useState(0);
  const [verdict, setVerdict] = useState<'ok' | 'fail' | null>(null);
  const answered = useRef(false);
  const packet: Packet | undefined = packets[index];

  function decide(block: boolean) {
    if (!active || answered.current || !packet) return;
    if (block !== packet.malicious) {
      answered.current = true;
      setVerdict('fail');
      onAnswer(false);
      return;
    }
    void feedbackTap();
    if (index + 1 >= packets.length) {
      answered.current = true;
      setVerdict('ok');
      onAnswer(true, 40);
      return;
    }
    setIndex(index + 1);
  }

  return (
    <View style={styles.container}>
      <View style={styles.progress} accessibilityLabel={`Paquete ${Math.min(index + 1, packets.length)} de ${packets.length}`}>
        {packets.map((item, position) => (
          <View key={item.id} style={[styles.pip, position < index && styles.pipDone, position === index && styles.pipCurrent]} />
        ))}
      </View>
      <View style={styles.wall}>
        <TelIcon name="shieldCheck" size={22} color={colors.accent} />
        <TelText variant="small" color="accentSoft" style={styles.wallText}>
          FIREWALL DEL CAMPUS
        </TelText>
      </View>
      {packet && (
        <Animated.View key={packet.id} entering={motion ? SlideInRight.duration(220) : undefined} style={[styles.packet, verdict === 'fail' && styles.packetFail]}>
          <View style={styles.packetIcon}>
            <TelIcon name="packet" size={26} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <TelText variant="subtitle" color="cream">
              {packet.title}
            </TelText>
            <TelText variant="caption" color="accentSoft">
              {packet.detail}
            </TelText>
          </View>
        </Animated.View>
      )}
      <TileGrid>
        <ChoiceTile label="Permitir" icon="check" disabled={!active || Boolean(verdict)} onPress={() => decide(false)} />
        <ChoiceTile label="Bloquear" icon="shield" disabled={!active || Boolean(verdict)} onPress={() => decide(true)} style={styles.blockTile} />
      </TileGrid>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  pip: {
    width: 26,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primarySoft,
  },
  pipDone: {
    backgroundColor: colors.accent,
  },
  pipCurrent: {
    backgroundColor: colors.cream,
  },
  wall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  wallText: {
    letterSpacing: 1.6,
  },
  packet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    minHeight: 96,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  packetFail: {
    borderColor: colors.danger,
  },
  packetIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  blockTile: {
    borderColor: 'rgba(229, 138, 138, 0.5)',
  },
});
