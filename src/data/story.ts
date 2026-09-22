import type { KnowledgeArea } from '@/types/game';

export interface StoryChallenge {
  prompt: string;
  options: [string, string, string, string];
  answerIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

export interface StoryChapter {
  id: string;
  number: number;
  title: string;
  area: KnowledgeArea;
  location: string;
  dialogue: string[];
  challenge: StoryChallenge;
  rewardXp: number;
}

export const storyChapters: StoryChapter[] = [
  {
    id: 'chapter-1',
    number: 1,
    title: 'El campus sin señal',
    area: 'redes',
    location: 'Biblioteca central',
    rewardXp: 200,
    dialogue: [
      'Telix: ¡Alerta! La red de la biblioteca cayó justo antes de las entregas.',
      'Telix: Los equipos están encendidos, pero nadie navega. Necesito un diagnóstico rápido.',
      'Telix: Revisemos la ruta básica: dispositivo, switch, router… ¿dónde crees que está el corte?',
    ],
    challenge: {
      prompt: 'Toda la biblioteca perdió Internet al mismo tiempo. ¿Cuál es la causa más probable?',
      options: [
        'Un computador tiene el Wi-Fi apagado',
        'Falló el router o el enlace hacia el proveedor',
        'Los cables de los mouse están sueltos',
        'El brillo de las pantallas está muy bajo',
      ],
      answerIndex: 1,
      explanation: 'Si todos los dispositivos fallan a la vez, el problema suele estar en el equipo compartido: router, switch principal o el enlace del proveedor.',
    },
  },
  {
    id: 'chapter-2',
    number: 2,
    title: 'Interferencia en el laboratorio',
    area: 'teleco',
    location: 'Laboratorio de telecomunicaciones',
    rewardXp: 300,
    dialogue: [
      'Telix: La red vuelve, pero el laboratorio reporta una señal lenta e inestable.',
      'Telix: Hay un microondas viejo, 30 notebooks y un solo punto de acceso en 2.4 GHz.',
      'Telix: Pongamos a prueba tu oído de radiofísico: ¿qué mejora aplicarías primero?',
    ],
    challenge: {
      prompt: '¿Cuál es la mejora más efectiva para este escenario de interferencia y saturación?',
      options: [
        'Pintar las paredes de azul TEL',
        'Subir el volumen de los altavoces',
        'Agregar puntos de acceso y migrar equipos a 5 GHz',
        'Reiniciar los notebooks cada hora',
      ],
      answerIndex: 2,
      explanation: 'La banda de 2.4 GHz sufre interferencia de microondas y saturación con muchos clientes. Más APs y migrar a 5 GHz reparte la carga y reduce interferencia.',
    },
  },
  {
    id: 'chapter-3',
    number: 3,
    title: 'El intruso en la red',
    area: 'seguridad',
    location: 'Sala de servidores',
    rewardXp: 450,
    dialogue: [
      'Telix: Restauramos la señal, pero detecté tráfico extraño hacia un servidor desconocido.',
      'Telix: Alguien dejó una contraseña pegada en un post-it… otra vez.',
      'Telix: Última prueba antes de declarar victoria: ¿cómo respondemos como telemáticos?',
    ],
    challenge: {
      prompt: 'Detectas tráfico sospechoso saliente en la red del campus. ¿Cuál es la primera acción razonable?',
      options: [
        'Apagar todos los servidores para siempre',
        'Publicar la contraseña nueva en el grupo general',
        'Ignorarlo: seguro es actualización de Windows',
        'Aislar el equipo afectado y analizar los registros',
      ],
      answerIndex: 3,
      explanation: 'Ante un incidente se contiene primero (aislar) y luego se analiza (logs). Apagar todo o compartir contraseñas empeora el problema.',
    },
  },
];

export function getChapter(id: string): StoryChapter | undefined {
  return storyChapters.find((chapter) => chapter.id === id);
}
