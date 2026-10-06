import type { RutixExpression, RutixPose } from '@/graphics/rutix';

// Juegos con Rutix: lo que dice y hace cuando lo tocas, le chocas la mano, le pides un chiste,
// lo haces bailar o respondes su "¿verdadero o falso?". Todo sin límite diario: es para divertirse.

export interface RutixReaction {
  text: string;
  expression: RutixExpression;
  pose: RutixPose;
}

// Toques seguidos: de saludo a cosquillas.
export const tickleReactions: RutixReaction[] = [
  { text: '¡Jiji! Eso me sube la señal.', expression: 'love', pose: 'wave' },
  { text: '¡Hola, hola! Te recibo fuerte y claro.', expression: 'happy', pose: 'wave' },
  { text: '¡Jajaja! ¡Cosquillas en la antena no!', expression: 'laugh', pose: 'celebrate' },
  { text: '¡Uy! Casi me desconfiguras.', expression: 'surprised', pose: 'shrug' },
  { text: '¡Otra vez! Me encanta cuando juegas conmigo.', expression: 'wink', pose: 'thumbsUp' },
  { text: '¡Jajajaja! ¡Me rindo, me rindo!', expression: 'laugh', pose: 'celebrate' },
];

export const highFiveLines = ['¡Chócala! Conexión establecida.', '¡Esa! Apretón de manos como en TCP: SYN, SYN-ACK, ACK.', '¡Chócala fuerte! Paquete entregado.', '¡Buena! Somos un gran equipo.'];

export const danceLines = ['¡Mira mis pasos! Este se llama «el router».', '¡A bailar al ritmo de los bits! 1, 0, 1, 1…', '¡Paso de onda! Arriba, abajo, arriba, abajo.', '¡Baile de la fibra óptica: puro brillo!'];

export const rutixJokes = [
  '¿Por qué el router fue al psicólogo? Porque tenía muchos conflictos de IP.',
  '¿Qué le dijo un bit al otro? «Nos vemos en el bus».',
  '¿Cuál es el colmo de un cable de red? Quedarse sin conexión con su pareja.',
  'Toc, toc. — ¿Quién es? — … (ocho segundos después) … — ¡El Wi-Fi lento!',
  '¿Por qué los programadores confunden Halloween con Navidad? Porque OCT 31 es igual a DEC 25.',
  '¿Qué hace una antena en una fiesta? ¡Capta toda la onda!',
  'Hay 10 tipos de personas: las que entienden binario y las que no.',
  '¿Por qué el paquete de datos llegó tarde? Se quedó pegado en un taco… de la red.',
  '¿Cómo se despide un firewall? «Tú no pasas… pero cuídate».',
  '¿Qué le dijo el switch al router? «Tú ve por Internet, yo cuido la casa».',
  'Mi contraseña era «incorrecta». Así, cuando me equivoco, el computador me la recuerda.',
  '¿Por qué la nube nunca pierde nada? Porque siempre tiene un respaldo bajo la manga.',
];

export interface TrueFalse {
  statement: string;
  answer: boolean;
  why: string;
}

export const rutixTrueFalse: TrueFalse[] = [
  { statement: 'La fibra óptica transmite los datos como pulsos de luz.', answer: true, why: 'Sí: la luz rebota dentro de un hilo de vidrio muy fino y así viaja kilómetros.' },
  { statement: 'El Wi-Fi viaja por el aire usando ondas de radio.', answer: true, why: 'Exacto: son ondas de radio, parientes de las que usa la radio FM.' },
  { statement: 'Un byte tiene 10 bits.', answer: false, why: 'Un byte tiene 8 bits. Con 8 bits se pueden formar 256 combinaciones.' },
  { statement: 'Internet y la web son exactamente lo mismo.', answer: false, why: 'Internet es la red de redes; la web es uno de los servicios que funcionan sobre ella.' },
  { statement: 'Una contraseña corta con tu nombre es muy segura.', answer: false, why: 'Las contraseñas cortas y predecibles se adivinan en segundos. Mejor larga y variada.' },
  { statement: 'El DNS traduce nombres como usm.cl a direcciones IP.', answer: true, why: 'Es como la agenda de contactos de Internet: tú escribes el nombre y él busca el número.' },
  { statement: 'Los cables submarinos llevan casi todo el tráfico de Internet entre continentes.', answer: true, why: 'Más del 95% viaja por cables de fibra en el fondo del mar, no por satélites.' },
  { statement: 'El GPS de tu teléfono envía señales a los satélites para saber dónde estás.', answer: false, why: 'Tu teléfono solo escucha: calcula su posición comparando las señales que le llegan.' },
  { statement: 'En binario, el número 5 se escribe 101.', answer: true, why: '4 + 0 + 1 = 5. Cada posición vale el doble que la de su derecha.' },
  { statement: 'Un firewall sirve para acelerar el Wi-Fi.', answer: false, why: 'El firewall protege: revisa el tráfico y bloquea lo que no cumple las reglas.' },
  { statement: 'El 5G usa ondas de radio, igual que el 4G.', answer: true, why: 'Ambos usan radio; el 5G aprovecha más frecuencias y mueve más datos.' },
  { statement: 'Un router y un módem hacen exactamente la misma tarea.', answer: false, why: 'El módem trae la señal del proveedor; el router reparte la conexión entre tus equipos.' },
  { statement: 'Si un sitio empieza con https, la conexión va cifrada.', answer: true, why: 'La «s» es de seguro: lo que viaja entre tu equipo y el sitio va cifrado.' },
  { statement: 'La telemática mezcla telecomunicaciones con informática.', answer: true, why: '¡De ahí viene el nombre! Redes, software, datos y hardware trabajando juntos.' },
];

// Elige un elemento distinto al anterior (para no repetir chiste dos veces seguidas).
export function pickDifferent<T>(items: T[], previous: number, random: () => number = Math.random): number {
  if (items.length <= 1) return 0;
  if (previous < 0 || previous >= items.length) return Math.floor(random() * items.length);
  const next = Math.floor(random() * (items.length - 1));
  return next >= previous ? next + 1 : next;
}
