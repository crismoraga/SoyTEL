import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initSettings } from '@/storage/settings';
import { colors } from '@/theme';

export default function RootLayout() {
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.primary);
    void initSettings();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.primary },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="home" />
        <Stack.Screen name="games" />
        <Stack.Screen name="burst" />
        <Stack.Screen name="millionaire" />
        <Stack.Screen name="journey" />
        <Stack.Screen name="story" />
        <Stack.Screen name="mascot" />
        <Stack.Screen name="achievements" />
        <Stack.Screen name="profile" />
      </Stack>
    </SafeAreaProvider>
  );
}
