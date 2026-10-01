import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { UserAvatar } from '@/components/UserAvatar';
import { sanitizeJourneyCode } from '@/lib/progression';
import { routeStops } from '@/route/content';
import type { PublicPlayer, RouteStop } from '@/route/types';
import { colors, font, radius, spacing } from '@/theme';

export function PlayerAvatar({ avatar, size = 44, online = true, style }: { avatar: number; size?: number; online?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <UserAvatar avatar={avatar} size={size} dimmed={!online} />
      {!online && <View style={[styles.offlineDot, { right: -1, bottom: -1 }]} />}
    </View>
  );
}

export function PlayerChip({ player, me, trailing, dark = true }: { player: PublicPlayer; me?: boolean; trailing?: React.ReactNode; dark?: boolean }) {
  return (
    <View style={[styles.chip, dark ? styles.chipDark : styles.chipLight, me && styles.chipMe]}>
      <PlayerAvatar avatar={player.avatar} size={36} online={player.online} />
      <TelText variant="label" color={dark ? 'cream' : 'primary'} style={styles.flex} numberOfLines={1}>
        {player.alias}
        {me ? ' (tú)' : ''}
      </TelText>
      {trailing}
    </View>
  );
}

const STOP_ORDER: RouteStop[] = ['stand', 'b215', 'b213', 'hall'];

// Mapa lineal de la ruta: stand → B215 → B213 → pasillo. Los tramos se dibujan en una capa propia,
// detrás de los íconos y separados de ellos, para que la línea nunca los tape.
export function RouteProgress({ stop, finished = false }: { stop: RouteStop; finished?: boolean }) {
  const current = STOP_ORDER.indexOf(stop);
  const half = `${50 / routeStops.length}%` as const;
  return (
    <View style={styles.route} accessibilityLabel={`Parada actual: ${routeStops[current]?.place}`}>
      <View pointerEvents="none" style={[styles.routeTrack, { left: half, right: half }]}>
        {routeStops.slice(1).map((item, index) => (
          <View key={item.id} style={[styles.routeSegment, (finished || index + 1 <= current) && styles.routeLineDone]} />
        ))}
      </View>
      {routeStops.map((item, index) => {
        const done = finished || index < current;
        const active = !finished && index === current;
        return (
          <View key={item.id} style={styles.routeStep}>
            <View style={[styles.routeDot, done && styles.routeDotDone, active && styles.routeDotActive]}>
              <TelIcon name={done ? 'check' : item.icon} size={16} color={active || done ? colors.primary : colors.slate} />
            </View>
            <TelText variant="small" color={active ? 'cream' : done ? 'accentSoft' : 'slate'} align="center" numberOfLines={1} style={styles.routeLabel}>
              {item.place.replace('Stand Telemática', 'Stand')}
            </TelText>
          </View>
        );
      })}
    </View>
  );
}

// Cuenta regresiva grande (3, 2, 1…) sincronizada con el anfitrión.
export function BigCountdown({ seconds, label }: { seconds: number; label: string }) {
  return (
    <View style={styles.countdown}>
      <TelText variant="overline" color="accent" align="center">
        {label}
      </TelText>
      <Animated.View key={seconds} entering={ZoomIn.springify().damping(10)}>
        <TelText variant="display" color="cream" align="center" style={styles.countdownNumber}>
          {Math.max(0, seconds)}
        </TelText>
      </Animated.View>
    </View>
  );
}

// Seis casillas para el código del stand (con teclado oculto, igual que en la app).
export function CodeBoxes({ value, onChange, autoFocus = false, onSubmit }: { value: string; onChange: (code: string) => void; autoFocus?: boolean; onSubmit?: () => void }) {
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Código de la ruta: ${value || 'vacío'}. Toca para escribir`} onPress={() => input.current?.focus()} style={styles.boxes}>
      {Array.from({ length: 6 }, (_, index) => {
        const character = value[index];
        const active = focused && index === Math.min(value.length, 5);
        return (
          <View key={index} style={[styles.box, active && styles.boxActive, Boolean(character) && styles.boxFilled]}>
            <TelText variant="title" color="primary" align="center">
              {character ?? ''}
            </TelText>
          </View>
        );
      })}
      <TextInput
        ref={input}
        value={value}
        onChangeText={(text) => onChange(sanitizeJourneyCode(text))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        maxLength={6}
        returnKeyType="go"
        onSubmitEditing={onSubmit}
        accessibilityLabel="Código de la ruta"
        style={[styles.hiddenInput, font('bodyBold')]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  offlineDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.slate,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.md,
  },
  chipDark: {
    backgroundColor: colors.primarySoft,
  },
  chipLight: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipMe: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  route: {
    flexDirection: 'row',
  },
  routeStep: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  routeTrack: {
    position: 'absolute',
    top: 14.5,
    flexDirection: 'row',
  },
  routeSegment: {
    flex: 1,
    height: 3,
    marginHorizontal: 22,
    borderRadius: 2,
    backgroundColor: colors.primarySoft,
  },
  routeLineDone: {
    backgroundColor: colors.accent,
  },
  routeDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primarySoft,
  },
  routeDotDone: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  routeDotActive: {
    backgroundColor: colors.cream,
    borderColor: colors.accent,
  },
  routeLabel: {
    fontSize: 11,
  },
  countdown: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  countdownNumber: {
    fontSize: 96,
    lineHeight: 104,
  },
  boxes: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  box: {
    flex: 1,
    height: 60,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    justifyContent: 'center',
  },
  boxActive: {
    borderColor: colors.secondary,
    borderWidth: 2,
  },
  boxFilled: {
    backgroundColor: colors.highlight,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
});
