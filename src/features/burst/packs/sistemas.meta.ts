import type { MicroGameId } from '@/types/game';
import type { MicroGameInfo } from '../catalog';
import type { MicroGameGuide } from '../guides';

// Paquete de microjuegos · Sistemas: phishing, cifrado César, redundancia, procesos, códigos HTTP y depuración.
// Metadatos (sin componentes): título, instrucción, consejo de Rutix, duración, ícono, área y ramo.
export const sistemasInfo: MicroGameInfo[] = [];

// Cómo se juega (2 o 3 pasos cortos) y qué se aprende.
export const sistemasGuides: Partial<Record<MicroGameId, MicroGameGuide>> = {};
