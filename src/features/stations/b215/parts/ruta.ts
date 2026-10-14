import type { B215Round } from '../types';
import { ZIP_ROUND_SECONDS, ZipRound } from '../zip/ZipRound';

// Rondas del circuito B215 · Ruta del paquete (estilo «Zip»: une los nodos en orden pasando por todas las casillas).
export const rounds: B215Round[] = [
  {
    id: 'ruta-paquete',
    title: 'Ruta del paquete',
    device: 'Router',
    icon: 'route',
    art: 'router',
    goal: 'Lleva el paquete del 1 al último número pasando por todas las casillas.',
    explain: ['En Internet los datos viajan en paquetes que saltan de router en router.', 'Cada router lo pasa al siguiente: aquí tú trazas ese camino, sin repetir casillas.'],
    learned: 'Un paquete llega a su destino saltando por varios routers, uno tras otro.',
    seconds: ZIP_ROUND_SECONDS,
    Component: ZipRound,
  },
];
