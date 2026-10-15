import { makeMicroRound } from '../rounds/QuickRounds';
import type { B215Round } from '../types';

// Ráfaga de redes: tres microjuegos de redes que cambian en cada ruta.
export const rounds: B215Round[] = [
  {
    id: 'rafaga-redes',
    track: 'redes',
    title: 'Ráfaga de redes',
    device: 'Redes',
    icon: 'network',
    art: 'router',
    goal: 'Gana tres microjuegos de switch, router, IP y más.',
    explain: ['Las redes conectan equipos para que la información viaje.', 'Tres microjuegos rápidos: ¡demuestra que entiendes cómo viajan los datos!'],
    learned: 'Switch, router, IP y DNS: las piezas que hacen funcionar Internet.',
    seconds: 45,
    Component: makeMicroRound(['switch-learn', 'router-table', 'dns-agenda', 'tcp-handshake', 'same-subnet', 'topology-pick', 'ip-valid', 'port-match', 'firewall', 'layer-order', 'connect-network', 'device-role']),
  },
];
