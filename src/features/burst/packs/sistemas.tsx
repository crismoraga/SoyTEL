import type { ComponentType } from 'react';
import type { MicroGameId } from '@/types/game';
import type { MicroGameProps } from '../types';

// Componentes del paquete de microjuegos · Sistemas: phishing, cifrado César, redundancia, procesos, códigos HTTP y depuración.
export const sistemasComponents: Partial<Record<MicroGameId, ComponentType<MicroGameProps>>> = {};
