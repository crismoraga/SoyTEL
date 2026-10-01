import AsyncStorage from '@react-native-async-storage/async-storage';
import { newBoxKeys } from '@/realtime/crypto';
import { clearRouteStorage, listHostSummaries, loadMember, saveHost, saveMember, type MemberCredentials } from '@/route/storage';
import { createRoute } from '@/route/engine';
import { isSealed, vaultGet, vaultSet } from '@/security/vault';

function credentials(): MemberCredentials {
  return {
    code: 'ABC234',
    clientId: 'stp123456',
    boxKeys: newBoxKeys(),
    alias: 'Ana',
    avatar: 3,
    fingerprint: null,
    brokerIndex: 0,
    hostBox: 'host-box',
    hostSign: 'host-sign',
    sessionKey: 'secreto-de-sesion',
    token: 'token-privado',
    joinedAt: 1,
    solo: false,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('vault', () => {
  it('stores values encrypted and reads them back', async () => {
    await vaultSet('@soytel/test', { secret: 'abc', n: 1 });
    const raw = await AsyncStorage.getItem('@soytel/test');
    expect(isSealed(raw)).toBe(true);
    expect(raw).not.toContain('abc');
    expect(await vaultGet('@soytel/test')).toEqual({ secret: 'abc', n: 1 });
  });

  it('migrates legacy plaintext values to the sealed format', async () => {
    await AsyncStorage.setItem('@soytel/legacy', JSON.stringify({ token: 'viejo' }));
    expect(await vaultGet('@soytel/legacy')).toEqual({ token: 'viejo' });
    expect(isSealed(await AsyncStorage.getItem('@soytel/legacy'))).toBe(true);
  });

  it('rejects tampered ciphertext', async () => {
    await vaultSet('@soytel/tamper', { ok: true });
    const raw = (await AsyncStorage.getItem('@soytel/tamper'))!;
    const flipped = raw.slice(0, -4) + (raw.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    await AsyncStorage.setItem('@soytel/tamper', flipped);
    expect(await vaultGet('@soytel/tamper')).toBeNull();
  });
});

describe('route storage', () => {
  it('never writes participant secrets in plaintext', async () => {
    const member = credentials();
    await saveMember(member);
    const raw = await AsyncStorage.getItem('@soytel/route/member');
    expect(raw).not.toContain('secreto-de-sesion');
    expect(raw).not.toContain('token-privado');
    expect(raw).not.toContain(member.boxKeys.secretKey);
    expect(await loadMember()).toEqual(member);
  });

  it('keeps host keys sealed and lists routes with their stop', async () => {
    const state = { ...createRoute('XYZ789', 1, 2), phase: 'checkin' as const, stop: 'b213' as const };
    const signKeys = { publicKey: 'pub', secretKey: 'clave-firma-secreta' };
    await saveHost({ code: 'XYZ789', clientId: 'sth1', brokerIndex: 0, boxKeys: newBoxKeys(), signKeys, sessionKey: 'sesion-secreta', state, seqs: {}, savedAt: 5 });
    const raw = await AsyncStorage.getItem('@soytel/route/host/XYZ789');
    expect(raw).not.toContain('clave-firma-secreta');
    expect(raw).not.toContain('sesion-secreta');
    expect(await listHostSummaries()).toEqual([{ code: 'XYZ789', phase: 'checkin', stop: 'b213', players: 0, savedAt: 5 }]);
  });

  it('clears every route key, including leases', async () => {
    await saveMember(credentials());
    await AsyncStorage.setItem('@soytel/route/lease/ABC234', '{"owner":"x","at":1}');
    await AsyncStorage.setItem('@soytel/route/recorded', '["ABC234"]');
    await AsyncStorage.setItem('@soytel/profile', '{}');
    await clearRouteStorage();
    const keys = await AsyncStorage.getAllKeys();
    expect(keys.filter((key) => key.startsWith('@soytel/route/'))).toEqual([]);
    expect(keys).toContain('@soytel/profile');
  });
});
