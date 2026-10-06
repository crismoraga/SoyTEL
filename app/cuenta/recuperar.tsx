import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { Rutix } from '@/components/graphics/Rutix';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { UserAvatar } from '@/components/UserAvatar';
import { ApiError, type ServerPlayer } from '@/account/api';
import { isRecoveryCode, RECOVERY_ALPHABET } from '@/account/rules';
import { restoreAccount } from '@/account/store';
import { formatNumber } from '@/lib/format';
import { colors, font, radius, spacing } from '@/theme';

// Lo escrito (o pegado) se limpia a 12 caracteres válidos agrupados de a 4; el prefijo TEL- es fijo.
function cleanInput(text: string): string {
  let raw = text.toUpperCase().trim();
  if (raw.startsWith('TEL-')) raw = raw.slice(4);
  const chars = raw.replace(new RegExp(`[^${RECOVERY_ALPHABET}]`, 'g'), '').slice(0, 12);
  return (chars.match(/.{1,4}/g) ?? []).join('-');
}

// Entrar a una cuenta existente con el código TEL-XXXX-XXXX-XXXX.
export default function RecoverScreen() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [player, setPlayer] = useState<ServerPlayer | null>(null);
  const fullCode = `TEL-${code}`;
  const valid = isRecoveryCode(fullCode);

  async function submit() {
    if (!valid) return;
    setLoading(true);
    setError(null);
    try {
      setPlayer(await restoreAccount(fullCode));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No se pudo entrar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace('/home');
  }

  if (player) {
    return (
      <Screen tone="dark" backdrop="orbits" header={<AppHeader transparent compact />}>
        <View style={styles.done}>
          <Rutix size={130} expression="happy" pose="wave" />
          <UserAvatar avatar={player.avatar} size={72} />
          <TelText variant="title" color="cream" align="center">
            ¡Hola de nuevo, {player.alias}!
          </TelText>
          <TelText variant="body" color="accentSoft" align="center">
            Recuperamos tu cuenta: {formatNumber(player.xp)} XP y {player.achievements.length} logros. Tu progreso de este teléfono también se conservó.
          </TelText>
        </View>
        <TelButton label="Continuar" variant="cream" iconRight="arrowRight" onPress={leave} />
      </Screen>
    );
  }

  return (
    <Screen keyboard header={<AppHeader onBack={leave} kicker="Ya tengo cuenta" title="Entra con tu código" subtitle="El código de recuperación que te mostró la app al crear tu cuenta." />}>
      <TelCard style={styles.card}>
        <TelText variant="label" color="ink" nativeID="recovery-code">
          Código de recuperación
        </TelText>
        <View style={styles.inputRow}>
          <TelText variant="heading" color="inkAccent" style={font('display')}>
            TEL-
          </TelText>
          <TextInput
            accessibilityLabel="Código de recuperación, sin el prefijo TEL"
            accessibilityLabelledBy="recovery-code"
            value={code}
            onChangeText={(text) => setCode(cleanInput(text))}
            placeholder="XXXX-XXXX-XXXX"
            placeholderTextColor={colors.slate}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
            style={[styles.input, font('display')]}
          />
        </View>
        {error && (
          <View style={styles.errorBox} accessibilityLiveRegion="polite">
            <TelIcon name="alert" size={18} color={colors.dangerInk} />
            <TelText variant="caption" color="dangerInk" style={styles.flex}>
              {error}
            </TelText>
          </View>
        )}
        <TelButton label="Entrar" icon="key" disabled={!valid} loading={loading} onPress={() => void submit()} />
        <TelText variant="small" color="inkSoft">
          Al entrar aquí, la cuenta se cierra en el teléfono donde estaba abierta. Tu progreso de este teléfono se suma a la cuenta.
        </TelText>
      </TelCard>
      <TelButton label="No tengo cuenta: crear una" variant="ghost" onPress={() => router.replace('/cuenta')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  done: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  card: {
    gap: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  input: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    color: colors.ink,
    paddingHorizontal: spacing.md,
    fontSize: 20,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
  flex: {
    flex: 1,
  },
});
