// Utilidades HTTP de la API de SoyTEL (funciones de Vercel con la firma Web Request/Response).
import { sqlState } from './db';

const ALLOWED_ORIGINS = new Set([
  'https://soytel.vercel.app',
  'http://localhost:8081',
  'http://localhost:8099',
  'http://localhost:8321',
]);

function extraOrigins(): string[] {
  return (process.env.SOYTEL_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

// La app nativa no envía Origin; la web en producción es del mismo origen. CORS solo para desarrollo.
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  if (!origin || !(ALLOWED_ORIGINS.has(origin) || extraOrigins().includes(origin))) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

export function json(request: Request, data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...BASE_HEADERS, ...corsHeaders(request), ...headers } });
}

export function fail(request: Request, status: number, code: string, message: string): Response {
  return json(request, { error: { code, message } }, status);
}

export function preflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

// Error con respuesta definida: el manejador lo convierte en ese estado y código.
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const BODY_LIMIT_BYTES = 4096;

// Lee un cuerpo JSON pequeño contando bytes mientras llega: al pasar el límite deja de leer.
// Solo acepta un objeto (no listas ni valores sueltos). Los errores salen como HttpError:
// 413 demasiado grande, 415 no es JSON, 400 JSON inválido.
export async function readJson<T>(request: Request, limitBytes = BODY_LIMIT_BYTES): Promise<T> {
  const type = (request.headers.get('content-type') ?? '').toLowerCase();
  if (!type.startsWith('application/json')) throw new HttpError(415, 'unsupported_media_type', 'La solicitud debe enviarse como JSON.');
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > limitBytes) throw new HttpError(413, 'payload_too_large', 'La solicitud es demasiado grande.');

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = request.body?.getReader();
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limitBytes) {
        await reader.cancel().catch(() => undefined);
        throw new HttpError(413, 'payload_too_large', 'La solicitud es demasiado grande.');
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new HttpError(400, 'bad_request', 'Solicitud no válida.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'bad_request', 'Solicitud no válida.');
  return value as T;
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+([A-Za-z0-9_-]{20,128})$/.exec(header.trim());
  return match ? match[1] : null;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  return forwarded.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

// Tope de lecturas por instancia (en memoria, sin tocar la base): frena ráfagas de consultas baratas
// de un mismo origen. No reemplaza la protección de borde; evita que cada lectura abusiva llegue a Postgres.
const readWindows = new Map<string, { startedAt: number; hits: number }>();

export function allowRead(scope: string, key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const id = `${scope}:${key}`;
  const current = readWindows.get(id);
  if (!current || now - current.startedAt >= windowMs) {
    if (readWindows.size > 5000) readWindows.clear();
    readWindows.set(id, { startedAt: now, hits: 1 });
    return true;
  }
  current.hits += 1;
  return current.hits <= limit;
}

export function resetReadLimits(): void {
  readWindows.clear();
}

// Envuelve un manejador: los errores con respuesta definida salen como tales; una regla de la base
// incumplida o un valor repetido salen como conflicto; lo inesperado, como 500 sin filtrar detalles.
export function handler(run: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try {
      return await run(request);
    } catch (error) {
      if (error instanceof HttpError) return fail(request, error.status, error.code, error.message);
      const state = sqlState(error);
      if (state === '23514') return fail(request, 422, 'contact_policy', 'Ese dato de contacto no se puede guardar con el curso indicado. Revisa el curso y la autorización.');
      if (state === '23505') return fail(request, 409, 'conflict', 'Esos datos ya están en uso. Intenta de nuevo.');
      console.error('[api]', request.method, new URL(request.url).pathname, error instanceof Error ? error.message : error);
      return fail(request, 500, 'internal', 'Ocurrió un error en el servidor. Intenta de nuevo.');
    }
  };
}
