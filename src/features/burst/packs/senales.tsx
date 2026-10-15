import type { ComponentType } from 'react';
import type { MicroGameId } from '@/types/game';
import type { MicroGameProps } from '../types';

// Componentes del paquete de microjuegos · Señales: ondas, modulación, canales Wi-Fi, fibra óptica, ruido y muestreo.
export const senalesComponents: Partial<Record<MicroGameId, ComponentType<MicroGameProps>>> = {};
