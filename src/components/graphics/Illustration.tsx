import { memo, useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { illustrationDrawing, type IllustrationName } from '@/graphics/illustrations';
import { SvgDrawing } from '@/graphics/ShapeLayer';

export type { IllustrationName } from '@/graphics/illustrations';

interface IllustrationProps {
  name: IllustrationName;
  width?: number;
  tone?: 'light' | 'dark';
  style?: StyleProp<ViewStyle>;
}

export const Illustration = memo(function Illustration({ name, width = 220, tone = 'light', style }: IllustrationProps) {
  const drawing = useMemo(() => illustrationDrawing(name, tone), [name, tone]);
  return <SvgDrawing drawing={drawing} width={width} height={(width * drawing.h) / drawing.w} style={style} />;
});
