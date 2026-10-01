import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Rutix } from '@/components/graphics/Rutix';
import { PressableScale } from '@/components/PressableScale';
import { Sheet } from '@/components/Sheet';
import { TelButton } from '@/components/TelButton';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { dismissAccountOffer, useAccount } from '@/account/store';
import { colors, spacing } from '@/theme';

const PERKS: { icon: IconName; text: string }[] = [
  { icon: 'trophy', text: 'Tus puntajes quedan registrados y apareces en el ranking global.' },
  { icon: 'refresh', text: 'Recuperas tu progreso en otro teléfono con un código.' },
  { icon: 'megaphone', text: 'Si quieres, te invitamos a charlas y actividades de Telemática.' },
];

// Ventana previa al juego para quien aún no tiene cuenta. Se puede jugar igual ("Ahora no").
export function AccountGate() {
  const account = useAccount();
  const [closed, setClosed] = useState(false);
  const visible = !closed && account.status === 'guest' && !account.offerDismissed;

  function go(path: '/cuenta' | '/cuenta/recuperar') {
    setClosed(true);
    router.push(path);
  }

  return (
    <Sheet visible={visible} onClose={() => dismissAccountOffer()} accessibilityLabel="Crea tu cuenta antes de jugar" tone="dark">
      <View style={styles.hero}>
        <Rutix size={96} expression="happy" pose="wave" />
        <View style={styles.flex}>
          <TelText variant="overline" color="accent">
            Antes de jugar
          </TelText>
          <TelText variant="heading" color="cream">
            ¡Crea tu cuenta para que tus puntajes cuenten!
          </TelText>
        </View>
      </View>
      <View style={styles.perks}>
        {PERKS.map((perk) => (
          <View key={perk.text} style={styles.perk}>
            <View style={styles.perkIcon}>
              <TelIcon name={perk.icon} size={16} color={colors.primary} />
            </View>
            <TelText variant="caption" color="accentSoft" style={styles.flex}>
              {perk.text}
            </TelText>
          </View>
        ))}
      </View>
      <TelText variant="small" color="slate">
        Solo te pedimos un alias. Curso, colegio y contacto son opcionales.
      </TelText>
      <View style={styles.actions}>
        <TelButton label="Crear mi cuenta" variant="cream" icon="user" onPress={() => go('/cuenta')} />
        <TelButton label="Ya tengo cuenta" variant="outlineLight" icon="key" onPress={() => go('/cuenta/recuperar')} />
        <PressableScale accessibilityRole="button" onPress={() => dismissAccountOffer()} style={styles.skip}>
          <TelText variant="label" color="accentSoft" align="center">
            Ahora no, jugar sin cuenta
          </TelText>
        </PressableScale>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  perks: {
    gap: spacing.xs,
  },
  perk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  perkIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    gap: spacing.xs,
  },
  skip: {
    minHeight: 44,
    justifyContent: 'center',
  },
});
