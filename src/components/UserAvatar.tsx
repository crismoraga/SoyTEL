import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { avatarDef } from '@/data/avatars';
import { colors } from '@/theme';
import { Rutix } from './graphics/Rutix';
import { TelIcon } from './TelIcon';

interface UserAvatarProps {
  avatar: number;
  size?: number;
  // Anillo crema de las hojas de marca (avatares circulares).
  ring?: boolean;
  dimmed?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

// Avatar circular del jugador (perfil, ruta, ranking).
export const UserAvatar = memo(function UserAvatar({ avatar, size = 44, ring = true, dimmed = false, style, accessibilityLabel }: UserAvatarProps) {
  const def = avatarDef(avatar);
  const border = ring ? Math.max(2, Math.round(size * 0.06)) : 0;
  return (
    <View
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: def.color, borderWidth: border },
        dimmed && styles.dimmed,
        style,
      ]}
    >
      {def.icon === 'rutix' ? (
        <Rutix size={size * 0.92} expression="happy" signal={2} animated={false} accessibilityLabel="" style={styles.rutix} />
      ) : (
        <TelIcon name={def.icon} size={size * 0.5} color={colors.primary} strokeWidth={2.2} />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.cream,
    overflow: 'hidden',
  },
  rutix: {
    marginTop: '12%',
  },
  dimmed: {
    opacity: 0.45,
  },
});
