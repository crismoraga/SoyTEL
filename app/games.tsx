import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { TelCard } from '@/components/TelCard';
import { TelButton } from '@/components/TelButton';
import { TelText } from '@/components/TelText';
import { colors, spacing } from '@/theme';

export default function GamesScreen() {
  return (
    <Screen>
      <TelText variant="title" color="primary">Explorar juegos</TelText>
      <TelText color="muted">
        Retos cortos diseñados para aprender conceptos telemáticos sin manuales extensos.
      </TelText>

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
    <TelCard>
      <View style={styles.titleRow}>
        <View style={styles.iconWrap}>
          <Ionicons color={colors.white} name={icon} size={24} />
        </View>
        <View style={styles.cardText}>
          <TelText variant="subtitle" color="primary">{title}</TelText>
          <TelText variant="caption" color="secondary">{duration}</TelText>
        </View>
      </View>
      <TelText color="muted">{subtitle}</TelText>
      <TelButton label="Jugar" variant="secondary" onPress={action} />
    </TelCard>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
});
