import { RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/Blocks';
import { Tag } from '@/components/Chips';
import { SkeletonText } from '@/components/feedback/Skeleton';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { UserAvatar } from '@/components/UserAvatar';
import type { LeaderboardEntry } from '@/account/api';
import { useAccount } from '@/account/store';
import { useLeaderboard } from '@/account/useLeaderboard';
import { formatNumber } from '@/lib/format';
import { useEntering } from '@/lib/motion';
import { colors, radius, spacing } from '@/theme';

const MEDALS = ['#E0B84A', '#AFC0CD', '#C98A5A'];

function PodiumSpot({ entry, height }: { entry: LeaderboardEntry; height: number }) {
  const color = MEDALS[entry.rank - 1] ?? colors.accent;
  return (
    <View style={styles.spot} accessible accessibilityLabel={`Lugar ${entry.rank}: ${entry.alias}, ${entry.xp} XP`}>
      {entry.rank === 1 && <TelIcon name="crown" size={26} color={MEDALS[0]} />}
      <UserAvatar avatar={entry.avatar} size={entry.rank === 1 ? 70 : 58} style={[styles.spotAvatar, { borderColor: color }]} />
      <TelText variant="label" color="cream" align="center" numberOfLines={1} style={styles.spotName}>
        {entry.alias}
        {entry.me ? ' (tú)' : ''}
      </TelText>
      <TelText variant="small" color="accentSoft" align="center" tabular>
        {formatNumber(entry.xp)} XP
      </TelText>
      <View style={[styles.pedestal, { height, backgroundColor: color }]}>
        <TelText variant="title" color="primary">
          {entry.rank}
        </TelText>
      </View>
    </View>
  );
}

function Row({ entry }: { entry: LeaderboardEntry }) {
  return (
    <View style={[styles.row, entry.me && styles.rowMe]} accessible accessibilityLabel={`Lugar ${entry.rank}: ${entry.alias}, nivel ${entry.level}, ${entry.xp} XP`}>
      <TelText variant="label" color="secondary" tabular style={styles.rank}>
        {entry.rank}
      </TelText>
      <UserAvatar avatar={entry.avatar} size={40} ring={entry.me} />
      <View style={styles.flex}>
        <TelText variant="label" color="primary" numberOfLines={1}>
          {entry.alias}
          {entry.me ? ' (tú)' : ''}
        </TelText>
        <TelText variant="small" color="muted">
          Nivel {entry.level}
        </TelText>
      </View>
      <TelText variant="label" color="primary" tabular>
        {formatNumber(entry.xp)} XP
      </TelText>
    </View>
  );
}

// Ranking global de XP entre todas las personas con cuenta en SoyTEL.
export default function RankingScreen() {
  const entering = useEntering();
  const account = useAccount();
  const board = useLeaderboard(50);
  const data = board.data;
  const top = data?.top ?? [];
  const podium = top.slice(0, 3);
  const rest = top.slice(3);
  const me = data?.me ?? null;
  const meVisible = top.some((entry) => entry.me);

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={board.refreshing} onRefresh={board.refresh} tintColor={colors.accent} colors={[colors.secondary]} />}
      header={
        <AppHeader onBack={() => router.back()} kicker="Ranking global" title="Tabla de experiencia" subtitle={data ? `${formatNumber(data.total)} jugadores con cuenta` : 'Todos los jugadores de SoyTEL'}>
          {podium.length > 0 && (
            <View style={styles.podium}>
              {podium[1] && <PodiumSpot entry={podium[1]} height={54} />}
              {podium[0] && <PodiumSpot entry={podium[0]} height={78} />}
              {podium[2] && <PodiumSpot entry={podium[2]} height={40} />}
            </View>
          )}
        </AppHeader>
      }
    >
      {account.status === 'registered' && me && (
        <Animated.View entering={entering.fadeUp()}>
          <TelCard tone="navy" style={styles.meCard}>
            <UserAvatar avatar={me.avatar} size={56} />
            <View style={styles.flex}>
              <TelText variant="overline" color="accent">
                Tu posición
              </TelText>
              <TelText variant="title" color="cream" tabular>
                #{formatNumber(me.rank)}
                <TelText variant="body" color="accentSoft">
                  {' '}
                  de {formatNumber(data?.total ?? 0)}
                </TelText>
              </TelText>
              <TelText variant="caption" color="accentSoft">
                {formatNumber(me.xp)} XP · nivel {me.level}
              </TelText>
            </View>
            <Tag tone="glass" icon="refresh" label="Se actualiza al jugar" />
          </TelCard>
        </Animated.View>
      )}

      {account.status === 'guest' && (
        <TelCard tone="accent" style={styles.cta}>
          <TelIcon name="trophy" size={28} color={colors.secondary} />
          <View style={styles.flex}>
            <TelText variant="subtitle" color="primary">
              Aparece en el ranking
            </TelText>
            <TelText variant="caption" color="secondary">
              Crea tu cuenta (solo un alias) y tu XP se suma a la tabla.
            </TelText>
          </View>
          <TelButton label="Crear" size="sm" fullWidth={false} onPress={() => router.push('/cuenta')} />
        </TelCard>
      )}

      {account.status === 'expired' && (
        <TelCard tone="danger" style={styles.cta}>
          <TelText variant="caption" color="dangerInk" style={styles.flex}>
            Tu cuenta se abrió en otro teléfono. Entra de nuevo con tu código para seguir sumando.
          </TelText>
          <TelButton label="Entrar" size="sm" variant="danger" fullWidth={false} onPress={() => router.push('/cuenta/recuperar')} />
        </TelCard>
      )}

      {board.loading && (
        <TelCard>
          <SkeletonText lines={6} />
        </TelCard>
      )}

      {board.error && !data && (
        <EmptyState illustration="offline" title="Sin conexión con el ranking" body={board.error} actionLabel="Reintentar" onAction={board.refresh} />
      )}

      {data && top.length === 0 && (
        <EmptyState illustration="trophy" title="Aún no hay jugadores" body="Crea tu cuenta y juega: serás el primero en la tabla." actionLabel="Jugar" onAction={() => router.navigate('/games')} />
      )}

      {rest.length > 0 && (
        <TelCard padded={false} style={styles.list}>
          {rest.map((entry) => (
            <Row key={`${entry.rank}-${entry.alias}`} entry={entry} />
          ))}
        </TelCard>
      )}

      {me && !meVisible && account.status === 'registered' && (
        <View style={styles.gap}>
          <TelText variant="caption" color="muted" align="center">
            …
          </TelText>
          <TelCard padded={false} style={styles.list}>
            <Row entry={me} />
          </TelCard>
        </View>
      )}

      <TelText variant="small" color="muted" align="center">
        Solo se muestran alias, avatar, nivel y XP. El XP se suma con cada partida de cualquier modo.
      </TelText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  spot: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    maxWidth: 120,
  },
  spotAvatar: {
    borderWidth: 3,
  },
  spotName: {
    maxWidth: '100%',
  },
  pedestal: {
    alignSelf: 'stretch',
    marginTop: 4,
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meCard: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  list: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowMe: {
    backgroundColor: colors.highlight,
  },
  rank: {
    width: 30,
    textAlign: 'center',
  },
  gap: {
    gap: spacing.xs,
  },
});
