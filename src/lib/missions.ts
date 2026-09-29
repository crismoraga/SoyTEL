import type { Href } from 'expo-router';
import { storyChapters } from '@/data/story';
import type { MedallionGlyph } from '@/graphics/medallions';
import type { GameResult } from '@/types/game';
import { isSameLocalDay } from './format';

export interface Mission {
  kicker: string;
  title: string;
  subtitle: string;
  glyph: MedallionGlyph;
  cta: string;
  route: Href;
}

// Próximo paso sugerido en Inicio: primero una ráfaga, luego la historia y después el reto diario.
export function nextMission(results: GameResult[], completedChapters: string[], now = new Date()): Mission {
  if (results.length === 0) {
    return {
      kicker: 'Tu primera misión',
      title: 'Ráfaga TEL',
      subtitle: '6 microjuegos · menos de 3 minutos',
      glyph: 'bolt',
      cta: 'Jugar ahora',
      route: '/burst',
    };
  }

  const nextChapter = storyChapters.find((chapter) => !completedChapters.includes(chapter.id));
  if (nextChapter) {
    return {
      kicker: 'Siguiente capítulo',
      title: `${nextChapter.number} · ${nextChapter.title}`,
      subtitle: `${nextChapter.location} · La señal perdida`,
      glyph: nextChapter.glyph,
      cta: 'Continuar historia',
      route: '/story',
    };
  }

  const burstToday = results.some((result) => result.gameId === 'burst' && isSameLocalDay(new Date(result.completedAt), now));
  if (!burstToday) {
    return {
      kicker: 'Reto del día',
      title: 'Ráfaga TEL',
      subtitle: 'Mantén tu racha con 6 microjuegos',
      glyph: 'bolt',
      cta: 'Jugar ahora',
      route: '/burst',
    };
  }

  if (!results.some((result) => result.gameId === 'millionaire')) {
    return {
      kicker: 'Nuevo desafío',
      title: 'Quién quiere ser Telemático',
      subtitle: '10 preguntas de menor a mayor dificultad',
      glyph: 'question',
      cta: 'Probar suerte',
      route: '/millionaire',
    };
  }

  return {
    kicker: 'Sigue explorando',
    title: 'Practica un área de la carrera',
    subtitle: 'Redes, señales, software, seguridad…',
    glyph: 'cap',
    cta: 'Ver áreas',
    route: '/career',
  };
}
