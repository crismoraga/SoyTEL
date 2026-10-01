import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import { TopTabs } from 'expo-router/js-top-tabs';
import { SignalSpinner } from '@/components/feedback/Loaders';
import { TelTabBar, type TelTabBarProps } from '@/components/TabBar';
import { useMotionLevel } from '@/lib/motion';
import { colors } from '@/theme';

function TabPlaceholder() {
  return (
    <View style={styles.placeholder}>
      <SignalSpinner size={44} />
    </View>
  );
}

// Secciones principales en un deslizador horizontal (como pasar del feed a reels en Instagram):
// se cambia de pestaña deslizando o con la barra inferior.
export default function TabsLayout() {
  const level = useMotionLevel();
  return (
    <TopTabs
      tabBarPosition="bottom"
      tabBar={(props: TelTabBarProps) => <TelTabBar {...props} />}
      initialLayout={{ width: Dimensions.get('window').width }}
      keyboardDismissMode="on-drag"
      overScrollMode="never"
      screenOptions={{
        // En la web el gesto compite con el desplazamiento del navegador: ahí se navega con la barra.
        swipeEnabled: Platform.OS !== 'web',
        animationEnabled: level !== 'minimal',
        lazy: true,
        lazyPreloadDistance: level === 'minimal' ? 0 : 1,
        lazyPlaceholder: TabPlaceholder,
        sceneStyle: { backgroundColor: colors.paper },
      }}
    >
      <TopTabs.Screen name="home" />
      <TopTabs.Screen name="games" />
      <TopTabs.Screen name="career" />
      <TopTabs.Screen name="achievements" />
      <TopTabs.Screen name="inbox" />
    </TopTabs>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },
});
