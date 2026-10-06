import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppHeader } from '@/components/AppHeader';
import { ChipGroup } from '@/components/Chips';
import { ProgressBar, ProgressRing } from '@/components/feedback/Progress';
import { SkeletonGrid } from '@/components/feedback/Skeleton';
import { Medallion, type MedallionState } from '@/components/graphics/Medallion';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { TelButton } from '@/components/TelButton';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { achievements } from '@/data/achievements';
import { achievementProgress, type AchievementContext } from '@/lib/achievements';
import { useEntering } from '@/lib/motion';
import { useFocusData } from '@/lib/useFocusData';
import { loadAchievementContext } from '@/storage/profile';
import { colors, radius, spacing, tierColors, type Tier } from '@/theme';
import type { Achievement } from '@/types/game';

type Filter = 'all' | 'done' | 'prog' | 'lock';

interface Row {
  achievement: Achievement;
  status: Exclude<Filter, 'all'>;
  current: number;
  ratio: number;
}

function buildRows(context: AchievementContext): Row[] {
  return achievements.map((achievement) => {
    const unlocked = context.profile.unlockedAchievements.includes(achievement.id);
    const current = Math.min(achievementProgress(achievement.id, context), achievement.threshold);
    const status: Row['status'] = unlocked ? 'done' : current > 0 ? 'prog' : 'lock';
    return { achievement, status, current, ratio: current / achievement.threshold };
  });
}

const medalState: Record<Row['status'], MedallionState> = { done: 'unlocked', prog: 'progress', lock: 'locked' };

// Pantalla "Mis logros" de Claude Design: resumen con anillo, filtros y grilla de medallas.
export default function AchievementsScreen() {
  const entering = useEntering();
  const [filter, setFilter] = useState<Filter>('all');
  const [detail, setDetail] = useState<Row | null>(null);
  const { data: context } = useFocusData(() => loadAchievementContext());
  const rows = context ? buildRows(context) : [];
  const done = rows.filter((row) => row.status === 'done').length;
  const visible = rows.filter((row) => filter === 'all' || row.status === filter);
  const count = (status: Filter) => (status === 'all' ? rows.length : rows.filter((row) => row.status === status).length);

  return (
    <Screen
      inTabs
      header={
        <AppHeader kicker="Sistema de logros" title="Mis logros">
          <View style={styles.summary}>
            <ProgressRing progress={rows.length ? done / rows.length : 0} size={64} accessibilityLabel="Logros desbloqueados">
              <TelText variant="subtitle" color="cream" tabular>
                {done}/{achievements.length}
              </TelText>
            </ProgressRing>
            <View style={styles.flex}>
              <TelText variant="subtitle" color="cream">
                {done === 1 ? '1 logro desbloqueado' : `${done} logros desbloqueados`}
              </TelText>
              <TelText variant="caption" color="accentSoft">
                Cada logro te acerca a un mejor futuro.
              </TelText>
            </View>
          </View>
        </AppHeader>
      }
    >
      <ChipGroup
        accessibilityLabel="Filtrar logros"
        value={filter}
        onChange={setFilter}
        inset={spacing.md}
        options={[
          { id: 'all', label: 'Todos', count: count('all') },
          { id: 'done', label: 'Obtenidos', count: count('done') },
          { id: 'prog', label: 'En progreso', count: count('prog') },
          { id: 'lock', label: 'Bloqueados', count: count('lock') },
        ]}
      />

      {context ? (
        <View style={styles.grid}>
          {visible.map((row, index) => (
            <Animated.View key={row.achievement.id} entering={entering.pop(index)} style={styles.cell}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${row.achievement.title}. ${row.status === 'done' ? 'Obtenido' : row.status === 'prog' ? `${row.current} de ${row.achievement.threshold}` : 'Bloqueado'}`}
                haptic
                onPress={() => setDetail(row)}
                style={styles.card}
              >
                <Medallion glyph={row.achievement.glyph} tier={row.achievement.tier} state={medalState[row.status]} progress={row.ratio} size={76} />
                <TelText variant="small" color="ink" align="center" numberOfLines={2} style={styles.name}>
                  {row.achievement.title}
                </TelText>
                {row.status === 'done' && (
                  <View style={styles.status}>
                    <TelIcon name="check" size={13} color={colors.successInk} strokeWidth={3} />
                    <TelText variant="small" color="successInk" style={styles.statusText}>
                      Obtenido
                    </TelText>
                  </View>
                )}
                {row.status === 'prog' && (
                  <View style={styles.progress}>
                    <ProgressBar progress={row.ratio} height={5} style={styles.bar} />
                    <TelText variant="small" color="inkAccent" style={styles.statusText} tabular>
                      {row.current} de {row.achievement.threshold}
                    </TelText>
                  </View>
                )}
                {row.status === 'lock' && (
                  <View style={styles.status}>
                    <TelIcon name="lock" size={13} color={colors.inkSoft} strokeWidth={2.4} />
                    <TelText variant="small" color="inkSoft" style={styles.statusText}>
                      Bloqueado
                    </TelText>
                  </View>
                )}
              </PressableScale>
            </Animated.View>
          ))}
        </View>
      ) : (
        <SkeletonGrid items={9} />
      )}

      <View style={styles.legend}>
        <TelText variant="heading" color="ink">
          Niveles de rareza
        </TelText>
        <View style={styles.legendRow}>
          {(['bronce', 'plata', 'oro', 'platino'] as Tier[]).map((tier) => (
            <View key={tier} style={styles.legendItem}>
              <Medallion glyph="star" tier={tier} size={52} />
              <TelText variant="small" color="ink">
                {tierColors[tier].label}
              </TelText>
            </View>
          ))}
        </View>
      </View>

      <Sheet visible={detail !== null} onClose={() => setDetail(null)} accessibilityLabel="Detalle del logro">
        {detail && (
          <View style={styles.sheetBody}>
            <Medallion
              glyph={detail.achievement.glyph}
              tier={detail.achievement.tier}
              state={medalState[detail.status]}
              progress={detail.ratio}
              size={132}
              ribbon
            />
            <TelText variant="small" color="inkAccent" style={styles.tier}>
              LOGRO {tierColors[detail.achievement.tier].label.toUpperCase()}
            </TelText>
            <TelText variant="title" color="ink" align="center">
              {detail.achievement.title}
            </TelText>
            <TelText variant="body" color="inkSoft" align="center">
              {detail.achievement.description}
            </TelText>
            {detail.status !== 'done' && (
              <View style={styles.sheetProgress}>
                <ProgressBar progress={detail.ratio} />
                <TelText variant="caption" color="inkAccent" align="center">
                  {detail.current} de {detail.achievement.threshold} · {detail.achievement.hint}
                </TelText>
              </View>
            )}
            <TelButton label="Entendido" onPress={() => setDetail(null)} />
          </View>
        )}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
  },
  flex: {
    flex: 1,
    gap: 3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  cell: {
    width: '33.33%',
    padding: 5,
  },
  card: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 168,
  },
  name: {
    minHeight: 32,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 11,
  },
  progress: {
    width: '100%',
    alignItems: 'center',
    gap: 4,
  },
  bar: {
    width: '80%',
  },
  legend: {
    gap: spacing.sm,
    marginTop: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendItem: {
    alignItems: 'center',
    gap: 4,
  },
  sheetBody: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  tier: {
    letterSpacing: 1.4,
  },
  sheetProgress: {
    alignSelf: 'stretch',
    gap: 6,
  },
});
