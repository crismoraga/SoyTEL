// Utilidades HTTP de la API de SoyTEL (funciones de Vercel con la firma Web Request/Response).

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

// Lee un cuerpo JSON pequeño; null si no es JSON válido o supera el límite.
export async function readJson<T>(request: Request, limitBytes = 4096): Promise<T | null> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > limitBytes) return null;
  let text: string;
  try {
    text = await request.text();
  } catch {
    return null;
  }
  if (text.length > limitBytes) return null;
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === 'object' ? (value as T) : null;
  } catch {
    return null;
  }
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

// Envuelve un manejador para que cualquier error inesperado responda 500 sin filtrar detalles.
export function handler(run: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try {
      return await run(request);
    } catch (error) {
      console.error('[api]', request.method, new URL(request.url).pathname, error instanceof Error ? error.message : error);
      return fail(request, 500, 'internal', 'Ocurrió un error en el servidor. Intenta de nuevo.');
    }
  };
}
