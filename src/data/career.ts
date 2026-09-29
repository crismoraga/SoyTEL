import type { MedallionGlyph } from '@/graphics/medallions';
import type { KnowledgeArea } from '@/types/game';

export type CareerAreaId = KnowledgeArea | 'innovacion';

export interface CareerArea {
  id: CareerAreaId;
  name: string;
  short: string;
  tagline: string;
  glyph: MedallionGlyph;
  description: string;
  examples: string[];
  practiceLabel: string;
}

// Contenido de "Conoce la carrera". Descripciones generales de las áreas de Ingeniería Civil Telemática.
export const careerAreas: CareerArea[] = [
  {
    id: 'redes',
    name: 'Redes y conectividad',
    short: 'Redes',
    tagline: 'Conectando personas.',
    glyph: 'network',
    description: 'Diseñas y administras cómo viajan los datos: routers, switches, protocolos TCP/IP y la arquitectura que conecta desde un laboratorio hasta un país.',
    examples: ['Configurar la red Wi-Fi de un campus', 'Unir sucursales de una empresa en una sola red', 'Detectar cuellos de botella en el tráfico'],
    practiceLabel: 'Practicar redes',
  },
  {
    id: 'teleco',
    name: 'Telecomunicaciones',
    short: 'Teleco',
    tagline: 'Señales que cruzan el mundo.',
    glyph: 'antenna',
    description: 'Estudias cómo la información viaja como señal: antenas, fibra óptica, radio, redes móviles 4G/5G y satélites, aprovechando al máximo el espectro.',
    examples: ['Planificar la cobertura de antenas en una ciudad', 'Diseñar enlaces de fibra óptica', 'Analizar interferencias en una señal inalámbrica'],
    practiceLabel: 'Practicar telecomunicaciones',
  },
  {
    id: 'software',
    name: 'Programación y software',
    short: 'Software',
    tagline: 'Construye soluciones.',
    glyph: 'code',
    description: 'Desarrollas aplicaciones y servicios que funcionan sobre la red: apps móviles, sistemas web, APIs en la nube y automatización de infraestructura.',
    examples: ['Crear una app como SoyTEL', 'Automatizar la configuración de cientos de equipos', 'Desarrollar servicios en la nube'],
    practiceLabel: 'Practicar software',
  },
  {
    id: 'seguridad',
    name: 'Ciberseguridad',
    short: 'Seguridad',
    tagline: 'Un entorno digital más seguro.',
    glyph: 'shield',
    description: 'Proteges redes, datos y personas: criptografía, firewalls, detección de intrusos y respuesta ante incidentes.',
    examples: ['Diseñar políticas de acceso seguras', 'Investigar un incidente de seguridad', 'Enseñar a reconocer el phishing'],
    practiceLabel: 'Practicar ciberseguridad',
  },
  {
    id: 'hardware',
    name: 'Electrónica e IoT',
    short: 'Hardware',
    tagline: 'Del circuito al sensor.',
    glyph: 'chip',
    description: 'Entiendes los dispositivos que procesan señales: electrónica digital, microcontroladores y sensores conectados al Internet de las cosas.',
    examples: ['Programar un sensor que envía datos a la nube', 'Entender cómo un chip procesa bits', 'Prototipar dispositivos IoT'],
    practiceLabel: 'Practicar electrónica',
  },
  {
    id: 'innovacion',
    name: 'Datos e innovación',
    short: 'Innovación',
    tagline: 'Ideas que transforman.',
    glyph: 'bulb',
    description: 'Usas datos y tecnología para crear soluciones nuevas: análisis de información, ciudades inteligentes, investigación y emprendimiento.',
    examples: ['Analizar datos para mejorar un servicio', 'Participar en proyectos de investigación', 'Emprender con una solución tecnológica'],
    practiceLabel: 'Vivir la historia de Telix',
  },
];

export function getCareerArea(id: string): CareerArea | undefined {
  return careerAreas.find((area) => area.id === id);
}

export const ADMISSION_URL = 'https://admision.usm.cl';
export const USM_URL = 'https://www.usm.cl';
