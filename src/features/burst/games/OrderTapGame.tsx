import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PressableScale } from '@/components/PressableScale';
import { TelText } from '@/components/TelText';
import { feedbackTap } from '@/lib/feedback';
import { colors, radius, spacing } from '@/theme';
import { dataUnits, orderRound, tcpIpStack, type OrderItem } from '../logic';
import type { MicroGameProps } from '../types';

interface OrderConfig {
  items: OrderItem[];
  count: (level: number) => number;
  prompt: string;
  from: string;
  to: string;
}

// Microjuegos de ordenar: se tocan las piezas de menor a mayor (o de abajo hacia arriba).
function OrderTapGame({ config, active, level, onAnswer }: MicroGameProps & { config: OrderConfig }) {
  const [round] = useState(() => orderRound(config.items, config.count(level)));
  const [placed, setPlaced] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string | null>(null);
  const done = useRef(false);

  function tap(item: OrderItem) {
    if (!active || done.current || placed.includes(item.id)) return;
    void feedbackTap();
    const expected = round.correct[placed.length];
    if (item.id !== expected.id) {
      done.current = true;
      setWrong(item.id);
      onAnswer(false);
      return;
    }
    const next = [...placed, item.id];
    setPlaced(next);
    if (next.length >= round.correct.length) {
      done.current = true;
      onAnswer(true, 30);
    }
  }

  return (
    <View style={styles.container}>
      <TelText variant="subtitle" color="cream" align="center">
        {config.prompt}
      </TelText>
      <View style={styles.scale}>
        <TelText variant="small" color="accentSoft">
          {config.from}
        </TelText>
        <View style={styles.slots}>
          {round.correct.map((item, index) => (
            <View key={item.id} style={[styles.slot, index < placed.length && styles.slotDone]}>
              <TelText variant="small" color={index < placed.length ? 'primary' : 'slate'} numberOfLines={1}>
                {index < placed.length ? item.label : index + 1}
              </TelText>
            </View>
          ))}
        </View>
        <TelText variant="small" color="accentSoft">
          {config.to}
        </TelText>
      </View>
      <View style={styles.grid}>
        {round.shuffled.map((item) => {
          const order = placed.indexOf(item.id);
          const isPlaced = order >= 0;
          const isWrong = wrong === item.id;
          return (
            <PressableScale
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}, ${item.detail}${isPlaced ? `, puesto ${order + 1}` : ''}`}
              disabled={!active || isPlaced}
              onPress={() => tap(item)}
              scaleTo={0.94}
              style={[styles.tile, isPlaced && styles.tileDone, isWrong && styles.tileWrong]}
            >
              {isPlaced && (
                <View style={styles.badge}>
                  <TelText variant="small" color="primary">
                    {order + 1}
                  </TelText>
                </View>
              )}
              <TelText variant="subtitle" color={isPlaced ? 'slate' : 'cream'} align="center">
                {item.label}
              </TelText>
              <TelText variant="small" color="accentSoft" align="center">
                {item.detail}
              </TelText>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const layers: OrderConfig = {
  items: tcpIpStack,
  count: () => 4,
  prompt: 'Toca las capas desde el cable hasta la app',
  from: 'Cable',
  to: 'App',
};

const units: OrderConfig = {
  items: dataUnits,
  count: (level) => (level >= 3 ? 5 : 4),
  prompt: 'Toca las unidades de la más pequeña a la más grande',
  from: 'Menor',
  to: 'Mayor',
};

// Microjuego 14: el modelo de capas de Internet, de abajo hacia arriba.
export function LayerOrderGame(props: MicroGameProps) {
  return <OrderTapGame {...props} config={layers} />;
}

// Microjuego 18: unidades de información en orden.
export function UnitOrderGame(props: MicroGameProps) {
  return <OrderTapGame {...props} config={units} />;
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  scale: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  slots: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  slot: {
    flex: 1,
    minHeight: 34,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 212, 237, 0.3)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  slotDone: {
    borderStyle: 'solid',
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 84,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 212, 237, 0.3)',
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    padding: spacing.sm,
  },
  tileDone: {
    borderColor: 'rgba(167, 212, 237, 0.12)',
    opacity: 0.75,
  },
  tileWrong: {
    backgroundColor: '#6E2A2A',
    borderColor: '#E58A8A',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
