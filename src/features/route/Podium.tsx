import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, ZoomIn } from 'react-native-reanimated';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { formatNumber } from '@/lib/format';
import type { PublicPlayer } from '@/route/types';
import { colors, radius, spacing, tierColors } from '@/theme';
import { PlayerAvatar } from './parts';

const PLACE_STYLE = [
  { height: 132, tier: tierColors.oro, label: '1º' },
  { height: 100, tier: tierColors.plata, label: '2º' },
  { height: 78, tier: tierColors.bronce, label: '3º' },
];

// Podio final: 2º · 1º · 3º, con medallas de oro, plata y bronce.
export function Podium({ players, meId, large = false }: { players: PublicPlayer[]; meId?: string | null; large?: boolean }) {
  const top = players.slice(0, 3);
  const order = [top[1], top[0], top[2]];
  const scale = large ? 1.35 : 1;
  return (
    <View style={styles.podium}>
      {order.map((player, column) => {
        if (!player) return <View key={column} style={styles.column} />;
        const place = player.rank - 1;
        const style = PLACE_STYLE[Math.min(place, 2)];
        return (
          <Animated.View key={player.id} entering={FadeInUp.delay(300 + (2 - place) * 450).springify().damping(13)} style={styles.column}>
            <Animated.View entering={ZoomIn.delay(700 + (2 - place) * 450)} style={styles.crownWrap}>
              {place === 0 && <TelIcon name="crown" size={30 * scale} color={style.tier.ring[1]} />}
            </Animated.View>
            <PlayerAvatar avatar={player.avatar} size={(place === 0 ? 64 : 52) * scale} />
            <TelText variant={large ? 'heading' : 'label'} color="cream" align="center" numberOfLines={1}>
              {player.alias}
              {player.id === meId ? ' (tú)' : ''}
            </TelText>
            <TelText variant="caption" color="accentSoft" align="center" tabular>
              {formatNumber(player.total)} pts
            </TelText>
            <View style={[styles.block, { height: style.height * scale, backgroundColor: style.tier.ring[1], borderColor: style.tier.ring[0] }]}>
              <TelText variant={large ? 'hero' : 'title'} color="primary">
                {style.label}
              </TelText>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

export function Leaderboard({ players, meId, limit, dark = true }: { players: PublicPlayer[]; meId?: string | null; limit?: number; dark?: boolean }) {
  const list = limit ? players.slice(0, limit) : players;
  return (
    <View style={styles.list}>
      {list.map((player) => {
        const me = player.id === meId;
        return (
          <View key={player.id} style={[styles.row, dark ? styles.rowDark : styles.rowLight, me && styles.rowMe]}>
            <View style={[styles.rank, player.rank <= 3 && { backgroundColor: PLACE_STYLE[player.rank - 1].tier.ring[1] }]}>
              <TelText variant="label" color={player.rank <= 3 ? 'primary' : dark ? 'cream' : 'primary'} tabular>
                {player.rank}
              </TelText>
            </View>
            <PlayerAvatar avatar={player.avatar} size={34} online={player.online} />
            <TelText variant="label" color={dark ? 'cream' : 'primary'} style={styles.flex} numberOfLines={1}>
              {player.alias}
              {me ? ' (tú)' : ''}
            </TelText>
            <TelText variant="label" color={dark ? 'cream' : 'secondary'} tabular>
              {formatNumber(player.total)}
            </TelText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  crownWrap: {
    minHeight: 30,
    justifyContent: 'flex-end',
  },
  block: {
    alignSelf: 'stretch',
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginTop: 4,
  },
  list: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.md,
  },
  rowDark: {
    backgroundColor: colors.primarySoft,
  },
  rowLight: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowMe: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  rank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
});
