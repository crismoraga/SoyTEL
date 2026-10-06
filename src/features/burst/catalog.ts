import type { IconName } from '@/graphics/icons';
import type { KnowledgeArea, MicroGameId } from '@/types/game';

export interface MicroGameInfo {
  id: MicroGameId;
  title: string;
  instruction: string;
  // Consejo de Rutix antes de empezar la ronda.
  tip: string;
  durationSeconds: number;
  icon: IconName;
  area: KnowledgeArea;
  mechanic: string;
}

// Metadatos de los 18 microjuegos (sin componentes, para listas y pruebas).
export const microGameCatalog: MicroGameInfo[] = [
  { id: 'connect-network', title: 'Conecta la red', instruction: 'Toca el equipo que falta para llegar a Internet.', tip: 'El router es la puerta a Internet; el switch une los equipos de una misma red.', durationSeconds: 10, icon: 'router', area: 'redes', mechanic: 'Elige' },
  { id: 'clean-signal', title: 'Señal limpia', instruction: 'Elige el medio con menos interferencia.', tip: 'La fibra casi no sufre interferencia. Más oscilaciones en el mismo tiempo = más frecuencia.', durationSeconds: 10, icon: 'wave', area: 'teleco', mechanic: 'Compara' },
  { id: 'ping-check', title: '¿Ping o no ping?', instruction: 'Lee la terminal: ¿hay conectividad?', tip: 'Si responde con «bytes de…» y un tiempo en ms, el otro equipo está vivo.', durationSeconds: 9, icon: 'terminal', area: 'redes', mechanic: 'Lee' },
  { id: 'color-code', title: 'Crimpado RJ45', instruction: 'Completa el color que falta en el cable T568B.', tip: 'T568B parte así: blanco-naranja, naranja, blanco-verde, azul…', durationSeconds: 12, icon: 'plug', area: 'hardware', mechanic: 'Completa' },
  { id: 'firewall', title: 'Firewall', instruction: 'Permite el tráfico legítimo y bloquea el malicioso.', tip: 'Desconfía de Telnet, de los archivos .exe y de muchos intentos seguidos.', durationSeconds: 14, icon: 'shieldCheck', area: 'seguridad', mechanic: 'Clasifica' },
  { id: 'signal-timing', title: 'Sintoniza la antena', instruction: 'Detén la aguja dentro de la zona verde.', tip: 'Sigue el vaivén de la aguja y toca un instante antes de la zona verde.', durationSeconds: 8, icon: 'antenna', area: 'teleco', mechanic: 'Reflejos' },
  { id: 'sequence-memory', title: 'Ruta de paquetes', instruction: 'Memoriza la ruta y repítela en orden.', tip: 'Di la ruta en voz baja mientras se ilumina: te ayuda a recordarla.', durationSeconds: 14, icon: 'network', area: 'redes', mechanic: 'Memoria' },
  { id: 'packet-rush', title: 'Congestión de red', instruction: '¡Envía 12 paquetes antes de que se acabe el tiempo!', tip: 'Toca parejo y sin pausas: son 12 envíos.', durationSeconds: 8, icon: 'send', area: 'redes', mechanic: 'Velocidad' },
  { id: 'cable-connect', title: 'Conecta el cable', instruction: 'Arrastra cada cable a su puerto del mismo color.', tip: 'Lleva cada cable hasta el puerto de su mismo color y suéltalo encima.', durationSeconds: 12, icon: 'move', area: 'hardware', mechanic: 'Arrastra' },
  { id: 'packet-catch', title: 'Atrapa el paquete', instruction: 'Toca 5 paquetes sanos y evita los infectados.', tip: 'Los paquetes rojos están infectados: déjalos pasar.', durationSeconds: 12, icon: 'packet', area: 'seguridad', mechanic: 'Atrapa' },
  { id: 'wifi-boost', title: 'Wi-Fi Boost', instruction: 'Arrastra el router hasta tener señal completa.', tip: 'Acerca el router al notebook y aléjalo del microondas.', durationSeconds: 12, icon: 'wifi', area: 'teleco', mechanic: 'Ubica' },
  { id: 'password-strong', title: 'Contraseña fuerte', instruction: 'Arma una contraseña que llegue a «Muy fuerte».', tip: 'Mezcla palabras, mayúsculas, números y símbolos. Mientras más larga, mejor.', durationSeconds: 15, icon: 'key', area: 'seguridad', mechanic: 'Construye' },
  { id: 'binary-bits', title: 'Bits en orden', instruction: 'Enciende los bits que suman el número.', tip: 'Parte por el bit más grande que quepa y completa con los chicos.', durationSeconds: 14, icon: 'hash', area: 'hardware', mechanic: 'Binario' },
  { id: 'layer-order', title: 'Capas de Internet', instruction: 'Toca las capas desde el cable hasta la app.', tip: 'Primero el medio (Wi-Fi o cable), luego la IP, después TCP y arriba la app.', durationSeconds: 14, icon: 'server', area: 'redes', mechanic: 'Ordena' },
  { id: 'ip-valid', title: '¿IP válida?', instruction: 'Encuentra la dirección IPv4 bien escrita.', tip: 'Cuatro números del 0 al 255, separados por puntos. Ni más ni menos.', durationSeconds: 12, icon: 'globe', area: 'redes', mechanic: 'Elige' },
  { id: 'fast-route', title: 'Ruta más rápida', instruction: 'Elige la ruta con menos latencia total.', tip: 'Suma los milisegundos de cada salto: gana el total más bajo.', durationSeconds: 15, icon: 'route', area: 'redes', mechanic: 'Calcula' },
  { id: 'safe-url', title: 'Sitio verdadero', instruction: 'Elige la dirección web oficial.', tip: 'Mira el final del dominio: usm.cl.algo.ru no es de la USM.', durationSeconds: 14, icon: 'shieldLock', area: 'seguridad', mechanic: 'Detecta' },
  { id: 'unit-order', title: 'De bit a giga', instruction: 'Ordena las unidades de menor a mayor.', tip: 'bit → byte → kilo → mega → giga. Cada paso es mil veces más (salvo el primero: 8 bits).', durationSeconds: 12, icon: 'database', area: 'software', mechanic: 'Ordena' },
];

export function getMicroGameInfo(id: string): MicroGameInfo | undefined {
  return microGameCatalog.find((game) => game.id === id);
}
