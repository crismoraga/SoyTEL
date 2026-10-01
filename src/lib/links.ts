import { Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { colors } from '@/theme';

// Enlaces oficiales usados en la app.
export const LINKS = {
  career: 'https://usm.cl/admision/carreras/ingenieria-civil-telematica/',
  admission: 'https://admision.usm.cl',
  usm: 'https://www.usm.cl',
  didactic: 'https://d1ft3l.cl',
} as const;

// Abre un enlace externo: navegador integrado en Android/iOS (se vuelve a la app con "cerrar")
// y pestaña nueva en la web.
export async function openLink(url: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.open?.(url, '_blank', 'noopener,noreferrer');
    return;
  }
  try {
    await WebBrowser.openBrowserAsync(url, {
      toolbarColor: colors.primary,
      controlsColor: colors.cream,
      secondaryToolbarColor: colors.primary,
      enableBarCollapsing: true,
      showTitle: true,
    });
  } catch {
    await Linking.openURL(url);
  }
}
