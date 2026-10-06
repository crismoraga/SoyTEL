import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initAccount } from '@/account/store';
import { ToastHost } from '@/components/feedback/ToastHost';
import { useRouteForeground } from '@/route/hooks';
import { routeMember } from '@/route/member';
import { loadInbox } from '@/storage/inbox';
import { initSettings } from '@/storage/settings';
import { colors, setFontsLoaded } from '@/theme';
import { fontAssets } from '@/theme/fontAssets';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const ready = fontsLoaded || Boolean(fontError);
  useRouteForeground();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.primary);
    void initSettings();
    void loadInbox();
    void initAccount();
    // Si la app se cerró en medio de una ruta, retoma la conexión con el stand.
    void routeMember.restore();
  }, []);

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  // Se fija antes de renderizar las pantallas para que todos los textos usen Montserrat/Nunito Sans.
  setFontsLoaded(fontsLoaded);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.primary }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.paper },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" options={{ animation: 'fade', contentStyle: { backgroundColor: colors.primary } }} />
          <Stack.Screen name="onboarding" options={{ animation: 'fade', contentStyle: { backgroundColor: colors.primary } }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="burst" options={{ animation: 'fade_from_bottom', gestureEnabled: false, contentStyle: { backgroundColor: colors.primary } }} />
          <Stack.Screen name="millionaire" options={{ animation: 'fade_from_bottom', contentStyle: { backgroundColor: colors.primary } }} />
          <Stack.Screen name="practice" />
          <Stack.Screen name="ruta/index" options={{ contentStyle: { backgroundColor: colors.paper } }} />
          <Stack.Screen name="ruta/juego" options={{ animation: 'fade_from_bottom', gestureEnabled: false, contentStyle: { backgroundColor: colors.primary } }} />
          <Stack.Screen name="ruta/stand" options={{ contentStyle: { backgroundColor: colors.primary } }} />
          <Stack.Screen name="estacion" options={{ animation: 'fade_from_bottom', gestureEnabled: false, contentStyle: { backgroundColor: colors.primary } }} />
          <Stack.Screen name="puzzle" options={{ animation: 'fade_from_bottom', contentStyle: { backgroundColor: colors.primary } }} />
          <Stack.Screen name="runner" options={{ animation: 'fade_from_bottom', gestureEnabled: false, contentStyle: { backgroundColor: colors.primary } }} />
          <Stack.Screen name="story" options={{ contentStyle: { backgroundColor: colors.primary } }} />
          <Stack.Screen name="mascot" options={{ contentStyle: { backgroundColor: colors.primary } }} />
          <Stack.Screen name="profile" />
          <Stack.Screen name="ranking" />
          <Stack.Screen name="malla" />
          <Stack.Screen name="privacidad" />
          <Stack.Screen name="ajustes" />
          <Stack.Screen name="cuenta/index" />
          <Stack.Screen name="cuenta/recuperar" />
        </Stack>
        <ToastHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
