import { basePerks, type RunnerPerks } from './logic';

// Personajes telemáticos de TEL Runner: cada uno es un equipo o concepto real de las redes, se
// desbloquea con paquetes de datos recogidos corriendo y trae una ventaja ligada a lo que hace.
export type RunnerCharacterId = 'rutix' | 'paqui' | 'routa' | 'fibri' | 'satelin' | 'dronix' | 'nubi';

export interface RunnerCharacter {
  id: RunnerCharacterId;
  name: string;
  // Qué es en una red de verdad.
  role: string;
  // Dato corto para aprender algo al elegirlo.
  fact: string;
  // Ventaja en la carrera, en palabras.
  perk: string;
  // Paquetes de datos que cuesta desbloquearlo (0 = disponible desde el inicio).
  cost: number;
  color: string;
  perks: RunnerPerks;
}

export const runnerCharacters: RunnerCharacter[] = [
  {
    id: 'rutix',
    name: 'Rutix',
    role: 'Robot-antena de SoyTEL',
    fact: 'Una antena convierte señales eléctricas en ondas que viajan por el aire, y al revés.',
    perk: 'Equilibrado: 3 vidas y salto normal.',
    cost: 0,
    color: '#6FB3D9',
    perks: basePerks,
  },
  {
    id: 'paqui',
    name: 'Paqui',
    role: 'Paquete de datos',
    fact: 'Todo lo que envías por Internet se corta en paquetes pequeños que viajan por separado y se rearman al llegar.',
    perk: 'Imán: recoge los paquetes de las pistas vecinas.',
    cost: 60,
    color: '#F2CE63',
    perks: { ...basePerks, magnet: true },
  },
  {
    id: 'routa',
    name: 'Routa',
    role: 'Router',
    fact: 'El router lee la dirección IP de cada paquete y decide por qué camino enviarlo.',
    perk: 'Cortafuegos incluido: parte con un escudo.',
    cost: 180,
    color: '#7BC8A4',
    perks: { ...basePerks, startShield: true },
  },
  {
    id: 'fibri',
    name: 'Fibri',
    role: 'Fibra óptica',
    fact: 'La fibra óptica lleva los datos como pulsos de luz dentro de un hilo de vidrio más fino que un cabello.',
    perk: 'Luz veloz: el doble de datos dura 12 segundos.',
    cost: 400,
    color: '#F29C6B',
    perks: { ...basePerks, boostSeconds: 12 },
  },
  {
    id: 'satelin',
    name: 'Satelín',
    role: 'Satélite de comunicaciones',
    fact: 'Un satélite repite las señales desde el espacio para conectar lugares donde no llegan los cables.',
    perk: 'Cobertura total: corre con 4 vidas.',
    cost: 800,
    color: '#A98BE0',
    perks: { ...basePerks, lives: 4 },
  },
  {
    id: 'dronix',
    name: 'Dronix',
    role: 'Dron conectado',
    fact: 'Un dron se controla por radio y envía video en vivo: es telemática volando.',
    perk: 'Hélices: salta casi el doble de tiempo.',
    cost: 1300,
    color: '#EE8FB3',
    perks: { ...basePerks, jumpSeconds: 1.05 },
  },
  {
    id: 'nubi',
    name: 'Nubi',
    role: 'La nube',
    fact: 'La nube son miles de servidores en centros de datos: guardan copias de tus archivos para que no se pierdan.',
    perk: 'Respaldo: una vez por carrera vuelve con una vida extra.',
    cost: 2000,
    color: '#A7D4ED',
    perks: { ...basePerks, backup: true },
  },
];

export function getRunnerCharacter(id: string): RunnerCharacter {
  return runnerCharacters.find((character) => character.id === id) ?? runnerCharacters[0];
}

// Próximo personaje que se puede comprar (el más barato de los que faltan).
export function nextRunnerCharacter(unlocked: string[]): RunnerCharacter | null {
  return runnerCharacters.filter((character) => !unlocked.includes(character.id)).sort((a, b) => a.cost - b.cost)[0] ?? null;
}
