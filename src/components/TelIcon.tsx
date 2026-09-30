import { memo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { G } from 'react-native-svg';
import { icons, type IconName } from '@/graphics/icons';
import { ShapeLayer } from '@/graphics/ShapeLayer';
import { colors } from '@/theme';

export type { IconName } from '@/graphics/icons';

interface TelIconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export const TelIcon = memo(function TelIcon({
  name,
  size = 24,
  color = colors.primary,
  strokeWidth = 2,
  style,
  accessibilityLabel,
}: TelIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      color={color}
      style={style}
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
    >
      <G fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        <ShapeLayer shapes={icons[name]} />
      </G>
    </Svg>
  );
});
