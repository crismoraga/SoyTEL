import { memo, useMemo } from 'react';
import { View } from 'react-native';
import { create } from 'qrcode';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors } from '@/theme';

// Margen en blanco alrededor del código, en módulos. El estándar pide 4: con menos, algunas cámaras
// no lo leen cuando el fondo de la pantalla es oscuro.
const QUIET_ZONE = 4;

// Trazado del código con su margen. `count` es el lado total en módulos (código + margen a ambos lados).
export function buildQr(value: string): { path: string; count: number; modules: number } {
  const qr = create(value, { errorCorrectionLevel: 'M' });
  const modules = qr.modules;
  let d = '';
  for (let row = 0; row < modules.size; row += 1) {
    for (let column = 0; column < modules.size; column += 1) {
      if (modules.get(row, column)) d += `M${column + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
    }
  }
  return { path: d, count: modules.size + QUIET_ZONE * 2, modules: modules.size };
}

// Código QR dibujado con SVG (sin imágenes): el stand lo muestra para unirse desde la cámara.
export const QrCode = memo(function QrCode({ value, size = 220, color = colors.primary, background = colors.white }: { value: string; size?: number; color?: string; background?: string }) {
  const { path, count } = useMemo(() => buildQr(value), [value]);

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Código QR para unirse: ${value}`}>
      <Svg width={size} height={size} viewBox={`0 0 ${count} ${count}`}>
        <Rect width={count} height={count} fill={background} />
        <Path d={path} fill={color} />
      </Svg>
    </View>
  );
});
