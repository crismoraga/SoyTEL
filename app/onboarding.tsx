import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brandImages } from '@/components/Brand';
import { BrandBackdrop } from '@/components/graphics/BrandBackdrop';
import { Illustration } from '@/components/graphics/Illustration';
import { Telix } from '@/components/graphics/Telix';
import { IconButton } from '@/components/IconButton';
import { PressableScale } from '@/components/PressableScale';
import { TelButton } from '@/components/TelButton';
import { TelText } from '@/components/TelText';
import { useEntering } from '@/lib/motion';
import { pushInbox } from '@/storage/inbox';
import { updateAlias } from '@/storage/profile';
import { markOnboarded } from '@/storage/story';
import { colors, font, radius, spacing } from '@/theme';

interface Slide {
  kicker: string;
  title: string;
  body: string;
}

const slides: Slide[] = [
  {
    kicker: 'Descubre Telemática',
    title: 'Explora el mundo de las redes y la tecnología',
    body: 'Juegos cortos de redes, señales, software, hardware y ciberseguridad para conocer Ingeniería Civil Telemática.',
  },
  {
    kicker: 'Juega en ráfagas',
    title: '12 microjuegos, segundos para cada uno',
    body: 'Sesiones de 15 a 20 minutos: ráfagas frenéticas, un concurso de preguntas, una historia en el campus y recorridos en grupo.',
  },
  {
    kicker: 'Tu compañero Telix',
    title: 'Cuida a Telix y colecciona medallas',
    body: 'Cada partida sube su señal. Si lo dejas solo, se desanima. Sin cuentas ni correos: tu progreso vive en este teléfono.',
  },
];

// Pantalla "Onboarding" de Claude Design: arte arriba, puntos de paso, textos y acciones abajo.
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const entering = useEntering();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [step, setStep] = useState(0);
  const [alias, setAlias] = useState('');
  const [saving, setSaving] = useState(false);
  const slide = slides[step];
  const isLast = step === slides.length - 1;

  async function finish(skipped = false) {
    setSaving(true);
    try {
      const profile = await updateAlias(skipped ? '' : alias);
      await markOnboarded();
      await pushInbox([
        {
          kind: 'aviso',
          title: `¡Bienvenido a SoyTEL, ${profile.alias}!`,
          body: 'Tu ruta por Telemática USM está lista. Explora, aprende y conecta.',
          route: '/games',
        },
      ]);
      router.replace(next === 'journey' ? { pathname: '/journey', params: { mode: 'join' } } : '/home');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.art}>
        {step === 0 ? (
          <Image source={brandImages.onboardingHero} style={styles.heroImage} resizeMode="cover" accessibilityLabel="Laptop, libros y logo de Telemática USM sobre el campus" />
        ) : (
          <View style={styles.artStage}>
            <BrandBackdrop variant={step === 1 ? 'network' : 'stars'} seed={step * 5 + 3} />
            <Animated.View key={step} entering={entering.pop()}>
              {step === 1 ? <Illustration name="burst" width={280} tone="dark" /> : <Telix size={230} expression="happy" pose="wave" signal={4} />}
            </Animated.View>
          </View>
        )}
        <LinearGradient colors={['rgba(11,45,69,0)', colors.primary]} style={styles.artFade} />
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Saltar introducción"
          onPress={() => void finish(true)}
          style={[styles.skip, { top: insets.top + spacing.sm }]}
        >
          <TelText variant="label" color="cream">
            Saltar
          </TelText>
        </PressableScale>
      </View>

      <ScrollView
        style={styles.panel}
        contentContainerStyle={[styles.panelContent, { paddingBottom: insets.bottom + spacing.lg }]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.dotsRow}>
          {slides.map((item, index) => (
            <View key={item.kicker} style={[styles.dot, index === step && styles.dotActive]} />
          ))}
          <TelText variant="small" color="accentSoft" style={styles.stepLabel}>
            {step + 1} / {slides.length}
          </TelText>
        </View>

        <Animated.View key={`text-${step}`} entering={entering.fadeUp()} style={styles.textBlock}>
          <TelText variant="overline" color="accent">
            {slide.kicker}
          </TelText>
          <TelText variant="title" color="cream" accessibilityRole="header">
            {slide.title}
          </TelText>
          <TelText variant="body" color="onDark">
            {slide.body}
          </TelText>
        </Animated.View>

        {isLast && (
          <Animated.View entering={entering.fadeUp(1)} style={styles.field}>
            <TelText variant="label" color="accentSoft" nativeID="alias-label">
              ¿Cómo te llamamos?
            </TelText>
            <TextInput
              accessibilityLabelledBy="alias-label"
              accessibilityLabel="Tu nombre o apodo"
              placeholder="Tu nombre o apodo"
              placeholderTextColor={colors.slate}
              value={alias}
              onChangeText={(value) => setAlias(value.slice(0, 24))}
              maxLength={24}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={() => void finish()}
              style={[styles.input, font('bodySemi')]}
            />
          </Animated.View>
        )}

        <View style={styles.actions}>
          {step > 0 && (
            <IconButton icon="chevronLeft" tone="dark" size={56} accessibilityLabel="Paso anterior" onPress={() => setStep((value) => value - 1)} style={styles.back} />
          )}
          <View style={styles.flex}>
            {isLast ? (
              <TelButton label="Empezar mi ruta" variant="cream" size="lg" iconRight="arrowRight" loading={saving} onPress={() => void finish()} />
            ) : (
              <TelButton label="Siguiente" variant="accent" size="lg" iconRight="arrowRight" onPress={() => setStep((value) => value + 1)} />
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  art: {
    height: '48%',
    minHeight: 300,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '108%',
  },
  artStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xl,
  },
  artFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 90,
  },
  skip: {
    position: 'absolute',
    right: spacing.md,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(11, 45, 69, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    flex: 1,
  },
  panelContent: {
    paddingHorizontal: 28,
    paddingTop: spacing.xs,
    gap: 18,
    flexGrow: 1,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondary,
  },
  dotActive: {
    width: 28,
    backgroundColor: colors.cream,
  },
  stepLabel: {
    marginLeft: 'auto',
    letterSpacing: 1,
  },
  textBlock: {
    gap: 10,
  },
  field: {
    gap: spacing.xs,
  },
  input: {
    height: 52,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.secondary,
    backgroundColor: colors.primaryInput,
    color: colors.cream,
    fontSize: 16,
  },
  actions: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  back: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.secondary,
    backgroundColor: 'transparent',
  },
  flex: {
    flex: 1,
  },
});
