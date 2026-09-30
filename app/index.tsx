import { useEffect, useState } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppLogo, brandImages, Wordmark } from '@/components/Brand';
import { PulseRings } from '@/components/feedback/PulseRings';
import { OrbitSpinner } from '@/components/feedback/Loaders';
import { TelButton } from '@/components/TelButton';
import { TelText } from '@/components/TelText';
import { useEntering } from '@/lib/motion';
import { isOnboarded } from '@/storage/story';
import { colors, spacing } from '@/theme';

type WelcomeState = 'checking' | 'returning' | 'new';

// Pantalla "Bienvenida" de Claude Design: fondo de marca, logo con ondas y llamado a comenzar.
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const entering = useEntering();
  const [state, setState] = useState<WelcomeState>('checking');

  useEffect(() => {
    let active = true;
    void isOnboarded().then((value) => {
      if (active) setState(value ? 'returning' : 'new');
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (state !== 'returning') return;
    const timer = setTimeout(() => router.replace('/home'), 1400);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <View style={styles.root}>
      <ImageBackground source={brandImages.splash} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(11,45,69,0.15)', 'rgba(11,45,69,0.55)', 'rgba(7,31,49,0.92)']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + spacing.xl }]}>
        <Animated.View entering={entering.fade()} style={styles.kickerBlock}>
          <TelText variant="overline" color="accentSoft" align="center" style={styles.kicker}>
            Ingeniería Civil Telemática
          </TelText>
          <View style={styles.kickerBar} />
        </Animated.View>

        <View style={styles.hero}>
          <View style={styles.logoStage}>
            <PulseRings size={300} color={colors.accent} style={StyleSheet.absoluteFill} />
            <Animated.View entering={entering.pop(1)}>
              <AppLogo size={176} shadow />
            </Animated.View>
          </View>
          <Animated.View entering={entering.fadeUp(3)} style={styles.titleBlock}>
            <Wordmark size={60} />
            <TelText variant="subtitle" color="cream" align="center">
              Mismas redes, un mejor mañana.
            </TelText>
          </Animated.View>
        </View>

        {state === 'new' && (
          <Animated.View entering={entering.fadeUp(5)} style={styles.actions}>
            <TelButton label="Comenzar" variant="cream" size="lg" iconRight="arrowRight" onPress={() => router.push('/onboarding')} />
            <TelButton
              label="Unirme con el código del stand"
              variant="outlineLight"
              icon="qr"
              onPress={() => router.push({ pathname: '/onboarding', params: { next: 'ruta' } })}
            />
            <TelText variant="caption" color="accentSoft" align="center">
              App oficial de Telemática USM
            </TelText>
          </Animated.View>
        )}

        {state !== 'new' && (
          <Animated.View entering={entering.fade(2)} style={styles.loading}>
            <OrbitSpinner size={44} />
            <TelText variant="label" color="accentSoft" align="center">
              Conectando personas con el futuro…
            </TelText>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
  },
  kickerBlock: {
    alignItems: 'center',
    gap: 14,
  },
  kicker: {
    letterSpacing: 3.4,
  },
  kickerBar: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  logoStage: {
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  actions: {
    gap: 14,
  },
  loading: {
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 140,
    justifyContent: 'center',
  },
});
