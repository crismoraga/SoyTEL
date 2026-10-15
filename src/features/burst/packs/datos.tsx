import type { ComponentType } from 'react';
import type { MicroGameId } from '@/types/game';
import { makeQuickGame } from '../quickpick';
import type { MicroGameProps } from '../types';
import { parityBit, logicGate, binarySearch, sqlFilter, chartRead, compressRle } from './quickRounds';

// Componentes del paquete de microjuegos · Datos: paridad, compuertas lógicas, búsqueda binaria, SQL, gráficos y compresión.
export const datosComponents: Partial<Record<MicroGameId, ComponentType<MicroGameProps>>> = {
  'parity-bit': makeQuickGame(parityBit, 'parityBit'),
  'logic-gate': makeQuickGame(logicGate, 'logicGate'),
  'binary-search': makeQuickGame(binarySearch, 'binarySearch'),
  'sql-filter': makeQuickGame(sqlFilter, 'sqlFilter'),
  'chart-read': makeQuickGame(chartRead, 'chartRead'),
  'compress-rle': makeQuickGame(compressRle, 'compressRle'),
};
