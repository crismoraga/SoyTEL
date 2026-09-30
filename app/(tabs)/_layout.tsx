import { Tabs } from 'expo-router';
import { TelTabBar } from '@/components/TabBar';
import { colors } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TelTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        sceneStyle: { backgroundColor: colors.paper },
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="games" />
      <Tabs.Screen name="career" />
      <Tabs.Screen name="achievements" />
      <Tabs.Screen name="inbox" />
    </Tabs>
  );
}
