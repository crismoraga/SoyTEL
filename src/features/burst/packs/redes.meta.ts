import type { MicroGameId } from '@/types/game';
import type { MicroGameInfo } from '../catalog';
import type { MicroGameGuide } from '../guides';

// Paquete de microjuegos · Redes: switch, router, DNS, TCP, subredes y topologías.
// Metadatos (sin componentes): título, instrucción, consejo de Rutix, duración, ícono, área y ramo.
export const redesInfo: MicroGameInfo[] = [];

// Cómo se juega (2 o 3 pasos cortos) y qué se aprende.
export const redesGuides: Partial<Record<MicroGameId, MicroGameGuide>> = {};
