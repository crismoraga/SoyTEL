import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import { AppHeader } from '@/components/AppHeader';
import { ListRow, SectionHeader } from '@/components/Blocks';
import { brandImages } from '@/components/Brand';
import { Tag } from '@/components/Chips';
import { ProgressBar } from '@/components/feedback/Progress';
import { Medallion } from '@/components/graphics/Medallion';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { careerAreas, type CareerArea } from '@/data/career';
import { tipForDate } from '@/data/tips';
import { TipSheet } from '@/features/tips/TipSheet';
import { LINKS, openLink } from '@/lib/links';
import { useEntering } from '@/lib/motion';
import { useFocusData } from '@/lib/useFocusData';
import { AREA_MASTERY, isAreaMastered, loadCareerProgress, masteredAreas, type AreaProgress } from '@/storage/career';
import { colors, radius, shadows, spacing } from '@/theme';

function progressLine(area: CareerArea, progress: AreaProgress | undefined): string {
  if (!progress) return area.id === 'innovacion' ? 'Aún no completas un capítulo de la historia.' : 'Aún no practicas esta área.';
  const sessions = progress.sessions === 1 ? '1 práctica' : `${progress.sessions} prácticas`;
  const best = `mejor resultado ${Math.round(progress.best * 100)} %`;
  return progress.best >= AREA_MASTERY ? `${sessions} · ${best} · ¡dominada!` : `${sessions} · ${best} · logra 60 % para dominarla`;
}

// Pantalla "Conoce la carrera": el avance de cada área se marca al practicarla, no al leerla.
export default function CareerScreen() {
  const entering = useEntering();
  const [selectedId, setSelectedId] = useState<CareerArea['id']>('redes');
  const [tipOpen, setTipOpen] = useState(false);
  const { data: progress } = useFocusData(loadCareerProgress);
  const selected = careerAreas.find((area) => area.id === selectedId) ?? careerAreas[0];
  const selectedProgress = progress?.[selected.id];
  const tip = tipForDate(new Date());
  const mastered = masteredAreas(progress).filter((id) => careerAreas.some((area) => area.id === id)).length;

  function practice(area: CareerArea) {
    if (area.id === 'innovacion') {
      router.push('/story');
      return;
    }
    router.push({ pathname: '/practice', params: { area: area.id } });
  }

  return (
    <Screen
      inTabs
      header={
        <AppHeader
          kicker="Conoce la carrera"
          title="Ingeniería Civil Telemática"
          art={<Image source={brandImages.spotCareer} style={styles.headerArt} resizeMode="cover" accessibilityLabel="Ilustración de la carrera" />}
        >
          <TelText variant="caption" color="onDark">
            Forma profesionales capaces de diseñar, integrar y gestionar tecnologías de redes y comunicaciones para un mundo más conectado.
          </TelText>
        </AppHeader>
      }
    >
      <View style={styles.section}>
        <SectionHeader title="Áreas de la carrera" subtitle={`${mastered}/${careerAreas.length} dominadas`} />
        <View style={styles.grid}>
          {careerAreas.map((area, index) => {
            const active = area.id === selected.id;
            const done = isAreaMastered(progress, area.id);
            const tried = Boolean(progress?.[area.id]);
            return (
              <Animated.View key={area.id} entering={entering.pop(index)} style={styles.cell}>
                <PressableScale
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${area.name}${done ? ', dominada' : tried ? ', en práctica' : ''}`}
                  haptic
                  onPress={() => setSelectedId(area.id)}
                  style={[styles.areaButton, active && styles.areaActive]}
                >
                  <Medallion glyph={area.glyph} size={60} />
                  <TelText variant="small" color="ink" align="center">
                    {area.short}
                  </TelText>
                  {done ? (
                    <View style={[styles.badge, styles.badgeDone]}>
                      <TelIcon name="check" size={11} color={colors.white} strokeWidth={3.4} />
                    </View>
                  ) : tried ? (
                    <View style={[styles.badge, styles.badgeTried]} />
                  ) : null}
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>
        <ProgressBar progress={mastered / careerAreas.length} accessibilityLabel="Áreas dominadas" />
        <TelText variant="caption" color="inkSoft">
          Un área queda dominada cuando logras 3 de 5 correctas en su práctica.
        </TelText>
      </View>

      <Animated.View key={selected.id} entering={entering.fadeUp()}>
        <TelCard style={styles.detail}>
          <View style={styles.detailHead}>
            <Medallion glyph={selected.glyph} size={56} />
            <View style={styles.flex}>
              <TelText variant="heading" color="ink">
                {selected.name}
              </TelText>
              <TelText variant="label" color="inkAccent">
                {selected.tagline}
              </TelText>
            </View>
          </View>
          <TelText variant="body" color="inkSoft">
            {selected.description}
          </TelText>
          <View style={styles.examples}>
            <TelText variant="small" color="ink" style={styles.kicker}>
              ¿QUÉ HACE UN TELEMÁTICO AQUÍ?
            </TelText>
            {selected.examples.map((example) => (
              <View key={example} style={styles.example}>
                <View style={styles.exampleIcon}>
                  <TelIcon name="check" size={14} color={colors.successInk} strokeWidth={3} />
                </View>
                <TelText variant="caption" color="ink" style={styles.flex}>
                  {example}
                </TelText>
              </View>
            ))}
          </View>
          <View style={styles.progressRow}>
            <TelIcon name={isAreaMastered(progress, selected.id) ? 'checkCircle' : 'target'} size={18} color={isAreaMastered(progress, selected.id) ? colors.success : colors.inkAccent} />
            <TelText variant="caption" color={isAreaMastered(progress, selected.id) ? 'successInk' : 'inkAccent'} style={styles.flex}>
              {progressLine(selected, selectedProgress)}
            </TelText>
          </View>
          <TelButton label={selected.practiceLabel} icon={selected.id === 'innovacion' ? 'book' : 'target'} iconRight="chevronRight" onPress={() => practice(selected)} />
        </TelCard>
      </Animated.View>

      <TelCard tone="navy" style={styles.tip} onPress={() => setTipOpen(true)} accessibilityLabel={`Dato del día: ${tip.text}. Toca para leerlo completo`}>
        <View style={styles.tipHead}>
          <Tag tone="glass" icon="lightbulb" label="DATO DEL DÍA" />
          <TelIcon name="arrowRight" size={18} color={colors.accentSoft} />
        </View>
        <TelText variant="bodyStrong" color="cream" numberOfLines={3}>
          {tip.text}
        </TelText>
      </TelCard>

      <View style={styles.section}>
        <SectionHeader title="¿Te interesa postular?" />
        <ListRow
          icon="grid"
          title="Malla interactiva"
          body="Los 10 semestres ramo por ramo: toca cada uno para ver qué aprenderás."
          trailing={<TelIcon name="chevronRight" size={18} color={colors.ink} />}
          onPress={() => router.push('/malla')}
        />
        <ListRow
          icon="school"
          title="La carrera en usm.cl"
          body="Malla oficial, perfil de egreso, campus y requisitos de Telemática."
          trailing={<TelIcon name="external" size={18} color={colors.ink} />}
          onPress={() => void openLink(LINKS.career)}
        />
        <ListRow
          icon="flag"
          title="Admisión USM"
          body="Fechas, vías de ingreso, becas y beneficios."
          trailing={<TelIcon name="external" size={18} color={colors.ink} />}
          onPress={() => void openLink(LINKS.admission)}
        />
      </View>

      <TipSheet tip={tip} visible={tipOpen} onClose={() => setTipOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerArt: {
    width: 104,
    height: 122,
    borderRadius: radius.md,
  },
  section: {
    gap: spacing.sm,
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
  areaButton: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  areaActive: {
    backgroundColor: colors.highlight,
    borderWidth: 2,
    borderColor: colors.inkAccent,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDone: {
    backgroundColor: colors.success,
  },
  badgeTried: {
    width: 12,
    height: 12,
    top: 10,
    right: 10,
    backgroundColor: colors.warning,
  },
  detail: {
    borderWidth: 1.5,
    borderColor: colors.inkAccent,
    gap: 14,
    ...shadows.soft,
  },
  detailHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  examples: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  kicker: {
    letterSpacing: 1.2,
  },
  example: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  exampleIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tip: {
    gap: spacing.xs,
  },
  tipHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
