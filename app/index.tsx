import { useEffect, useState } from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppLogo, brandImages, Wordmark } from '@/components/Brand';
import { BrandBackdrop } from '@/components/graphics/BrandBackdrop';
import { PulseRings } from '@/components/feedback/PulseRings';
import { OrbitSpinner } from '@/components/feedback/Loaders';
import { TelButton } from '@/components/TelButton';
import { TelText } from '@/components/TelText';
import { useEntering } from '@/lib/motion';
import { useDesktopLayout } from '@/lib/useDesktopLayout';
import { isOnboarded } from '@/storage/story';
import { colors, spacing } from '@/theme';

// Colores base de la escena de escritorio: el lado izquierdo coincide con el tono del borde de la ilustración.
const DESKTOP_LEFT = '#001B36';
const DESKTOP_RIGHT = '#0F3552';

function mix(from: string, to: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const c = [0, 1, 2].map((i) => Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function withAlpha(hex: string, alpha: number): string {
  const channel = (i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `rgba(${channel(0)},${channel(1)},${channel(2)},${alpha})`;
}

type WelcomeState = 'checking' | 'returning' | 'new';

// Pantalla "Bienvenida" de Claude Design: fondo de marca, logo con ondas y llamado a comenzar.
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const entering = useEntering();
  const { width, height } = useWindowDimensions();
  const { isDesktop } = useDesktopLayout();
  const [state, setState] = useState<WelcomeState>('checking');

  // Todo el bloque escala con el alto disponible para que quepa sin desplazar (360x640 hasta tablets).
  const big = isDesktop && width >= 1440;
  const wordmarkSize = isDesktop ? (big ? 80 : 68) : height < 700 ? 44 : 56;
  const taglineHeight = isDesktop ? 40 : 56;
  const reserved = insets.top + insets.bottom + 48 + 44 + wordmarkSize * 1.25 + taglineHeight + 200 + 32;
  const stageSize = isDesktop ? (big ? 300 : 260) : Math.round(Math.max(130, Math.min(height > 1000 ? 400 : 300, height - reserved)));
  const logoSize = Math.round(stageSize / 1.7);

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

  const kicker = (
    <Animated.View entering={entering.fade()} style={styles.kickerBlock}>
      <TelText variant="overline" color="accentSoft" align="center" style={styles.kicker}>
        Ingeniería Civil Telemática
      </TelText>
      <View style={styles.kickerBar} />
    </Animated.View>
  );

  const hero = (
    <View style={styles.hero}>
      <View style={{ width: stageSize, height: stageSize, alignItems: 'center', justifyContent: 'center' }}>
        <PulseRings size={stageSize} color={colors.accent} style={StyleSheet.absoluteFill} />
        <Animated.View entering={entering.pop(1)}>
          <AppLogo size={logoSize} shadow />
        </Animated.View>
      </View>
      <Animated.View entering={entering.fadeUp(3)} style={styles.titleBlock}>
        <Wordmark size={wordmarkSize} />
        <TelText variant="subtitle" color="cream" align="center" style={big && styles.taglineBig}>
          Mismas redes, un mejor mañana.
        </TelText>
      </Animated.View>
    </View>
  );

  const actions =
    state === 'new' ? (
      <Animated.View entering={entering.fadeUp(5)} style={styles.actions}>
        <TelButton label="Comenzar" variant="cream" size="lg" iconRight="arrowRight" onPress={() => router.push('/onboarding')} />
        <TelButton
          label="Unirme con un código"
          variant="outlineLight"
          size={isDesktop ? 'lg' : 'md'}
          icon="qr"
          onPress={() => router.push({ pathname: '/onboarding', params: { next: 'ruta' } })}
        />
        <TelText variant="caption" color="accentSoft" align="center">
          App oficial de Telemática USM
        </TelText>
      </Animated.View>
    ) : (
      <Animated.View entering={entering.fade(2)} style={styles.loading}>
        <OrbitSpinner size={44} />
        <TelText variant="label" color="accentSoft" align="center">
          Conectando personas con el futuro…
        </TelText>
      </Animated.View>
    );

  // Escritorio (web >= 1024): una sola escena a pantalla completa. La ilustración ocupa el lado izquierdo como
  // fondo y su borde derecho se funde con el degradado de marca (sin costura ni tarjeta).
  if (isDesktop) {
    const artW = Math.round(Math.max(width * 0.64, (height * 780) / 1386));
    const artH = Math.round((artW * 1386) / 780);
    const scale = width >= 1440 ? Math.min(1.7, width / 1440) : 1;
    const edge = mix(DESKTOP_LEFT, DESKTOP_RIGHT, artW / width);
    return (
      <LinearGradient colors={[DESKTOP_LEFT, DESKTOP_RIGHT]} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={styles.root}>
        <View pointerEvents="none" style={[styles.artBg, { width: artW }]}>
          <Image source={brandImages.splash} style={{ width: artW, height: artH }} resizeMode="cover" accessibilityLabel="Laptop con candado y señal de red, ilustración de Telemática USM" />
          <LinearGradient
            colors={[withAlpha(edge, 0), withAlpha(edge, 0.55), edge]}
            locations={[0.45, 0.78, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <BrandBackdrop variant="network" seed={11} opacity={0.35} />
        <View style={[styles.split, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl, paddingLeft: Math.round(artW * 0.55) }]}>
          <View style={[styles.splitColumn, scale > 1 && { transform: [{ scale }] }]}>
            <View style={styles.splitKicker}>{kicker}</View>
            {hero}
            <View style={styles.splitActions}>{actions}</View>
          </View>
        </View>
      </LinearGradient>
    );
  }

  // Móvil y tablet: degradado limpio con red de puntos; la ilustración es solo una textura tenue arriba,
  // desvanecida antes de llegar al logo.
  return (
    <LinearGradient colors={[colors.primary, colors.primarySoft]} style={styles.root}>
      <BrandBackdrop variant="network" seed={11} opacity={0.5} />
      <View pointerEvents="none" style={styles.texture}>
        <Image source={brandImages.splash} style={styles.textureImage} resizeMode="cover" />
        <LinearGradient colors={['rgba(11,45,69,0.1)', colors.primary]} locations={[0, 0.9]} style={StyleSheet.absoluteFill} />
      </View>
      <View style={[styles.content, { paddingTop: insets.top + (height < 700 ? spacing.md : spacing.xl), paddingBottom: insets.bottom + spacing.lg }]}>
        {kicker}
        {hero}
        <View style={styles.mobileActions}>{actions}</View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
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
  split: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  artBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  splitColumn: {
    width: 480,
    maxWidth: '100%',
    alignItems: 'stretch',
    gap: spacing.lg,
  },
  splitKicker: {
    alignItems: 'center',
  },
  splitActions: {
    alignItems: 'stretch',
    marginTop: spacing.md,
  },
  taglineBig: {
    fontSize: 22,
    lineHeight: 30,
  },
  texture: {
    ...StyleSheet.absoluteFill,
    height: '30%',
    opacity: 0.15,
    overflow: 'hidden',
  },
  textureImage: {
    width: '100%',
    height: '330%',
  },
  mobileActions: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
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
