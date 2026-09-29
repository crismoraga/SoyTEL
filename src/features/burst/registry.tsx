import type { ComponentType } from 'react';
import type { MicroGameId } from '@/types/game';
import { microGameCatalog } from './catalog';
import { CableConnectGame } from './games/CableConnectGame';
import { CleanSignalGame } from './games/CleanSignalGame';
import { ColorCodeGame } from './games/ColorCodeGame';
import { ConnectNetworkGame } from './games/ConnectNetworkGame';
import { FirewallGame } from './games/FirewallGame';
import { PacketCatchGame } from './games/PacketCatchGame';
import { PacketRushGame } from './games/PacketRushGame';
import { PasswordStrongGame } from './games/PasswordStrongGame';
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

// Duración de una ronda: la ráfaga acelera un 8% por ronda (mínimo 6 s).
export function roundDuration(base: number, round: number, focus = false): number {
  if (focus) return base;
  return Math.max(6, Math.round(base * (1 - Math.min(round, 5) * 0.08)));
}
