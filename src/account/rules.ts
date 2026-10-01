// Reglas de la cuenta compartidas por la app y la API (api/v1/*): sin dependencias de React Native
// ni alias de rutas, para que el servidor valide exactamente lo mismo que la app.

export const GRADES = [
  { id: '7b', label: '7° básico', young: true },
  { id: '8b', label: '8° básico', young: true },
  { id: '1m', label: 'I° medio', young: false },
  { id: '2m', label: 'II° medio', young: false },
  { id: '3m', label: 'III° medio', young: false },
  { id: '4m', label: 'IV° medio', young: false },
  { id: 'egresado', label: 'Egresado/a de media', young: false },
  { id: 'universidad', label: 'Universitario/a', young: false },
  { id: 'docente', label: 'Docente u orientador/a', young: false },
  { id: 'apoderado', label: 'Apoderado/a', young: false },
  { id: 'otro', label: 'Otro', young: false },
] as const;

export type GradeId = (typeof GRADES)[number]['id'];

export function isGrade(value: unknown): value is GradeId {
  return typeof value === 'string' && GRADES.some((grade) => grade.id === value);
}

export function gradeLabel(id: string | null | undefined): string | null {
  return GRADES.find((grade) => grade.id === id)?.label ?? null;
}

// Menores de 14 (7° y 8° básico): el contacto requiere autorización de su apoderado/a.
export function needsGuardianConsent(grade: string | null | undefined): boolean {
  return GRADES.some((item) => item.id === grade && item.young);
}

export const CONTACT_KINDS = ['email', 'phone', 'instagram'] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

export const contactLabels: Record<ContactKind, { label: string; placeholder: string }> = {
  email: { label: 'Correo', placeholder: 'nombre@correo.cl' },
  phone: { label: 'Celular', placeholder: '+56 9 1234 5678' },
  instagram: { label: 'Instagram', placeholder: '@usuario' },
};

export function isContactKind(value: unknown): value is ContactKind {
  return typeof value === 'string' && (CONTACT_KINDS as readonly string[]).includes(value);
}

// Normaliza el dato de contacto; devuelve null si no es válido.
export function normalizeContact(kind: ContactKind, raw: string): string | null {
  const value = raw.trim();
  if (!value || value.length > 120) return null;
  switch (kind) {
    case 'email': {
      const email = value.toLowerCase();
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
    }
    case 'phone': {
      // Celulares de Chile: 9 dígitos que parten en 9, con o sin +56.
      const digits = value.replace(/[^\d]/g, '');
      const local = digits.startsWith('56') && digits.length === 11 ? digits.slice(2) : digits;
      return /^9\d{8}$/.test(local) ? `+56${local}` : null;
    }
    case 'instagram': {
      const handle = value.replace(/^@+/, '').toLowerCase();
      return /^[a-z0-9._]{1,30}$/.test(handle) ? `@${handle}` : null;
    }
    default:
      return null;
  }
}

export const ALIAS_MIN = 2;
export const ALIAS_MAX = 20;
export const SCHOOL_MAX = 80;
export const AVATAR_COUNT = 20;

export function cleanAlias(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f<>{}[\]\\/|`"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, ALIAS_MAX)
    .trim();
}

export function cleanSchool(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f<>{}\\|`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SCHOOL_MAX)
    .trim();
}

// Palabras que no pueden ir en un alias visible en el ranking (insultos y contenido inapropiado).
const BLOCKED_WORDS = new Set([
  'ctm', 'csm', 'ql', 'qlo', 'qliao', 'culiao', 'culiado', 'culia', 'weon', 'wn', 'won', 'hueon', 'huevon', 'aweonao', 'ahueonao',
  'puta', 'puto', 'putita', 'putito', 'maricon', 'maraco', 'marica', 'fleto', 'zorra', 'perra', 'pico', 'pichula', 'raja',
  'chucha', 'mierda', 'verga', 'pene', 'vagina', 'sexo', 'sexy', 'porno', 'porn', 'xxx', 'nazi', 'hitler', 'violador', 'violar',
  'pendejo', 'cabron', 'tula', 'teta', 'tetas', 'poto', 'cuea', 'joder', 'idiota', 'imbecil', 'estupido',
  'retrasado', 'mongolico', 'mogolico', 'droga', 'marihuana', 'weona', 'aweonado', 'conchetumare',
]);

// Fragmentos largos y sin falsos positivos conocidos (p. ej. no se usa "puta", que aparece en "computador").
const BLOCKED_FRAGMENTS = [
  'conchetumare', 'conchesumare', 'conchatumadre', 'conchasumadre', 'culiao', 'aweona', 'hueon', 'huevon', 'maricon',
  'pichula', 'weon', 'hitler', 'porno', 'violador', 'qliao', 'mierda',
];

function normalizeForFilter(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's');
}

export function isBlockedText(text: string): boolean {
  const normalized = normalizeForFilter(text);
  const words = normalized.split(/[^a-zñ]+/).filter(Boolean);
  if (words.some((word) => BLOCKED_WORDS.has(word))) return true;
  const squashed = normalized.replace(/[^a-zñ]/g, '');
  return BLOCKED_FRAGMENTS.some((fragment) => squashed.includes(fragment));
}

// Motivo por el que un alias no sirve (null si está bien).
export function aliasProblem(raw: string): string | null {
  const alias = cleanAlias(raw);
  if (alias.length < ALIAS_MIN) return `Tu alias necesita al menos ${ALIAS_MIN} caracteres.`;
  if (!/[\p{L}\p{N}]/u.test(alias)) return 'Usa letras o números en tu alias.';
  if (isBlockedText(alias)) return 'Ese alias no está permitido. Elige otro.';
  return null;
}

export function schoolProblem(raw: string): string | null {
  const school = cleanSchool(raw);
  if (!school) return null;
  if (school.length < 3) return 'Escribe el nombre del colegio (o déjalo en blanco).';
  if (isBlockedText(school)) return 'Revisa el nombre del colegio.';
  return null;
}

// Códigos de recuperación: TEL-XXXX-XXXX-XXXX con un alfabeto sin caracteres confundibles.
export const RECOVERY_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function formatRecoveryCode(raw: string): string {
  const clean = raw
    .toUpperCase()
    .replace(/^TEL-?/, '')
    .replace(new RegExp(`[^${RECOVERY_ALPHABET}]`, 'g'), '')
    .slice(0, 12);
  const groups = clean.match(/.{1,4}/g) ?? [];
  return groups.length ? `TEL-${groups.join('-')}` : '';
}

export function isRecoveryCode(raw: string): boolean {
  return /^TEL-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/.test(formatRecoveryCode(raw));
}

// Límites para aceptar el XP que informa un dispositivo (el juego corre en el teléfono).
export const XP_SIGNUP_CAP = 6000;
export const XP_BURST_ALLOWANCE = 400;
export const XP_PER_SECOND = 3;

export function allowedXp(storedXp: number, secondsSinceLastSync: number): number {
  return storedXp + XP_BURST_ALLOWANCE + Math.max(0, secondsSinceLastSync) * XP_PER_SECOND;
}
