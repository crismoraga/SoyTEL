import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppLogo, Wordmark } from '@/components/Brand';
import { Sheet } from '@/components/Sheet';
import { TelButton } from '@/components/TelButton';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { LINKS, openLink } from '@/lib/links';
import { pillars } from '@/route/content';
import { colors, spacing } from '@/theme';

interface TelematicaSheetProps {
  visible: boolean;
  onClose: () => void;
}

// Se abre al tocar el logo TEL: presenta la carrera y lleva a sus enlaces oficiales.
export function TelematicaSheet({ visible, onClose }: TelematicaSheetProps) {
  function go(action: () => void) {
    onClose();
    action();
  }

  return (
    <Sheet visible={visible} onClose={onClose} accessibilityLabel="Ingeniería Civil Telemática USM" tone="dark">
      <View style={styles.head}>
        <AppLogo size={64} shadow />
        <View style={styles.flex}>
          <Wordmark size={26} />
          <TelText variant="label" color="accentSoft">
            Ingeniería Civil Telemática · USM
          </TelText>
        </View>
      </View>
      <TelText variant="body" color="cream">
        Diseñas, integras y gestionas las redes y comunicaciones que conectan al mundo: desde Internet y la fibra óptica hasta las apps, los datos y los dispositivos.
      </TelText>
      <View style={styles.pillars}>
        {pillars.map((pillar) => (
          <View key={pillar.id} style={[styles.pillar, { backgroundColor: pillar.color }]}>
            <TelIcon name={pillar.icon} size={14} color={colors.primary} />
            <TelText variant="small" color="primary">
              {pillar.pillar}
            </TelText>
          </View>
        ))}
      </View>
      <View style={styles.actions}>
        <TelButton label="Malla interactiva" variant="cream" icon="grid" onPress={() => go(() => router.push('/malla'))} />
        <TelButton label="La carrera en usm.cl" variant="outlineLight" icon="external" onPress={() => go(() => void openLink(LINKS.career))} />
        <TelButton label="Admisión USM" variant="outlineLight" icon="school" onPress={() => go(() => void openLink(LINKS.admission))} />
        <TelButton label="Didactic-Tel · los pilares" variant="outlineLight" icon="globe" onPress={() => go(() => void openLink(LINKS.didactic))} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  pillars: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  pillar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  actions: {
    gap: spacing.xs,
  },
});
