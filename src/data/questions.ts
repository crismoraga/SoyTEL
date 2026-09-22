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

export const quizQuestions: QuizQuestion[] = [
  {
    id: 'net-001',
    area: 'redes',
    difficulty: 1,
    prompt: '¿Qué dispositivo conecta normalmente una red local con Internet?',
    options: ['Switch', 'Router', 'Punto de acceso', 'Cable UTP'],
    answerIndex: 1,
    explanation: 'El router encamina paquetes entre redes distintas, como tu red local e Internet.',
  },
  {
    id: 'soft-001',
    area: 'software',
    difficulty: 1,
    prompt: '¿Qué significa que una app sea multiplataforma?',
    options: [
      'Funciona solo en navegadores',
      'Usa varios lenguajes a la vez',
      'Puede ejecutarse en más de un sistema operativo',
      'No necesita conexión a Internet',
    ],
    answerIndex: 2,
    explanation: 'Una app multiplataforma comparte gran parte del código para Android, iOS u otros sistemas.',
  },
  {
    id: 'hard-001',
    area: 'hardware',
    difficulty: 2,
    prompt: 'En electrónica digital, ¿qué representa un bit?',
    options: ['Una frecuencia', 'Un valor binario', 'Un tipo de cable', 'Una unidad de potencia'],
    answerIndex: 1,
    explanation: 'Un bit representa un valor binario: 0 o 1.',
  },
  {
    id: 'tel-001',
    area: 'teleco',
    difficulty: 2,
    prompt: '¿Qué parámetro describe cuántas veces oscila una señal por segundo?',
    options: ['Amplitud', 'Fase', 'Frecuencia', 'Latencia'],
    answerIndex: 2,
    explanation: 'La frecuencia se mide en hertz y describe ciclos por segundo.',
  },
  {
    id: 'sec-001',
    area: 'seguridad',
    difficulty: 3,
    prompt: '¿Cuál es la función principal de un firewall?',
    options: [
      'Aumentar la velocidad Wi-Fi',
      'Filtrar tráfico según reglas',
      'Traducir direcciones IP',
      'Comprimir paquetes',
    ],
    answerIndex: 1,
    explanation: 'Un firewall permite o bloquea tráfico de acuerdo con reglas de seguridad.',
  },
  {
    id: 'net-002',
    area: 'redes',
    difficulty: 3,
    prompt: '¿Qué protocolo resuelve nombres de dominio en direcciones IP?',
    options: ['HTTP', 'DHCP', 'DNS', 'FTP'],
    answerIndex: 2,
    explanation: 'DNS traduce nombres legibles, como usm.cl, a direcciones IP.',
  },
  {
    id: 'soft-002',
    area: 'software',
    difficulty: 4,
    prompt: '¿Qué problema evita principalmente un sistema de control de versiones?',
    options: [
      'La latencia de red',
      'La pérdida o conflicto de cambios en el código',
      'El consumo de batería',
      'La falta de memoria RAM',
    ],
    answerIndex: 1,
    explanation: 'Git y herramientas similares registran cambios y facilitan colaborar sin sobrescribir trabajo.',
  },
  {
    id: 'hard-002',
    area: 'hardware',
    difficulty: 4,
    prompt: '¿Qué compuerta entrega 1 solo cuando ambas entradas son 1?',
    options: ['OR', 'XOR', 'NOT', 'AND'],
    answerIndex: 3,
    explanation: 'La compuerta AND produce 1 únicamente cuando todas sus entradas son 1.',
  },
  {
    id: 'tel-002',
    area: 'teleco',
    difficulty: 5,
    prompt: 'Según Nyquist, para reconstruir una señal se debe muestrear al menos…',
    options: [
      'A la mitad de su frecuencia máxima',
      'Al doble de su frecuencia máxima',
      'A diez veces su frecuencia mínima',
      'A una frecuencia arbitraria',
    ],
    answerIndex: 1,
    explanation: 'El criterio de Nyquist exige muestrear al menos al doble de la frecuencia máxima.',
  },
  {
    id: 'sec-002',
    area: 'seguridad',
    difficulty: 5,
    prompt: '¿Qué práctica protege mejor una contraseña almacenada?',
    options: [
      'Guardarla cifrada con una clave compartida',
      'Guardarla en texto plano con acceso restringido',
      'Guardar un hash con sal usando un algoritmo resistente',
      'Enviarla por correo cifrado',
    ],
    answerIndex: 2,
    explanation: 'Las contraseñas se protegen con hash robusto y sal única; no deben poder recuperarse.',
  },
];
