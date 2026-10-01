import type { IconName } from '@/components/TelIcon';
import type { AchievementId } from '@/types/game';

// Avatares predefinidos del perfil, la ruta y el ranking: ícono de marca sobre un color, con anillo crema.
// Los primeros 8 coinciden con los de la ruta en vivo (mismo índice). Algunos se desbloquean jugando.

export interface AvatarDef {
  id: number;
  label: string;
  icon: IconName | 'rutix';
  color: string;
  unlock?: { achievement?: AchievementId; level?: number; hint: string };
}

export const avatarCatalog: AvatarDef[] = [
  { id: 0, label: 'Router', icon: 'router', color: '#6FB3D9' },
  { id: 1, label: 'Antena', icon: 'antenna', color: '#4FB38A' },
  { id: 2, label: 'Chip', icon: 'cpu', color: '#9B8AE6' },
  { id: 3, label: 'Robot', icon: 'robot', color: '#E58A5A' },
  { id: 4, label: 'Cohete', icon: 'rocket', color: '#E0B84A' },
  { id: 5, label: 'Globo', icon: 'globe', color: '#A7D4ED' },
  { id: 6, label: 'Láser', icon: 'laser', color: '#F4ECD7' },
  { id: 7, label: 'Señal', icon: 'signal', color: '#E7A3C8' },
  { id: 8, label: 'Escudo', icon: 'shieldCheck', color: '#7CC6B0' },
  { id: 9, label: 'Código', icon: 'code', color: '#8FB8F0' },
  { id: 10, label: 'Fibra', icon: 'fiber', color: '#F2A07B' },
  { id: 11, label: 'Red neuronal', icon: 'neural', color: '#C9A7F0' },
  { id: 12, label: 'Terminal', icon: 'terminal', color: '#B9D98A' },
  { id: 13, label: 'Laboratorio', icon: 'flask', color: '#F3C97A' },
  { id: 14, label: 'Nocturno', icon: 'moon', color: '#9FB4D9' },
  { id: 15, label: 'Idea', icon: 'lightbulb', color: '#F7D774' },
  { id: 16, label: 'Rutix', icon: 'rutix', color: '#123D5C', unlock: { achievement: 'rutix-friend', hint: 'Cuida a Rutix siete días distintos.' } },
  { id: 17, label: 'Corona', icon: 'crown', color: '#F2CE63', unlock: { level: 5, hint: 'Llega al nivel 5.' } },
  { id: 18, label: 'Templo', icon: 'temple', color: '#A7D4ED', unlock: { achievement: 'temple-restored', hint: 'Enciende los 5 pilares en la ruta.' } },
  { id: 19, label: 'Campeón', icon: 'podium', color: '#E0B84A', unlock: { achievement: 'route-champion', hint: 'Gana una ruta en vivo.' } },
];

export function avatarDef(index: number): AvatarDef {
  const count = avatarCatalog.length;
  return avatarCatalog[((Math.floor(index) % count) + count) % count] ?? avatarCatalog[0];
}

export function isAvatarUnlocked(avatar: AvatarDef, progress: { level: number; achievements: string[] }): boolean {
  if (!avatar.unlock) return true;
  if (avatar.unlock.level !== undefined && progress.level < avatar.unlock.level) return false;
  if (avatar.unlock.achievement && !progress.achievements.includes(avatar.unlock.achievement)) return false;
  return true;
}
