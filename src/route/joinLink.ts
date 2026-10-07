import { isRouteCode } from './protocol';

// Parámetros del enlace para unirse (?codigo=…&k=…). Vienen de fuera de la app: pueden faltar, llegar
// repetidos (entonces son una lista) o traer cualquier texto. Aquí se leen sin "arreglar" nada: un
// código que no es exactamente un código de ruta se informa como enlace inválido.

type Param = string | string[] | undefined | null;

export interface JoinLink {
  code: string | null;
  // Huella del stand que trae el QR (permite verificarlo sin esperar).
  fingerprint: string | null;
  // 'code': el código del enlace no es válido. 'key': la verificación del enlace está dañada.
  problem: 'code' | 'key' | null;
}

function single(value: Param): string | null {
  if (typeof value === 'string') return value;
  // Un parámetro repetido es ambiguo: no se elige uno al azar.
  if (Array.isArray(value) && value.length === 1 && typeof value[0] === 'string') return value[0];
  return null;
}

const FINGERPRINT = /^[0-9a-f]{12}$/;

export function parseJoinLink(codigo: Param, k: Param): JoinLink {
  if (codigo === undefined || codigo === null) return { code: null, fingerprint: null, problem: null };
  const code = single(codigo)?.trim().toUpperCase() ?? '';
  if (!isRouteCode(code)) return { code: null, fingerprint: null, problem: 'code' };
  if (k === undefined || k === null) return { code, fingerprint: null, problem: null };
  const key = single(k)?.trim().toLowerCase() ?? '';
  // Sin una huella íntegra se entra igual, pero como con el código escrito (verificación a la vista).
  return FINGERPRINT.test(key) ? { code, fingerprint: key, problem: null } : { code, fingerprint: null, problem: 'key' };
}

// Código de una ruta guardada en este dispositivo (pantalla del stand).
export function parseStandCode(codigo: Param): { code: string | null; invalid: boolean } {
  if (codigo === undefined || codigo === null) return { code: null, invalid: false };
  const code = single(codigo)?.trim().toUpperCase() ?? '';
  return isRouteCode(code) ? { code, invalid: false } : { code: null, invalid: true };
}
