import type { MicroGameId } from '@/types/game';
import type { MicroGameInfo } from '../catalog';
import type { MicroGameGuide } from '../guides';

// Paquete de microjuegos · Señales: ondas, modulación, canales Wi-Fi, fibra óptica, ruido y muestreo.
// Metadatos (sin componentes): título, instrucción, consejo de Rutix, duración, ícono, área y ramo.
export const senalesInfo: MicroGameInfo[] = [];

// Cómo se juega (2 o 3 pasos cortos) y qué se aprende.
export const senalesGuides: Partial<Record<MicroGameId, MicroGameGuide>> = {};
