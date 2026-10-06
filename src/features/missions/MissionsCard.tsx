import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ProgressBar } from '@/components/feedback/Progress';
import { PressableScale } from '@/components/PressableScale';
import { TelButton } from '@/components/TelButton';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { dailyKey } from '@/features/burst/daily';
import { MISSION_REWARD_DATA, missionStates } from '@/lib/dailyMissions';
import { feedbackSuccess } from '@/lib/feedback';
import { formatNumber } from '@/lib/format';
import { claimMissionReward, loadMissionClaim } from '@/storage/missions';
import { colors, radius, spacing } from '@/theme';
import type { GameResult } from '@/types/game';

interface MissionsCardProps {
  results: GameResult[];
  // Se llama después de entregar la recompensa (para refrescar la señal de Rutix).
  onClaimed?: () => void;
}

// Misiones de hoy: tres metas que propone Rutix. Va sobre fondos azul noche.
export function MissionsCard({ results, onClaimed }: MissionsCardProps) {
  const [today] = useState(() => new Date());
  const day = dailyKey(today);
  const [claimedOn, setClaimedOn] = useState<string | null | undefined>(undefined);
  const states = missionStates(results, today);
  const done = states.filter((state) => state.done).length;
  const claimed = claimedOn === day;

  useEffect(() => {
    let active = true;
    void loadMissionClaim().then((value) => {
      if (active) setClaimedOn(value);
    });
    return () => {
      active = false;
    };
  }, []);

  async function claim() {
    if (await claimMissionReward(day)) void feedbackSuccess();
    setClaimedOn(day);
    onClaimed?.();
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <TelText variant="small" color="accent" style={styles.kicker}>
            MISIONES DE HOY · {done} DE {states.length}
          </TelText>
          <TelText variant="subtitle" color="cream">
            {claimed ? '¡Misiones cumplidas!' : done === states.length ? 'Rutix tiene tu recompensa' : 'Rutix te propone tres metas'}
          </TelText>
        </View>
        <View style={styles.reward} accessible accessibilityLabel={`Recompensa: ${MISSION_REWARD_DATA} paquetes de datos`}>
          <TelIcon name="packet" size={14} color={colors.primary} />
          <TelText variant="small" color="primary" tabular>
            +{MISSION_REWARD_DATA}
          </TelText>
        </View>
      </View>
      {states.map(({ mission, value, done: complete }) => (
        <PressableScale
          key={mission.id}
          accessibilityRole="button"
          accessibilityLabel={`${mission.title}. ${complete ? 'Lista' : `${formatNumber(value)} de ${formatNumber(mission.goal)}`}`}
          disabled={complete}
          onPress={() => router.push(mission.route)}
          style={styles.row}
        >
          <View style={[styles.icon, complete && styles.iconDone]}>
            <TelIcon name={complete ? 'check' : mission.icon} size={18} color={complete ? colors.white : colors.primary} strokeWidth={complete ? 3 : 2} />
          </View>
          <View style={styles.flex}>
            <TelText variant="label" color={complete ? 'accentSoft' : 'cream'}>
              {mission.title}
            </TelText>
            {mission.goal > 1 && !complete && (
              <ProgressBar progress={value / mission.goal} color={colors.accent} trackColor={colors.primary} height={5} accessibilityLabel={`Avance de ${mission.title}`} />
            )}
          </View>
          {!complete && <TelIcon name="chevronRight" size={18} color={colors.accentSoft} />}
        </PressableScale>
      ))}
      {done === states.length && claimedOn !== undefined && !claimed && (
        <TelButton label={`Reclamar ${MISSION_REWARD_DATA} paquetes`} variant="cream" icon="packet" size="sm" onPress={() => void claim()} />
      )}
      {claimed && (
        <TelText variant="caption" color="accentSoft" align="center">
          Recompensa guardada. Mañana Rutix trae misiones nuevas.
        </TelText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    gap: 4,
  },
  card: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  kicker: {
    letterSpacing: 1.2,
    fontSize: 11,
  },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: '#F2CE63',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingVertical: 6,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: 'rgba(11, 45, 69, 0.55)',
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  iconDone: {
    backgroundColor: colors.success,
  },
});
