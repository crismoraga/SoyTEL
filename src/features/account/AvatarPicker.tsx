import { StyleSheet, View } from 'react-native';
import { PressableScale } from '@/components/PressableScale';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { UserAvatar } from '@/components/UserAvatar';
import { avatarCatalog, isAvatarUnlocked } from '@/data/avatars';
import { colors, radius, spacing } from '@/theme';

interface AvatarPickerProps {
  value: number;
  onChange: (avatar: number) => void;
  level: number;
  achievements: string[];
  size?: number;
  tone?: 'light' | 'dark';
}

// Grilla de avatares predefinidos; los bloqueados muestran cómo conseguirlos.
export function AvatarPicker({ value, onChange, level, achievements, size = 52, tone = 'light' }: AvatarPickerProps) {
  const dark = tone === 'dark';
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Elige tu avatar" style={styles.grid}>
      {avatarCatalog.map((avatar) => {
        const unlocked = isAvatarUnlocked(avatar, { level, achievements });
        const selected = avatar.id === value;
        return (
          <PressableScale
            key={avatar.id}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: !unlocked }}
            accessibilityLabel={unlocked ? avatar.label : `${avatar.label}, bloqueado. ${avatar.unlock?.hint ?? ''}`}
            disabled={!unlocked}
            haptic
            onPress={() => onChange(avatar.id)}
            style={[styles.cell, selected && (dark ? styles.selectedDark : styles.selected)]}
          >
            <UserAvatar avatar={avatar.id} size={size} ring={selected} dimmed={!unlocked} />
            {!unlocked && (
              <View style={styles.lock}>
                <TelIcon name="lock" size={12} color={colors.white} strokeWidth={2.6} />
              </View>
            )}
            <TelText variant="small" color={dark ? (selected ? 'cream' : 'accentSoft') : selected ? 'ink' : 'inkSoft'} align="center" numberOfLines={1} style={styles.label}>
              {unlocked ? avatar.label : (avatar.unlock?.level ? `Nivel ${avatar.unlock.level}` : 'Logro')}
            </TelText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  cell: {
    width: '20%',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: radius.md,
  },
  selected: {
    backgroundColor: colors.highlight,
  },
  selectedDark: {
    backgroundColor: colors.primarySoft,
  },
  lock: {
    position: 'absolute',
    top: 6,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.slate,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    paddingHorizontal: spacing.xxs,
  },
});
