import type { MedallionGlyph } from '@/graphics/medallions';
import type { StoryChallenge } from './story';

export interface JourneyStation {
  number: number;
  name: string;
  place: string;
  glyph: MedallionGlyph;
  task: string;
  challenge: StoryChallenge;
  points: number;
}

// Estaciones del Recorrido conjunto (inspiradas en "Mi ruta" y "Reto de estación" de Claude Design).
export const journeyStations: JourneyStation[] = [
  {
    number: 1,
    name: 'Bienvenida a Telemática',
    place: 'Punto de encuentro',
    glyph: 'users',
    points: 50,
    task: 'Preséntense: cada integrante dice qué app usa más y qué red la conecta.',
    challenge: {
      prompt: '¿Qué une a millones de redes independientes en todo el mundo?',
      options: ['Internet', 'Un solo cable gigante', 'La radio AM', 'El Bluetooth'],
      answerIndex: 0,
      explanation: 'Internet es una red de redes: millones de redes interconectadas que hablan protocolos comunes.',
      hint: 'Es una red de redes.',
    },
  },
  {
    number: 2,
    name: 'Redes y conectividad',
    place: 'Rincón de redes',
    glyph: 'network',
    points: 50,
    task: 'Ordenen la ruta de un mensaje: celular → Wi-Fi → router → Internet → servidor.',
    challenge: {
      prompt: '¿Qué equipo decide por dónde enviar un paquete hacia otra red?',
      options: ['El router', 'El monitor', 'El teclado', 'El parlante'],
      answerIndex: 0,
      explanation: 'El router elige la mejor ruta para cada paquete según su dirección IP de destino.',
      hint: 'Su nombre viene de "ruta".',
    },
  },
  {
    number: 3,
    name: 'Ciberseguridad',
    place: 'Zona segura',
    glyph: 'shield',
    points: 50,
    task: 'Cada integrante inventa una frase-contraseña de cuatro palabras al azar (¡sin decirla en voz alta!).',
    challenge: {
      prompt: '¿Cuál de estas contraseñas es más difícil de adivinar para un atacante?',
      options: ['123456', 'Telematica2026', 'maleta-nube-4-faro', 'qwerty'],
      answerIndex: 2,
      explanation: 'Una frase larga con palabras al azar tiene muchas más combinaciones posibles que una palabra corta o una secuencia conocida.',
      hint: 'Largo y al azar le gana a corto y predecible.',
    },
  },
  {
    number: 4,
    name: 'Software y datos',
    place: 'Sala de proyectos',
    glyph: 'database',
    points: 50,
    task: 'En un minuto, definan qué datos necesita una app para mostrar el ranking del grupo.',
    challenge: {
      prompt: 'Para guardar el puntaje de miles de jugadores y ordenarlos, ¿qué conviene usar?',
      options: ['Una base de datos', 'Una foto de la pantalla', 'Un post-it', 'La memoria del mouse'],
      answerIndex: 0,
      explanation: 'Una base de datos guarda la información de forma estructurada y permite ordenarla y consultarla rápido.',
      hint: 'Piensa en dónde viven los datos de una app.',
    },
  },
  {
    number: 5,
    name: 'Innovación y futuro',
    place: 'Auditorio',
    glyph: 'bulb',
    points: 50,
    task: 'Propongan una idea tecnológica que mejore el campus y denle un nombre.',
    challenge: {
      prompt: '¿Qué tecnología conecta sensores cotidianos, como medidores o semáforos, a Internet?',
      options: ['IoT (Internet de las cosas)', 'El fax', 'El disquete', 'El telégrafo'],
      answerIndex: 0,
      explanation: 'El Internet de las cosas conecta objetos con sensores a la red para medir, automatizar y decidir mejor.',
      hint: 'Internet de las…',
    },
  },
];
