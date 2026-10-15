import { Bars, Mono, Waves, type QuickGenerator, type QuickRound } from '../quickpick';

// Generadores de los microjuegos de los paquetes Señales, Datos y Sistemas. Cada ronda sale al azar de
// un banco o de valores aleatorios: la misma partida no se repite.

const pick = <T,>(items: readonly T[], random: () => number): T => items[Math.floor(random() * items.length)];
function sample<T>(items: readonly T[], count: number, random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy.slice(0, count);
}
const LETTERS = ['A', 'B', 'C', 'D'];

// ——— Señales ———

export const waveFrequency: QuickGenerator = (level, random) => {
  const count = level >= 2 ? 4 : 3;
  const cycles = sample(level >= 3 ? [3, 4, 5, 6] : [2, 3, 5, 7], count, random);
  const lowest = level >= 2 && random() < 0.4;
  const target = cycles.indexOf(lowest ? Math.min(...cycles) : Math.max(...cycles));
  return {
    visual: <Waves waves={cycles.map((value, index) => ({ label: LETTERS[index], cycles: value }))} />,
    prompt: lowest ? '¿Cuál onda tiene la frecuencia más baja?' : '¿Cuál onda vibra más rápido?',
    options: LETTERS.slice(0, count),
    answer: target,
    note: `Era la ${LETTERS[target]}: más vueltas en el mismo tiempo = más frecuencia.`,
  };
};

export const amFm: QuickGenerator = (level, random) => {
  const kinds = level >= 2 ? ['AM', 'FM', 'Sin modular'] : ['AM', 'FM'];
  const kind = pick(kinds, random);
  return {
    visual: <Waves waves={[{ cycles: 7, am: kind === 'AM', fm: kind === 'FM' }]} />,
    prompt: '¿Qué tipo de modulación ves?',
    options: kinds,
    answer: kinds.indexOf(kind),
    note: kind === 'AM' ? 'Cambia la altura (amplitud): AM.' : kind === 'FM' ? 'Cambia qué tan juntas están las ondas (frecuencia): FM.' : 'Todas iguales: la portadora sin modular.',
  };
};

export const wifiChannel: QuickGenerator = (_level, random) => {
  const counts = sample([1, 3, 5, 6, 8], 3, random);
  const best = counts.indexOf(Math.min(...counts));
  return {
    visual: <Bars values={counts} labels={['Canal 1', 'Canal 6', 'Canal 11']} />,
    prompt: 'Redes vecinas en cada canal. ¿Dónde pones tu Wi-Fi?',
    options: ['Canal 1', 'Canal 6', 'Canal 11'],
    answer: best,
    note: 'El canal con menos redes vecinas tiene menos interferencia.',
  };
};

export const fiberAngle: QuickGenerator = (level, random) => {
  const inside = pick(level >= 2 ? [12, 15, 18] : [8, 10, 12], random);
  const outside = sample([35, 45, 60, 75], 3, random);
  const options = [inside, ...outside].map((value) => `${value}°`);
  return {
    prompt: 'El láser entra a la fibra inclinado respecto a su eje. ¿Con qué ángulo la luz queda atrapada?',
    options,
    answer: 0,
    note: `Con ${inside}°: la luz entra casi derecha y rebota por dentro (reflexión total).`,
  };
};

export const signalNoise: QuickGenerator = (level, random) => {
  const noises = level >= 2 ? [0.15, 0.35, 0.6] : [0.05, 0.5, 0.9];
  const order = sample([0, 1, 2], 3, random);
  const best = order.indexOf(0);
  return {
    visual: <Waves waves={order.map((noise, index) => ({ label: LETTERS[index], cycles: 3, noise: noises[noise], seed: index + 3 }))} />,
    prompt: '¿Cuál señal llegó más limpia?',
    options: LETTERS.slice(0, 3),
    answer: best,
    note: `La ${LETTERS[best]}: menos ruido = mejor relación señal/ruido.`,
  };
};

export const sampling: QuickGenerator = (level, random) => {
  const hz = pick(level >= 2 ? [15, 20, 25, 40] : [3, 5, 10, 50], random);
  const right = hz * 2;
  const options = [right, hz, Math.round(hz / 2) || 1, hz * 2 - 1].map((value) => `${value} por segundo`);
  return {
    prompt: `Una onda vibra ${hz} veces por segundo. ¿Cuántas muestras por segundo necesitas, como mínimo, para guardarla?`,
    options,
    answer: 0,
    note: `El doble: ${right}. Con menos, la onda se deforma al reconstruirla (Nyquist).`,
  };
};

// ——— Datos ———

export const parityBit: QuickGenerator = (level, random) => {
  const bits = Array.from({ length: 7 }, () => (random() < 0.5 ? 1 : 0));
  const ones = bits.reduce<number>((sum, bit) => sum + bit, 0);
  const odd = level >= 3;
  const parity = odd ? (ones % 2 === 0 ? 1 : 0) : ones % 2;
  return {
    visual: <Mono lines={[`Datos: ${bits.join(' ')}`, `Paridad ${odd ? 'impar' : 'par'}: total de 1 ${odd ? 'impar' : 'par'}`]} />,
    prompt: '¿Qué bit de paridad agregas?',
    options: ['0', '1'],
    answer: parity,
    note: `Hay ${ones} unos: con ${parity} el total queda ${odd ? 'impar' : 'par'}.`,
  };
};

const GATES: Record<string, { rule: string; run: (a: number, b: number) => number }> = {
  AND: { rule: 'enciende si A y B son 1', run: (a, b) => a & b },
  OR: { rule: 'enciende si A o B es 1', run: (a, b) => a | b },
  XOR: { rule: 'enciende si solo una es 1', run: (a, b) => a ^ b },
  NAND: { rule: 'apaga solo si A y B son 1', run: (a, b) => 1 - (a & b) },
};

export const logicGate: QuickGenerator = (level, random) => {
  const gate = pick(level >= 2 ? Object.keys(GATES) : ['AND', 'OR'], random);
  const a = random() < 0.5 ? 1 : 0;
  const b = random() < 0.5 ? 1 : 0;
  const out = GATES[gate].run(a, b);
  return {
    visual: <Mono lines={[`A = ${a}   B = ${b}`, `Compuerta ${gate}: ${GATES[gate].rule}`]} />,
    prompt: '¿Se enciende el LED?',
    options: ['Sí, se enciende (1)', 'No, queda apagado (0)'],
    answer: out ? 0 : 1,
    note: `${gate} con A=${a} y B=${b} da ${out}.`,
  };
};

export const binarySearch: QuickGenerator = (level, random) => {
  const size = pick(level >= 2 ? [64, 128, 256] : [8, 16, 32], random);
  const steps = Math.log2(size);
  const options = [steps, size / 2, size, steps + 3].map(String);
  return {
    prompt: `Buscas un número en una lista ordenada de ${size}. Partiendo siempre por la mitad, ¿cuántas preguntas necesitas como máximo?`,
    options,
    answer: 0,
    note: `${steps}: cada pregunta descarta la mitad (${size} → ${size / 2} → … → 1).`,
  };
};

const STUDENTS = ['Ana', 'Beto', 'Caro', 'Dani', 'Eli', 'Fran', 'Gabo', 'Isa'];

export const sqlFilter: QuickGenerator = (_level, random) => {
  const rows = sample(STUDENTS, 5, random).map((name) => ({ name, curso: pick([2, 3, 4], random) }));
  const curso = rows[0].curso;
  const count = rows.filter((row) => row.curso === curso).length;
  const options = [1, 2, 3, 4, 5].filter((value) => value !== count).slice(0, 3);
  return {
    visual: <Mono lines={[`SELECT * FROM alumnos WHERE curso = ${curso};`, ...rows.map((row) => `${row.name.padEnd(5)} · ${row.curso}.º medio`)]} />,
    prompt: '¿Cuántas filas devuelve la consulta?',
    options: [String(count), ...options.map(String)],
    answer: 0,
    note: `Hay ${count} con curso = ${curso}.`,
  };
};

export const chartRead: QuickGenerator = (_level, random) => {
  const hours = ['9h', '11h', '13h', '15h', '17h'];
  const values = sample([12, 25, 38, 51, 64, 77, 90], 5, random);
  const top = values.indexOf(Math.max(...values));
  return {
    visual: <Bars values={values} labels={hours} />,
    prompt: 'Usuarios conectados al Wi-Fi del colegio. ¿A qué hora hubo más?',
    options: sample(hours.filter((hour) => hour !== hours[top]), 3, random).concat(hours[top]).reverse(),
    answer: 0,
    note: `A las ${hours[top]}: es la barra más alta.`,
  };
};

function rle(text: string): string {
  return text.replace(/(.)\1*/g, (run) => `${run.length}${run[0]}`);
}

export const compressRle: QuickGenerator = (level, random) => {
  const letters = sample(['A', 'B', 'C', 'D', 'E'], level >= 2 ? 4 : 3, random);
  const text = letters.map((letter) => letter.repeat(1 + Math.floor(random() * 4))).join('');
  const right = rle(text);
  const wrong = [right.replace(/\d/, (digit) => String(Number(digit) + 1)), letters.join(''), right.split('').reverse().join('')].filter((item) => item !== right);
  return {
    visual: <Mono lines={[text]} />,
    prompt: 'Comprímelo contando las letras repetidas. ¿Cuál es?',
    options: [right, ...[...new Set(wrong)].slice(0, 3)],
    answer: 0,
    note: `${text} → ${right}: cuántas veces y qué letra.`,
  };
};

// ——— Sistemas ———

const MAILS = [
  { from: 'soporte@usm.cl', fake: 'soporte@usm-cl.verifica.ru' },
  { from: 'notificaciones@instagram.com', fake: 'seguridad@instagrann.com' },
  { from: 'alertas@bancoestado.cl', fake: 'alertas@banco-estado-cl.top' },
  { from: 'no-reply@google.com', fake: 'no-reply@g00gle-login.com' },
];

export const phishingMail: QuickGenerator = (_level, random) => {
  const [trap, ...others] = sample(MAILS, 3, random);
  return {
    prompt: '¿Cuál remitente es una trampa (phishing)?',
    options: [trap.fake, ...others.map((mail) => mail.from)],
    answer: 0,
    note: `${trap.fake} imita al real (${trap.from}) con un dominio falso.`,
  };
};

const WORDS = ['HOLA', 'RED', 'WIFI', 'DATO', 'LUZ', 'CLAVE', 'NUBE', 'PAQUETE', 'ROUTER', 'FIBRA'];
const shift = (word: string, by: number) => word.replace(/[A-Z]/g, (char) => String.fromCharCode(((char.charCodeAt(0) - 65 + by + 26) % 26) + 65));

export const caesarShift: QuickGenerator = (_level, random) => {
  const [word, ...others] = sample(WORDS, 4, random);
  const by = 1 + Math.floor(random() * 3);
  return {
    visual: <Mono lines={[`Mensaje: ${shift(word, by)}`, `Cada letra avanzó ${by}`]} />,
    prompt: '¿Qué dice el mensaje original?',
    options: [word, ...others],
    answer: 0,
    note: `Retrocede ${by} letras cada una: ${shift(word, by)} → ${word}.`,
  };
};

const REDUNDANCY: QuickRound[] = [
  { prompt: 'Se cae un servidor. ¿Qué diseño sigue funcionando?', options: ['Dos servidores con balanceador', 'Un servidor muy potente', 'Un servidor y un monitor'], answer: 0, note: 'Con dos, el balanceador manda todo al que sigue vivo.' },
  { prompt: 'Se corta un cable de Internet. ¿Qué sede sigue conectada?', options: ['La que tiene dos enlaces', 'La que tiene el cable más caro', 'La que tiene más computadores'], answer: 0, note: 'Un segundo enlace (redundante) toma el tráfico.' },
  { prompt: 'Se quema el disco. ¿Dónde no se pierde nada?', options: ['Con copia en dos discos (RAID 1)', 'Con un disco más grande', 'Con un disco más rápido'], answer: 0, note: 'Dos copias: si un disco falla, el otro tiene todo.' },
  { prompt: 'Se corta la luz. ¿Qué sala de servidores sigue encendida?', options: ['La que tiene UPS y generador', 'La que tiene aire acondicionado', 'La que tiene más ventanas'], answer: 0, note: 'UPS y generador mantienen la energía.' },
];

export const redundancy: QuickGenerator = (_level, random) => pick(REDUNDANCY, random);

export const cpuHog: QuickGenerator = (level, random) => {
  const apps = sample(['Navegador', 'Música', 'Juego', 'Editor', 'Chat', 'Fotos'], 4, random);
  const hog = Math.floor(random() * 4);
  const lines = apps.map((app, index) => `${app.padEnd(10)} CPU ${index === hog ? 96 : 2 + Math.floor(random() * 8)} %`);
  const withSystem = level >= 2;
  if (withSystem) lines.push('Sistema    CPU 3 %');
  return {
    visual: <Mono lines={lines} />,
    prompt: 'El computador va lento. ¿Qué proceso cierras?',
    options: withSystem ? [apps[hog], ...apps.filter((_, index) => index !== hog).slice(0, 2), 'Sistema'] : apps,
    answer: withSystem ? 0 : hog,
    note: `${apps[hog]} usa 96 % de la CPU. Nunca cierres el proceso del sistema.`,
  };
};

const HTTP: [string, string, string][] = [
  ['La página que buscas no existe.', '404', '404: no encontrado.'],
  ['Todo cargó perfecto.', '200', '200: OK, todo bien.'],
  ['El servidor tuvo un error interno.', '500', '500: falló el servidor, no tú.'],
  ['Debes iniciar sesión para ver esto.', '401', '401: no autorizado, falta iniciar sesión.'],
  ['Hiciste demasiadas peticiones seguidas.', '429', '429: demasiadas solicitudes, espera un poco.'],
];

export const httpStatus: QuickGenerator = (_level, random) => {
  const [right, ...others] = sample(HTTP, 4, random);
  return {
    visual: <Mono lines={[`🌐 ${right[0]}`]} />,
    prompt: '¿Qué código HTTP devolvió el servidor?',
    options: [right[1], ...others.map((item) => item[1])],
    answer: 0,
    note: right[2],
  };
};

const BUGS: { goal: string; lines: string[]; bug: number; why: string }[] = [
  { goal: 'Encender el ventilador si hace más de 30 °C', lines: ['leer temperatura', 'si temperatura < 30:', '  encender ventilador'], bug: 1, why: 'Debía ser «> 30».' },
  { goal: 'Sumar los puntos de 3 rondas', lines: ['total = 0', 'repetir 2 veces:', '  total = total + puntos'], bug: 1, why: 'Eran 3 rondas, no 2.' },
  { goal: 'Avisar si la batería baja de 20 %', lines: ['leer batería', 'si batería < 20:', '  apagar pantalla'], bug: 2, why: 'Debía mostrar un aviso, no apagar la pantalla.' },
  { goal: 'Dar acceso si la clave es correcta', lines: ['leer clave', 'si clave == "1234":', '  negar acceso'], bug: 2, why: 'Con la clave correcta debía dar acceso.' },
];

export const bugHunt: QuickGenerator = (_level, random) => {
  const bug = pick(BUGS, random);
  return {
    visual: <Mono lines={[`Meta: ${bug.goal}`, ...bug.lines.map((line, index) => `${index + 1}  ${line}`)]} />,
    prompt: '¿Qué línea tiene el bug?',
    options: bug.lines.map((_, index) => `Línea ${index + 1}`),
    answer: bug.bug,
    note: `Línea ${bug.bug + 1}: ${bug.why}`,
  };
};
