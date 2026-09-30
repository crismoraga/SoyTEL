import { memo, useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { medallionDrawing, type MedallionGlyph, type MedallionState, type MedallionTier } from '@/graphics/medallions';
import { SvgDrawing } from '@/graphics/ShapeLayer';

export type { MedallionGlyph, MedallionState, MedallionTier } from '@/graphics/medallions';

interface MedallionProps {
  glyph: MedallionGlyph;
  tier?: MedallionTier;
  state?: MedallionState;
  progress?: number;
  size?: number;
  ribbon?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const Medallion = memo(function Medallion({
  glyph,
  tier = 'crema',
  state = 'unlocked',
  progress = 0,
  size = 64,
  ribbon = false,
  style,
}: MedallionProps) {
  // El progreso se redondea a 5% para no regenerar la medalla en cada cambio mínimo.
  const rounded = Math.round(progress * 20) / 20;
  const drawing = useMemo(
    () => medallionDrawing({ glyph, tier, state, progress: rounded, ribbon }),
    [glyph, ribbon, rounded, state, tier],
  );
  return <SvgDrawing drawing={drawing} width={size} height={ribbon ? (size * 146) / 120 : size} style={style} />;
});
