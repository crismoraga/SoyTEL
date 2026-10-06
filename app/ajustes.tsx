import { Alert, Platform, StyleSheet, Switch, View } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { ListRow } from '@/components/Blocks';
import { ChipGroup } from '@/components/Chips';
import { Rutix } from '@/components/graphics/Rutix';
import { Screen } from '@/components/Screen';
import { TelButton } from '@/components/TelButton';
import { TelCard } from '@/components/TelCard';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { suggestedMotionLevel, useMotionLevel, type MotionLevel } from '@/lib/motion';
import { paceLabels } from '@/lib/pace';
import { resetAllData } from '@/storage/reset';
import { updateSettings, useSettings, type GamePace, type MotionPreference, type ThemePreference } from '@/storage/settings';
import { colors, currentTheme, spacing } from '@/theme';
import { setThemePreference } from '@/theme/themeStore';

const THEME_OPTIONS: { id: ThemePreference; label: string; icon: IconName }[] = [
  { id: 'system', label: 'Del teléfono', icon: 'settings' },
  { id: 'light', label: 'Claro', icon: 'lightbulb' },
  { id: 'dark', label: 'Oscuro', icon: 'moon' },
];

const PACE_OPTIONS: { id: GamePace; label: string }[] = (['relaxed', 'calm', 'normal', 'fast'] as GamePace[]).map((id) => ({ id, label: paceLabels[id].label }));

const MOTION_OPTIONS: { id: MotionPreference; label: string }[] = [
  { id: 'auto', label: 'Automático' },
  { id: 'full', label: 'Completas' },
  { id: 'balanced', label: 'Equilibradas' },
  { id: 'minimal', label: 'Mínimas' },
];

const motionCopy: Record<MotionLevel, string> = {
  full: 'Todo en movimiento: estrellas que titilan, Rutix con ondas y confeti completo.',
  balanced: 'Transiciones breves y Rutix flotando; sin adornos en bucle. Ideal para la mayoría de los teléfonos.',
  minimal: 'Casi sin movimiento: lo más liviano para teléfonos de gama baja o si prefieres menos estímulos.',
};

function confirmAction(title: string, message: string, action: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}

function Block({ icon, title, description, children }: { icon: IconName; title: string; description?: string; children?: React.ReactNode }) {
  return (
    <TelCard style={styles.block}>
      <View style={styles.blockHead}>
        <View style={styles.blockIcon}>
          <TelIcon name={icon} size={18} color={colors.ink} />
        </View>
        <TelText variant="heading" color="ink" style={styles.flex}>
          {title}
        </TelText>
      </View>
      {children}
      {description && (
        <TelText variant="caption" color="inkSoft">
          {description}
        </TelText>
      )}
    </TelCard>
  );
}

function SwitchRow({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.flex}>
        <TelText variant="label" color="ink">
          {label}
        </TelText>
        <TelText variant="caption" color="inkSoft">
          {description}
        </TelText>
      </View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.secondary }} thumbColor={colors.white} />
    </View>
  );
}

// Ajustes de la app: tema, ritmo de los juegos, animaciones, vibración y datos.
export default function SettingsScreen() {
  const settings = useSettings();
  const motionLevel = useMotionLevel();
  const version = Constants.expoConfig?.version ?? '';

  async function chooseTheme(theme: ThemePreference) {
    await updateSettings({ theme });
    await setThemePreference(theme);
  }

  function confirmReset() {
    confirmAction(
      'Borrar datos de este teléfono',
      'Se reinician tu XP, logros, historial, avisos y ajustes en este teléfono, y se cierra tu cuenta aquí (sigue existiendo en el servidor y la recuperas con tu código). No se puede deshacer.',
      'Borrar todo',
      () =>
        void resetAllData()
          .then(() => setThemePreference('system'))
          .then(() => router.replace('/home')),
    );
  }

  return (
    <Screen header={<AppHeader onBack={() => router.back()} kicker="Tu app, a tu manera" title="Ajustes" />}>
      <Block icon="moon" title="Tema" description={`Ahora: ${currentTheme() === 'dark' ? 'oscuro' : 'claro'}. Al cambiarlo, la app se reinicia un instante para aplicar los colores.`}>
        <View style={styles.chips}>
          <ChipGroup accessibilityLabel="Tema de la app" options={THEME_OPTIONS} value={settings.theme} onChange={(theme) => void chooseTheme(theme)} />
        </View>
      </Block>

      <Block icon="timer" title="Ritmo de los juegos" description={paceLabels[settings.pace].description}>
        <View style={styles.chips}>
          <ChipGroup accessibilityLabel="Ritmo de los juegos" options={PACE_OPTIONS} value={settings.pace} onChange={(pace) => void updateSettings({ pace })} />
        </View>
        <TelText variant="caption" color="inkSoft">
          Cambia cuánto tiempo tienes en la Ráfaga y en los juegos de la ruta cuando practicas. En la ruta en vivo el ritmo lo fija el stand para todo el grupo.
        </TelText>
      </Block>

      <Block icon="robot" title="Rutix en los juegos">
        <View style={styles.rutixRow}>
          <Rutix size={64} expression={settings.coach ? 'happy' : 'sleep'} animated={false} />
          <SwitchRow
            label="Rutix te acompaña"
            description="Da pistas, celebra tus aciertos y te anima cuando algo falla."
            value={settings.coach}
            onChange={(coach) => void updateSettings({ coach })}
          />
        </View>
      </Block>

      <Block
        icon="sparkles"
        title="Animaciones"
        description={`${settings.motion === 'auto' ? `Para este teléfono: ${MOTION_OPTIONS.find((option) => option.id === suggestedMotionLevel())?.label.toLowerCase()}. ` : ''}${motionCopy[motionLevel]}`}
      >
        <View style={styles.chips}>
          <ChipGroup accessibilityLabel="Nivel de animaciones" options={MOTION_OPTIONS} value={settings.motion} onChange={(motion) => void updateSettings({ motion })} />
        </View>
      </Block>

      <Block icon="vibrate" title="Vibración">
        <SwitchRow
          label="Vibración y hápticos"
          description="Pequeñas vibraciones al acertar, fallar o tocar botones."
          value={settings.haptics}
          onChange={(haptics) => void updateSettings({ haptics })}
        />
      </Block>

      <View style={styles.links}>
        <ListRow icon="user" title="Cuenta" body="Alias, avatar, curso, colegio y código de recuperación." onPress={() => router.push('/cuenta')} />
        <ListRow icon="shieldLock" title="Privacidad" body="Qué datos guardamos y cómo los cuidamos." onPress={() => router.push('/privacidad')} />
      </View>

      <TelButton label="Borrar datos de este teléfono" variant="dangerOutline" icon="trash" onPress={confirmReset} />
      <TelText variant="caption" color="inkSoft" align="center">
        SoyTEL {version} · Ingeniería Civil Telemática USM
      </TelText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.sm,
  },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  blockIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  chips: {
    marginHorizontal: -spacing.xs,
  },
  switchRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
  },
  rutixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  links: {
    gap: spacing.sm,
  },
});
