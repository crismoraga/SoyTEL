import type { MicroGameId } from '@/types/game';
import type { MicroGameInfo } from '../catalog';
import type { MicroGameGuide } from '../guides';

// Paquete de microjuegos · Datos: paridad, compuertas lógicas, búsqueda binaria, SQL, gráficos y compresión.
export const datosInfo: MicroGameInfo[] = [
  { id: 'parity-bit', title: 'Bit de paridad', instruction: 'Agrega el bit que deja la cuenta de unos como se pide.', tip: 'Cuenta los 1: si son impares, agrega un 1 para que queden pares.', durationSeconds: 12, icon: 'parity', area: 'hardware', mechanic: 'Calcula', course: 'Sistemas Digitales y Estructura de Computadores · 5.º semestre' },
  { id: 'logic-gate', title: 'Compuerta lógica', instruction: '¿Se enciende el LED con estas entradas?', tip: 'AND pide las dos en 1; OR se conforma con una.', durationSeconds: 10, icon: 'logicGate', area: 'hardware', mechanic: 'Decide', course: 'Electrónica Digital · 4.º semestre' },
  { id: 'binary-search', title: 'Adivina en pocas', instruction: '¿Cuántas preguntas bastan partiendo por la mitad?', tip: 'Cada pregunta descarta la mitad: 32, 16, 8, 4, 2, 1.', durationSeconds: 12, icon: 'binarySearch', area: 'software', mechanic: 'Calcula', course: 'Algorítmica y Complejidad · 4.º semestre' },
  { id: 'sql-filter', title: 'Filtra la tabla', instruction: 'Cuenta las filas que devuelve la consulta.', tip: 'WHERE se queda solo con las filas que cumplen la condición.', durationSeconds: 14, icon: 'table', area: 'software', mechanic: 'Cuenta', course: 'Bases de Datos · 5.º semestre' },
  { id: 'chart-read', title: 'Lee el gráfico', instruction: 'Encuentra la hora con más usuarios.', tip: 'Busca la barra más alta.', durationSeconds: 10, icon: 'chart', area: 'software', mechanic: 'Lee', course: 'Ciencia de Datos · 7.º semestre' },
  { id: 'compress-rle', title: 'Comprime', instruction: 'Elige la versión comprimida del texto.', tip: 'Cuenta cuántas veces se repite cada letra seguida.', durationSeconds: 12, icon: 'compress', area: 'software', mechanic: 'Elige', course: 'Algorítmica y Complejidad · 4.º semestre' },
];

export const datosGuides: Partial<Record<MicroGameId, MicroGameGuide>> = {
  'parity-bit': { steps: ['Cuenta los unos de los datos.', 'Elige 0 o 1 para que el total cumpla la paridad.'], learn: 'El bit de paridad permite detectar si un bit se dañó en el camino.' },
  'logic-gate': { steps: ['Lee las entradas A y B.', 'Aplica la regla de la compuerta y responde.'], learn: 'Las compuertas lógicas son la base de todo circuito digital: combinan ceros y unos.' },
  'binary-search': { steps: ['Lee el tamaño de la lista.', 'Cuenta cuántas veces puedes partirla por la mitad.'], learn: 'La búsqueda binaria encuentra un dato en una lista ordenada partiéndola por la mitad cada vez.' },
  'sql-filter': { steps: ['Lee la condición WHERE.', 'Cuenta las filas que la cumplen.'], learn: 'SQL es el idioma para pedirle datos a una base: WHERE filtra las filas.' },
  'chart-read': { steps: ['Mira las barras.', 'Toca la hora de la más alta.'], learn: 'Leer gráficos permite tomar decisiones con datos, como cuándo reforzar el Wi-Fi.' },
  'compress-rle': { steps: ['Agrupa las letras repetidas.', 'Escribe cuántas son y qué letra.'], learn: 'Comprimir es guardar lo mismo con menos datos: así pesan menos fotos y videos.' },
};
