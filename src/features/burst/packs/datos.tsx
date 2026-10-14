import type { ComponentType } from 'react';
import type { MicroGameId } from '@/types/game';
import type { MicroGameProps } from '../types';

// Componentes del paquete de microjuegos · Datos: paridad, compuertas lógicas, búsqueda binaria, SQL, gráficos y compresión.
export const datosComponents: Partial<Record<MicroGameId, ComponentType<MicroGameProps>>> = {};
