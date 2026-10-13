import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelText, textStyles } from '@/components/TelText';
import { isOnboarded } from '@/storage/story';
import { spacing } from '@/theme';

const logo = require('../assets/logo.png');

// Alto de ventana en que el logo y el margen superior pasan de su mínimo a su máximo.
const SHORT_HEIGHT = 640;
const TALL_HEIGHT = 844;

export default function WelcomeScreen() {
  const { height } = useWindowDimensions();
  const roomy = Math.min(1, Math.max(0, (height - SHORT_HEIGHT) / (TALL_HEIGHT - SHORT_HEIGHT)));
  const logoSize = Math.round(64 + roomy * 104);
  const heroTop = Math.round(roomy * spacing.xxl);
  const compact = height < 700;

  async function start() {
    const onboarded = await isOnboarded();
    router.replace(onboarded ? '/home' : '/onboarding');
  }
  return (
    <Screen dark contentStyle={compact ? styles.containerCompact : styles.container}>
      <View style={[styles.hero, compact && styles.heroCompact, { paddingTop: heroTop }]}>
        <Image
          accessibilityLabel="Logo SoyTEL"
          source={logo}
          style={[styles.logo, { width: logoSize, height: logoSize }]}
          resizeMode="contain"
        />
        <TelText variant="overline" color="accentSoft" align="center">
          Ingeniería Civil Telemática
        </TelText>
        <TelText variant="hero" color="white" align="center" style={textStyles.shadow}>
          Aprende jugando en ráfagas cortas
        </TelText>
        <TelText variant="body" color="accentSoft" align="center">
          Microretos de redes, software, hardware, telecomunicaciones y seguridad para descubrir la carrera.
        </TelText>
      </View>

      <TelCard tone="cream" style={compact && styles.cardCompact}>
        <TelText variant="subtitle" color="primary">
          Tu misión
        </TelText>
        <TelText color="primarySoft">
          Completa retos de menos de 20 minutos, gana XP, desbloquea medallas y ayuda a Telix a restaurar la señal.
        </TelText>
      </TelCard>

      <View style={styles.actions}>
        <TelButton label="Comenzar aventura" onPress={() => void start()} />
        <TelButton label="Explorar juegos" variant="ghost" surface="dark" onPress={() => router.push('/games')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
  },
  containerCompact: {
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.md,
  },
  heroCompact: {
    gap: spacing.sm,
  },
  cardCompact: {
    padding: spacing.md,
  },
  logo: {
    borderRadius: 32,
  },
  actions: {
    gap: spacing.sm,
  },
});
