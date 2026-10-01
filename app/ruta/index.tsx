import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated from 'react-native-reanimated';
import { AppHeader } from '@/components/AppHeader';
import { Tag } from '@/components/Chips';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { aliasProblem, cleanAlias } from '@/account/rules';
import { AccountGate } from '@/features/account/AccountGate';
import { AvatarPicker } from '@/features/account/AvatarPicker';
import { CodeBoxes, RouteProgress } from '@/features/route/parts';
import { useEntering } from '@/lib/motion';
import { isValidJourneyCode, sanitizeJourneyCode } from '@/lib/progression';
import { routeStops } from '@/route/content';
import { useMemberView } from '@/route/hooks';
import { routeMember } from '@/route/member';
import { DEFAULT_ALIAS, loadProfile, updateIdentity } from '@/storage/profile';
import { colors, font, radius, spacing } from '@/theme';

// Punto de entrada de la Ruta Telemática: código del stand, alias y avatar.
export default function RouteLandingScreen() {
  const entering = useEntering();
  const params = useLocalSearchParams<{ codigo?: string; k?: string }>();
  const view = useMemberView();
  const [code, setCode] = useState(() => sanitizeJourneyCode(params.codigo ?? ''));
  const [alias, setAlias] = useState('');
  const [avatar, setAvatar] = useState(0);
  const [unlocks, setUnlocks] = useState<{ level: number; achievements: string[] }>({ level: 1, achievements: [] });
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const active = view.status !== 'idle' && view.code;

  useEffect(() => {
    void loadProfile().then((profile) => {
      setAlias((value) => value || (profile.alias === DEFAULT_ALIAS ? '' : profile.alias));
      setAvatar(profile.avatar);
      setUnlocks({ level: profile.level, achievements: profile.unlockedAchievements });
    });
  }, []);

  async function join() {
    if (!isValidJourneyCode(code)) {
      setError('El código tiene 6 caracteres (sin 0, 1, I ni O). Míralo en la pantalla del stand.');
      return;
    }
    const problem = aliasProblem(alias);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setJoining(true);
    const clean = cleanAlias(alias);
    // El alias y el avatar elegidos aquí quedan también en el perfil.
    await updateIdentity({ alias: clean, avatar });
    const fingerprint = params.codigo && sanitizeJourneyCode(params.codigo) === code ? (params.k ?? null) : null;
    await routeMember.join({ code, alias: clean, avatar, fingerprint });
    setJoining(false);
    router.push('/ruta/juego');
  }

  function playSolo() {
    routeMember.startSolo({ alias: alias.trim() || 'Explorador', avatar });
    router.push('/ruta/juego');
  }

  return (
    <Screen
      keyboard
      header={
        <AppHeader onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))} kicker="Ruta Telemática" title="Stand → B215 → B213 → Pasillo" subtitle="Juega en grupo y en vivo con el código del stand">
          <RouteProgress stop="stand" />
        </AppHeader>
      }
    >
      {active ? (
        <Animated.View entering={entering.fadeUp()}>
          <TelCard tone="navy" style={styles.resume}>
            <Tag tone="glass" live label={view.solo ? 'MODO INDIVIDUAL' : `RUTA ${view.code}`} />
            <TelText variant="heading" color="cream">
              Tienes una ruta en curso
            </TelText>
            <TelText variant="caption" color="accentSoft">
              Vuelve a la partida para seguir sumando puntos con tu grupo.
            </TelText>
            <TelButton label="Volver a la ruta" variant="cream" iconRight="arrowRight" onPress={() => router.push('/ruta/juego')} />
            <TelButton label="Salir de la ruta" variant="outlineLight" size="sm" onPress={() => void routeMember.leave()} />
          </TelCard>
        </Animated.View>
      ) : null}

      <Animated.View entering={entering.fadeUp(1)}>
        <TelCard style={styles.card}>
          <Tag tone="sky" icon="qr" label="ÚNETE AL GRUPO" />
          <TelText variant="heading" color="primary">
            Código del stand
          </TelText>
          <TelText variant="caption" color="muted">
            Está en la pantalla del stand de Ingeniería Civil Telemática. También puedes escanear su QR con la cámara.
          </TelText>
          <CodeBoxes value={code} onChange={(value) => {
            setCode(value);
            setError(null);
          }} autoFocus={!params.codigo} />

          <TelText variant="label" color="primary" style={styles.fieldLabel}>
            Tu alias para el ranking
          </TelText>
          <TextInput
            value={alias}
            onChangeText={(value) => {
              setAlias(value.slice(0, 18));
              setError(null);
            }}
            placeholder="Ej: Cami, Nico T., La Fibra"
            placeholderTextColor={colors.slate}
            maxLength={18}
            autoCorrect={false}
            autoFocus={Boolean(params.codigo)}
            returnKeyType="go"
            onSubmitEditing={() => void join()}
            accessibilityLabel="Tu alias"
            style={[styles.input, font('bodyBold')]}
          />

          <TelText variant="label" color="primary" style={styles.fieldLabel}>
            Elige tu avatar
          </TelText>
          <AvatarPicker value={avatar} onChange={setAvatar} level={unlocks.level} achievements={unlocks.achievements} size={44} />

          {error && (
            <TelText variant="caption" color="danger" accessibilityLiveRegion="polite">
              {error}
            </TelText>
          )}
          <TelButton label="Unirme a la ruta" iconRight="arrowRight" loading={joining} disabled={code.length !== 6} onPress={() => void join()} />
        </TelCard>
      </Animated.View>

      <Animated.View entering={entering.fadeUp(2)} style={styles.stops}>
        {routeStops.slice(1).map((stop) => (
          <View key={stop.id} style={styles.stop}>
            <View style={styles.stopIcon}>
              <TelIcon name={stop.icon} size={20} color={colors.secondary} />
            </View>
            <View style={styles.flex}>
              <TelText variant="label" color="primary">
                {stop.place} · {stop.title}
              </TelText>
              <TelText variant="caption" color="muted">
                {stop.summary}
              </TelText>
            </View>
          </View>
        ))}
      </Animated.View>

      <Animated.View entering={entering.fadeUp(3)} style={styles.extra}>
        <TelButton label="Jugar la ruta sin grupo" variant="subtle" icon="user" onPress={playSolo} />
        <TelButton label="Soy del equipo del stand" variant="ghost" icon="flag" size="sm" onPress={() => router.push('/ruta/stand')} />
      </Animated.View>
      {!active && <AccountGate />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    gap: 2,
  },
  resume: {
    gap: spacing.sm,
  },
  card: {
    gap: spacing.sm,
  },
  fieldLabel: {
    marginTop: spacing.xs,
  },
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.md,
    fontSize: 17,
    color: colors.primary,
  },
  stops: {
    gap: spacing.sm,
  },
  stop: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  stopIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extra: {
    gap: spacing.xs,
  },
});
