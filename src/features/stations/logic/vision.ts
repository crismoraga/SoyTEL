// Lógica de "Entrena la IA": imágenes pixel art de gatos y perros, filtros reales y curvas de entrenamiento.

export type Species = 'gato' | 'perro';
export type FilterKind = 'original' | 'bordes' | 'desenfoque';

// '.' fondo · '#' pelaje · 's' pelaje secundario · 'o' ojos · 'n' nariz · 'w' bigotes · 't' lengua
const CAT = [
  '................',
  '.##..........##.',
  '.#s#........#s#.',
  '.#ss#......#ss#.',
  '.##############.',
  '.##############.',
  '.###oo####oo###.',
  '.###oo####oo###.',
  '.##############.',
  'ww#####nn#####ww',
  '.#ww##nnnn##ww#.',
  '.##############.',
  '..############..',
  '...##########...',
  '.....######.....',
  '................',
];

const DOG = [
  '................',
  '....########....',
  '..############..',
  '.ss##########ss.',
  'sss##########sss',
  'sss##oo##oo##sss',
  'sss##oo##oo##sss',
  'ss############ss',
  '.s#####nn#####s.',
  '..####nnnn####..',
  '..#####nn#####..',
  '...####tt####...',
  '...####tt####...',
  '....########....',
  '......####......',
  '................',
];

export const GRID = 16;
const BACKGROUND = '#DCEBF6';

interface Palette {
  fur: string;
  secondary: string;
  eyes: string;
  nose: string;
}

const catPalettes: Palette[] = [
  { fur: '#9AA5B1', secondary: '#5E6B78', eyes: '#1B2530', nose: '#E88FA0' },
  { fur: '#E8A35C', secondary: '#B86B2B', eyes: '#1B2530', nose: '#E88FA0' },
  { fur: '#3B3B45', secondary: '#1E1E26', eyes: '#E6C84A', nose: '#E88FA0' },
  { fur: '#EDE3D1', secondary: '#C9B79A', eyes: '#2F6F95', nose: '#E88FA0' },
];

const dogPalettes: Palette[] = [
  { fur: '#B07A4A', secondary: '#6E4524', eyes: '#1B2530', nose: '#1E1E1E' },
  { fur: '#E4C07A', secondary: '#B08A45', eyes: '#1B2530', nose: '#1E1E1E' },
  { fur: '#F2EFE8', secondary: '#8A6A4F', eyes: '#1B2530', nose: '#1E1E1E' },
  { fur: '#4A3A30', secondary: '#2B211B', eyes: '#F4ECD7', nose: '#111111' },
];

export interface PixelImage {
  id: number;
  species: Species;
  pixels: string[];
}

function colorFor(symbol: string, palette: Palette): string {
  switch (symbol) {
    case '#':
      return palette.fur;
    case 's':
      return palette.secondary;
    case 'o':
      return palette.eyes;
    case 'n':
      return palette.nose;
    case 'w':
      return palette.eyes === '#E6C84A' ? '#BFC7CF' : '#3A4652';
    case 't':
      return '#E36D7E';
    default:
      return BACKGROUND;
  }
}

export function makeImage(id: number, species: Species, random: () => number): PixelImage {
  const template = species === 'gato' ? CAT : DOG;
  const palettes = species === 'gato' ? catPalettes : dogPalettes;
  const palette = palettes[Math.floor(random() * palettes.length)];
  const shift = Math.floor(random() * 3) - 1;
  const pixels: string[] = [];
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      const sourceX = x - shift;
      const symbol = sourceX >= 0 && sourceX < GRID ? template[y][sourceX] : '.';
      pixels.push(colorFor(symbol, palette));
    }
  }
  // Algo de ruido, como en las fotos reales.
  const noise = 3 + Math.floor(random() * 4);
  for (let i = 0; i < noise; i += 1) {
    const index = Math.floor(random() * pixels.length);
    pixels[index] = random() < 0.5 ? '#FFFFFF' : '#8CA3B4';
  }
  return { id, species, pixels };
}

export function makeDataset(count: number, random: () => number, startId = 0): PixelImage[] {
  const images: PixelImage[] = [];
  for (let i = 0; i < count; i += 1) images.push(makeImage(startId + i, i % 2 === 0 ? 'gato' : 'perro', random));
  for (let i = images.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [images[i], images[j]] = [images[j], images[i]];
  }
  return images;
}

function luminance(hex: string): number {
  const value = parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function grayscale(image: PixelImage): number[] {
  return image.pixels.map(luminance);
}

// Filtro de Sobel (detección de bordes) sobre la imagen en escala de grises.
export function sobel(gray: number[]): number[] {
  const at = (x: number, y: number) => gray[Math.min(GRID - 1, Math.max(0, y)) * GRID + Math.min(GRID - 1, Math.max(0, x))];
  const out: number[] = [];
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
      const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
      out.push(Math.min(1, Math.hypot(gx, gy) / 2.2));
    }
  }
  return out;
}

// Desenfoque de caja 3×3.
export function blur(gray: number[]): number[] {
  const out: number[] = [];
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
          sum += gray[ny * GRID + nx];
          count += 1;
        }
      }
      out.push(sum / count);
    }
  }
  return out;
}

export function toGrayHex(value: number): string {
  const channel = Math.round(Math.min(1, Math.max(0, value)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${channel}${channel}${channel}`;
}

export function filtered(image: PixelImage, filter: FilterKind): string[] {
  if (filter === 'original') return image.pixels;
  const gray = grayscale(image);
  if (filter === 'bordes') return sobel(gray).map((value) => toGrayHex(value));
  return blur(gray).map((value) => toGrayHex(value));
}

export const filterFactor: Record<FilterKind, number> = { bordes: 1, original: 0.7, desenfoque: 0.35 };

export const filterFeedback: Record<FilterKind, string> = {
  bordes: '¡Buena elección! Los bordes marcan orejas y hocico: justo lo que distingue a un gato de un perro.',
  original: 'Funciona, pero el color confunde: hay gatos y perros de todos los colores.',
  desenfoque: 'El desenfoque borra los detalles: al modelo le cuesta ver las orejas.',
};

export const EPOCHS = 30;

export function bestEpoch(random: () => number): number {
  return 11 + Math.floor(random() * 6);
}

export function trainLoss(epoch: number): number {
  return 1.15 * Math.exp(-epoch / 6) + 0.05;
}

// La pérdida de validación baja y luego sube: ahí empieza el sobreajuste. Desde `best` el castigo por
// sobreajuste crece más rápido de lo que la curva sigue bajando, así que el punto más bajo que se
// dibuja es exactamente `best` (el mismo que premia stopQuality).
export function validationLoss(epoch: number, best: number): number {
  const overfit = Math.max(0, epoch - best);
  return 1.15 * Math.exp(-epoch / 6.5) + 0.12 + overfit * 0.035 + overfit * overfit * 0.0035;
}

export function stopQuality(epoch: number, best: number): number {
  return Math.max(0, Math.min(1, 1 - Math.abs(epoch - best) / 9));
}

// Qué se le dice al jugador según dónde detuvo el entrenamiento (coherente con la curva).
export function stopVerdict(epoch: number, best: number): { tone: 'good' | 'bad'; text: string } {
  const distance = Math.abs(epoch - best);
  if (distance <= 1) return { tone: 'good', text: '¡Justo a tiempo! La validación estaba en su mínimo.' };
  if (distance <= 3) {
    return epoch < best
      ? { tone: 'good', text: 'Casi: la validación todavía bajaba un poco. Unas épocas más y era el mínimo.' }
      : { tone: 'good', text: 'Casi: la validación ya empezaba a subir. El mínimo estaba unas épocas antes.' };
  }
  return epoch < best
    ? { tone: 'bad', text: 'Muy pronto: el modelo todavía podía aprender más.' }
    : { tone: 'bad', text: 'Muy tarde: la validación subió, el modelo memorizó los datos (sobreajuste).' };
}

export const LABEL_MAX = 450;
export const FILTER_MAX = 200;
export const TRAIN_MAX = 350;

export function modelQuality(labelAccuracy: number, filter: FilterKind, quality: number): number {
  return 0.45 * labelAccuracy + 0.2 * filterFactor[filter] + 0.35 * quality;
}

// Precisión mostrada del modelo en el conjunto de prueba (50% = azar).
export function modelAccuracy(quality: number): number {
  return 0.5 + 0.5 * Math.max(0, Math.min(1, quality));
}
