export const ALLOW = new Set([
  'https://q06mrashid-sketch.github.io',
  'http://localhost:5173',
  'http://localhost:3000',
]);

export function corsHeaders(origin?: string) {
  const allow = origin && ALLOW.has(origin) ? origin : 'https://q06mrashid-sketch.github.io';
  return {
    'Access-Control-Allow-Origin': allow,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
  } as const;
}

export function preflight(req: Request) {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('Origin') ?? undefined;
    return new Response('ok', { status: 200, headers: corsHeaders(origin) });
  }
  return null;
}

export function json(body: unknown, init: ResponseInit = {}, origin?: string) {
  const headers = { 'Content-Type': 'application/json', ...corsHeaders(origin), ...(init.headers ?? {}) };
  return new Response(JSON.stringify(body), { ...init, headers });
}
