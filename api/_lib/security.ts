import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { RECOVERY_ALPHABET } from '../../src/account/rules';
import { query } from './db';

// Tokens de sesión y códigos de recuperación: en la base solo se guarda su hash.

export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSecret(secret: string): string {
  const pepper = process.env.SOYTEL_PEPPER ?? '';
  return createHmac('sha256', pepper).update(secret).digest('hex');
}

export function newRecoveryCode(): string {
  const bytes = randomBytes(12);
  const chars = Array.from(bytes, (byte) => RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length]).join('');
  return `TEL-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

export function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// Datos de contacto cifrados en la base (AES-256-GCM con SOYTEL_DATA_KEY): ni un respaldo de la base los expone.
function dataKey(): Buffer {
  const raw = process.env.SOYTEL_DATA_KEY ?? '';
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('SOYTEL_DATA_KEY debe tener 32 bytes en base64');
  return key;
}

export function encryptField(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', dataKey(), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `g1:${Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64')}`;
}

export function decryptField(sealed: string | null): string | null {
  if (!sealed || !sealed.startsWith('g1:')) return null;
  try {
    const raw = Buffer.from(sealed.slice(3), 'base64');
    const decipher = createDecipheriv('aes-256-gcm', dataKey(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

function hashIp(ip: string): string {
  return createHash('sha256')
    .update(`${process.env.SOYTEL_PEPPER ?? ''}:${ip}`)
    .digest('hex')
    .slice(0, 32);
}

// Límite de solicitudes por ventana (contador en Postgres). true = permitido.
export async function rateLimit(scope: string, ip: string, limit: number, windowSeconds: number): Promise<boolean> {
  const rows = await query<{ hits: number }>(
    `insert into rate_limits (bucket, window_start, hits) values ($1, now(), 1)
     on conflict (bucket) do update set
       hits = case when rate_limits.window_start < now() - make_interval(secs => $2) then 1 else rate_limits.hits + 1 end,
       window_start = case when rate_limits.window_start < now() - make_interval(secs => $2) then now() else rate_limits.window_start end
     returning hits`,
    [`${scope}:${hashIp(ip)}`, windowSeconds],
  );
  return (rows[0]?.hits ?? 0) <= limit;
}

// Llave de administración para exportar contactos (encabezado x-admin-key).
export function isAdmin(request: Request): boolean {
  const expected = process.env.SOYTEL_ADMIN_KEY ?? '';
  const given = request.headers.get('x-admin-key') ?? '';
  return expected.length >= 24 && sameSecret(hashSecret(given), hashSecret(expected));
}
