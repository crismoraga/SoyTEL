import type { KnowledgeArea } from '@/types/game';

export interface QuizQuestion {
  id: string;
  area: KnowledgeArea;
  difficulty: 1 | 2 | 3 | 4 | 5;
  prompt: string;
  options: [string, string, string, string];
  answerIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

export const areaLabels: Record<KnowledgeArea, string> = {
  redes: 'Redes',
  software: 'Software',
  hardware: 'Hardware',
  teleco: 'Telecomunicaciones',
  seguridad: 'Ciberseguridad',
};

const bank: QuizQuestion[] = [
  // Redes
  { id: 'net-001', area: 'redes', difficulty: 1, prompt: '¿Qué dispositivo conecta normalmente una red local con Internet?', options: ['Switch', 'Router', 'Punto de acceso', 'Cable UTP'], answerIndex: 1, explanation: 'El router encamina paquetes entre redes distintas, como tu red local e Internet.' },
  { id: 'net-003', area: 'redes', difficulty: 1, prompt: '¿Qué equipo conecta varios computadores dentro de una misma red local cableada?', options: ['Switch', 'Módem satelital', 'Proyector', 'Parlante'], answerIndex: 0, explanation: 'El switch une los equipos de una LAN y reenvía tramas usando sus direcciones MAC.' },
  { id: 'net-004', area: 'redes', difficulty: 2, prompt: '¿Qué protocolo te asigna automáticamente una dirección IP al conectarte a una red?', options: ['DNS', 'DHCP', 'HTTP', 'SMTP'], answerIndex: 1, explanation: 'DHCP entrega de forma automática la IP, la máscara, la puerta de enlace y los servidores DNS.' },
  { id: 'net-005', area: 'redes', difficulty: 2, prompt: '¿Qué comando usarías para comprobar si un servidor responde en la red?', options: ['ping', 'print', 'paint', 'zip'], answerIndex: 0, explanation: 'ping envía mensajes ICMP y mide el tiempo de ida y vuelta de la respuesta.' },
  { id: 'net-002', area: 'redes', difficulty: 3, prompt: '¿Qué protocolo resuelve nombres de dominio en direcciones IP?', options: ['HTTP', 'DHCP', 'DNS', 'FTP'], answerIndex: 2, explanation: 'DNS traduce nombres legibles, como usm.cl, a direcciones IP.' },
  { id: 'net-006', area: 'redes', difficulty: 4, prompt: '¿En qué capa del modelo OSI trabaja principalmente un router?', options: ['Física', 'Enlace de datos', 'Red', 'Aplicación'], answerIndex: 2, explanation: 'El router opera en la capa 3 (red): decide rutas según direcciones IP.' },
  { id: 'net-007', area: 'redes', difficulty: 4, prompt: '¿Qué protocolo de transporte garantiza la entrega ordenada y confiable de los datos?', options: ['UDP', 'TCP', 'ARP', 'ICMP'], answerIndex: 1, explanation: 'TCP numera los segmentos, confirma su recepción y retransmite los perdidos. UDP no lo hace.' },
  { id: 'net-008', area: 'redes', difficulty: 5, prompt: '¿Cuántas direcciones de host utilizables tiene una subred IPv4 /24?', options: ['256', '254', '255', '128'], answerIndex: 1, explanation: 'Un /24 tiene 256 direcciones; se reservan la de red y la de broadcast, quedando 254 para equipos.' },
  // Software
  { id: 'soft-003', area: 'software', difficulty: 1, prompt: '¿Qué es un algoritmo?', options: ['Una secuencia de pasos para resolver un problema', 'Un tipo de cable', 'Un virus informático', 'Una marca de celulares'], answerIndex: 0, explanation: 'Un algoritmo es una receta precisa: pasos ordenados que resuelven un problema.' },
  { id: 'soft-001', area: 'software', difficulty: 1, prompt: '¿Qué significa que una app sea multiplataforma?', options: ['Funciona solo en navegadores', 'Usa varios lenguajes a la vez', 'Puede ejecutarse en más de un sistema operativo', 'No necesita conexión a Internet'], answerIndex: 2, explanation: 'Una app multiplataforma comparte gran parte del código para Android, iOS u otros sistemas.' },
  { id: 'soft-008', area: 'software', difficulty: 2, prompt: '¿Qué hace un bucle (loop) en programación?', options: ['Repite instrucciones mientras se cumpla una condición', 'Borra el programa', 'Conecta a Internet', 'Cambia el idioma'], answerIndex: 0, explanation: 'Los bucles evitan escribir lo mismo muchas veces: repiten un bloque según una condición.' },
  { id: 'soft-004', area: 'software', difficulty: 2, prompt: '¿Qué es una API?', options: ['Una forma definida para que dos programas se comuniquen', 'Un antivirus', 'Un formato de impresión', 'Una tecla especial'], answerIndex: 0, explanation: 'Una API es un contrato: define cómo un programa pide datos o acciones a otro.' },
  { id: 'soft-005', area: 'software', difficulty: 3, prompt: 'En una app cliente-servidor, ¿dónde se guardan normalmente los datos que comparten todos los usuarios?', options: ['En un servidor o base de datos central', 'En la pantalla del celular', 'En el cargador', 'En el router de cada casa'], answerIndex: 0, explanation: 'Los clientes consultan un servidor central, así todos ven la misma información actualizada.' },
  { id: 'soft-006', area: 'software', difficulty: 3, prompt: '¿Qué formato de texto se usa mucho para intercambiar datos entre apps y servidores?', options: ['JSON', 'MP3', 'PNG', 'EXE'], answerIndex: 0, explanation: 'JSON representa datos como pares clave-valor legibles por personas y programas.' },
  { id: 'soft-002', area: 'software', difficulty: 4, prompt: '¿Qué problema evita principalmente un sistema de control de versiones?', options: ['La latencia de red', 'La pérdida o conflicto de cambios en el código', 'El consumo de batería', 'La falta de memoria RAM'], answerIndex: 1, explanation: 'Git y herramientas similares registran cambios y facilitan colaborar sin sobrescribir trabajo.' },
  { id: 'soft-007', area: 'software', difficulty: 5, prompt: '¿Qué complejidad tiene la búsqueda binaria en una lista ordenada de n elementos?', options: ['O(n²)', 'O(n)', 'O(log n)', 'O(1)'], answerIndex: 2, explanation: 'En cada paso descarta la mitad de la lista, así que necesita del orden de log₂(n) comparaciones.' },
  // Hardware
  { id: 'hard-003', area: 'hardware', difficulty: 1, prompt: '¿Cuántos bits forman un byte?', options: ['4', '8', '16', '10'], answerIndex: 1, explanation: 'Un byte son 8 bits: suficiente para 256 valores distintos, como una letra.' },
  { id: 'hard-008', area: 'hardware', difficulty: 1, prompt: '¿Qué es un sensor?', options: ['Un dispositivo que mide algo del entorno, como luz o temperatura', 'Un programa de chat', 'Una clave Wi-Fi', 'Un tipo de pantalla'], answerIndex: 0, explanation: 'Los sensores convierten magnitudes físicas en señales eléctricas que un sistema puede leer.' },
  { id: 'hard-001', area: 'hardware', difficulty: 2, prompt: 'En electrónica digital, ¿qué representa un bit?', options: ['Una frecuencia', 'Un valor binario', 'Un tipo de cable', 'Una unidad de potencia'], answerIndex: 1, explanation: 'Un bit representa un valor binario: 0 o 1.' },
  { id: 'hard-004', area: 'hardware', difficulty: 2, prompt: '¿Qué componente convierte una señal analógica en digital?', options: ['Un conversor análogo-digital (ADC)', 'Un ventilador', 'La fuente de poder', 'El disco duro'], answerIndex: 0, explanation: 'El ADC muestrea y cuantiza la señal para transformarla en bits.' },
  { id: 'hard-005', area: 'hardware', difficulty: 3, prompt: '¿Qué es un microcontrolador, como el de un Arduino?', options: ['Un pequeño computador en un chip para controlar dispositivos', 'Un cable de red', 'Una antena', 'Un monitor'], answerIndex: 0, explanation: 'Integra procesador, memoria y entradas/salidas en un solo chip: ideal para IoT.' },
  { id: 'hard-006', area: 'hardware', difficulty: 3, prompt: '¿Cómo se escribe el número 5 en binario?', options: ['101', '110', '111', '011'], answerIndex: 0, explanation: '101 = 1·4 + 0·2 + 1·1 = 5.' },
  { id: 'hard-002', area: 'hardware', difficulty: 4, prompt: '¿Qué compuerta entrega 1 solo cuando ambas entradas son 1?', options: ['OR', 'XOR', 'NOT', 'AND'], answerIndex: 3, explanation: 'La compuerta AND produce 1 únicamente cuando todas sus entradas son 1.' },
  { id: 'hard-007', area: 'hardware', difficulty: 4, prompt: '¿Qué ley relaciona voltaje, corriente y resistencia?', options: ['Ley de Ohm', 'Ley de Moore', 'Ley de Nyquist', 'Ley de Murphy'], answerIndex: 0, explanation: 'La ley de Ohm dice que V = I · R.' },
  { id: 'hard-009', area: 'hardware', difficulty: 5, prompt: 'Una compuerta XOR con entradas 1 y 1 entrega…', options: ['0', '1', '2', 'Depende del voltaje'], answerIndex: 0, explanation: 'XOR entrega 1 solo si las entradas son distintas; con 1 y 1 el resultado es 0.' },
  // Telecomunicaciones
  { id: 'tel-003', area: 'teleco', difficulty: 1, prompt: '¿Qué transporta la información dentro de una fibra óptica?', options: ['Luz', 'Agua', 'Sonido', 'Calor'], answerIndex: 0, explanation: 'La fibra guía pulsos de luz por un núcleo de vidrio gracias a la reflexión interna total.' },
  { id: 'tel-004', area: 'teleco', difficulty: 1, prompt: '¿Qué usan los celulares para conectarse a Internet fuera de casa?', options: ['Redes móviles como 4G y 5G', 'Fax', 'Radio AM', 'Un cable muy largo'], answerIndex: 0, explanation: 'Las redes móviles conectan tu teléfono a antenas celulares que enlazan con Internet.' },
  { id: 'tel-001', area: 'teleco', difficulty: 2, prompt: '¿Qué parámetro describe cuántas veces oscila una señal por segundo?', options: ['Amplitud', 'Fase', 'Frecuencia', 'Latencia'], answerIndex: 2, explanation: 'La frecuencia se mide en hertz y describe ciclos por segundo.' },
  { id: 'tel-005', area: 'teleco', difficulty: 2, prompt: '¿En qué unidad se mide la frecuencia de una señal?', options: ['Hertz (Hz)', 'Watts (W)', 'Ohms (Ω)', 'Bytes'], answerIndex: 0, explanation: 'Un hertz es un ciclo por segundo; el Wi-Fi opera en gigahertz (GHz).' },
  { id: 'tel-006', area: 'teleco', difficulty: 3, prompt: '¿Por qué el Wi-Fi de 5 GHz suele sufrir menos interferencia que el de 2,4 GHz?', options: ['Tiene más canales y menos equipos compitiendo', 'Porque usa cables', 'Porque funciona solo de noche', 'Porque transmite sonido'], answerIndex: 0, explanation: 'La banda de 2,4 GHz está saturada (microondas, Bluetooth, redes vecinas); 5 GHz ofrece más canales libres.' },
  { id: 'tel-007', area: 'teleco', difficulty: 4, prompt: '¿Qué le pasa a una señal inalámbrica al alejarse de la antena?', options: ['Se atenúa: pierde potencia', 'Gana potencia', 'Cambia de color', 'Se convierte en luz'], answerIndex: 0, explanation: 'La potencia recibida disminuye con la distancia y con los obstáculos: eso es la atenuación.' },
  { id: 'tel-008', area: 'teleco', difficulty: 4, prompt: '¿Qué modulación varía la frecuencia de la portadora según la señal?', options: ['AM', 'FM', 'PCM', 'QR'], answerIndex: 1, explanation: 'FM (frecuencia modulada) codifica la información en cambios de frecuencia; AM lo hace en la amplitud.' },
  { id: 'tel-002', area: 'teleco', difficulty: 5, prompt: 'Según Nyquist, para reconstruir una señal se debe muestrear al menos…', options: ['A la mitad de su frecuencia máxima', 'Al doble de su frecuencia máxima', 'A diez veces su frecuencia mínima', 'A una frecuencia arbitraria'], answerIndex: 1, explanation: 'El criterio de Nyquist exige muestrear al menos al doble de la frecuencia máxima.' },
  // Ciberseguridad
  { id: 'sec-003', area: 'seguridad', difficulty: 1, prompt: '¿Cuál de estas contraseñas es más difícil de adivinar?', options: ['123456', 'qwerty', 'maleta-nube-4-faro', 'password'], answerIndex: 2, explanation: 'Una frase larga con palabras al azar tiene muchísimas más combinaciones posibles.' },
  { id: 'sec-004', area: 'seguridad', difficulty: 1, prompt: 'Te llega un correo urgente pidiendo la clave de tu banco. ¿Qué es probablemente?', options: ['Phishing', 'Una actualización', 'Un regalo', 'Un respaldo'], answerIndex: 0, explanation: 'El phishing suplanta a entidades confiables para robar datos. Ningún banco pide tu clave por correo.' },
  { id: 'sec-005', area: 'seguridad', difficulty: 2, prompt: '¿Qué agrega la autenticación de dos factores (2FA)?', options: ['Un segundo paso de verificación, como un código en tu teléfono', 'Más velocidad', 'Otra pantalla', 'Un segundo correo'], answerIndex: 0, explanation: 'Aunque roben tu contraseña, sin el segundo factor no pueden entrar.' },
  { id: 'sec-001', area: 'seguridad', difficulty: 3, prompt: '¿Cuál es la función principal de un firewall?', options: ['Aumentar la velocidad Wi-Fi', 'Filtrar tráfico según reglas', 'Traducir direcciones IP', 'Comprimir paquetes'], answerIndex: 1, explanation: 'Un firewall permite o bloquea tráfico de acuerdo con reglas de seguridad.' },
  { id: 'sec-006', area: 'seguridad', difficulty: 3, prompt: '¿Qué indica el candado junto a la dirección en tu navegador?', options: ['Que la conexión con el sitio va cifrada (HTTPS)', 'Que el sitio es de un banco', 'Que no tiene anuncios', 'Que la página es gratis'], answerIndex: 0, explanation: 'El candado indica HTTPS: los datos viajan cifrados, aunque no garantiza que el sitio sea confiable.' },
  { id: 'sec-007', area: 'seguridad', difficulty: 4, prompt: '¿Qué es un ataque de denegación de servicio (DoS)?', options: ['Saturar un servicio con tráfico para dejarlo inaccesible', 'Mirar una contraseña por sobre el hombro', 'Borrar el historial', 'Cambiar el fondo de pantalla'], answerIndex: 0, explanation: 'Un DoS inunda al servidor de peticiones hasta que no puede atender a usuarios legítimos.' },
  { id: 'sec-008', area: 'seguridad', difficulty: 4, prompt: '¿Qué tipo de cifrado usa la misma clave para cifrar y descifrar?', options: ['Simétrico', 'Asimétrico', 'Hash', 'Binario'], answerIndex: 0, explanation: 'En el cifrado simétrico (como AES) emisor y receptor comparten la misma clave secreta.' },
  { id: 'sec-002', area: 'seguridad', difficulty: 5, prompt: '¿Qué práctica protege mejor una contraseña almacenada?', options: ['Guardarla cifrada con una clave compartida', 'Guardarla en texto plano con acceso restringido', 'Guardar un hash con sal usando un algoritmo resistente', 'Enviarla por correo cifrado'], answerIndex: 2, explanation: 'Las contraseñas se protegen con hash robusto y sal única; no deben poder recuperarse.' },
];

export const quizQuestions: QuizQuestion[] = [...bank].sort((a, b) => a.difficulty - b.difficulty);

type Random = () => number;

function shuffle<T>(items: T[], random: Random): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

// 10 preguntas en escalera de dificultad (2 por nivel), evitando repetir área seguida.
export function pickMillionaireQuestions(random: Random = Math.random): QuizQuestion[] {
  const picked: QuizQuestion[] = [];
  for (const difficulty of [1, 1, 2, 2, 3, 3, 4, 4, 5, 5] as const) {
    const pool = shuffle(
      quizQuestions.filter((question) => question.difficulty === difficulty && !picked.includes(question)),
      random,
    );
    const lastArea = picked[picked.length - 1]?.area;
    const choice = pool.find((question) => question.area !== lastArea) ?? pool[0];
    if (choice) picked.push(choice);
  }
  return picked;
}

export function pickPracticeQuestions(area: KnowledgeArea, count = 5, random: Random = Math.random): QuizQuestion[] {
  const pool = shuffle(quizQuestions.filter((question) => question.area === area), random).slice(0, count);
  return pool.sort((a, b) => a.difficulty - b.difficulty);
}

export function shuffleOptions(question: QuizQuestion, random: Random = Math.random): QuizQuestion {
  const order = shuffle([0, 1, 2, 3], random);
  return {
    ...question,
    options: order.map((index) => question.options[index]) as QuizQuestion['options'],
    answerIndex: order.indexOf(question.answerIndex) as QuizQuestion['answerIndex'],
  };
}
