export function xpForLevel(level: number): number {
  if (level < 1) {
    return 0;
  }

  return 120 * (level - 1) + 35 * (level - 1) ** 2;
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) {
    level += 1;
  }
  return level;
}

export function progressToNextLevel(xp: number): number {
  const level = levelFromXp(xp);
  const current = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return Math.min(1, Math.max(0, (xp - current) / (next - current)));
}

export function xpToNextLevel(xp: number): number {
  return Math.max(0, xpForLevel(levelFromXp(xp) + 1) - xp);
}

// XP por sesión: base fija + puntaje (con tope, para que un modo no domine) + precisión + ritmo.
export function calculateGameXp(score: number, accuracy: number, durationSeconds: number): number {
  const safeScore = Math.min(2000, Math.max(0, score));
  const safeAccuracy = Math.min(1, Math.max(0, accuracy));
  const paceBonus = durationSeconds <= 300 ? 15 : 5;
  return Math.round(20 + safeScore * 0.08 + safeAccuracy * 60 + paceBonus);
}

export function levelTitle(level: number): string {
  if (level >= 10) return 'Arquitecto de redes';
  if (level >= 7) return 'Ingeniero en terreno';
  if (level >= 5) return 'Analista de señal';
  if (level >= 3) return 'Técnico en práctica';
  return 'Explorador TEL';
}

export function journeyCodeFromSeed(seed: number): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let value = Math.abs(Math.floor(seed));
  let code = '';

  for (let index = 0; index < 6; index += 1) {
    code += alphabet[value % alphabet.length];
    value = Math.floor(value / alphabet.length) + 17;
  }

  return code;
}

export function isValidJourneyCode(code: unknown): boolean {
  return typeof code === 'string' && /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/.test(code.trim().toUpperCase());
}

// Limpia lo que se escribe en el campo del código. Solo acepta texto: un parámetro de enlace repetido
// llega como lista y no se intenta interpretar (ver route/joinLink).
export function sanitizeJourneyCode(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .toUpperCase()
    .replace(/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/g, '')
    .slice(0, 6);
}
