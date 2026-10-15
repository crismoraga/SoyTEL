import type { MicroGameId } from '@/types/game';
import type { MicroGameInfo } from '../catalog';
import type { MicroGameGuide } from '../guides';

// Paquete de microjuegos · Redes: switch, router, DNS, TCP, subredes y topologías.
// Metadatos (sin componentes): título, instrucción, consejo de Rutix, duración, ícono, área y ramo.
export const redesInfo: MicroGameInfo[] = [
  {
    id: 'switch-learn',
    title: 'El switch reparte',
    instruction: 'Entrega el sobre: toca el puerto de su destinatario.',
    tip: 'El switch sabe qué equipo hay en cada puerto y manda cada mensaje solo por el puerto correcto.',
    durationSeconds: 10,
    icon: 'switchPorts',
    area: 'redes',
    mechanic: 'Entrega',
    course: 'Redes de Computadores · 3.er semestre',
  },
  {
    id: 'router-table',
    title: '¿Por dónde sale?',
    instruction: 'Busca el destino en la tabla y toca por dónde sale.',
    tip: 'El router compara el destino con cada línea de su tabla. Si ninguna coincide, usa «lo demás».',
    durationSeconds: 12,
    icon: 'routerTable',
    area: 'redes',
    mechanic: 'Enruta',
    course: 'Administración de Redes · 5.º semestre',
  },
  {
    id: 'dns-agenda',
    title: 'Agenda DNS',
    instruction: 'Busca el nombre en la agenda y toca su dirección IP.',
    tip: 'El DNS es la agenda de Internet: pasa nombres a IP. Ojo: usm.cl y usm.com son distintos.',
    durationSeconds: 10,
    icon: 'dns',
    area: 'redes',
    mechanic: 'Busca',
    course: 'Redes de Computadores · 3.er semestre',
  },
  {
    id: 'tcp-handshake',
    title: 'Saludo TCP',
    instruction: 'Toca los mensajes en el orden del saludo.',
    tip: 'SYN pide hablar, SYN-ACK acepta y ACK confirma. FIN no es del saludo: sirve para despedirse.',
    durationSeconds: 10,
    icon: 'handshake',
    area: 'redes',
    mechanic: 'Ordena',
    course: 'Redes de Computadores · 3.er semestre',
  },
  {
    id: 'same-subnet',
    title: '¿Misma red?',
    instruction: 'Elige cómo viaja el mensaje entre los dos equipos.',
    tip: 'Compara solo la parte de red: con /24 son los 3 primeros números; con /16, los 2 primeros.',
    durationSeconds: 12,
    icon: 'network',
    area: 'redes',
    mechanic: 'Compara',
    course: 'Administración de Redes · 5.º semestre',
  },
  {
    id: 'topology-pick',
    title: '¿Qué topología?',
    instruction: 'Mira cómo se conectan los equipos y elige su topología.',
    tip: 'Estrella: un equipo al centro. Anillo: un círculo. Bus: un cable largo. Malla: todos con todos.',
    durationSeconds: 10,
    icon: 'topology',
    area: 'redes',
    mechanic: 'Identifica',
    course: 'Planificación de Infraestructura Telemática · 8.º semestre',
  },
];

// Cómo se juega (2 o 3 pasos cortos) y qué se aprende.
export const redesGuides: Partial<Record<MicroGameId, MicroGameGuide>> = {
  'switch-learn': {
    steps: ['Lee a quién va dirigido el sobre.', 'Toca el puerto donde está conectado ese equipo.'],
    learn: 'Un switch aprende la dirección MAC de cada equipo conectado y entrega cada mensaje solo por el puerto de su destinatario.',
  },
  'router-table': {
    steps: ['Mira la IP de destino del paquete.', 'Busca la línea de la tabla que empieza igual.', 'Si ninguna coincide, toca «lo demás» (Internet).'],
    learn: 'Un router decide por dónde sale cada paquete comparando su IP de destino con la tabla de rutas; lo que no coincide va por la ruta por defecto.',
  },
  'dns-agenda': {
    steps: ['Lee el nombre por el que preguntan.', 'Búscalo en la agenda y toca la IP de su fila.'],
    learn: 'El DNS traduce los nombres que escribimos (como usm.cl) en las direcciones IP que usan los equipos para encontrarse.',
  },
  'tcp-handshake': {
    steps: ['Mira qué equipo habla en cada flecha.', 'Toca SYN, SYN-ACK y ACK en ese orden.', 'No toques los mensajes que no son del saludo (FIN).'],
    learn: 'Antes de intercambiar datos, TCP abre la conexión con tres mensajes: SYN, SYN-ACK y ACK, el saludo en tres pasos.',
  },
  'same-subnet': {
    steps: ['Mira la máscara: los 255 marcan los números de la red.', 'Compara esos números en las dos IP.', 'Si son iguales, toca «Directo por el switch»; si no, «Pasa por el router».'],
    learn: 'Dos equipos hablan directo por el switch solo si están en la misma red; si no, el mensaje debe pasar por un router.',
  },
  'topology-pick': {
    steps: ['Observa cómo se unen los equipos entre sí.', 'Toca el nombre de la topología que ves.'],
    learn: 'La topología es la forma en que se conectan los equipos de una red: estrella, anillo, bus o malla.',
  },
};
