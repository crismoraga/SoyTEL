import { useEffect } from 'react';
import { AppState, BackHandler, StyleSheet, View } from 'react-native';
import { Rutix } from '@/components/graphics/Rutix';
import { Sheet } from '@/components/Sheet';
import { TelButton } from '@/components/TelButton';
import { TelText } from '@/components/TelText';
import { spacing } from '@/theme';

interface PauseSheetProps {
  visible: boolean;
  title: string;
  body: string;
  stayLabel?: string;
  leaveLabel: string;
  onStay: () => void;
  onLeave: () => void;
}

// Pausa con Rutix: antes de abandonar una partida en curso, pregunta si de verdad quieres salir.
export function PauseSheet({ visible, title, body, stayLabel = 'Seguir jugando', leaveLabel, onStay, onLeave }: PauseSheetProps) {
  return (
    <Sheet visible={visible} onClose={onStay} tone="dark" accessibilityLabel={title}>
      <View style={styles.hero}>
        <Rutix size={88} expression="think" pose="think" animated={false} />
        <View style={styles.flex}>
          <TelText variant="overline" color="accent">
            En pausa
          </TelText>
          <TelText variant="heading" color="cream">
            {title}
          </TelText>
        </View>
      </View>
      <TelText variant="body" color="onDark">
        {body}
      </TelText>
      <View style={styles.actions}>
        <TelButton label={stayLabel} variant="cream" icon="play" onPress={onStay} />
        <TelButton label={leaveLabel} variant="outlineLight" icon="door" onPress={onLeave} />
      </View>
    </Sheet>
  );
}

// Al salir de la app (o cambiar de pestaña en la web) durante una partida individual, se pausa sola:
// el reloj no corre mientras nadie la está mirando.
export function useAutoPause(enabled: boolean, onPause: () => void): void {
  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') onPause();
    });
    return () => subscription.remove();
  }, [enabled, onPause]);
}

// Botón "atrás" de Android durante una partida: abre la pausa en vez de salir de golpe.
export function useBackToPause(enabled: boolean, onBack: () => void): void {
  useEffect(() => {
    if (!enabled) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [enabled, onBack]);
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
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
