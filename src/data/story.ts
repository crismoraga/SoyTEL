import type { TelixExpression } from '@/graphics/telix';
import type { MedallionGlyph } from '@/graphics/medallions';
import type { KnowledgeArea } from '@/types/game';

export interface StoryChallenge {
  prompt: string;
  options: [string, string, string, string];
  answerIndex: 0 | 1 | 2 | 3;
  explanation: string;
  hint: string;
}

export interface StoryLine {
  mood: TelixExpression;
  text: string;
}

export interface StoryChapter {
  id: string;
  number: number;
  title: string;
  area: KnowledgeArea;
  location: string;
  glyph: MedallionGlyph;
  dialogue: StoryLine[];
  challenge: StoryChallenge;
  outro: string;
  rewardXp: number;
  // Posición del capítulo en el mapa del campus (porcentajes).
  map: { x: number; y: number };
}

export const storyChapters: StoryChapter[] = [
  {
    id: 'chapter-1',
    number: 1,
    title: 'El campus sin señal',
    area: 'redes',
    location: 'Biblioteca central',
    glyph: 'network',
    rewardXp: 200,
    map: { x: 22, y: 80 },
    dialogue: [
      { mood: 'alert', text: '¡Alerta! La red de la biblioteca cayó justo antes de las entregas.' },
      { mood: 'think', text: 'Los equipos están encendidos, pero nadie navega. Necesito un diagnóstico rápido.' },
      { mood: 'neutral', text: 'Revisemos la ruta básica: dispositivo, switch, router… ¿dónde crees que está el corte?' },
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
      hint: 'Piensa en qué equipo comparten todos los computadores.',
    },
    outro: '¡La biblioteca volvió a navegar! Pero siento interferencias en el laboratorio…',
  },
  {
    id: 'chapter-2',
    number: 2,
    title: 'Interferencia en el laboratorio',
    area: 'teleco',
    location: 'Laboratorio de telecomunicaciones',
    glyph: 'antenna',
    rewardXp: 300,
    map: { x: 72, y: 66 },
    dialogue: [
      { mood: 'sleepy', text: 'La red vuelve, pero el laboratorio reporta una señal lenta e inestable.' },
      { mood: 'think', text: 'Hay un microondas viejo, 30 notebooks y un solo punto de acceso en 2,4 GHz.' },
      { mood: 'happy', text: 'Pongamos a prueba tu oído de radiofísico: ¿qué mejora aplicarías primero?' },
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
      explanation: 'La banda de 2,4 GHz sufre interferencia de microondas y saturación con muchos clientes. Más APs y migrar a 5 GHz reparte la carga y reduce la interferencia.',
      hint: 'El problema es de espectro y de cantidad de equipos por antena.',
    },
    outro: 'La señal del laboratorio está limpia. Uy… detecto tráfico raro en la sala de servidores.',
  },
  {
    id: 'chapter-3',
    number: 3,
    title: 'El intruso en la red',
    area: 'seguridad',
    location: 'Sala de servidores',
    glyph: 'shield',
    rewardXp: 450,
    map: { x: 28, y: 50 },
    dialogue: [
      { mood: 'alert', text: 'Restauramos la señal, pero detecté tráfico extraño hacia un servidor desconocido.' },
      { mood: 'sad', text: 'Alguien dejó una contraseña pegada en un post-it… otra vez.' },
      { mood: 'think', text: 'Antes de seguir: ¿cómo respondemos como telemáticos?' },
    ],
    challenge: {
      prompt: 'Detectas tráfico sospechoso saliente en la red del campus. ¿Cuál es la primera acción razonable?',
      options: [
        'Apagar todos los servidores para siempre',
        'Publicar la contraseña nueva en el grupo general',
        'Ignorarlo: seguro es una actualización',
        'Aislar el equipo afectado y analizar los registros',
      ],
      answerIndex: 3,
      explanation: 'Ante un incidente se contiene primero (aislar) y luego se analiza (registros). Apagar todo o compartir contraseñas empeora el problema.',
      hint: 'Primero contener, después investigar.',
    },
    outro: 'Intruso contenido. Ahora los sensores del taller de electrónica dejaron de reportar…',
  },
  {
    id: 'chapter-4',
    number: 4,
    title: 'Sensores en silencio',
    area: 'hardware',
    location: 'Taller de electrónica',
    glyph: 'chip',
    rewardXp: 550,
    map: { x: 72, y: 34 },
    dialogue: [
      { mood: 'think', text: 'Los sensores de temperatura del taller miden bien, pero sus datos no llegan a la red.' },
      { mood: 'alert', text: 'El microcontrolador recibe un voltaje que sube y baja… y la red solo entiende bits.' },
      { mood: 'neutral', text: '¿Qué pieza falta entre el sensor y el microcontrolador?' },
    ],
    challenge: {
      prompt: 'Un sensor entrega una señal analógica. Para enviarla por la red, ¿qué componente la convierte a digital?',
      options: [
        'Un conversor análogo-digital (ADC)',
        'Un switch de 24 puertos',
        'Un firewall perimetral',
        'Una batería más grande',
      ],
      answerIndex: 0,
      explanation: 'El ADC muestrea y cuantiza la señal analógica, convirtiéndola en bits que el microcontrolador puede procesar y enviar.',
      hint: 'Analógico entra, digital sale.',
    },
    outro: '¡Los sensores hablan de nuevo! Falta el último paso: que todos vean el estado del campus.',
  },
  {
    id: 'chapter-5',
    number: 5,
    title: 'La app del campus',
    area: 'software',
    location: 'Casa Central',
    glyph: 'code',
    rewardXp: 700,
    map: { x: 47, y: 15 },
    dialogue: [
      { mood: 'happy', text: 'Redes, señal, seguridad y sensores funcionando. ¡Casi lo logramos!' },
      { mood: 'think', text: 'Queremos una app que muestre en tiempo real qué laboratorios tienen señal.' },
      { mood: 'neutral', text: 'Diseñemos cómo la app obtiene esa información.' },
    ],
    challenge: {
      prompt: 'La app debe mostrar a todos el estado actualizado de cada laboratorio. ¿Qué arquitectura conviene?',
      options: [
        'Que cada teléfono consulte a un servidor central mediante una API',
        'Imprimir la lista y pegarla en la entrada',
        'Que la app adivine según la hora',
        'Enviar un correo a cada estudiante cada minuto',
      ],
      answerIndex: 0,
      explanation: 'En una arquitectura cliente-servidor, la app consulta a un servidor mediante una API; así todos ven la misma información actualizada.',
      hint: 'Una sola fuente de verdad, muchos clientes.',
    },
    outro: 'La señal del campus está restaurada. ¡Eres parte del equipo TEL!',
  },
];

export function getChapter(id: string): StoryChapter | undefined {
  return storyChapters.find((chapter) => chapter.id === id);
}
