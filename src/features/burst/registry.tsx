import type { ComponentType } from 'react';
import type { MicroGameId } from '@/types/game';
import { microGameCatalog } from './catalog';
import { BinaryBitsGame } from './games/BinaryBitsGame';
import { CableConnectGame } from './games/CableConnectGame';
import { CleanSignalGame } from './games/CleanSignalGame';
import { ColorCodeGame } from './games/ColorCodeGame';
import { ConnectNetworkGame } from './games/ConnectNetworkGame';
import { FirewallGame } from './games/FirewallGame';
import { LayerOrderGame, UnitOrderGame } from './games/OrderTapGame';
import { PacketCatchGame } from './games/PacketCatchGame';
import { PacketRushGame } from './games/PacketRushGame';
import { PasswordStrongGame } from './games/PasswordStrongGame';
import { FastRouteGame, IpValidGame, SafeUrlGame } from './games/PickOneGame';
import { PingCheckGame } from './games/PingCheckGame';
import { SequenceMemoryGame } from './games/SequenceMemoryGame';
import { SignalTimingGame } from './games/SignalTimingGame';
import { WifiBoostGame } from './games/WifiBoostGame';
import type { MicroGameDefinition, MicroGameProps } from './types';

const components: Record<MicroGameId, ComponentType<MicroGameProps>> = {
  'connect-network': ConnectNetworkGame,
  'clean-signal': CleanSignalGame,
  'ping-check': PingCheckGame,
  'color-code': ColorCodeGame,
  firewall: FirewallGame,
  'signal-timing': SignalTimingGame,
  'sequence-memory': SequenceMemoryGame,
  'packet-rush': PacketRushGame,
  'cable-connect': CableConnectGame,
  'packet-catch': PacketCatchGame,
  'wifi-boost': WifiBoostGame,
  'password-strong': PasswordStrongGame,
  'binary-bits': BinaryBitsGame,
  'layer-order': LayerOrderGame,
  'ip-valid': IpValidGame,
  'fast-route': FastRouteGame,
  'safe-url': SafeUrlGame,
  'unit-order': UnitOrderGame,
};

export const microGameRegistry: MicroGameDefinition[] = microGameCatalog.map((info) => ({
  ...info,
  Component: components[info.id],
}));

export function pickBurstGames(count: number, random: () => number = Math.random): MicroGameDefinition[] {
  const shuffled = [...microGameRegistry];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function getMicroGame(id: string): MicroGameDefinition | undefined {
  return microGameRegistry.find((game) => game.id === id);
}

// Duración de una ronda. `factor` es el ritmo elegido (más alto = más tiempo) y `acceleration` cuánto
// se acorta cada ronda (0 en ritmo tranquilo; 8 % en el ritmo rápido original). Mínimo 6 s.
export function roundDuration(base: number, round: number, focus = false, factor = 1, acceleration = 0.08): number {
  if (focus) return Math.round(base * factor);
  return Math.max(6, Math.round(base * factor * (1 - Math.min(round, 5) * acceleration)));
}
