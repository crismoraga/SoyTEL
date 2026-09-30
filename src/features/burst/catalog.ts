import type { IconName } from '@/graphics/icons';
import type { KnowledgeArea, MicroGameId } from '@/types/game';

export interface MicroGameInfo {
  id: MicroGameId;
  title: string;
  instruction: string;
  durationSeconds: number;
  icon: IconName;
  area: KnowledgeArea;
  mechanic: string;
}

// Metadatos de los 12 microjuegos (sin componentes, para listas y pruebas).
export const microGameCatalog: MicroGameInfo[] = [
  { id: 'connect-network', title: 'Conecta la red', instruction: 'Toca el equipo que falta para llegar a Internet.', durationSeconds: 10, icon: 'router', area: 'redes', mechanic: 'Elige' },
  { id: 'clean-signal', title: 'Señal limpia', instruction: 'Elige el medio con menos interferencia.', durationSeconds: 10, icon: 'wave', area: 'teleco', mechanic: 'Compara' },
  { id: 'ping-check', title: '¿Ping o no ping?', instruction: 'Lee la terminal: ¿hay conectividad?', durationSeconds: 9, icon: 'terminal', area: 'redes', mechanic: 'Lee' },
  { id: 'color-code', title: 'Crimpado RJ45', instruction: 'Completa el color que falta en el cable T568B.', durationSeconds: 12, icon: 'plug', area: 'hardware', mechanic: 'Completa' },
  { id: 'firewall', title: 'Firewall', instruction: 'Permite el tráfico legítimo y bloquea el malicioso.', durationSeconds: 14, icon: 'shieldCheck', area: 'seguridad', mechanic: 'Clasifica' },
  { id: 'signal-timing', title: 'Sintoniza la antena', instruction: 'Detén la aguja dentro de la zona verde.', durationSeconds: 8, icon: 'antenna', area: 'teleco', mechanic: 'Reflejos' },
  { id: 'sequence-memory', title: 'Ruta de paquetes', instruction: 'Memoriza la ruta y repítela en orden.', durationSeconds: 14, icon: 'network', area: 'redes', mechanic: 'Memoria' },
  { id: 'packet-rush', title: 'Congestión de red', instruction: '¡Envía 12 paquetes antes de que se acabe el tiempo!', durationSeconds: 8, icon: 'send', area: 'redes', mechanic: 'Velocidad' },
  { id: 'cable-connect', title: 'Conecta el cable', instruction: 'Arrastra cada cable a su puerto del mismo color.', durationSeconds: 12, icon: 'move', area: 'hardware', mechanic: 'Arrastra' },
  { id: 'packet-catch', title: 'Atrapa el paquete', instruction: 'Toca 5 paquetes sanos y evita los infectados.', durationSeconds: 12, icon: 'packet', area: 'seguridad', mechanic: 'Atrapa' },
  { id: 'wifi-boost', title: 'Wi-Fi Boost', instruction: 'Arrastra el router hasta tener señal completa.', durationSeconds: 12, icon: 'wifi', area: 'teleco', mechanic: 'Ubica' },
  { id: 'password-strong', title: 'Contraseña fuerte', instruction: 'Arma una contraseña que llegue a «Muy fuerte».', durationSeconds: 15, icon: 'key', area: 'seguridad', mechanic: 'Construye' },
];

export function getMicroGameInfo(id: string): MicroGameInfo | undefined {
  return microGameCatalog.find((game) => game.id === id);
}
