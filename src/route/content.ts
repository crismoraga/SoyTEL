import type { IconName } from '@/graphics/icons';
import type { CheckinStop, PillarId, RouteStop, StationGameId } from './types';

export interface StopInfo {
  id: RouteStop;
  place: string;
  title: string;
  summary: string;
  icon: IconName;
}

// Paradas físicas de la ruta, en orden.
export const routeStops: StopInfo[] = [
  {
    id: 'stand',
    place: 'Stand Telemática',
    title: 'Punto de partida',
    summary: 'Ingresa el código del stand para unirte al grupo y jugar en simultáneo.',
    icon: 'flag',
  },
  {
    id: 'b215',
    place: 'Sala B215',
    title: 'Laboratorio de redes',
    summary: 'Routers, switches, access points y cables: la red del laboratorio te necesita.',
    icon: 'router',
  },
  {
    id: 'b213',
    place: 'Sala B213',
    title: 'Pilares de Telemática',
    summary: 'Cinco proyectos, cinco pilares: Datos, Software, Redes, Telecomunicaciones y Hardware.',
    icon: 'temple',
  },
  {
    id: 'hall',
    place: 'Pasillo',
    title: 'Cierre final',
    summary: 'Trivia en vivo sobre todo lo que viste: responde rápido para sumar más puntos.',
    icon: 'podium',
  },
];

export function stopInfo(id: RouteStop): StopInfo {
  return routeStops.find((stop) => stop.id === id) ?? routeStops[0];
}

export const checkinCopy: Record<CheckinStop, { heading: string; hint: string; confirm: string }> = {
  b215: {
    heading: 'Vayan a la sala B215',
    hint: 'Cuando estés dentro del laboratorio de redes, confirma tu llegada. El juego parte cuando todo el grupo esté en la sala.',
    confirm: 'Estoy en la sala B215',
  },
  b213: {
    heading: 'Avancen a la sala B213',
    hint: 'Ahí están los proyectos de los pilares de Telemática. Confirma cuando llegues para desbloquear sus juegos.',
    confirm: 'Estoy en la sala B213',
  },
  hall: {
    heading: 'Salgan al pasillo',
    hint: 'Llegó el cierre: trivia en vivo con todo el grupo. Confirma cuando estés en el pasillo.',
    confirm: 'Estoy en el pasillo',
  },
};

export interface PillarInfo {
  id: PillarId;
  pillar: string;
  project: string;
  game: string;
  summary: string;
  icon: IconName;
  color: string;
  ink: string;
}

// Los cinco pilares de Didactic-Tel (d1ft3l.cl) y el proyecto que los muestra en B213.
export const pillars: PillarInfo[] = [
  {
    id: 'datos',
    pillar: 'Datos',
    project: 'Procesamiento digital de imágenes',
    game: 'Entrena la IA',
    summary: 'Etiqueta imágenes, elige un filtro y entrena un modelo de machine learning que las clasifica.',
    icon: 'neural',
    color: '#9B8AE6',
    ink: '#3E2F86',
  },
  {
    id: 'software',
    pillar: 'Software',
    project: 'Shielded · ciberseguridad',
    game: 'Escudo digital',
    summary: 'Como en la app Shielded: detecta phishing y amenazas antes de que lleguen a tu teléfono.',
    icon: 'shieldCheck',
    color: '#E58A5A',
    ink: '#7A3514',
  },
  {
    id: 'redes',
    pillar: 'Redes',
    project: 'Telefonía IP',
    game: 'Llamada IP',
    summary: 'Marca desde un teléfono fijo, arma la señalización SIP y ordena los paquetes de voz.',
    icon: 'phone',
    color: '#4FB38A',
    ink: '#1D5C44',
  },
  {
    id: 'teleco',
    pillar: 'Telecomunicaciones',
    project: 'Fibra óptica y láser',
    game: 'Viaje de la luz',
    summary: 'Apunta el láser para que la luz rebote dentro de la fibra y transmite un mensaje en pulsos.',
    icon: 'laser',
    color: '#6FB3D9',
    ink: '#1E5B7F',
  },
  {
    id: 'hardware',
    pillar: 'Hardware',
    project: 'Arduino, ESP32 y Raspberry Pi',
    game: 'Placas maker',
    summary: 'Elige la placa correcta, conecta un LED y programa su parpadeo.',
    icon: 'board',
    color: '#E0B84A',
    ink: '#6B5320',
  },
];

export function pillarInfo(id: PillarId): PillarInfo {
  return pillars.find((pillar) => pillar.id === id) ?? pillars[0];
}

export const pillarIds: PillarId[] = pillars.map((pillar) => pillar.id);

export const stationTitles: Record<StationGameId, string> = {
  'red-b215': 'Operación Red B215',
  datos: 'Entrena la IA',
  software: 'Escudo digital',
  redes: 'Llamada IP',
  teleco: 'Viaje de la luz',
  hardware: 'Placas maker',
};

// Colores y formas de las alternativas de la trivia (estilo Kahoot, distinguibles sin color).
export const answerStyles = [
  { color: '#E0605A', shape: 'triangle' as const, label: 'Triángulo' },
  { color: '#3E8FD0', shape: 'diamond' as const, label: 'Rombo' },
  { color: '#D9A42B', shape: 'circle' as const, label: 'Círculo' },
  { color: '#3FA66B', shape: 'square' as const, label: 'Cuadrado' },
];
