import { useState } from 'react';
import { StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Tag } from '@/components/Chips';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelText } from '@/components/TelText';
import { colors, font, radius, spacing } from '@/theme';

// Código de recuperación de la cuenta, con botón para copiarlo.
export function RecoveryCodeCard({ code, compact = false }: { code: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <TelCard tone="navy" style={styles.codeCard}>
      <Tag tone="cream" icon="key" label="CÓDIGO DE RECUPERACIÓN" />
      <TelText variant={compact ? 'heading' : 'title'} color="cream" align="center" selectable style={[styles.code, font('display')]}>
        {code}
      </TelText>
      <TelText variant="caption" color="accentSoft" align="center">
        Con este código entras a tu cuenta en otro teléfono. Guárdalo (una foto sirve) y no lo compartas: quien lo tenga puede usar tu cuenta.
      </TelText>
      <TelButton
        label={copied ? '¡Copiado!' : 'Copiar código'}
        variant="outlineLight"
        size="sm"
        icon={copied ? 'check' : 'share'}
        onPress={() => {
          void Clipboard.setStringAsync(code);
          setCopied(true);
        }}
      />
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
});
