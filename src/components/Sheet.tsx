import type { PropsWithChildren } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMotionEnabled } from '@/lib/motion';
import { colors, radius, spacing } from '@/theme';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  tone?: 'light' | 'dark';
  accessibilityLabel: string;
}

// Hoja inferior modal para detalles (logros, confirmaciones).
export function Sheet({ visible, onClose, tone = 'light', accessibilityLabel, children }: PropsWithChildren<SheetProps>) {
  const insets = useSafeAreaInsets();
  const motionEnabled = useMotionEnabled();
  const policy = motionEnabled ? ReduceMotion.System : ReduceMotion.Always;
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(200).reduceMotion(policy)} style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <View style={styles.anchor} pointerEvents="box-none">
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel}
          entering={SlideInDown.springify().damping(18).reduceMotion(policy)}
          style={[styles.sheet, tone === 'dark' ? styles.dark : styles.light, { paddingBottom: insets.bottom + spacing.lg }]}
        >
          <View style={[styles.handle, tone === 'dark' && styles.handleDark]} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 31, 49, 0.62)',
  },
  anchor: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  light: {
    backgroundColor: colors.paper,
  },
  dark: {
    backgroundColor: colors.primary,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  handleDark: {
    backgroundColor: colors.secondary,
  },
});
