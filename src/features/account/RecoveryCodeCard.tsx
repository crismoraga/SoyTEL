import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Tag } from '@/components/Chips';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelText } from '@/components/TelText';
import { colors, font, radius, spacing } from '@/theme';

interface RecoveryCodeCardProps {
  code: string;
  compact?: boolean;
  // Parte oculto (pantalla de la cuenta): el código solo se ve cuando su dueño lo pide.
  concealed?: boolean;
  // Cambiar el código por uno nuevo (el anterior deja de servir).
  onRegenerate?: () => void;
  regenerating?: boolean;
}

// Código de recuperación de la cuenta: quien lo tenga puede entrar a ella, así que se puede ocultar,
// copiarlo es una acción que el usuario pide, y se puede cambiar si quedó a la vista de alguien.
export function RecoveryCodeCard({ code, compact = false, concealed = false, onRegenerate, regenerating = false }: RecoveryCodeCardProps) {
  const [copied, setCopied] = useState(false);
  const [hidden, setHidden] = useState(concealed);
  const [shown, setShown] = useState(code);
  // Un código nuevo se muestra de inmediato (hay que guardarlo) y aún no está copiado.
  if (shown !== code) {
    setShown(code);
    setCopied(false);
    setHidden(false);
  }
  return (
    <TelCard tone="navy" style={styles.codeCard}>
      <Tag tone="cream" icon="key" label="CÓDIGO DE RECUPERACIÓN" />
      <TelText
        variant={compact ? 'heading' : 'title'}
        color="cream"
        align="center"
        selectable={!hidden}
        accessibilityLabel={hidden ? 'Código de recuperación oculto' : `Código de recuperación: ${code.split('').join(' ')}`}
        style={[styles.code, font('display')]}
      >
        {hidden ? 'TEL-••••-••••-••••' : code}
      </TelText>
      <TelText variant="caption" color="accentSoft" align="center">
        Con este código entras a tu cuenta en otro teléfono. Guárdalo en un lugar seguro y no lo compartas: quien lo tenga puede usar tu cuenta.
      </TelText>
      <View style={styles.actions}>
        <TelButton label={hidden ? 'Mostrar código' : 'Ocultar código'} variant="outlineLight" size="sm" icon={hidden ? 'eye' : 'lock'} onPress={() => setHidden(!hidden)} />
        {!hidden && (
          <TelButton
            label={copied ? '¡Copiado!' : 'Copiar código'}
            variant="outlineLight"
            size="sm"
            icon={copied ? 'check' : 'share'}
            onPress={() => {
              void Clipboard.setStringAsync(code).then(
                () => setCopied(true),
                () => setCopied(false),
              );
            }}
          />
        )}
        {onRegenerate && <TelButton label="Alguien más lo vio: cambiar código" variant="ghostLight" size="sm" icon="refresh" loading={regenerating} onPress={onRegenerate} />}
      </View>
    </TelCard>
  );
}

const styles = StyleSheet.create({
  codeCard: {
    gap: spacing.sm,
    alignItems: 'stretch',
  },
  code: {
    letterSpacing: 1.5,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  actions: {
    gap: spacing.xs,
  },
});
