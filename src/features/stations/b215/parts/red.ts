import { BuildNetworkRound } from '../rounds/BuildNetworkRound';
import { FirewallRound } from '../rounds/FirewallRound';
import { WifiChannelRound } from '../rounds/WifiChannelRound';
import type { B215Round } from '../types';

// Rondas del circuito B215 · Firewall, canal Wi-Fi y armar la red del laboratorio.
export const rounds: B215Round[] = [
  {
    id: 'firewall-reglas',
    title: '¿Pasa o no pasa?',
    device: 'Firewall',
    icon: 'shieldCheck',
    art: 'firewall',
    goal: 'Mira las reglas y decide si cada conexión pasa o se bloquea.',
    explain: ['Un firewall es el guardia de la red: revisa cada conexión que entra.', 'La compara con sus reglas y deja pasar solo lo permitido.'],
    learned: 'Un firewall aplica reglas: deja pasar lo permitido y bloquea el resto.',
    seconds: 35,
    Component: FirewallRound,
  },
  {
    id: 'canal-wifi',
    title: 'Canal libre',
    device: 'Wi-Fi',
    icon: 'wifi',
    art: 'accessPoint',
    goal: 'Elige el canal donde tu Wi-Fi tendrá menos interferencia.',
    explain: ['El Wi-Fi usa canales, como las emisoras de radio.', 'Si dos redes usan el mismo canal se interfieren y todo va más lento.'],
    learned: 'En 2,4 GHz los canales 1, 6 y 11 no se pisan: elegir el más libre mejora la señal.',
    seconds: 30,
    Component: WifiChannelRound,
  },
  {
    id: 'arma-red',
    title: 'Arma la red',
    device: 'Red de la sala',
    icon: 'network',
    art: 'switch',
    goal: 'Pon cada equipo en su lugar para que todos tengan Internet.',
    explain: ['Una red se arma con equipos que cumplen roles distintos.', 'Router hacia Internet, switch para los cables y access point para el Wi-Fi.'],
    learned: 'Cada equipo tiene su rol: el router sale a Internet, el switch une cables y el access point da Wi-Fi.',
    seconds: 40,
    Component: BuildNetworkRound,
  },
];
