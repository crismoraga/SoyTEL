import type { MicroGameId } from '@/types/game';

// Guía de cada microjuego: cómo se juega (pasos cortos, en orden) y qué se aprende con él.
// Los pasos se muestran antes de cada ronda; la idea, junto al resultado.
export interface MicroGameGuide {
  steps: string[];
  learn: string;
}

export const microGameGuides: Record<MicroGameId, MicroGameGuide> = {
  'connect-network': {
    steps: ['Mira qué equipo falta en el camino.', 'Toca el equipo que completa la conexión.'],
    learn: 'El router conecta tu red con Internet; el switch une los equipos dentro de la misma red.',
  },
  'clean-signal': {
    steps: ['Compara las opciones que aparecen.', 'Toca la que tiene menos interferencia.'],
    learn: 'La interferencia ensucia la señal. La fibra óptica casi no la sufre porque lleva los datos como luz.',
  },
  'ping-check': {
    steps: ['Lee las líneas de la terminal.', 'Si hay respuestas con un tiempo en ms, toca «Hay conexión»; si no, «Sin conexión».'],
    learn: 'El comando ping envía un mensaje corto a otro equipo y mide cuánto tarda en volver.',
  },
  'color-code': {
    steps: ['Busca el pin con borde punteado.', 'Toca el color de cable que va en ese pin.'],
    learn: 'Los ocho hilos de un cable de red van siempre en el mismo orden: es la norma T568B.',
  },
  firewall: {
    steps: ['Lee cada conexión que quiere entrar.', 'Toca «Permitir» si es confiable o «Bloquear» si parece un ataque.'],
    learn: 'Un firewall revisa el tráfico y deja pasar solo lo que cumple las reglas de seguridad.',
  },
  'signal-timing': {
    steps: ['Sigue la aguja, que va y viene.', 'Toca el botón cuando esté sobre la zona verde.'],
    learn: 'Una antena recibe mejor cuando está bien apuntada: por eso hay que sintonizarla.',
  },
  'sequence-memory': {
    steps: ['Mira en qué orden se encienden los equipos.', 'Repite la ruta tocándolos en el mismo orden.'],
    learn: 'Un paquete pasa por varios equipos, uno tras otro: esa lista de saltos es su ruta.',
  },
  'packet-rush': {
    steps: ['Toca el botón de enviar una y otra vez.', 'Completa los 12 envíos antes de que termine el reloj.'],
    learn: 'Cuando muchos paquetes quieren pasar al mismo tiempo, la red se congestiona y todo va más lento.',
  },
  'cable-connect': {
    steps: ['Mantén presionado un cable y arrástralo.', 'Suéltalo sobre el puerto de su mismo color.'],
    learn: 'Cada cable va en su puerto: un conector mal puesto deja al equipo sin red.',
  },
  'packet-catch': {
    steps: ['Toca los paquetes sanos mientras caen.', 'Deja pasar los rojos: están infectados.'],
    learn: 'Un antivirus revisa cada archivo que llega y bloquea los que traen malware.',
  },
  'wifi-boost': {
    steps: ['Arrastra el router por la casa.', 'Déjalo cerca del notebook y lejos del microondas.'],
    learn: 'El Wi-Fi pierde fuerza con la distancia, las paredes y aparatos como el microondas.',
  },
  'password-strong': {
    steps: ['Toca piezas para armar la contraseña.', 'Sigue sumando hasta que el medidor diga «Muy fuerte».'],
    learn: 'Una contraseña larga y variada tarda muchísimo más en ser adivinada.',
  },
  'binary-bits': {
    steps: ['Toca un bit para encenderlo o apagarlo.', 'Suma los valores encendidos hasta formar el número.'],
    learn: 'Los computadores guardan todo con bits: cada posición vale el doble que la anterior.',
  },
  'layer-order': {
    steps: ['Lee las cuatro capas.', 'Tócalas en orden: desde el cable o Wi-Fi hasta la app.'],
    learn: 'Internet funciona por capas (enlace, IP, transporte y aplicación): cada una se apoya en la de abajo.',
  },
  'ip-valid': {
    steps: ['Revisa las cuatro direcciones.', 'Toca la que tiene 4 números entre 0 y 255 separados por puntos.'],
    learn: 'Una dirección IPv4 identifica a cada equipo en la red, como el número de una casa.',
  },
  'fast-route': {
    steps: ['Suma los milisegundos de cada ruta.', 'Toca la ruta con el total más bajo.'],
    learn: 'La latencia es el tiempo que tarda un dato en llegar: los routers buscan el camino más rápido.',
  },
  'safe-url': {
    steps: ['Lee cada dirección letra por letra.', 'Toca la que termina en el dominio oficial.'],
    learn: 'El phishing imita sitios reales. Lo que manda es el final del dominio, justo antes de la primera barra.',
  },
  'unit-order': {
    steps: ['Lee las unidades que aparecen.', 'Tócalas de la más chica a la más grande.'],
    learn: 'Ocho bits forman un byte; mil bytes, un kilobyte; después vienen el mega y el giga.',
  },
  'port-match': {
    steps: ['Lee qué servicio se pide.', 'Toca el número de puerto que le corresponde.'],
    learn: 'Un mismo equipo ofrece varios servicios a la vez: cada uno atiende en su propio puerto.',
  },
  'device-role': {
    steps: ['Lee la pista entre comillas.', 'Toca el equipo de red que hace esa tarea.'],
    learn: 'Router, switch, access point y firewall trabajan juntos, pero cada uno cumple una tarea distinta.',
  },
  'wifi-safe': {
    steps: ['Mira el tipo de seguridad bajo cada red.', 'Toca la que está mejor protegida.'],
    learn: 'Una red abierta no cifra nada. WPA2 y WPA3 protegen lo que envías con una clave.',
  },
  acronym: {
    steps: ['Lee la sigla.', 'Toca lo que significa de verdad.'],
    learn: 'Las siglas de redes resumen nombres en inglés: saber qué significan ayuda a entender qué hacen.',
  },
};

export function getMicroGameGuide(id: MicroGameId): MicroGameGuide {
  return microGameGuides[id];
}
