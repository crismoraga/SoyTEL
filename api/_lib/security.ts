import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { recoveryCodeFromBytes } from '../../src/account/rules';
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
  return recoveryCodeFromBytes(randomBytes(12));
}

export function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// ——— Datos de contacto cifrados (AES-256-GCM): ni un respaldo de la base los expone ———
//
// SOYTEL_DATA_KEY es la llave vigente (32 bytes en base64). Para cambiarla sin perder lo guardado,
// la anterior pasa a SOYTEL_DATA_KEY_PREVIOUS (varias, separadas por coma): se sigue pudiendo leer con
// ellas y todo lo nuevo se cifra con la vigente. Cada dato lleva la huella de la llave que lo cifró.

interface DataKey {
  id: string;
  key: Buffer;
}

function parseKey(raw: string): DataKey | null {
  const key = Buffer.from(raw.trim(), 'base64');
  if (key.length !== 32) return null;
  return { id: createHash('sha256').update(key).digest('hex').slice(0, 8), key };
}

function currentKey(): DataKey {
  const key = parseKey(process.env.SOYTEL_DATA_KEY ?? '');
  if (!key) throw new Error('SOYTEL_DATA_KEY debe tener 32 bytes en base64');
  return key;
}

function keyring(): DataKey[] {
  const previous = (process.env.SOYTEL_DATA_KEY_PREVIOUS ?? '')
    .split(',')
    .map((item) => parseKey(item))
    .filter((item): item is DataKey => item !== null);
  const current = parseKey(process.env.SOYTEL_DATA_KEY ?? '');
  return current ? [current, ...previous] : previous;
}

export function encryptField(plain: string): string {
  const { id, key } = currentKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `g2:${id}:${Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64')}`;
}

function decryptWith(key: Buffer, payload: string): string | null {
  try {
    const raw = Buffer.from(payload, 'base64');
    if (raw.length < 28) return null;
    const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// 'empty': no hay dato. 'unreadable': hay un dato pero no se pudo descifrar (llave equivocada o dato
// dañado). No se confunden: un dato ilegible nunca se presenta como si no existiera.
export type FieldResult = { state: 'empty' } | { state: 'ok'; value: string } | { state: 'unreadable' };

export function openField(sealed: string | null | undefined): FieldResult {
  if (!sealed) return { state: 'empty' };
  const keys = keyring();
  const tagged = /^g2:([0-9a-f]{8}):(.+)$/.exec(sealed);
  if (tagged) {
    const match = keys.find((item) => item.id === tagged[1]);
    const value = match ? decryptWith(match.key, tagged[2]) : null;
    return value === null ? { state: 'unreadable' } : { state: 'ok', value };
  }
  if (sealed.startsWith('g1:')) {
    // Formato anterior, sin huella: se prueba con cada llave conocida.
    for (const item of keys) {
      const value = decryptWith(item.key, sealed.slice(3));
      if (value !== null) return { state: 'ok', value };
    }
  }
  return { state: 'unreadable' };
}

// Problemas de configuración que impiden operar con datos sensibles (solo nombres, nunca valores).
export function configProblems(): string[] {
  const problems: string[] = [];
  if (!parseKey(process.env.SOYTEL_DATA_KEY ?? '')) problems.push('data_key');
  if ((process.env.SOYTEL_PEPPER ?? '').length < 16) problems.push('pepper');
  return problems;
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
