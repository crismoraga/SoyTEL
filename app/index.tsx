import { Image, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelText, textStyles } from '@/components/TelText';
import { isOnboarded } from '@/storage/story';
import { spacing } from '@/theme';

const logo = require('../assets/logo.png');

export default function WelcomeScreen() {
  async function start() {
    const onboarded = await isOnboarded();
    router.replace(onboarded ? '/home' : '/onboarding');
  }
  return (
    <Screen dark scroll={false} contentStyle={styles.container}>
      <View style={styles.hero}>
        <Image accessibilityLabel="Logo SoyTEL" source={logo} style={styles.logo} resizeMode="contain" />
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

      <TelCard tone="cream">
        <TelText variant="subtitle" color="primary">
          Tu misión
        </TelText>
        <TelText color="primarySoft">
          Completa retos de menos de 20 minutos, gana XP, desbloquea medallas y ayuda a Telix a restaurar la señal.
        </TelText>
      </TelCard>

      <View style={styles.actions}>
        <TelButton label="Comenzar aventura" onPress={() => void start()} />
        <TelButton label="Explorar juegos" variant="ghost" onPress={() => router.push('/games')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xxl,
  },
  logo: {
    width: 132,
    height: 132,
    borderRadius: 32,
  },
  actions: {
    gap: spacing.sm,
  },
});
