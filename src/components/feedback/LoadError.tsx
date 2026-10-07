import { StyleSheet, View } from 'react-native';
import { TelButton } from '@/components/TelButton';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { colors, radius, spacing } from '@/theme';

interface LoadErrorProps {
  onRetry: () => void;
  // 'dark': sobre pantallas azul noche (juegos, Rutix, historia).
  tone?: 'light' | 'dark';
}

// Aviso para cuando no se pudo leer lo guardado en el teléfono: explica qué pasó y deja reintentar,
// en vez de dejar la pantalla cargando para siempre.
export function LoadError({ onRetry, tone = 'light' }: LoadErrorProps) {
  const dark = tone === 'dark';
  return (
    <View style={[styles.card, dark ? styles.dark : styles.light]} accessibilityRole="alert">
      <TelIcon name="alert" size={24} color={dark ? colors.cream : colors.inkAccent} />
      <View style={styles.text}>
        <TelText variant="subtitle" color={dark ? 'cream' : 'ink'}>
          No pudimos leer tus datos
        </TelText>
        <TelText variant="caption" color={dark ? 'accentSoft' : 'inkSoft'}>
          Siguen guardados en el teléfono. Inténtalo otra vez.
        </TelText>
      </View>
      <TelButton label="Reintentar" icon="refresh" size="sm" variant={dark ? 'cream' : 'primary'} fullWidth={false} onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  light: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  dark: {
    backgroundColor: colors.primarySoft,
    borderColor: 'rgba(167, 212, 237, 0.25)',
  },
  text: {
    flex: 1,
    minWidth: 160,
    gap: 2,
  },
});
