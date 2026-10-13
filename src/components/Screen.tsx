import { useEffect, useRef, type PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/theme';

interface ScreenProps {
  scroll?: boolean;
  dark?: boolean;
  contentStyle?: ViewStyle;
  /** Muestra un botón de volver arriba a la izquierda. */
  onBack?: () => void;
  /** Al cambiar este valor, la pantalla se desplaza hasta el final del contenido. */
  autoScrollKey?: string | number | boolean | null;
}

export function Screen({
  scroll = true,
  dark = false,
  contentStyle,
  onBack,
  autoScrollKey,
  children,
}: PropsWithChildren<ScreenProps>) {
  const scrollRef = useRef<ScrollView>(null);
  const pendingScroll = useRef(false);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    // El contenido nuevo puede no estar medido todavía: se reintenta en onContentSizeChange.
    pendingScroll.current = true;
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [autoScrollKey]);

  const background = dark
    ? [colors.primary, colors.primarySoft] as const
    : [colors.paper, colors.cream] as const;
  const content = (
    <View style={[styles.content, contentStyle]}>
      {onBack && (
        <Pressable
          accessibilityLabel="Volver"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onBack}
          style={styles.back}
        >
          <Ionicons color={dark ? colors.white : colors.primary} name="chevron-back" size={26} />
        </Pressable>
      )}
      {children}
    </View>
  );

  return (
    <LinearGradient colors={background} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {scroll ? (
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => {
              if (pendingScroll.current) {
                pendingScroll.current = false;
                scrollRef.current?.scrollToEnd({ animated: true });
              }
            }}
          >
            {content}
          </ScrollView>
        ) : content}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.lg,
    // En tablets el contenido no se estira a todo el ancho.
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  back: {
    width: 44,
    height: 44,
    marginLeft: -spacing.sm,
    marginBottom: -spacing.sm,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
});
