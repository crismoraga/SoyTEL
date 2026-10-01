import {
  aliasProblem,
  AVATAR_COUNT,
  cleanAlias,
  cleanSchool,
  isContactKind,
  isGrade,
  needsGuardianConsent,
  normalizeContact,
  schoolProblem,
  type ContactKind,
  type GradeId,
} from '../../src/account/rules';
import { query } from './db';
import { decryptField, encryptField, hashSecret } from './security';

export interface PlayerRow {
  [key: string]: unknown;
  id: string;
  alias: string;
  avatar: number;
  grade: string | null;
  school: string | null;
  contact_kind: string | null;
  contact_value: string | null;
  contact_consent: boolean;
  guardian_consent: boolean;
  consent_at: string | null;
  xp: number;
  level: number;
  games: number;
  streak: number;
  best_route: number;
  routes: number;
  achievements: string[];
  flags: number;
  hidden: boolean;
  last_sync_at: string | null;
  created_at: string;
}

export interface ProfileInput {
  alias?: unknown;
  avatar?: unknown;
  grade?: unknown;
  school?: unknown;
  contact?: unknown;
  contactConsent?: unknown;
  guardianConsent?: unknown;
}

export interface ProfileValues {
  alias?: string;
  avatar?: number;
  grade?: GradeId | null;
  school?: string | null;
  contactKind?: ContactKind | null;
  contactValue?: string | null;
  contactConsent?: boolean;
  guardianConsent?: boolean;
}

export type Validation<T> = { ok: true; value: T } | { ok: false; message: string };

// Valida el perfil enviado por la app. En registro el alias es obligatorio; en edición todo es opcional.
// `current` se usa al editar para revisar el consentimiento con el curso ya guardado.
export function validateProfile(input: ProfileInput, mode: 'create' | 'update', current?: PlayerRow): Validation<ProfileValues> {
  const value: ProfileValues = {};

  if (input.alias !== undefined || mode === 'create') {
    if (typeof input.alias !== 'string') return { ok: false, message: 'Falta tu alias.' };
    const problem = aliasProblem(input.alias);
    if (problem) return { ok: false, message: problem };
    value.alias = cleanAlias(input.alias);
  }

  if (input.avatar !== undefined || mode === 'create') {
    const avatar = Number(input.avatar ?? 0);
    if (!Number.isInteger(avatar) || avatar < 0 || avatar >= AVATAR_COUNT) return { ok: false, message: 'Avatar no válido.' };
    value.avatar = avatar;
  }

  if (input.grade !== undefined) {
    if (input.grade !== null && !isGrade(input.grade)) return { ok: false, message: 'Curso no válido.' };
    value.grade = (input.grade as GradeId | null) ?? null;
  }

  if (input.school !== undefined) {
    if (input.school !== null && typeof input.school !== 'string') return { ok: false, message: 'Colegio no válido.' };
    const school = input.school ? cleanSchool(input.school) : '';
    const problem = school ? schoolProblem(school) : null;
    if (problem) return { ok: false, message: problem };
    value.school = school || null;
  }

  const touchesContact = input.contact !== undefined || input.contactConsent !== undefined || input.guardianConsent !== undefined;
  if (touchesContact) {
    const consent = input.contactConsent === true;
    const guardian = input.guardianConsent === true;
    const grade = value.grade !== undefined ? value.grade : (current?.grade ?? null);
    if (!consent || input.contact === null || input.contact === undefined) {
      // Sin consentimiento no se guarda ningún dato de contacto.
      value.contactConsent = false;
      value.guardianConsent = false;
      value.contactKind = null;
      value.contactValue = null;
    } else {
      const contact = input.contact as { kind?: unknown; value?: unknown };
      if (!isContactKind(contact.kind) || typeof contact.value !== 'string') return { ok: false, message: 'Dato de contacto no válido.' };
      const normalized = normalizeContact(contact.kind, contact.value);
      if (!normalized) return { ok: false, message: 'Revisa tu dato de contacto.' };
      if (needsGuardianConsent(grade) && !guardian) return { ok: false, message: 'Para 7° y 8° básico se necesita la autorización de tu apoderado/a.' };
      value.contactConsent = true;
      value.guardianConsent = guardian;
      value.contactKind = contact.kind;
      value.contactValue = normalized;
    }
  }

  return { ok: true, value };
}

export interface ProgressValues {
  xp: number;
  games: number;
  streak: number;
  bestRoute: number;
  routes: number;
  achievements: string[];
}

function count(value: unknown, max: number): number {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.min(max, Math.max(0, number)) : 0;
}

export function sanitizeProgress(input: unknown): ProgressValues {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const achievements = Array.isArray(raw.achievements)
    ? [...new Set(raw.achievements.filter((id): id is string => typeof id === 'string' && /^[a-z0-9-]{3,40}$/.test(id)))].slice(0, 64)
    : [];
  return {
    xp: count(raw.xp, 10_000_000),
    games: count(raw.games, 100_000),
    streak: count(raw.streak, 3650),
    bestRoute: count(raw.bestRoute, 30_000),
    routes: count(raw.routes, 10_000),
    achievements,
  };
}

export async function findPlayerByToken(token: string): Promise<PlayerRow | null> {
  const rows = await query<PlayerRow>('select * from players where token_hash = $1', [hashSecret(token)]);
  return rows[0] ?? null;
}

export async function rankOf(row: PlayerRow): Promise<{ rank: number; total: number }> {
  const rows = await query<{ ahead: string; total: string }>(
    `select
       (select count(*) from players where not hidden and (xp > $1 or (xp = $1 and created_at < $2))) as ahead,
       (select count(*) from players where not hidden) as total`,
    [row.xp, row.created_at],
  );
  const ahead = Number(rows[0]?.ahead ?? 0);
  const total = Number(rows[0]?.total ?? 0);
  return { rank: row.hidden ? 0 : ahead + 1, total };
}

// Perfil completo para su dueño (incluye su dato de contacto descifrado).
export function ownerView(row: PlayerRow) {
  const contactValue = row.contact_consent ? decryptField(row.contact_value) : null;
  return {
    id: row.id,
    alias: row.alias,
    avatar: row.avatar,
    grade: row.grade,
    school: row.school,
    contact: row.contact_kind && contactValue ? { kind: row.contact_kind, value: contactValue } : null,
    contactConsent: row.contact_consent,
    guardianConsent: row.guardian_consent,
    xp: row.xp,
    level: row.level,
    games: row.games,
    streak: row.streak,
    bestRoute: row.best_route,
    routes: row.routes,
    achievements: row.achievements ?? [],
    hidden: row.hidden,
    createdAt: row.created_at,
  };
}

// Columnas y valores SQL para guardar los campos de perfil validados.
export function profileColumns(values: ProfileValues): { columns: string[]; params: unknown[] } {
  const columns: string[] = [];
  const params: unknown[] = [];
  const add = (column: string, value: unknown) => {
    columns.push(column);
    params.push(value);
  };
  if (values.alias !== undefined) add('alias', values.alias);
  if (values.avatar !== undefined) add('avatar', values.avatar);
  if (values.grade !== undefined) add('grade', values.grade);
  if (values.school !== undefined) add('school', values.school);
  if (values.contactConsent !== undefined) {
    add('contact_consent', values.contactConsent);
    add('guardian_consent', Boolean(values.guardianConsent));
    add('contact_kind', values.contactKind ?? null);
    add('contact_value', values.contactValue ? encryptField(values.contactValue) : null);
    add('consent_at', values.contactConsent ? new Date().toISOString() : null);
  }
  return { columns, params };
}
