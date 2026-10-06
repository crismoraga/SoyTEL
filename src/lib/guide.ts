import type { Href } from 'expo-router';
import type { IconName } from '@/graphics/icons';
import type { GameResult } from '@/types/game';

// Guía de inicio: los primeros pasos recomendados para quien abre SoyTEL por primera vez.
// Cada paso se marca solo cuando se cumple; con todos listos, la guía desaparece de Inicio.
export interface GuideStep {
  id: 'burst' | 'runner' | 'puzzle' | 'station' | 'rutix' | 'career';
  title: string;
  text: string;
  icon: IconName;
  route: Href;
  done: boolean;
}

export interface GuideInput {
  results: GameResult[];
  // Días distintos en que se cuidó a Rutix.
  mascotDays: number;
  // Áreas de la carrera con al menos una práctica.
  careerAreas: number;
}

export function starterGuide({ results, mascotDays, careerAreas }: GuideInput): GuideStep[] {
  const played = (...ids: string[]) => results.some((result) => ids.includes(result.gameId));
  return [
    { id: 'burst', title: 'Juega tu primera Ráfaga', text: 'Ocho microjuegos cortos. Rutix te explica cada uno antes de empezar.', icon: 'bolt', route: '/burst', done: played('burst') },
    { id: 'runner', title: 'Corre en TEL Runner', text: 'Junta paquetes de datos, esquiva virus y desbloquea personajes.', icon: 'rocket', route: '/runner', done: played('runner') },
    {
      id: 'puzzle',
      title: 'Resuelve un desafío sin reloj',
      text: 'Conecta la red girando cables. Sin apuro y con pistas.',
      icon: 'network',
      route: { pathname: '/puzzle', params: { juego: 'red' } },
      done: played('puzzle'),
    },
    {
      id: 'station',
      title: 'Practica un juego de la ruta',
      text: 'Los mismos juegos de la feria, para entrenar antes.',
      icon: 'router',
      route: { pathname: '/estacion', params: { juego: 'red-b215' } },
      done: played('station', 'route'),
    },
    { id: 'rutix', title: 'Cuida y juega con Rutix', text: 'Recarga sus datos, hazlo bailar o pídele un chiste.', icon: 'robot', route: '/mascot', done: mascotDays > 0 },
    { id: 'career', title: 'Practica un área de la carrera', text: 'Cinco preguntas de redes, software, hardware, telecomunicaciones o seguridad.', icon: 'school', route: '/career', done: careerAreas > 0 },
  ];
}

export function guideProgress(steps: GuideStep[]): { done: number; total: number; next: GuideStep | null } {
  return { done: steps.filter((step) => step.done).length, total: steps.length, next: steps.find((step) => !step.done) ?? null };
}
