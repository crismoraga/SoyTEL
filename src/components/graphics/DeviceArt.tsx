import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { colors } from '@/theme';

// Equipos y piezas de red que aparecen en los juegos (tarjetas de explicación, tableros).
export type DeviceKind =
  | 'router'
  | 'switch'
  | 'firewall'
  | 'dns'
  | 'accessPoint'
  | 'server'
  | 'pc'
  | 'laptop'
  | 'phone'
  | 'internet'
  | 'printer'
  | 'camera'
  | 'fiber'
  | 'antenna'
  | 'cable';

export const deviceLabels: Record<DeviceKind, string> = {
  router: 'Router',
  switch: 'Switch',
  firewall: 'Firewall',
  dns: 'Servidor DNS',
  accessPoint: 'Access point',
  server: 'Servidor',
  pc: 'Computador',
  laptop: 'Notebook',
  phone: 'Teléfono',
  internet: 'Internet',
  printer: 'Impresora',
  camera: 'Cámara',
  fiber: 'Fibra óptica',
  antenna: 'Antena',
  cable: 'Cable de red',
};

// Versión provisoria: el ícono del equipo dentro de un círculo. Se reemplaza por ilustraciones propias.
const fallbackIcons: Record<DeviceKind, IconName> = {
  router: 'router',
  switch: 'lanSwitch',
  firewall: 'shieldCheck',
  dns: 'book',
  accessPoint: 'accessPoint',
  server: 'server',
  pc: 'laptop',
  laptop: 'laptop',
  phone: 'phone',
  internet: 'globe',
  printer: 'board',
  camera: 'eye',
  fiber: 'fiber',
  antenna: 'antenna',
  cable: 'plug',
};

interface DeviceArtProps {
  device: DeviceKind;
  size?: number;
  // Color del trazo principal (sobre fondo oscuro, crema).
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export const DeviceArt = memo(function DeviceArt({ device, size = 64, color = colors.cream, style }: DeviceArtProps) {
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={deviceLabels[device]}
      style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderColor: color }, style]}
    >
      <TelIcon name={fallbackIcons[device]} size={Math.round(size * 0.55)} color={color} />
    </View>
  );
});

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    backgroundColor: 'rgba(167, 212, 237, 0.12)',
  },
});
