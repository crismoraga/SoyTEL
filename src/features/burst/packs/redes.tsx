import type { ComponentType } from 'react';
import type { MicroGameId } from '@/types/game';
import type { MicroGameProps } from '../types';

// Componentes del paquete de microjuegos · Redes: switch, router, DNS, TCP, subredes y topologías.
export const redesComponents: Partial<Record<MicroGameId, ComponentType<MicroGameProps>>> = {};
