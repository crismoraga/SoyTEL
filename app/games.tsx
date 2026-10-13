import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { TelText } from '@/components/TelText';
import { colors, radius, spacing } from '@/theme';

export default function GamesScreen() {
  const { height } = useWindowDimensions();
  // En pantallas bajas se omite la introducción para mostrar más juegos de una vez.
  const compact = height < 700;

  return (
    <Screen onBack={() => router.back()} contentStyle={styles.container}>
      <TelText variant="title" color="primary">Explorar juegos</TelText>
      {!compact && (
        <TelText color="muted">
          Retos cortos diseñados para aprender conceptos telemáticos sin manuales extensos.
        </TelText>
      )}

      <GameCard
        icon="flash"
        title="Ráfaga TEL"
        subtitle="Seis microretos frenéticos al azar: trivia, memoria, reflejos y sintonía."
        duration="3–5 min"
        action={() => router.push('/burst')}
      />
      <GameCard
        icon="help-circle"
        title="Quién quiere ser Telemático"
        subtitle="Preguntas progresivas con comodín 50:50 y explicaciones breves."
        duration="8–12 min"
        action={() => router.push('/millionaire')}
      />
      <GameCard
        icon="book"
        title="Historia: La señal perdida"
        subtitle="Tres capítulos narrativos con Telix y retos por área de la carrera."
        duration="10–15 min"
        action={() => router.push('/story')}
      />
      <GameCard
        icon="map"
        title="Recorrido conjunto"
        subtitle="Genera un ID, comparte la sesión y completa checkpoints."
        duration="15–20 min"
        action={() => router.push('/journey')}
      />
      <GameCard
        icon="planet"
        title="Telix interactivo"
        subtitle="Cuida a la mascota y revisa cómo tu progreso cambia su ánimo."
        duration="1 min"
        action={() => router.push('/mascot')}
      />
    </Screen>
  );
}

interface GameCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  duration: string;
  action: () => void;
}

function GameCard({ icon, title, subtitle, duration, action }: GameCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Jugar ${title}. ${duration}. ${subtitle}`}
      onPress={action}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.titleRow}>
        <View style={styles.iconWrap}>
          <Ionicons color={colors.white} name={icon} size={22} />
        </View>
        <View style={styles.cardText}>
          <TelText variant="bodyStrong" color="primary">{title}</TelText>
          <TelText variant="caption" color="secondary">{duration}</TelText>
        </View>
        <Ionicons color={colors.accent} name="chevron-forward" size={22} />
      </View>
      <TelText variant="caption" color="muted">{subtitle}</TelText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: colors.accentSoft,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
});
