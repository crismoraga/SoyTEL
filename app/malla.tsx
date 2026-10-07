import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { ChipGroup, Tag } from '@/components/Chips';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import {
  courses,
  coursesBySemester,
  cycleEnding,
  MALLA_SPECIALIZATIONS,
  mallaAreaOrder,
  mallaAreas,
  pillarCoverage,
  semesters,
  type Course,
  type MallaArea,
} from '@/data/malla';
import { LINKS, openLink } from '@/lib/links';
import { pillarInfo, pillars } from '@/route/content';
import { colors, radius, spacing } from '@/theme';

type Filter = 'all' | MallaArea;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todo' },
  ...mallaAreaOrder.map((area) => ({ id: area, label: mallaAreas[area].short })),
];

const coverage = pillarCoverage();
const maxCoverage = Math.max(...Object.values(coverage));

// Malla interactiva: los 10 semestres con todos sus ramos; al tocar uno se explica qué se ve en él.
export default function MallaScreen() {
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Course | null>(null);
  const [open, setOpen] = useState(false);

  function show(course: Course) {
    setSelected(course);
    setOpen(true);
  }

  const area = selected ? mallaAreas[selected.area] : null;
  const pillar = selected?.pillar ? pillarInfo(selected.pillar) : null;

  return (
    <Screen
      header={
        <AppHeader onBack={() => router.back()} kicker="Ingeniería Civil Telemática · 2026" title="Malla interactiva" subtitle="Toca un ramo para saber de qué se trata">
          <View style={styles.stats}>
            <Tag tone="glass" icon="book" label={`${courses.filter((course) => course.kind !== 'practica').length} asignaturas`} />
            <Tag tone="glass" icon="calendar" label="10 semestres" />
            <Tag tone="glass" icon="steps" label="2 prácticas" />
          </View>
        </AppHeader>
      }
    >
      <TelCard style={styles.gap}>
        <TelText variant="heading" color="ink">
          Ves de todo: los cinco pilares
        </TelText>
        <TelText variant="caption" color="inkSoft">
          Ramos de la carrera ligados a cada pilar de Telemática, los mismos de la sala B213.
        </TelText>
        {pillars.map((item) => (
          <View key={item.id} style={styles.pillarRow}>
            <View style={[styles.pillarIcon, { backgroundColor: item.color }]}>
              <TelIcon name={item.icon} size={16} color={colors.primary} />
            </View>
            <TelText variant="label" color="ink" numberOfLines={1} style={styles.pillarName}>
              {item.pillar}
            </TelText>
            <View style={styles.pillarTrack}>
              <View style={[styles.pillarFill, { width: `${(coverage[item.id] / maxCoverage) * 100}%`, backgroundColor: item.color }]} />
            </View>
            <TelText variant="label" color="inkAccent" tabular style={styles.pillarCount}>
              {coverage[item.id]}
            </TelText>
          </View>
        ))}
      </TelCard>

      <ChipGroup accessibilityLabel="Filtrar por tipo de ramo" options={FILTERS} value={filter} onChange={setFilter} inset={spacing.md} />

      {semesters.map((semester) => {
        const items = coursesBySemester(semester.number);
        const cycle = cycleEnding(semester.number);
        return (
          <View key={semester.number} style={styles.semester}>
            <View style={styles.semesterHead}>
              <View style={styles.semesterBadge}>
                <TelText variant="label" color="actionInk">
                  {semester.roman}
                </TelText>
              </View>
              <TelText variant="heading" color="ink" style={styles.flex}>
                Semestre {semester.roman}
              </TelText>
              <TelText variant="caption" color="inkSoft">
                Año {semester.year}
              </TelText>
            </View>
            <View style={styles.grid}>
              {items.map((course) => {
                const info = mallaAreas[course.area];
                const dimmed = filter !== 'all' && filter !== course.area;
                return (
                  <PressableScale
                    key={course.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${course.name}. ${info.label}. Ver descripción`}
                    onPress={() => show(course)}
                    scaleTo={0.97}
                    style={[styles.course, { backgroundColor: info.tint, borderLeftColor: info.color }, dimmed && styles.dimmed]}
                  >
                    <TelText variant="small" color="ink" numberOfLines={3} style={[styles.courseName, { color: info.ink }]}>
                      {course.name}
                    </TelText>
                    {course.pillar && (
                      <View style={[styles.courseDot, { backgroundColor: pillarInfo(course.pillar).color }]} />
                    )}
                  </PressableScale>
                );
              })}
            </View>
            {cycle && (
              <View style={styles.cycle}>
                <TelIcon name="flag" size={14} color={colors.inkAccent} />
                <TelText variant="caption" color="inkAccent" style={styles.flex}>
                  <TelText variant="caption" color="ink">
                    {cycle.label}:{' '}
                  </TelText>
                  {cycle.summary}
                </TelText>
              </View>
            )}
          </View>
        );
      })}

      <TelCard tone="navy" style={styles.gap}>
        <Tag tone="glass" icon="sparkles" label="ELECTIVOS DISCIPLINARES" />
        <TelText variant="body" color="cream">
          En los últimos semestres te especializas en una línea:
        </TelText>
        <View style={styles.specializations}>
          {MALLA_SPECIALIZATIONS.map((item) => (
            <Tag key={item} tone="glass" label={item} />
          ))}
        </View>
      </TelCard>

      <TelText variant="caption" color="inkSoft" align="center">
        Información referencial basada en la malla 2026 publicada por la USM. Revisa la versión oficial antes de postular.
      </TelText>
      <TelButton label="Ver la carrera en usm.cl" icon="external" onPress={() => void openLink(LINKS.career)} />
      <TelButton label="Admisión USM" variant="outline" icon="school" onPress={() => void openLink(LINKS.admission)} />

      <Sheet visible={open} onClose={() => setOpen(false)} accessibilityLabel="Detalle del ramo">
        {selected && area && (
          <View style={styles.sheet}>
            <View style={styles.sheetTags}>
              <Tag tone="sky" icon="calendar" label={`Semestre ${semesters[selected.semester - 1]?.roman}`} />
              <View style={[styles.areaTag, { backgroundColor: area.tint }]}>
                <View style={[styles.areaDot, { backgroundColor: area.color }]} />
                <TelText variant="small" style={{ color: area.ink }}>
                  {area.label}
                </TelText>
              </View>
            </View>
            <TelText variant="title" color="ink">
              {selected.name}
            </TelText>
            <TelText variant="body" color="inkSoft">
              {selected.description}
            </TelText>
            {pillar && (
              <View style={[styles.pillarBox, { borderColor: pillar.color }]}>
                <View style={[styles.pillarIcon, { backgroundColor: pillar.color }]}>
                  <TelIcon name={pillar.icon} size={16} color={colors.primary} />
                </View>
                <TelText variant="caption" color="ink" style={styles.flex}>
                  Pilar {pillar.pillar}: en la ruta lo juegas con «{pillar.game}» en la sala B213.
                </TelText>
              </View>
            )}
            <TelButton label="Entendido" onPress={() => setOpen(false)} />
          </View>
        )}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  gap: {
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  pillarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pillarIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillarName: {
    flex: 1,
  },
  pillarTrack: {
    width: '38%',
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  pillarFill: {
    height: '100%',
    borderRadius: 4,
  },
  pillarCount: {
    width: 22,
    textAlign: 'right',
  },
  semester: {
    gap: spacing.xs,
  },
  semesterHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  semesterBadge: {
    minWidth: 40,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 15,
    backgroundColor: colors.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  course: {
    width: '48.5%',
    flexGrow: 1,
    minHeight: 64,
    borderRadius: radius.sm,
    borderLeftWidth: 5,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 18,
    justifyContent: 'center',
  },
  courseName: {
    fontSize: 12.5,
    lineHeight: 16,
  },
  courseDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dimmed: {
    opacity: 0.28,
  },
  cycle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.highlight,
  },
  specializations: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  sheet: {
    gap: spacing.sm,
  },
  sheetTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  areaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  areaDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pillarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
  },
});
