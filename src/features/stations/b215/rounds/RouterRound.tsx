import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FitBox, type FitSize } from '@/components/FitBox';
import { DeviceArt } from '@/components/graphics/DeviceArt';
import { PressableScale } from '@/components/PressableScale';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { feedbackSuccess, feedbackWarning } from '@/lib/feedback';
import { useMotionEnabled } from '@/lib/motion';
import { colors, monoFamily, radius } from '@/theme';
import type { RoundProps } from '../types';
import {
  makeRouterRound,
  normalizeLevel,
  ROUND_ITEMS,
  ROUTER_DEFAULT_HINT,
  routerBoardLayout,
  routerFeedback,
  type ExitId,
  type Rect,
  type RouteRow,
  type RouterPacket,
  type RouterRoundData,
} from './equipos.logic';
import { Flyer, FrameCard, MessageSlot, place, ResultChip, Shaky, useRoundFlow, visualPalette, type Point, type SlotMessage, type Visual } from './SwitchRound';

const IDLE = 'Busca en la tabla la fila que calza con la IP de destino.';

interface RouterOutcome {
  index: number;
  choice: ExitId;
  ok: boolean;
  text: string;
}

function rowVisual(id: ExitId, packet: RouterPacket, outcome: RouterOutcome | null): Visual {
  if (!outcome) return 'idle';
  if (outcome.choice === id) return outcome.ok ? 'ok' : 'bad';
  return packet.exit === id ? 'target' : 'dim';
}

interface RowProps {
  row: RouteRow;
  rect: Rect;
  visual: Visual;
  disabled: boolean;
  shake: number | null;
  onPress: () => void;
}

// Una fila de la tabla de rutas y, a la vez, una salida del router: «red → salida».
function RouteRowButton({ row, rect, visual, disabled, shake, onPress }: RowProps) {
  const palette = visualPalette[visual];
  const fallback = row.id === 'internet';
  return (
    <Shaky token={shake} style={place(rect)}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Salir por ${row.name}, ${fallback ? 'todo lo demás' : `red ${row.network}`}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        scaleTo={0.97}
        style={[styles.row, { backgroundColor: palette.bg, borderColor: palette.border, opacity: palette.opacity }]}
      >
        <TelIcon name={fallback ? 'globe' : 'door'} size={20} color={colors.accentSoft} />
        <TelText variant="caption" color="cream" numberOfLines={2} maxFontSizeMultiplier={1.15} style={[styles.network, !fallback && styles.mono]}>
          {row.network}
        </TelText>
        <TelIcon name="arrowRight" size={16} color={colors.accentSoft} />
        <TelText variant="label" color="cream" numberOfLines={2} maxFontSizeMultiplier={1.15} style={styles.exitName}>
          {row.name}
        </TelText>
        {(visual === 'ok' || visual === 'target' || visual === 'bad') && <ResultChip ok={visual !== 'bad'} />}
      </PressableScale>
    </Shaky>
  );
}

interface BoardProps {
  size: FitSize;
  data: RouterRoundData;
  packet: RouterPacket;
  outcome: RouterOutcome | null;
  motion: boolean;
  onChoose: (choice: ExitId) => void;
}

// El router arriba y, como cables que bajan de él, las salidas: cada fila de la tabla es una salida.
function RouterBoard({ size, data, packet, outcome, motion, onChoose }: BoardProps) {
  const layout = routerBoardLayout(size.width, size.height, data.rows.length);
  const disabled = outcome !== null;
  const router: Point = { x: layout.artSize / 2 + 2, y: layout.header.y + layout.header.height / 2 };
  const spineTop = layout.header.y + layout.header.height - 2;
  const last = layout.rows[layout.rows.length - 1];
  const spineBottom = last.y + last.height / 2;
  const shake = outcome && !outcome.ok && motion ? outcome.index + 1 : null;
  const target = layout.rows[data.rows.findIndex((row) => row.id === packet.exit)];

  return (
    <>
      <View pointerEvents="none" style={[styles.spine, { left: layout.spineX - 1.5, top: spineTop, height: Math.max(0, spineBottom - spineTop) }]} />
      {layout.rows.map((rect, position) => {
        const visual = rowVisual(data.rows[position].id, packet, outcome);
        return (
          <View
            key={`cable-${position}`}
            pointerEvents="none"
            style={[
              styles.stub,
              {
                left: layout.spineX - 1.5,
                top: rect.y + rect.height / 2 - 1.5,
                width: rect.x - layout.spineX + 1.5,
                backgroundColor: visual === 'ok' || visual === 'target' ? colors.accent : 'rgba(167, 212, 237, 0.4)',
              },
            ]}
          />
        );
      })}
      <View style={[styles.header, place(layout.header)]}>
        <DeviceArt device="router" size={layout.artSize} />
        <TelIcon name="routerTable" size={18} color={colors.accentSoft} />
        <TelText variant="small" color="accentSoft" numberOfLines={1} maxFontSizeMultiplier={1.15} style={styles.headerText}>
          TABLA DE RUTAS
        </TelText>
      </View>
      {layout.rows.map((rect, position) => (
        <RouteRowButton
          key={data.rows[position].id}
          row={data.rows[position]}
          rect={rect}
          visual={rowVisual(data.rows[position].id, packet, outcome)}
          disabled={disabled}
          shake={outcome?.choice === data.rows[position].id ? shake : null}
          onPress={() => onChoose(data.rows[position].id)}
        />
      ))}
      {motion && outcome && target && <Flyer key={outcome.index} icon="packet" from={router} to={{ x: target.x + target.width / 2, y: target.y + target.height / 2 }} />}
    </>
  );
}

export function RouterRound({ seed, level, pace, timeUp, onDone }: RoundProps) {
  const lvl = normalizeLevel(level);
  const data = useMemo(() => makeRouterRound(seed, lvl), [seed, lvl]);
  const motion = useMotionEnabled();
  const flow = useRoundFlow({ kind: 'router', total: ROUND_ITEMS, timeUp, pace, onDone });
  const [last, setLast] = useState<RouterOutcome | null>(null);

  const packet = data.packets[Math.min(flow.index, data.packets.length - 1)];
  const outcome = last && last.index === flow.index ? last : null;

  function choose(choice: ExitId) {
    if (outcome) return;
    const result = routerFeedback(data, flow.index, choice);
    if (!flow.resolve(result.ok)) return;
    setLast({ index: flow.index, choice, ok: result.ok, text: result.text });
    void (result.ok ? feedbackSuccess() : feedbackWarning());
  }

  // La ruta por defecto se explica una vez, con el primer paquete que va a Internet.
  const message: SlotMessage | null = outcome
    ? { tone: outcome.ok ? 'good' : 'bad', text: outcome.text }
    : flow.index === data.firstInternet
      ? { tone: 'info', text: ROUTER_DEFAULT_HINT }
      : null;

  return (
    <View style={styles.root}>
      <FrameCard index={flow.index} total={ROUND_ITEMS} icon="packet" label={`Paquete ${flow.index + 1} de ${ROUND_ITEMS} para ${packet.ip}`}>
        <TelText variant="small" color="secondary" maxFontSizeMultiplier={1.3}>
          Paquete para
        </TelText>
        <TelText variant="heading" color="primary" numberOfLines={1} maxFontSizeMultiplier={1.3} style={styles.ip}>
          {packet.ip}
        </TelText>
        {lvl === 0 && (
          <TelText variant="caption" color="secondary" numberOfLines={1} maxFontSizeMultiplier={1.3}>
            ({packet.note})
          </TelText>
        )}
      </FrameCard>
      <FitBox style={styles.board}>{(size) => <RouterBoard size={size} data={data} packet={packet} outcome={outcome} motion={motion} onChoose={choose} />}</FitBox>
      <MessageSlot message={message} idle={IDLE} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    gap: 6,
  },
  // Aunque el contenedor no acote el alto, el tablero nunca desaparece.
  board: {
    minHeight: 150,
  },
  ip: {
    fontFamily: monoFamily,
    fontWeight: '700',
  },
  mono: {
    fontFamily: monoFamily,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 2,
  },
  headerText: {
    flex: 1,
    letterSpacing: 1.2,
  },
  spine: {
    position: 'absolute',
    width: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(167, 212, 237, 0.4)',
  },
  stub: {
    position: 'absolute',
    height: 3,
    borderRadius: 2,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  network: {
    flex: 0.9,
  },
  exitName: {
    flex: 1.1,
  },
});
