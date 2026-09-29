import { useState } from 'react';
import { Image, Linking, StyleSheet, View } from 'react-native';
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
import { ADMISSION_URL, careerAreas, USM_URL, type CareerArea } from '@/data/career';
import { tipForDate } from '@/data/tips';
import { useEntering } from '@/lib/motion';
import { useFocusData } from '@/lib/useFocusData';
import { loadViewedAreas, markAreaViewed } from '@/storage/career';
import { syncAchievements } from '@/storage/profile';
import { colors, radius, shadows, spacing } from '@/theme';

// Pantalla "Conoce la carrera" de Claude Design, con contenido real de cada área.
export default function CareerScreen() {
  const entering = useEntering();
  const [selectedId, setSelectedId] = useState<CareerArea['id']>('redes');
  const { data: viewed, setData: setViewed } = useFocusData(loadViewedAreas);
  const selected = careerAreas.find((area) => area.id === selectedId) ?? careerAreas[0];
  const tip = tipForDate(new Date());

  async function select(area: CareerArea) {
    setSelectedId(area.id);
    const updated = await markAreaViewed(area.id);
    setViewed(updated);
    if (updated.length >= careerAreas.length) {
      await syncAchievements();
    }
  }

  function practice(area: CareerArea) {
    if (area.id === 'innovacion') {
      router.push('/story');
      return;
    }
    router.push({ pathname: '/practice', params: { area: area.id } });
  }

  const viewedCount = viewed?.length ?? 0;

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
        <SectionHeader title="Áreas de la carrera" subtitle={`${viewedCount}/${careerAreas.length} exploradas`} />
        <View style={styles.grid}>
          {careerAreas.map((area, index) => {
            const active = area.id === selected.id;
            const seen = viewed?.includes(area.id) ?? false;
            return (
              <Animated.View key={area.id} entering={entering.pop(index)} style={styles.cell}>
                <PressableScale
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${area.name}${seen ? ', explorada' : ''}`}
                  haptic
                  onPress={() => void select(area)}
                  style={[styles.areaButton, active && styles.areaActive]}
                >
                  <Medallion glyph={area.glyph} size={60} />
                  <TelText variant="small" color="primary" align="center">
                    {area.short}
                  </TelText>
                  {seen && !active && (
                    <View style={styles.seenBadge}>
                      <TelIcon name="check" size={11} color={colors.white} strokeWidth={3.4} />
                    </View>
                  )}
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>
        <ProgressBar progress={viewedCount / careerAreas.length} accessibilityLabel="Áreas exploradas" />
      </View>

      <Animated.View key={selected.id} entering={entering.fadeUp()}>
        <TelCard style={styles.detail}>
          <View style={styles.detailHead}>
            <Medallion glyph={selected.glyph} size={56} />
            <View style={styles.flex}>
              <TelText variant="heading" color="primary">
                {selected.name}
              </TelText>
              <TelText variant="label" color="secondary">
                {selected.tagline}
              </TelText>
            </View>
          </View>
          <TelText variant="body" color="muted">
            {selected.description}
          </TelText>
          <View style={styles.examples}>
            <TelText variant="small" color="primary" style={styles.kicker}>
              ¿QUÉ HACE UN TELEMÁTICO AQUÍ?
            </TelText>
            {selected.examples.map((example) => (
              <View key={example} style={styles.example}>
                <View style={styles.exampleIcon}>
                  <TelIcon name="check" size={14} color={colors.successInk} strokeWidth={3} />
                </View>
                <TelText variant="caption" color="primary" style={styles.flex}>
                  {example}
                </TelText>
              </View>
            ))}
          </View>
          <TelButton label={selected.practiceLabel} variant="subtle" icon={selected.id === 'innovacion' ? 'book' : 'target'} iconRight="chevronRight" onPress={() => practice(selected)} />
        </TelCard>
      </Animated.View>

      <TelCard tone="navy" style={styles.tip}>
        <Tag tone="glass" icon="lightbulb" label="DATO DEL DÍA" />
        <TelText variant="bodyStrong" color="cream">
          {tip.text}
        </TelText>
      </TelCard>

      <View style={styles.section}>
        <SectionHeader title="¿Te interesa postular?" />
        <ListRow
          icon="school"
          title="Admisión USM"
          body="Tu futuro comienza aquí: fechas, requisitos y vías de ingreso."
          trailing={<TelIcon name="external" size={18} color={colors.primary} />}
          onPress={() => void Linking.openURL(ADMISSION_URL)}
        />
        <ListRow
          icon="globe"
          title="Universidad Técnica Federico Santa María"
          body="Becas, beneficios y vida universitaria."
          trailing={<TelIcon name="external" size={18} color={colors.primary} />}
          onPress={() => void Linking.openURL(USM_URL)}
        />
      </View>
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
    borderColor: colors.secondary,
  },
  seenBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detail: {
    borderWidth: 1.5,
    borderColor: colors.secondary,
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
  tip: {
    gap: spacing.xs,
  },
});
