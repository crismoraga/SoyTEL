import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  aliasProblem,
  allowedXp,
  cleanAlias,
  formatRecoveryCode,
  isBlockedText,
  isRecoveryCode,
  needsGuardianConsent,
  normalizeContact,
  schoolProblem,
} from '@/account/rules';
import { dismissAccountOffer, initAccount, isOfferSnoozed, OFFER_SNOOZE_MS, shouldOfferAccount } from '@/account/store';
import { avatarCatalog, isAvatarUnlocked } from '@/data/avatars';
import { detectDeviceMotion, particleBudget, resolveMotionLevel } from '@/lib/motion';
import { roundDuration } from '@/features/burst/registry';
import { PACE_ACCELERATION, paceFactor, paceFromFactor } from '@/lib/pace';
import { defaultSettings, parseSettings } from '@/storage/settings';

describe('account rules', () => {
  it('validates aliases and blocks insults (also with leetspeak)', () => {
    expect(aliasProblem('Fibra Veloz')).toBeNull();
    expect(aliasProblem('a')).toMatch(/al menos/);
    expect(aliasProblem('w30n')).toMatch(/no está permitido/);
    expect(isBlockedText('el qliao')).toBe(true);
    // Sin falsos positivos con palabras comunes.
    expect(isBlockedText('Computador')).toBe(false);
    expect(isBlockedText('Liceo de Conchalí')).toBe(false);
    expect(cleanAlias('  <Ana>   María ')).toBe('Ana María');
  });

  it('normalizes contact data', () => {
    expect(normalizeContact('email', ' Ana@Correo.CL ')).toBe('ana@correo.cl');
    expect(normalizeContact('email', 'no-es-correo')).toBeNull();
    expect(normalizeContact('phone', '+56 9 1234 5678')).toBe('+56912345678');
    expect(normalizeContact('phone', '912345678')).toBe('+56912345678');
    expect(normalizeContact('phone', '221234567')).toBeNull();
    expect(normalizeContact('instagram', '@Tele.Matica')).toBe('@tele.matica');
  });

  it('requires a guardian for contact data in 7° and 8° básico only', () => {
    expect(needsGuardianConsent('7b')).toBe(true);
    expect(needsGuardianConsent('8b')).toBe(true);
    expect(needsGuardianConsent('1m')).toBe(false);
    expect(needsGuardianConsent(null)).toBe(false);
  });

  it('formats recovery codes', () => {
    expect(formatRecoveryCode('tel-abcd efgh-jkmn')).toBe('TEL-ABCD-EFGH-JKMN');
    expect(isRecoveryCode('TEL-ABCD-EFGH-JKMN')).toBe(true);
    // 0, 1, I y O no existen en el alfabeto.
    expect(isRecoveryCode('TEL-ABCD-EFGH-JKM0')).toBe(false);
  });

  it('limits how fast a device can claim XP', () => {
    expect(allowedXp(1000, 0)).toBe(1400);
    expect(allowedXp(1000, 60)).toBe(1580);
  });

  it('checks school names', () => {
    expect(schoolProblem('')).toBeNull();
    expect(schoolProblem('Liceo Bicentenario de Viña')).toBeNull();
    expect(schoolProblem('ab')).not.toBeNull();
  });
});

describe('avatars', () => {
  it('has unique ids and locks special avatars until earned', () => {
    expect(new Set(avatarCatalog.map((avatar) => avatar.id)).size).toBe(avatarCatalog.length);
    const crown = avatarCatalog.find((avatar) => avatar.label === 'Corona')!;
    expect(isAvatarUnlocked(crown, { level: 4, achievements: [] })).toBe(false);
    expect(isAvatarUnlocked(crown, { level: 5, achievements: [] })).toBe(true);
    const rutix = avatarCatalog.find((avatar) => avatar.icon === 'rutix')!;
    expect(isAvatarUnlocked(rutix, { level: 9, achievements: [] })).toBe(false);
    expect(isAvatarUnlocked(rutix, { level: 1, achievements: ['rutix-friend'] })).toBe(true);
  });
});

describe('motion levels', () => {
  it('starts low-memory Android phones with minimal animations', () => {
    expect(detectDeviceMotion('android', 2 * 1024 ** 3, 2019)).toBe('minimal');
    expect(detectDeviceMotion('android', 6 * 1024 ** 3, 2021)).toBe('balanced');
    expect(detectDeviceMotion('ios', null, null)).toBe('balanced');
  });

  it('honors the system setting and the user preference', () => {
    expect(resolveMotionLevel('auto', true, 'balanced')).toBe('minimal');
    expect(resolveMotionLevel('auto', false, 'minimal')).toBe('minimal');
    expect(resolveMotionLevel('full', false, 'minimal')).toBe('full');
  });

  it('scales confetti by level', () => {
    expect(particleBudget('full', 40)).toBe(40);
    expect(particleBudget('balanced', 40)).toBe(18);
    expect(particleBudget('minimal', 40)).toBe(0);
  });

  it('migrates the old "reduce motion" switch', () => {
    expect(parseSettings(JSON.stringify({ haptics: false, reducedMotion: true }))).toMatchObject({ haptics: false, motion: 'minimal' });
    expect(parseSettings(JSON.stringify({ motion: 'full' }))).toMatchObject({ haptics: true, motion: 'full' });
    expect(parseSettings('{oops')).toEqual(defaultSettings);
  });

  it('defaults to an unhurried game pace and validates stored values', () => {
    expect(defaultSettings.pace).toBe('relaxed');
    expect(parseSettings(JSON.stringify({ pace: 'fast', theme: 'dark', coach: false }))).toMatchObject({ pace: 'fast', theme: 'dark', coach: false });
    expect(parseSettings(JSON.stringify({ pace: 'turbo', theme: 'neon' }))).toMatchObject({ pace: 'relaxed', theme: 'system', coach: true });
    expect(paceFactor('calm')).toBeGreaterThan(paceFactor('normal'));
    expect(paceFactor('fast')).toBe(1);
    expect(paceFromFactor(1.68)).toBe('calm');
    // En ritmo tranquilo la Ráfaga no acelera y da más tiempo que el ritmo original.
    expect(roundDuration(10, 4, false, paceFactor('calm'), PACE_ACCELERATION.calm)).toBe(17);
    expect(roundDuration(10, 4, false, paceFactor('fast'), PACE_ACCELERATION.fast)).toBe(7);
  });
});

describe('account invitation', () => {
  it('rests for half a day after "ahora no"', async () => {
    await AsyncStorage.clear();
    await initAccount();
    expect(shouldOfferAccount()).toBe(true);
    dismissAccountOffer();
    expect(shouldOfferAccount()).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 10));
    // La hora del descarte queda guardada: al reiniciar la app se respeta el descanso.
    const savedAt = Number(await AsyncStorage.getItem('@soytel/account-offer'));
    expect(isOfferSnoozed(savedAt)).toBe(true);
    expect(isOfferSnoozed(savedAt, savedAt + OFFER_SNOOZE_MS + 1)).toBe(false);
    expect(isOfferSnoozed(0)).toBe(false);
  });
});
