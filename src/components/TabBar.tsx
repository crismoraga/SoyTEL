import { StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnreadCount } from '@/storage/inbox';
import { colors, spacing } from '@/theme';
import { PressableScale } from './PressableScale';
import { TelIcon, type IconName } from './TelIcon';
import { TelText } from './TelText';

const tabs: Record<string, { label: string; icon: IconName }> = {
  home: { label: 'Inicio', icon: 'home' },
  games: { label: 'Jugar', icon: 'gamepad' },
  career: { label: 'Carrera', icon: 'school' },
  achievements: { label: 'Logros', icon: 'trophy' },
  inbox: { label: 'Avisos', icon: 'bell' },
};

// Barra de navegación inferior del diseño "Inicio": ícono dentro de una píldora celeste al estar activo.
export function TelTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const unread = useUnreadCount();

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
    >
      {state.routes.map((route, index) => {
        const config = tabs[route.name];
        if (!config) return null;
        const focused = state.index === index;
        const showDot = route.name === 'inbox' && unread > 0;

        function onPress() {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        }

        return (
          <PressableScale
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={showDot ? `${config.label}, ${unread} sin leer` : config.label}
            onPress={onPress}
            haptic
            style={styles.item}
          >
            <View style={[styles.pill, focused && styles.pillActive]}>
              <TelIcon name={config.icon} size={22} color={focused ? colors.primary : colors.muted} />
              {showDot && <View style={styles.dot} />}
            </View>
            <TelText variant="small" color={focused ? 'primary' : 'muted'} style={styles.label}>
              {config.label}
            </TelText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingHorizontal: 6,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    minHeight: 48,
  },
  pill: {
    width: 54,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: colors.highlight,
  },
  dot: {
    position: 'absolute',
    top: 1,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  label: {
    fontSize: 11,
  },
});
