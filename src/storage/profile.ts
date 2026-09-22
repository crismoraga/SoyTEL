import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameResult, UserProfile } from '@/types/game';
import { calculateGameXp, levelFromXp } from '@/lib/progression';

const PROFILE_KEY = '@soytel/profile';
const RESULTS_KEY = '@soytel/results';

export const defaultProfile: UserProfile = {
  alias: 'Explorador TEL',
  createdAt: new Date().toISOString(),
  xp: 0,
  level: 1,
  streakDays: 0,
  lastPlayedAt: null,
  mascotMood: 72,
  unlockedAchievements: [],
};

function isSameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function isYesterday(day: Date, reference: Date): boolean {
  const yesterday = new Date(reference);
  yesterday.setDate(reference.getDate() - 1);
  return isSameDay(day, yesterday);
}

export async function loadProfile(): Promise<UserProfile> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  let profile = defaultProfile;

  if (raw) {
    try {
      profile = { ...defaultProfile, ...JSON.parse(raw) as Partial<UserProfile> };
    } catch {
      profile = defaultProfile;
    }
  }

  return applyMascotDecay(profile);
}

function applyMascotDecay(profile: UserProfile): UserProfile {
  if (!profile.lastPlayedAt) {
    return profile;
  }

  const daysSince = Math.floor((Date.now() - new Date(profile.lastPlayedAt).getTime()) / 86_400_000);
  if (daysSince <= 0) {
    return profile;
  }

  return {
    ...profile,
    mascotMood: Math.max(10, profile.mascotMood - daysSince * 6),
  };
}

export async function unlockAchievement(id: string): Promise<UserProfile> {
  const profile = await loadProfile();
  if (profile.unlockedAchievements.includes(id)) {
    return profile;
  }

  const updated = {
    ...profile,
    unlockedAchievements: [...profile.unlockedAchievements, id],
  };
  await saveProfile(updated);
  return updated;
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function loadResults(): Promise<GameResult[]> {
  const raw = await AsyncStorage.getItem(RESULTS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as GameResult[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function recordGameResult(result: GameResult): Promise<UserProfile> {
  const [profile, results] = await Promise.all([loadProfile(), loadResults()]);
  const playedAt = new Date(result.completedAt);
  const previousPlayedAt = profile.lastPlayedAt ? new Date(profile.lastPlayedAt) : null;
  const streakDays = previousPlayedAt && isSameDay(previousPlayedAt, playedAt)
    ? profile.streakDays
    : previousPlayedAt && isYesterday(previousPlayedAt, playedAt)
      ? profile.streakDays + 1
      : 1;
  const xp = profile.xp + calculateGameXp(result.score, result.accuracy, result.durationSeconds);
  const unlockedAchievements = new Set(profile.unlockedAchievements);

  if (!unlockedAchievements.has('first-signal')) {
    unlockedAchievements.add('first-signal');
  }
  if (result.accuracy >= 1) {
    unlockedAchievements.add('perfect-run');
  }
  if (result.gameId === 'journey') {
    const journeyCount = results.filter((item) => item.gameId === 'journey').length + 1;
    if (journeyCount >= 2) {
      unlockedAchievements.add('journey-host');
    }
  }
  if (result.gameId === 'millionaire') {
    const correctAnswers = Number(result.metadata?.correctAnswers ?? 0);
    const historicalCorrect = results
      .filter((item) => item.gameId === 'millionaire')
      .reduce((total, item) => total + Number(item.metadata?.correctAnswers ?? 0), 0);
    if (historicalCorrect + correctAnswers >= 10) {
      unlockedAchievements.add('quiz-bronze');
    }
  }
  if (result.gameId === 'burst') {
    const burstCount = results.filter((item) => item.gameId === 'burst').length + 1;
    if (burstCount >= 3) {
      unlockedAchievements.add('burst-starter');
    }
  }
  if (result.gameId === 'story' && Number(result.metadata?.chapter ?? 0) >= 3) {
    unlockedAchievements.add('signal-restored');
  }

  const updated: UserProfile = {
    ...profile,
    xp,
    level: levelFromXp(xp),
    streakDays,
    lastPlayedAt: result.completedAt,
    mascotMood: Math.min(100, profile.mascotMood + 4),
    unlockedAchievements: [...unlockedAchievements],
  };

  if (updated.level >= 5) {
    updated.unlockedAchievements = [...new Set([...updated.unlockedAchievements, 'level-five'])];
  }

  await Promise.all([
    saveProfile(updated),
    AsyncStorage.setItem(RESULTS_KEY, JSON.stringify([result, ...results].slice(0, 100))),
  ]);

  return updated;
}

export async function updateAlias(alias: string): Promise<UserProfile> {
  const profile = await loadProfile();
  const updated = {
    ...profile,
    alias: alias.trim() || defaultProfile.alias,
  };
  await saveProfile(updated);
  return updated;
}
