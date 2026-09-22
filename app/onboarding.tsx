import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelText } from '@/components/TelText';
import { markOnboarded } from '@/storage/story';
import { updateAlias } from '@/storage/profile';
import { colors, radius, spacing } from '@/theme';

interface Slide {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}

const slides: Slide[] = [
  {
    icon: 'flash',
    title: 'Juega en ráfagas',
    body: 'Microretos de menos de 15 segundos sobre redes, señales, hardware y seguridad. Perfectos para el trayecto.',
  },
  {
    icon: 'school',
    title: 'Aprende sin darte cuenta',
    body: 'Cada acierto viene con una microexplicación. Descubre qué hace un ingeniero telemático mientras juegas.',
  },
  {
    icon: 'people',
    title: 'Comparte el recorrido',
    body: 'Genera un ID de recorrido y completa estaciones con tu curso. La señal se restaura en equipo.',
  },
];

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [alias, setAlias] = useState('');
  const [saving, setSaving] = useState(false);
  const slide = slides[step];

  async function finish() {
    setSaving(true);
    try {
      await updateAlias(alias);
      await markOnboarded();
      router.replace('/home');
    } finally {
      setSaving(false);
    }
  }

  if (step < slides.length) {
    return (
      <Screen dark contentStyle={styles.container}>
        <View style={styles.slide}>
          <View style={styles.iconWrap}>
            <Ionicons color={colors.accent} name={slide.icon} size={72} />
          </View>
          <TelText variant="hero" color="white" align="center">{slide.title}</TelText>
          <TelText color="accentSoft" align="center">{slide.body}</TelText>
        </View>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {slides.map((item, index) => (
              <View
                key={item.title}
                style={[styles.dot, index === step && styles.dotActive]}
              />
            ))}
          </View>
          <TelButton label={step + 1 >= slides.length ? 'Crear mi perfil' : 'Siguiente'} onPress={() => setStep((value) => value + 1)} />
          <TelButton label="Saltar" variant="ghost" onPress={() => setStep(slides.length)} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen dark scroll={false} contentStyle={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.aliasContainer}
      >
        <TelText variant="overline" color="accentSoft" align="center">Último paso</TelText>
        <TelText variant="title" color="white" align="center">¿Cómo te llamará la red?</TelText>
        <TelText color="accentSoft" align="center">
          Elige un alias para tus logros y recorridos. Sin cuentas, sin correos: tu progreso vive en este dispositivo.
        </TelText>
        <TextInput
          accessibilityLabel="Tu alias"
          placeholder="Ej: Nodo Valparaíso"
          placeholderTextColor={colors.muted}
          value={alias}
          onChangeText={(value) => setAlias(value.slice(0, 24))}
          style={styles.input}
          maxLength={24}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={() => void finish()}
        />
        <TelButton label="Comenzar aventura" loading={saving} onPress={() => void finish()} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 150,
    height: 150,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(111,179,217,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167,212,237,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    gap: spacing.sm,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: {
    backgroundColor: colors.accent,
    width: 26,
  },
  aliasContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  input: {
    minHeight: 56,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    color: colors.primary,
    paddingHorizontal: spacing.lg,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});
