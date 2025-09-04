const defaultOrigin = "https://q06mrashid-sketch.github.io";
export const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? defaultOrigin;

// supabase/functions/_shared/cors.ts
// simple CORS helpers that default to the ALLOWED_ORIGIN env var or the
// hard-coded fallback above.  We intentionally avoid trying to restrict
// origins more tightly here so that both the CMS editor and the mobile app
// can call the edge functions without errors.

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-requested-with",
    "Access-Control-Max-Age": "86400",
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
