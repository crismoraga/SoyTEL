import { RouterRound } from '../rounds/RouterRound';
import { SwitchRound } from '../rounds/SwitchRound';
import type { B215Round } from '../types';

// Rondas del circuito B215 · Switch y router: a qué puerto va cada trama y por qué salida sale cada paquete.
export const rounds: B215Round[] = [
  {
    id: 'switch-reparte',
    title: 'El switch reparte',
    device: 'Switch',
    icon: 'lanSwitch',
    art: 'switch',
    goal: 'Toca el puerto al que el switch debe entregar cada mensaje.',
    explain: ['Un switch une con cables los equipos de una misma red.', 'Recuerda en qué puerto está cada equipo y entrega cada mensaje solo ahí.'],
    learned: 'El switch aprende en qué puerto está cada equipo y le entrega solo lo suyo.',
    seconds: 35,
    Component: SwitchRound,
  },
  {
    id: 'router-salida',
    title: '¿Por dónde sale?',
    device: 'Router',
    icon: 'router',
    art: 'router',
    goal: 'Toca la salida por la que el router debe enviar cada paquete.',
    explain: ['Un router conecta redes distintas, como dos salas o tu casa con Internet.', 'Mira la dirección de destino y la compara con su tabla para elegir la salida.'],
    learned: 'El router lee la IP de destino y elige la salida con su tabla de rutas.',
    seconds: 35,
    Component: RouterRound,
  },
];
