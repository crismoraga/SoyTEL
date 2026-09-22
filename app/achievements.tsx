import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { TelCard } from '@/components/TelCard';
import { TelText } from '@/components/TelText';
import { achievements } from '@/data/achievements';
import { loadProfile, loadResults } from '@/storage/profile';
import { loadMascotDays } from '@/storage/story';
import { colors, radius, spacing } from '@/theme';
import type { Achievement, GameResult, UserProfile } from '@/types/game';

const tierColors: Record<Achievement['tier'], string> = {
  bronce: '#B0805A',
  plata: '#A7B7C4',
  oro: '#D6A92E',
  platino: '#6FB3D9',
};

function achievementProgress(id: string, profile: UserProfile, results: GameResult[], mascotDays: number): number {
  switch (id) {
    case 'first-signal':
      return Math.min(1, results.length);
    case 'burst-starter':
      return results.filter((item) => item.gameId === 'burst').length;
    case 'quiz-bronze':
      return results
        .filter((item) => item.gameId === 'millionaire')
        .reduce((total, item) => total + Number(item.metadata?.correctAnswers ?? 0), 0);
    case 'journey-host':
      return results.filter((item) => item.gameId === 'journey').length;
    case 'perfect-run':
      return results.some((item) => item.accuracy >= 1) ? 1 : 0;
    case 'level-five':
      return profile.level;
    case 'signal-restored':
      return results.some((item) => item.gameId === 'story' && Number(item.metadata?.chapter ?? 0) >= 3)
        ? 3
        : 0;
    case 'telix-friend':
      return mascotDays;
    default:
      return 0;
  }
}

export default function AchievementsScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [results, setResults] = useState<GameResult[]>([]);
  const [mascotDays, setMascotDays] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void Promise.all([loadProfile(), loadResults(), loadMascotDays()]).then(([p, r, days]) => {
        if (active) {
          setProfile(p);
          setResults(r);
          setMascotDays(days.length);
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const unlocked = profile?.unlockedAchievements ?? [];

  return (
    <Screen>
      <TelText variant="overline" color="secondary">Sala de trofeos</TelText>
      <TelText variant="title" color="primary">Logros y medallas</TelText>
      <TelText color="muted">
        {unlocked.length}/{achievements.length} desbloqueados. Cada medalla celebra un hábito real de un telemático.
      </TelText>

      {achievements.map((achievement) => {
        const isUnlocked = unlocked.includes(achievement.id);
        const current = profile
          ? achievementProgress(achievement.id, profile, results, mascotDays)
          : 0;
        const ratio = Math.min(1, current / achievement.threshold);

        return (
          <TelCard key={achievement.id} tone={isUnlocked ? 'cream' : 'light'}>
            <View style={styles.row}>
              <View style={[styles.medal, { backgroundColor: isUnlocked ? tierColors[achievement.tier] : 'rgba(102,113,124,0.15)' }]}>
                <Ionicons
                  color={isUnlocked ? colors.white : colors.muted}
                  name={isUnlocked ? 'medal' : 'lock-closed'}
                  size={26}
                />
              </View>
              <View style={styles.body}>
                <View style={styles.titleRow}>
                  <TelText variant="bodyStrong" color={isUnlocked ? 'primary' : 'muted'}>
                    {achievement.title}
                  </TelText>
                  <View style={[styles.tierChip, { borderColor: tierColors[achievement.tier] }]}>
                    <TelText variant="caption" style={{ color: tierColors[achievement.tier] }}>
                      {achievement.tier}
                    </TelText>
                  </View>
                </View>
                <TelText variant="caption" color="muted">{achievement.description}</TelText>
                {!isUnlocked && (
                  <View style={styles.progressTrack} accessibilityLabel={`Progreso ${current} de ${achievement.threshold}`}>
                    <View style={[styles.progressFill, { width: `${Math.max(4, ratio * 100)}%` }]} />
                  </View>
                )}
                {!isUnlocked && achievement.threshold > 1 && (
                  <TelText variant="caption" color="secondary">{current}/{achievement.threshold}</TelText>
                )}
              </View>
            </View>
          </TelCard>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  medal: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  tierChip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(11,45,69,0.1)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.secondary,
  },
});
