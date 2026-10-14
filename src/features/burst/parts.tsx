import { createContext, useContext, type PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { PressableScale } from '@/components/PressableScale';
import { TelIcon, type IconName } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { colors, radius, spacing } from '@/theme';

export type TileState = 'idle' | 'correct' | 'wrong' | 'dimmed';

// Espacio que la pantalla de la Ráfaga le deja al microjuego (sin la barra superior, el reloj ni la instrucción).
export interface GameSpace {
  width: number;
  height: number;
}

const GameSpaceContext = createContext<GameSpace | null>(null);
export const GameSpaceProvider = GameSpaceContext.Provider;

export function useGameSpace(): GameSpace | null {
  return useContext(GameSpaceContext);
}

// Con poco alto (320×520) las piezas se achican; con mucho (412×780) crecen en vez de dejar vacío.
export type GameDensity = 'compact' | 'regular' | 'roomy';

export function densityFor(height: number): GameDensity {
  return height < 390 ? 'compact' : height < 520 ? 'regular' : 'roomy';
}

export function useGameDensity(): GameDensity {
  const space = useGameSpace();
  return space ? densityFor(space.height) : 'regular';
}

// Raíz de un microjuego: llena el alto disponible (para que un tablero con FitBox use lo que sobra) y
// centra el resto cuando hay espacio de sobra.
export function GameFrame({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const density = useGameDensity();
  return <View style={[styles.frame, density === 'compact' && styles.frameCompact, style]}>{children}</View>;
}

const tileMetrics: Record<GameDensity, { minHeight: number; icon: number; glyph: number; padding: number; gap: number }> = {
  compact: { minHeight: 64, icon: 32, glyph: 18, padding: 8, gap: 2 },
  regular: { minHeight: 84, icon: 44, glyph: 24, padding: 10, gap: 4 },
  roomy: { minHeight: 100, icon: 48, glyph: 26, padding: 12, gap: 8 },
};

interface ChoiceTileProps {
  label: string;
  icon?: IconName;
  state?: TileState;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

// Opción grande con ícono para los microjuegos de elección rápida.
export function ChoiceTile({ label, icon, state = 'idle', disabled, onPress, style, children }: PropsWithChildren<ChoiceTileProps>) {
  const metrics = tileMetrics[useGameDensity()];
  const palette =
    state === 'correct'
      ? { bg: '#1F5E43', border: '#6BC59A', fg: colors.white }
      : state === 'wrong'
        ? { bg: '#6E2A2A', border: '#E58A8A', fg: colors.white }
        : state === 'dimmed'
          ? { bg: colors.primarySoft, border: 'rgba(167,212,237,0.1)', fg: colors.slate }
          : { bg: colors.primarySoft, border: 'rgba(167,212,237,0.3)', fg: colors.cream };
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      haptic
      onPress={onPress}
      scaleTo={0.94}
      style={[styles.tile, { minHeight: metrics.minHeight, padding: metrics.padding, gap: metrics.gap, backgroundColor: palette.bg, borderColor: palette.border }, style]}
    >
      {icon && (
        <View style={[styles.tileIcon, { width: metrics.icon, height: metrics.icon, borderRadius: metrics.icon / 2 }]}>
          <TelIcon name={icon} size={metrics.glyph} color={colors.primary} />
        </View>
      )}
      {children}
      <TelText variant="label" align="center" style={{ color: palette.fg }}>
        {label}
      </TelText>
    </PressableScale>
  );
}

export function TileGrid({ children }: PropsWithChildren) {
  const density = useGameDensity();
  return <View style={[styles.grid, density === 'compact' && styles.gridCompact]}>{children}</View>;
}

export function GameCaption({ children }: PropsWithChildren) {
  return (
    <TelText variant="label" color="accentSoft" align="center">
      {children}
    </TelText>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    minHeight: 0,
    gap: spacing.sm,
    justifyContent: 'center',
  },
  frameCompact: {
    gap: spacing.xs,
  },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileIcon: {
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridCompact: {
    gap: spacing.xs,
  },
});
