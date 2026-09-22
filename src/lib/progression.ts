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

export function calculateGameXp(score: number, accuracy: number, durationSeconds: number): number {
  const safeScore = Math.max(0, score);
  const safeAccuracy = Math.min(1, Math.max(0, accuracy));
  const paceBonus = durationSeconds <= 300 ? 15 : 5;
  return Math.round(safeScore * 0.2 + safeAccuracy * 60 + paceBonus);
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

export function isValidJourneyCode(code: string): boolean {
  return /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/.test(code.trim().toUpperCase());
}
