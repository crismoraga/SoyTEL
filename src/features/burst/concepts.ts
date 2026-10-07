import { pick, shuffle, type Random } from './logic';

// Microjuegos de conceptos ("elige la correcta"): puertos, equipos de red, seguridad Wi-Fi y siglas.
// Cada opción trae su explicación, que Rutix muestra después de responder.
export interface ConceptOption {
  id: string;
  label: string;
  detail?: string;
  correct: boolean;
  why: string;
}

export interface ConceptRound {
  prompt: string;
  options: ConceptOption[];
  footer: string;
}

// ---- Puerto correcto ----
export const services = [
  { name: 'una página web segura (HTTPS)', port: 443, why: 'HTTPS usa el puerto 443: es la web con candado.' },
  { name: 'una página web sin cifrar (HTTP)', port: 80, why: 'HTTP, la web sin candado, usa el puerto 80.' },
  { name: 'la traducción de nombres (DNS)', port: 53, why: 'El DNS responde en el puerto 53.' },
  { name: 'el acceso remoto seguro (SSH)', port: 22, why: 'SSH usa el puerto 22.' },
  { name: 'el envío de correo (SMTP)', port: 25, why: 'SMTP, el correo saliente, usa el puerto 25.' },
  { name: 'la transferencia de archivos (FTP)', port: 21, why: 'FTP usa el puerto 21.' },
];

export function portRound(random: Random = Math.random): ConceptRound {
  const target = pick(services, random);
  const others = shuffle(
    services.filter((service) => service.port !== target.port),
    random,
  ).slice(0, 3);
  return {
    prompt: `¿Por qué puerto viaja ${target.name}?`,
    footer: 'Un puerto es como la puerta de cada servicio dentro de un mismo equipo.',
    options: shuffle([target, ...others], random).map((service, index) => ({
      id: `puerto${index}`,
      label: `Puerto ${service.port}`,
      correct: service.port === target.port,
      why: service.port === target.port ? target.why : `El ${service.port} es de ${service.name}.`,
    })),
  };
}

// ---- ¿Qué equipo es? ----
export const devices = [
  { name: 'Router', clue: 'Une tu red con Internet y elige el camino de cada paquete.' },
  { name: 'Switch', clue: 'Conecta por cable los equipos de una misma red.' },
  { name: 'Access point', clue: 'Entrega Wi-Fi a los equipos que están cerca.' },
  { name: 'Firewall', clue: 'Revisa el tráfico y bloquea lo peligroso.' },
  { name: 'Servidor', clue: 'Guarda páginas y datos y los entrega a quien los pide.' },
  { name: 'Módem', clue: 'Convierte la señal del proveedor en una conexión para tu casa.' },
  { name: 'Antena', clue: 'Convierte señales eléctricas en ondas de radio, y al revés.' },
];

export function deviceRound(random: Random = Math.random): ConceptRound {
  const target = pick(devices, random);
  const others = shuffle(
    devices.filter((device) => device.name !== target.name),
    random,
  ).slice(0, 3);
  return {
    prompt: `«${target.clue}» ¿Qué equipo es?`,
    footer: 'Cada equipo de una red tiene una tarea distinta.',
    options: shuffle([target, ...others], random).map((device, index) => ({
      id: `equipo${index}`,
      label: device.name,
      correct: device.name === target.name,
      why: `${device.name}: ${device.clue}`,
    })),
  };
}

// ---- Wi-Fi seguro ----
export const wifiSecurities = [
  { level: 0, tag: 'Abierta, sin clave', why: 'Sin clave, la red no cifra nada: quien esté cerca ve a qué sitios entras y todo lo que no viaje por HTTPS.' },
  { level: 1, tag: 'WEP', why: 'WEP es antiguo: su clave se rompe en minutos.' },
  { level: 2, tag: 'WPA', why: 'WPA mejoró a WEP, pero ya está superado.' },
  { level: 3, tag: 'WPA2', why: 'WPA2 es seguro si la clave es buena.' },
  { level: 4, tag: 'WPA3', why: 'WPA3 es la protección más nueva y resistente.' },
];

const networkNames = ['Cafe_Gratis', 'Casa_Perez', 'Lab_TEL', 'USM_Alumnos', 'Biblioteca', 'Vecino_5G', 'Plaza_WiFi', 'Depto_402'];

export function wifiRound(random: Random = Math.random): ConceptRound {
  const chosen = shuffle(wifiSecurities, random).slice(0, 4);
  const best = Math.max(...chosen.map((security) => security.level));
  const names = shuffle(networkNames, random);
  return {
    prompt: '¿A cuál red Wi-Fi conviene conectarse?',
    footer: 'De menos a más segura: abierta, WEP, WPA, WPA2 y WPA3.',
    options: chosen.map((security, index) => ({
      id: `wifi${index}`,
      label: names[index],
      detail: security.tag,
      correct: security.level === best,
      why: security.why,
    })),
  };
}

// ---- Sigla TEL ----
export const acronyms = [
  { short: 'IP', full: 'Internet Protocol', fakes: ['Información Privada', 'Interfaz de Paquetes', 'Internet Pública'], why: 'IP es el protocolo que le da una dirección a cada equipo.' },
  { short: 'DNS', full: 'Domain Name System', fakes: ['Datos de Navegación Segura', 'Dirección Numérica Simple', 'Disco de Nombres Seguros'], why: 'El DNS traduce nombres como usm.cl a direcciones IP.' },
  { short: 'LAN', full: 'Local Area Network', fakes: ['Línea de Acceso Nacional', 'Lista de Antenas Nuevas', 'Lector de Alta Nitidez'], why: 'Una LAN es la red local de una casa, una sala o un edificio.' },
  { short: 'URL', full: 'Uniform Resource Locator', fakes: ['Usuario de Red Local', 'Unidad de Registro en Línea', 'Ubicación Rápida de Links'], why: 'La URL es la dirección completa de una página.' },
  { short: 'USB', full: 'Universal Serial Bus', fakes: ['Unidad de Salida Básica', 'Usuario Sin Bloqueo', 'Unión de Señales Binarias'], why: 'USB es el conector universal para datos y energía.' },
  { short: 'GPS', full: 'Global Positioning System', fakes: ['Guía Para Satélites', 'Gran Punto de Señal', 'Generador de Posiciones Seguras'], why: 'El GPS calcula tu posición con señales de satélites.' },
  { short: 'LED', full: 'Light Emitting Diode', fakes: ['Luz de Energía Digital', 'Lámpara Eléctrica Directa', 'Línea de Emisión Doble'], why: 'Un LED es un diodo que emite luz cuando pasa corriente.' },
  { short: 'HTTP', full: 'HyperText Transfer Protocol', fakes: ['Hoja de Texto Para Programas', 'Host de Tráfico Total de Paquetes', 'Hipervínculo de Tránsito Privado'], why: 'HTTP es el protocolo con que el navegador pide las páginas web.' },
];

export function acronymRound(random: Random = Math.random): ConceptRound {
  const target = pick(acronyms, random);
  return {
    prompt: `¿Qué significa ${target.short}?`,
    footer: 'Muchas siglas de redes vienen del inglés.',
    options: shuffle([target.full, ...target.fakes], random).map((label, index) => ({
      id: `sigla${index}`,
      label,
      correct: label === target.full,
      why: label === target.full ? target.why : `${target.short} significa ${target.full}.`,
    })),
  };
}
