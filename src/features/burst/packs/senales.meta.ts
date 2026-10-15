import type { MicroGameId } from '@/types/game';
import type { MicroGameInfo } from '../catalog';
import type { MicroGameGuide } from '../guides';

// Paquete de microjuegos · Señales: ondas, modulación, canales Wi-Fi, fibra óptica, ruido y muestreo.
export const senalesInfo: MicroGameInfo[] = [
  { id: 'wave-frequency', title: '¿Cuál vibra más rápido?', instruction: 'Compara las ondas y elige la que pide la pregunta.', tip: 'Cuenta las vueltas: más vueltas en el mismo espacio es más frecuencia.', durationSeconds: 10, icon: 'frequency', area: 'teleco', mechanic: 'Compara', course: 'Calor y Ondas · 4.º semestre' },
  { id: 'am-fm', title: '¿AM o FM?', instruction: 'Mira la onda y di cómo está modulada.', tip: 'Si cambia la altura es AM; si cambia lo apretadas que están, es FM.', durationSeconds: 10, icon: 'modulation', area: 'teleco', mechanic: 'Identifica', course: 'Principios de Comunicaciones · 6.º semestre' },
  { id: 'wifi-channel', title: 'Canal libre', instruction: 'Pon tu Wi-Fi en el canal más despejado.', tip: 'Los canales 1, 6 y 11 no se pisan: elige el que tenga menos vecinos.', durationSeconds: 10, icon: 'channel', area: 'teleco', mechanic: 'Elige', course: 'Laboratorio de Comunicaciones · 7.º semestre' },
  { id: 'fiber-angle', title: 'Luz atrapada', instruction: 'Elige el ángulo que mantiene la luz en la fibra.', tip: 'La luz tiene que entrar casi derecha para rebotar por dentro.', durationSeconds: 12, icon: 'angle', area: 'teleco', mechanic: 'Elige', course: 'Fundamentos de Transmisión de Señales · 5.º semestre' },
  { id: 'signal-noise', title: 'Señal clara', instruction: 'Encuentra la señal con menos ruido.', tip: 'La señal limpia se ve suave; el ruido la llena de picos.', durationSeconds: 10, icon: 'noise', area: 'teleco', mechanic: 'Compara', course: 'Principios de Comunicaciones · 6.º semestre' },
  { id: 'sampling', title: 'Muestrea la onda', instruction: '¿Cuántas muestras necesitas para guardar la onda?', tip: 'Toma al menos el doble de muestras que la frecuencia de la onda.', durationSeconds: 12, icon: 'sampling', area: 'teleco', mechanic: 'Calcula', course: 'Fundamentos de Transmisión de Señales · 5.º semestre' },
];

export const senalesGuides: Partial<Record<MicroGameId, MicroGameGuide>> = {
  'wave-frequency': { steps: ['Cuenta cuántas vueltas da cada onda.', 'Toca la letra de la que pide la pregunta.'], learn: 'La frecuencia es cuántas veces vibra una onda por segundo; se mide en hertz (Hz).' },
  'am-fm': { steps: ['Mira si cambia la altura o la separación de la onda.', 'Toca AM, FM o sin modular.'], learn: 'Modular es montar el mensaje en una onda portadora, cambiando su amplitud (AM) o su frecuencia (FM).' },
  'wifi-channel': { steps: ['Mira cuántas redes vecinas hay en cada canal.', 'Toca el canal con menos.'], learn: 'Elegir un canal con menos redes reduce la interferencia y hace más rápido el Wi-Fi.' },
  'fiber-angle': { steps: ['Lee los ángulos posibles.', 'Toca el que deja la luz rebotando dentro.'], learn: 'La fibra óptica guía la luz por reflexión total interna: si entra muy inclinada, se escapa.' },
  'signal-noise': { steps: ['Compara las tres señales.', 'Toca la que se ve más suave.'], learn: 'Mientras más alta la relación señal/ruido, mejor llega el mensaje.' },
  'sampling': { steps: ['Lee cuántas veces vibra la onda por segundo.', 'Elige el doble: es el mínimo.'], learn: 'Para digitalizar una señal hay que muestrearla al menos al doble de su frecuencia (Nyquist).' },
};
