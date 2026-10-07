import { useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { Rutix } from '@/components/graphics/Rutix';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelText } from '@/components/TelText';
import { ApiError, type ProfilePayload } from '@/account/api';
import { AccountStorageError, createAccount, deleteAccount, editAccount, forgetAccount, regenerateRecoveryCode, useAccount } from '@/account/store';
import { AccountForm, type AccountFormValues } from '@/features/account/AccountForm';
import { RecoveryCodeCard } from '@/features/account/RecoveryCodeCard';
import { formatNumber } from '@/lib/format';
import { LoadError } from '@/components/feedback/LoadError';
import { useFocusData } from '@/lib/useFocusData';
import { DEFAULT_ALIAS, loadProfile } from '@/storage/profile';
import { spacing } from '@/theme';

function confirm(title: string, message: string, action: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}

// Mensaje para mostrar: los errores de la cuenta ya vienen redactados para el usuario.
function messageOf(caught: unknown, fallback: string): string {
  return caught instanceof ApiError || caught instanceof AccountStorageError ? caught.message : fallback;
}

// Crear o editar la cuenta (alias, avatar, curso, colegio y consentimiento de contacto).
export default function AccountScreen() {
  const account = useAccount();
  const { data: profile, error: profileError, reload } = useFocusData(loadProfile);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [rotating, setRotating] = useState(false);

  const editing = account.status === 'registered' && !createdCode;
  const player = account.player;

  async function submit(payload: ProfilePayload) {
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      if (editing) {
        await editAccount(payload);
        setSaved(true);
      } else {
        setCreatedCode(await createAccount(payload));
      }
    } catch (caught) {
      setError(messageOf(caught, 'No se pudo guardar. Intenta de nuevo.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function rotateCode() {
    if (rotating) return;
    setRotating(true);
    setError(null);
    try {
      await regenerateRecoveryCode();
    } catch (caught) {
      setError(messageOf(caught, 'No se pudo cambiar el código. Intenta de nuevo.'));
    } finally {
      setRotating(false);
    }
  }

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace('/home');
  }

  if (createdCode && player) {
    return (
      <Screen tone="dark" backdrop="orbits" header={<AppHeader transparent compact />}>
        <View style={styles.done}>
          <Rutix size={140} expression="celebrate" pose="celebrate" />
          <TelText variant="overline" color="accent" align="center">
            Cuenta creada
          </TelText>
          <TelText variant="title" color="cream" align="center">
            ¡Qué bueno tenerte aquí, {player.alias}!
          </TelText>
          <TelText variant="body" color="accentSoft" align="center">
            {account.rank ? `Partes en el lugar ${formatNumber(account.rank.rank)} de ${formatNumber(account.rank.total)} del ranking.` : 'Ya apareces en el ranking global.'}
          </TelText>
        </View>
        <RecoveryCodeCard code={createdCode} />
        <TelButton label="¡A jugar!" variant="cream" iconRight="arrowRight" onPress={leave} />
      </Screen>
    );
  }

  if (account.status === 'loading' || !profile) {
    return <Screen header={<AppHeader onBack={leave} kicker="Cuenta" title=" " />}>{profileError && <LoadError onRetry={reload} />}</Screen>;
  }

  if (account.status === 'expired') {
    return (
      <Screen header={<AppHeader onBack={leave} kicker="Cuenta" title="Sesión cerrada" />}>
        <TelCard style={styles.gap}>
          <TelText variant="body" color="ink">
            Tu cuenta se abrió en otro teléfono con el código de recuperación, así que este dejó de estar conectado. Tu progreso local sigue aquí.
          </TelText>
          <TelButton label="Entrar con mi código" icon="key" onPress={() => router.replace('/cuenta/recuperar')} />
          <TelButton label="Seguir sin cuenta" variant="outline" onPress={() => void forgetAccount().then(leave)} />
        </TelCard>
      </Screen>
    );
  }

  const initial: AccountFormValues = editing && player
    ? {
        alias: player.alias,
        avatar: player.avatar,
        grade: player.grade,
        school: player.school ?? '',
        wantsContact: player.contactConsent,
        contactKind: player.contact?.kind ?? 'email',
        contactValue: player.contact?.value ?? '',
        guardianConsent: player.guardianConsent,
      }
    : {
        alias: profile.alias === DEFAULT_ALIAS ? '' : profile.alias,
        avatar: profile.avatar,
        grade: null,
        school: '',
        wantsContact: false,
        contactKind: 'email',
        contactValue: '',
        guardianConsent: false,
      };

  return (
    <Screen
      keyboard
      header={
        <AppHeader
          onBack={leave}
          kicker={editing ? 'Tu cuenta' : 'Crea tu cuenta'}
          title={editing ? 'Datos de tu cuenta' : 'Que tu puntaje cuente'}
          subtitle={editing ? 'Cambia lo que quieras; los cambios se guardan en el servidor.' : 'Solo el alias es obligatorio. Tu progreso actual se suma a la cuenta.'}
        />
      }
    >
      {!editing && (
        <TelCard tone="accent" style={styles.intro}>
          <TelText variant="caption" color="ink">
            ¿Ya tienes cuenta en otro teléfono?
          </TelText>
          <TelButton label="Entrar con mi código" variant="outline" size="sm" icon="key" fullWidth={false} onPress={() => router.replace('/cuenta/recuperar')} />
        </TelCard>
      )}
      {editing && player?.contactError && (
        <TelCard tone="danger" style={styles.gap}>
          <TelText variant="caption" color="dangerInk" accessibilityLiveRegion="polite">
            No pudimos leer el contacto que tenías guardado. Escríbelo de nuevo y guarda, o desactiva las invitaciones.
          </TelText>
        </TelCard>
      )}
      <AccountForm
        key={editing ? `edit-${player?.id}` : 'create'}
        initial={initial}
        level={profile.level}
        achievements={profile.unlockedAchievements}
        submitLabel={editing ? (saved ? 'Guardado' : 'Guardar cambios') : 'Crear cuenta'}
        submitting={submitting}
        error={error}
        onSubmit={(payload) => void submit(payload)}
      />
      {editing && account.recoveryCode && (
        <RecoveryCodeCard
          code={account.recoveryCode}
          compact
          concealed
          regenerating={rotating}
          onRegenerate={() =>
            confirm(
              'Cambiar código de recuperación',
              'Se crea un código nuevo y el anterior deja de servir en el acto. Anota el nuevo: lo necesitarás para entrar a tu cuenta en otro teléfono.',
              'Cambiar código',
              () => void rotateCode(),
            )
          }
        />
      )}
      {editing && (
        <View style={styles.dangerZone}>
          <TelButton
            label="Cerrar sesión en este teléfono"
            variant="outline"
            icon="arrowLeft"
            onPress={() =>
              confirm(
                'Cerrar sesión',
                'Tu cuenta y tu puntaje siguen en el servidor. Para volver a entrar necesitarás tu código de recuperación.',
                'Cerrar sesión',
                () => void forgetAccount().then(leave),
              )
            }
          />
          <TelButton
            label="Eliminar mi cuenta y mis datos"
            variant="dangerOutline"
            icon="trash"
            onPress={() =>
              confirm(
                'Eliminar cuenta',
                'Se borrarán del servidor tu alias, curso, colegio, contacto y tu lugar en el ranking. Tu progreso local en este teléfono se mantiene. No se puede deshacer.',
                'Eliminar',
                () =>
                  void deleteAccount()
                    .then(leave)
                    .catch((caught: unknown) => setError(messageOf(caught, 'No se pudo eliminar la cuenta.'))),
              )
            }
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  done: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  gap: {
    gap: spacing.sm,
  },
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  dangerZone: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
