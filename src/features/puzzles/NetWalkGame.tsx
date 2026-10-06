import { memo, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';
import { TelButton } from '@/components/TelButton';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { feedbackSuccess, feedbackTap } from '@/lib/feedback';
import { useMotionEnabled } from '@/lib/motion';
import { mulberry32 } from '@/route/random';
import { colors, radius, spacing } from '@/theme';
import { createNetPuzzle, currentMasks, EAST, hintOrder, minimalMoves, netScore, NORTH, portCount, poweredCells, SOUTH, turnsToSolve, WEST } from './netwalk';
import type { PuzzleGameProps } from './types';

const LIT = colors.accent;
const DIM = '#4A6A82';

interface TileProps {
  mask: number;
  turns: number;
  powered: boolean;
  kind: 'server' | 'terminal' | 'cable';
  size: number;
  left: number;
  top: number;
  hinted: boolean;
  onPress: () => void;
}

// Una pieza: los cables se dibujan en su orientación resuelta y la vista completa gira.
const NetTile = memo(function NetTile({ mask, turns, powered, kind, size, left, top, hinted, onPress }: TileProps) {
  const motion = useMotionEnabled();
  const rotation = useSharedValue(turns * 90);
  useEffect(() => {
    rotation.set(motion ? withTiming(turns * 90, { duration: 140 }) : turns * 90);
  }, [motion, rotation, turns]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  const center = size / 2;
  const stroke = Math.max(5, size * 0.13);
  const color = powered ? LIT : DIM;
  const node = size * 0.3;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${kind === 'server' ? 'Servidor' : kind === 'terminal' ? 'Equipo' : 'Cable'}${powered ? ', con señal' : ', sin señal'}. Girar`}
      onPress={onPress}
      style={[styles.tile, { width: size, height: size, left, top }, hinted && styles.tileHint]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, style]}>
        <Svg width={size} height={size}>
          {mask & NORTH ? <Line x1={center} y1={center} x2={center} y2={0} stroke={color} strokeWidth={stroke} strokeLinecap="round" /> : null}
          {mask & EAST ? <Line x1={center} y1={center} x2={size} y2={center} stroke={color} strokeWidth={stroke} strokeLinecap="round" /> : null}
          {mask & SOUTH ? <Line x1={center} y1={center} x2={center} y2={size} stroke={color} strokeWidth={stroke} strokeLinecap="round" /> : null}
          {mask & WEST ? <Line x1={center} y1={center} x2={0} y2={center} stroke={color} strokeWidth={stroke} strokeLinecap="round" /> : null}
          {kind === 'cable' && <Circle cx={center} cy={center} r={stroke / 2} fill={color} />}
        </Svg>
      </Animated.View>
      {kind !== 'cable' && (
        <View
          pointerEvents="none"
          style={[
            styles.node,
            { width: node * 2, height: node * 2, borderRadius: node, left: center - node, top: center - node },
            kind === 'server' ? styles.nodeServer : powered ? styles.nodeOn : styles.nodeOff,
          ]}
        >
          <TelIcon name={kind === 'server' ? 'server' : 'laptop'} size={node * 1.05} color={kind === 'server' || powered ? colors.primary : colors.slate} strokeWidth={2.2} />
        </View>
      )}
    </Pressable>
  );
});

// Desafío "Conecta la red": gira las piezas hasta que la señal del servidor llegue a todos los equipos.
export function NetWalkGame({ level, seed, onSolved, say }: PuzzleGameProps) {
  const { width } = useWindowDimensions();
  const [puzzle] = useState(() => createNetPuzzle(level, mulberry32(seed)));
  const [turns, setTurns] = useState(puzzle.turns);
  const [moves, setMoves] = useState(0);
  const [hints, setHints] = useState(0);
  const [hinted, setHinted] = useState<number | null>(null);
  const done = useRef(false);
  const optimal = minimalMoves(puzzle);
  // Celdas de tamaño entero y posición absoluta: sin saltos de línea por redondeo.
  const cell = Math.floor((Math.min(width - spacing.md * 2, 440) - 2) / puzzle.size);
  const board = cell * puzzle.size + 2;
  const masks = currentMasks(puzzle, turns);
  const powered = poweredCells(puzzle.size, puzzle.server, masks);
  const terminals = puzzle.solved.map((mask, index) => index !== puzzle.server && portCount(mask) === 1);
  const terminalCount = terminals.filter(Boolean).length;
  const online = terminals.filter((isTerminal, index) => isTerminal && powered[index]).length;

  function finish(nextTurns: number[], usedMoves: number, usedHints: number) {
    if (done.current) return;
    const solved = poweredCells(puzzle.size, puzzle.server, currentMasks(puzzle, nextTurns)).every(Boolean);
    if (!solved) return;
    done.current = true;
    void feedbackSuccess();
    const score = Math.max(300, netScore(optimal, usedMoves) - usedHints * 80);
    onSolved({
      score,
      accuracy: Math.min(1, optimal / Math.max(usedMoves, optimal)),
      detail: `${usedMoves} giros (mínimo ${optimal})${usedHints ? ` · ${usedHints} ${usedHints === 1 ? 'pista' : 'pistas'}` : ''}`,
    });
  }

  function rotate(index: number) {
    if (done.current) return;
    void feedbackTap();
    const next = turns.map((value, position) => (position === index ? value + 1 : value));
    const used = moves + 1;
    setTurns(next);
    setMoves(used);
    setHinted(null);
    const lit = poweredCells(puzzle.size, puzzle.server, currentMasks(puzzle, next));
    const now = terminals.filter((isTerminal, position) => isTerminal && lit[position]).length;
    if (now > online) say(now === terminalCount ? '¡Todos los equipos en línea!' : `¡Equipo conectado! Van ${now} de ${terminalCount}.`, 'good');
    finish(next, used, hints);
  }

  function hint() {
    if (done.current) return;
    // La pista avanza desde el servidor hacia afuera: acomoda la primera pieza mal girada del camino.
    const target = hintOrder(puzzle).find((index) => turnsToSolve(puzzle.solved[index], turns[index]) > 0);
    if (target === undefined) return;
    const next = turns.map((value, index) => (index === target ? value + turnsToSolve(puzzle.solved[index], value) : value));
    const usedHints = hints + 1;
    setTurns(next);
    setHints(usedHints);
    setHinted(target);
    say(target === puzzle.server ? 'Giré el servidor hacia su cable. Desde ahí parte la señal.' : 'Te acomodé esa pieza. Sigue el cable encendido desde el servidor.', 'tip');
    finish(next, moves, usedHints);
  }

  function reset() {
    if (done.current) return;
    setTurns(puzzle.turns);
    setHinted(null);
    say('Volvimos al inicio. Parte por las piezas junto al servidor.', 'idle');
  }

  return (
    <View style={styles.container}>
      <View style={styles.stats}>
        <View style={styles.stat}>
          <TelIcon name="laptop" size={16} color={colors.accent} />
          <TelText variant="label" color="cream" tabular>
            {online}/{terminalCount} equipos
          </TelText>
        </View>
        <View style={styles.stat}>
          <TelIcon name="refresh" size={16} color={colors.accent} />
          <TelText variant="label" color="cream" tabular>
            {moves} giros
          </TelText>
        </View>
      </View>
      <View style={[styles.board, { width: board, height: board }]}>
        {puzzle.solved.map((mask, index) => (
          <NetTile
            key={index}
            mask={mask}
            turns={turns[index]}
            powered={powered[index]}
            kind={index === puzzle.server ? 'server' : terminals[index] ? 'terminal' : 'cable'}
            size={cell}
            left={(index % puzzle.size) * cell}
            top={Math.floor(index / puzzle.size) * cell}
            hinted={hinted === index}
            onPress={() => rotate(index)}
          />
        ))}
      </View>
      <View style={styles.actions}>
        <TelButton label="Pista" variant="outlineLight" icon="lightbulb" size="sm" style={styles.flex} onPress={hint} />
        <TelButton label="Reiniciar" variant="outlineLight" icon="refresh" size="sm" style={styles.flex} onPress={reset} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  board: {
    borderRadius: radius.lg,
    backgroundColor: 'rgba(7, 31, 49, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(167, 212, 237, 0.2)',
    overflow: 'hidden',
  },
  tile: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(167, 212, 237, 0.12)',
  },
  tileHint: {
    backgroundColor: 'rgba(244, 236, 215, 0.14)',
  },
  node: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  nodeServer: {
    backgroundColor: colors.cream,
    borderColor: colors.accent,
  },
  nodeOn: {
    backgroundColor: colors.accent,
    borderColor: colors.cream,
  },
  nodeOff: {
    backgroundColor: colors.primarySoft,
    borderColor: DIM,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
});
