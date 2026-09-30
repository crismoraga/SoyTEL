import { memo, useMemo } from 'react';
import { View } from 'react-native';
import { create } from 'qrcode';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors } from '@/theme';

// Código QR dibujado con SVG (sin imágenes): el stand lo muestra para unirse desde la cámara.
export const QrCode = memo(function QrCode({ value, size = 220, color = colors.primary, background = colors.white }: { value: string; size?: number; color?: string; background?: string }) {
  const { path, count } = useMemo(() => {
    const qr = create(value, { errorCorrectionLevel: 'M' });
    const modules = qr.modules;
    let d = '';
    for (let row = 0; row < modules.size; row += 1) {
      for (let column = 0; column < modules.size; column += 1) {
        if (modules.get(row, column)) d += `M${column + 2} ${row + 2}h1v1h-1z`;
      }
    }
    return { path: d, count: modules.size + 4 };
  }, [value]);

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Código QR para unirse: ${value}`}>
      <Svg width={size} height={size} viewBox={`0 0 ${count} ${count}`}>
        <Rect width={count} height={count} fill={background} />
        <Path d={path} fill={color} />
      </Svg>
    </View>
  );
});
