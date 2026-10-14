import type { MicroGameId } from '@/types/game';
import type { MicroGameInfo } from '../catalog';
import type { MicroGameGuide } from '../guides';

// Paquete de microjuegos · Datos: paridad, compuertas lógicas, búsqueda binaria, SQL, gráficos y compresión.
// Metadatos (sin componentes): título, instrucción, consejo de Rutix, duración, ícono, área y ramo.
export const datosInfo: MicroGameInfo[] = [];

// Cómo se juega (2 o 3 pasos cortos) y qué se aprende.
export const datosGuides: Partial<Record<MicroGameId, MicroGameGuide>> = {};
