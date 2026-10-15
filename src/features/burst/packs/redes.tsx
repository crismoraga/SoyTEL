import type { ComponentType } from 'react';
import type { MicroGameId } from '@/types/game';
import { DnsAgendaGame } from '../games/DnsAgendaGame';
import { RouterTableGame } from '../games/RouterTableGame';
import { SameSubnetGame } from '../games/SameSubnetGame';
import { SwitchLearnGame } from '../games/SwitchLearnGame';
import { TcpHandshakeGame } from '../games/TcpHandshakeGame';
import { TopologyPickGame } from '../games/TopologyPickGame';
import type { MicroGameProps } from '../types';

// Componentes del paquete de microjuegos · Redes: switch, router, DNS, TCP, subredes y topologías.
export const redesComponents: Partial<Record<MicroGameId, ComponentType<MicroGameProps>>> = {
  'switch-learn': SwitchLearnGame,
  'router-table': RouterTableGame,
  'dns-agenda': DnsAgendaGame,
  'tcp-handshake': TcpHandshakeGame,
  'same-subnet': SameSubnetGame,
  'topology-pick': TopologyPickGame,
};
