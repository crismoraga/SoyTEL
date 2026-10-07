import { useEffect, useState, type PropsWithChildren } from 'react';
import { Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMotionEnabled } from '@/lib/motion';
import { colors, radius, spacing } from '@/theme';
import { IconButton } from './IconButton';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  tone?: 'light' | 'dark';
  accessibilityLabel: string;
}

const useNativeDriver = Platform.OS !== 'web';

// Hoja inferior modal para detalles (logros, dato del día, ramos de la malla).
// Usa Animated de React Native con driver nativo: las animaciones de layout de Reanimated dentro de
// un Modal dejaban botones sin responder en Android.
// El contenido siempre se puede desplazar: con letra grande o en una pantalla baja, ningún botón queda
// fuera de alcance.
export function Sheet({ visible, onClose, tone = 'light', accessibilityLabel, children }: PropsWithChildren<SheetProps>) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const motionEnabled = useMotionEnabled();
  const [offset] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) return;
    if (!motionEnabled) {
      offset.setValue(0);
      return;
    }
    offset.setValue(1);
    const animation = Animated.spring(offset, { toValue: 0, damping: 22, stiffness: 260, mass: 0.9, useNativeDriver });
    animation.start();
    return () => animation.stop();
  }, [motionEnabled, offset, visible]);

  const translateY = offset.interpolate({ inputRange: [0, 1], outputRange: [0, 96] });
  const toneStyle = tone === 'dark' ? styles.dark : styles.light;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={motionEnabled ? 'fade' : 'none'}
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <GestureHandlerRootView style={styles.root}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" style={styles.backdrop} onPress={onClose} />
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel}
          style={[
            styles.sheet,
            toneStyle,
            { paddingBottom: insets.bottom + spacing.lg, maxHeight: height - insets.top - spacing.lg, transform: [{ translateY }] },
          ]}
        >
          <View style={[styles.handle, tone === 'dark' && styles.handleDark]} />
          <IconButton icon="close" tone={tone === 'dark' ? 'dark' : 'light'} size={36} accessibilityLabel="Cerrar hoja" onPress={onClose} style={styles.close} />
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7, 31, 49, 0.62)',
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
  close: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.md,
    zIndex: 2,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
});
