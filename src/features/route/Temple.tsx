import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { TelText } from '@/components/TelText';
import { SvgDrawing } from '@/graphics/ShapeLayer';
import { templeDrawing } from '@/graphics/temple';
import { pillars } from '@/route/content';
import type { PillarId } from '@/route/types';

// Templo de Telemática (como en Didactic-Tel): cada pilar se enciende al completar su proyecto en B213.
export const Temple = memo(function Temple({ lit, width = 320 }: { lit: Partial<Record<PillarId, boolean>>; width?: number }) {
  const drawing = useMemo(() => templeDrawing(pillars.map((pillar) => ({ color: pillar.color, lit: Boolean(lit[pillar.id]) }))), [lit]);
  const count = pillars.filter((pillar) => lit[pillar.id]).length;
  return (
    <View style={styles.wrap} accessible accessibilityRole="image" accessibilityLabel={`Templo de Telemática: ${count} de 5 pilares encendidos`}>
      <SvgDrawing drawing={drawing} width={width} height={(width / 320) * 196} />
      <View style={[styles.labels, { width }]}>
        {pillars.map((pillar) => (
          <TelText key={pillar.id} variant="small" color={lit[pillar.id] ? 'cream' : 'slate'} align="center" style={styles.label} numberOfLines={1} adjustsFontSizeToFit>
            {pillar.pillar === 'Telecomunicaciones' ? 'Teleco' : pillar.pillar}
          </TelText>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  labels: {
    flexDirection: 'row',
    marginTop: 4,
  },
  label: {
    flex: 1,
    fontSize: 11,
  },
});
