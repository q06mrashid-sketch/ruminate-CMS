const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*';

// supabase/functions/_shared/cors.ts
export function corsFor(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map(s=>s.trim()).filter(Boolean);
  const allow = allowed.length === 0 || allowed.includes(origin) ? origin : allowed[0] || "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-requested-with, x-cms-secret",
    "Access-Control-Max-Age": "86400",
  };
}

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  } as const;
}

export function preflight(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders() });
  }
  return null;
}

export function json(body: unknown, init: ResponseInit = {}) {
  const headers = { 'Content-Type': 'application/json', ...corsHeaders(), ...(init.headers ?? {}) };
  return new Response(JSON.stringify(body), { ...init, headers });
}
