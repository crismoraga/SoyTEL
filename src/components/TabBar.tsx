import { useState } from 'react';
import { Animated, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import type { NavigationHelpers, ParamListBase, TabNavigationState } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnreadCount } from '@/storage/inbox';
import { colors, spacing } from '@/theme';
import { PressableScale } from './PressableScale';
import { TelIcon, type IconName } from './TelIcon';
import { TelText } from './TelText';

export const TAB_ORDER = ['home', 'games', 'career', 'achievements', 'inbox'] as const;
export type TabName = (typeof TAB_ORDER)[number];

const tabs: Record<TabName, { label: string; icon: IconName }> = {
  home: { label: 'Inicio', icon: 'home' },
  games: { label: 'Jugar', icon: 'gamepad' },
  career: { label: 'Carrera', icon: 'school' },
  achievements: { label: 'Logros', icon: 'trophy' },
  inbox: { label: 'Avisos', icon: 'bell' },
};

function isTab(name: string): name is TabName {
  return (TAB_ORDER as readonly string[]).includes(name);
}

type TabEvents = {
  tabPress: { data: undefined; canPreventDefault: true };
  tabLongPress: { data: undefined };
};

interface TabDescriptor {
  options: { title?: string; tabBarAccessibilityLabel?: string };
}

export interface TelTabBarProps {
  state: TabNavigationState<ParamListBase>;
  navigation: NavigationHelpers<ParamListBase, TabEvents>;
  descriptors: Record<string, TabDescriptor | undefined>;
  // Índice animado del deslizador (0…n-1, con decimales mientras se desliza entre pestañas).
  position?: Animated.AnimatedInterpolation<number>;
}

const INSET = 4;

// Barra inferior: el botón activo se marca completo (fondo azul noche con ícono y texto crema)
// y la marca sigue al dedo cuando se desliza entre secciones.
export function TelTabBar({ state, navigation, descriptors, position }: TelTabBarProps) {
  const insets = useSafeAreaInsets();
  const unread = useUnreadCount();
  const [width, setWidth] = useState(0);
  const routes = state.routes.filter((route) => isTab(route.name));
  const count = routes.length;
  const cell = count > 0 ? width / count : 0;
  const focusedKey = state.routes[state.index]?.key;
  const focusedIndex = Math.max(0, routes.findIndex((route) => route.key === focusedKey));

  const translateX =
    position && count > 1
      ? position.interpolate({
          inputRange: routes.map((_, index) => index),
          outputRange: routes.map((_, index) => index * cell),
          extrapolate: 'clamp',
        })
      : focusedIndex * cell;

  function onLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.xs) + 2 }]}>
      <View accessibilityRole="tablist" style={styles.row} onLayout={onLayout}>
        {width > 0 && (
          <Animated.View pointerEvents="none" style={[styles.indicator, { width: cell - INSET * 2, transform: [{ translateX }] }]} />
        )}
        {routes.map((route) => {
          const name = route.name as TabName;
          const config = tabs[name];
          const focused = route.key === focusedKey;
          const showDot = name === 'inbox' && unread > 0;
          const options = descriptors[route.key]?.options;
          const label = options?.title ?? config.label;

          function onPress() {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate({ name: route.name, params: route.params, merge: true });
            }
          }

          function onLongPress() {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          }

          return (
            <PressableScale
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options?.tabBarAccessibilityLabel ?? (showDot ? `${label}, ${unread} sin leer` : label)}
              onPress={onPress}
              onLongPress={onLongPress}
              haptic
              scaleTo={0.94}
              style={styles.item}
            >
              <View>
                <TelIcon name={config.icon} size={22} color={focused ? colors.actionInk : colors.inkSoft} strokeWidth={focused ? 2.3 : 2} />
                {showDot && <View style={[styles.dot, focused && styles.dotOnDark]} />}
              </View>
              <TelText variant="small" color={focused ? 'actionInk' : 'inkSoft'} style={styles.label} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                {label}
              </TelText>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
    paddingHorizontal: 6,
  },
  row: {
    flexDirection: 'row',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: INSET,
    borderRadius: 16,
    backgroundColor: colors.action,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 54,
    paddingVertical: 6,
    borderRadius: 16,
  },
  dot: {
    position: 'absolute',
    top: -3,
    right: -6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  dotOnDark: {
    borderColor: colors.action,
  },
  label: {
    fontSize: 11,
  },
});
