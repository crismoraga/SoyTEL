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
import { AcronymGame, DeviceRoleGame, FastRouteGame, IpValidGame, PortMatchGame, SafeUrlGame, WifiSafeGame } from './games/PickOneGame';
import { PingCheckGame } from './games/PingCheckGame';
import { SequenceMemoryGame } from './games/SequenceMemoryGame';
import { SignalTimingGame } from './games/SignalTimingGame';
import { WifiBoostGame } from './games/WifiBoostGame';
import { datosComponents } from './packs/datos';
import { redesComponents } from './packs/redes';
import { senalesComponents } from './packs/senales';
import { sistemasComponents } from './packs/sistemas';
import type { MicroGameDefinition, MicroGameProps } from './types';

const coreComponents: Partial<Record<MicroGameId, ComponentType<MicroGameProps>>> = {
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
  'port-match': PortMatchGame,
  'device-role': DeviceRoleGame,
  'wifi-safe': WifiSafeGame,
  acronym: AcronymGame,
};

const components: Partial<Record<MicroGameId, ComponentType<MicroGameProps>>> = { ...coreComponents, ...redesComponents, ...senalesComponents, ...datosComponents, ...sistemasComponents };

// Un juego del catálogo entra al registro cuando tiene componente (una prueba exige que todos lo tengan).
export const microGameRegistry: MicroGameDefinition[] = microGameCatalog.flatMap((info) => {
  const Component = components[info.id];
  return Component ? [{ ...info, Component }] : [];
});

// Elige `count` microjuegos distintos. Primero los que no se jugaron hace poco (`recent`, del más
// nuevo al más viejo) y, entre ellos, alternando áreas: una ráfaga no debería ser seis juegos de lo mismo.
// Con la misma `random` y la misma lista el resultado es el mismo (el desafío diario depende de eso).
export function pickBurstGames(count: number, random: () => number = Math.random, recent: readonly string[] = []): MicroGameDefinition[] {
  const shuffled = [...microGameRegistry];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  const played = new Set(recent);
  const pool = [...shuffled.filter((game) => !played.has(game.id)), ...shuffled.filter((game) => played.has(game.id))];
  const picked: MicroGameDefinition[] = [];
  const total = Math.min(count, pool.length);
  while (picked.length < total) {
    const previous = picked[picked.length - 1]?.area;
    const fresh = (game: MicroGameDefinition) => !played.has(game.id);
    const other = (game: MicroGameDefinition) => game.area !== previous;
    let index = pool.findIndex((game) => fresh(game) && other(game));
    if (index === -1) index = pool.findIndex(fresh);
    if (index === -1) index = pool.findIndex(other);
    if (index === -1) index = 0;
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
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
