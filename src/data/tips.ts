import type { KnowledgeArea } from '@/types/game';

export interface Tip {
  id: string;
  area: KnowledgeArea | 'general';
  text: string;
}

// Datos curiosos breves para el aviso diario y para Telix.
export const tips: Tip[] = [
  { id: 'fiber-light', area: 'teleco', text: 'La fibra óptica transmite datos con pulsos de luz que viajan por un hilo de vidrio más delgado que un cabello.' },
  { id: 'arpanet-lo', area: 'redes', text: 'El primer mensaje de ARPANET, en 1969, fue «LO»: el sistema se cayó antes de completar la palabra «LOGIN».' },
  { id: 'ipv4-ipv6', area: 'redes', text: 'Una dirección IPv4 tiene 32 bits y alcanza para unos 4.300 millones de equipos; IPv6 usa 128 bits.' },
  { id: 'wifi-microwave', area: 'teleco', text: 'El Wi-Fi de 2,4 GHz comparte banda con los hornos microondas: por eso a veces se interfieren.' },
  { id: 'dns-guide', area: 'redes', text: 'DNS funciona como la guía telefónica de Internet: traduce nombres como usm.cl a direcciones IP.' },
  { id: 'submarine', area: 'teleco', text: 'La gran mayoría del tráfico intercontinental de Internet viaja por cables submarinos, no por satélites.' },
  { id: 'https-tls', area: 'seguridad', text: 'HTTPS cifra la conversación entre tu navegador y el servidor usando TLS: nadie en el camino puede leerla.' },
  { id: 'shannon', area: 'teleco', text: 'En 1948 Claude Shannon calculó la capacidad máxima de un canal con ruido: nació la teoría de la información.' },
  { id: 'passphrase', area: 'seguridad', text: 'Cuatro palabras al azar pueden ser más difíciles de adivinar que una contraseña corta llena de símbolos.' },
  { id: 'switch-router', area: 'redes', text: 'Un switch reenvía tramas usando direcciones MAC; un router encamina paquetes entre redes usando direcciones IP.' },
  { id: 'utp-twist', area: 'hardware', text: 'Los cables UTP trenzan sus pares de cobre para cancelar interferencias electromagnéticas.' },
  { id: 'latency', area: 'redes', text: 'Latencia no es lo mismo que ancho de banda: una carretera más ancha no hace más corto el viaje.' },
  { id: 'osi', area: 'redes', text: 'El modelo OSI divide la comunicación en 7 capas, desde la física (cables y ondas) hasta la aplicación.' },
  { id: 'byte', area: 'hardware', text: 'Un bit vale 0 o 1; ocho bits forman un byte, suficiente para representar una letra.' },
  { id: 'nyquist-cd', area: 'teleco', text: 'Por el criterio de Nyquist, el audio de un CD se muestrea a 44,1 kHz: más del doble de lo que el oído alcanza a escuchar.' },
  { id: 'gps-time', area: 'teleco', text: 'Tu teléfono calcula su posición GPS comparando cuánto tardan en llegar las señales horarias de varios satélites.' },
  { id: 'phishing', area: 'seguridad', text: 'El phishing ataca a personas, no a computadores: un correo convincente puede valer más que un virus.' },
  { id: 'iot', area: 'hardware', text: 'El Internet de las cosas conecta sensores cotidianos: medidores de agua, semáforos o hasta maceteros.' },
  { id: 'git', area: 'software', text: 'Con control de versiones como Git, cientos de personas pueden trabajar en el mismo código sin pisarse.' },
  { id: 'api', area: 'software', text: 'Una API es un contrato: define cómo una app le pide datos a un servidor y qué recibirá de vuelta.' },
  { id: 'packet-switching', area: 'redes', text: 'Internet divide tus mensajes en paquetes que pueden tomar caminos distintos y se reordenan al llegar.' },
  { id: '5g-mmwave', area: 'teleco', text: 'Las frecuencias altas del 5G transportan más datos, pero alcanzan menos distancia y les afectan más los obstáculos.' },
];

export function tipForDate(date: Date): Tip {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start) / 86_400_000);
  return tips[dayOfYear % tips.length];
}

export function randomTip(exclude?: string): Tip {
  const pool = tips.filter((tip) => tip.id !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}
