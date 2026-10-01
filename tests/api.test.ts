/**
 * @jest-environment node
 */
import { profileColumns, sanitizeProgress, validateProfile, type PlayerRow } from '../api/_lib/players';
import { decryptField, encryptField, hashSecret, newRecoveryCode } from '../api/_lib/security';
import { isRecoveryCode } from '@/account/rules';

// Lógica pura de la API (validación, consentimiento, cifrado de contactos). Sin base de datos.
beforeAll(() => {
  process.env.SOYTEL_DATA_KEY = Buffer.alloc(32, 7).toString('base64');
  process.env.SOYTEL_PEPPER = 'pimienta-de-prueba';
});

describe('api validation', () => {
  it('requires an alias on sign up and validates the avatar', () => {
    expect(validateProfile({}, 'create').ok).toBe(false);
    expect(validateProfile({ alias: 'Ana', avatar: 99 }, 'create').ok).toBe(false);
    const check = validateProfile({ alias: '  Ana  ', avatar: 3 }, 'create');
    expect(check).toEqual({ ok: true, value: { alias: 'Ana', avatar: 3 } });
  });

  it('drops contact data without explicit consent', () => {
    const check = validateProfile({ alias: 'Ana', contact: { kind: 'email', value: 'ana@correo.cl' }, contactConsent: false }, 'create');
    expect(check.ok && check.value.contactValue).toBeNull();
    expect(check.ok && check.value.contactConsent).toBe(false);
  });

  it('needs guardian consent for 7° and 8° básico', () => {
    const base = { alias: 'Ana', grade: '7b', contact: { kind: 'phone', value: '912345678' }, contactConsent: true };
    expect(validateProfile(base, 'create').ok).toBe(false);
    const ok = validateProfile({ ...base, guardianConsent: true }, 'create');
    expect(ok.ok && ok.value.contactValue).toBe('+56912345678');
    // Al editar, se usa el curso ya guardado.
    const current = { grade: '8b' } as PlayerRow;
    expect(validateProfile({ contact: { kind: 'email', value: 'a@b.cl' }, contactConsent: true }, 'update', current).ok).toBe(false);
  });

  it('encrypts contact data before it reaches the database', () => {
    const { columns, params } = profileColumns({ contactConsent: true, guardianConsent: false, contactKind: 'email', contactValue: 'ana@correo.cl' });
    const sealed = params[columns.indexOf('contact_value')] as string;
    expect(sealed).toMatch(/^g1:/);
    expect(sealed).not.toContain('ana@');
    expect(decryptField(sealed)).toBe('ana@correo.cl');
    expect(decryptField(encryptField('x').replace(/.$/, 'A'))).not.toBe('x');
  });

  it('sanitizes progress', () => {
    const progress = sanitizeProgress({ xp: -5, games: 3.7, achievements: ['first-signal', 'first-signal', '<script>', 7] });
    expect(progress).toEqual({ xp: 0, games: 3, streak: 0, bestRoute: 0, routes: 0, achievements: ['first-signal'] });
  });

  it('issues recovery codes in the expected format and hashes secrets', () => {
    const code = newRecoveryCode();
    expect(isRecoveryCode(code)).toBe(true);
    expect(hashSecret(code)).toHaveLength(64);
    expect(hashSecret(code)).not.toContain(code);
  });
});
