import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, shadows, textStyle } from '@/theme';
import { TelText } from './TelText';

export const brandImages = {
  logo: require('../../assets/brand/logo-app.png'),
  badge: require('../../assets/brand/badge.png'),
  splash: require('../../assets/brand/splash-bg.jpg'),
  campusNight: require('../../assets/brand/campus-night.jpg'),
  onboardingHero: require('../../assets/brand/onboarding-hero.jpg'),
  banner: require('../../assets/brand/banner.jpg'),
  spotLabs: require('../../assets/brand/spot-labs.jpg'),
  spotEvents: require('../../assets/brand/spot-events.jpg'),
  spotCareer: require('../../assets/brand/spot-career.jpg'),
};

// Logotipo "SoyTEL": "Soy" en crema y "TEL" en celeste (pantalla de bienvenida de Claude Design).
export function Wordmark({ size = 22, onLight = false }: { size?: number; onLight?: boolean }) {
  const base = [textStyle('display'), { fontSize: size, lineHeight: Math.round(size * 1.12), letterSpacing: -size * 0.03 }];
  return (
    <TelText accessibilityRole="header" accessibilityLabel="SoyTEL" style={base}>
      <TelText style={[base, { color: onLight ? colors.primary : colors.cream }]}>Soy</TelText>
      <TelText style={[base, { color: onLight ? colors.secondary : colors.accent }]}>TEL</TelText>
    </TelText>
  );
}

export function AppLogo({ size = 38, style, shadow = false }: { size?: number; style?: StyleProp<ViewStyle>; shadow?: boolean }) {
  const rounded = size * 0.24;
  return (
    <View style={[{ width: size, height: size, borderRadius: rounded }, shadow && shadows.logo, style]}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: rounded, overflow: 'hidden' }]}>
        <Image source={brandImages.logo} style={{ width: size, height: size }} resizeMode="cover" accessibilityLabel="Logo Telemática USM" />
      </View>
    </View>
  );
}
