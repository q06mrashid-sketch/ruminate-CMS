// supabase/functions/_shared/cors.ts

const defaultOrigin = "https://q06mrashid-sketch.github.io";

// Support both env names, comma-separated list. Examples:
// ALLOWED_ORIGINS="https://q06mrashid-sketch.github.io,http://localhost:5173,exp://"
const ORIGINS_ENV =
  Deno.env.get("ALLOWED_ORIGINS") ??
  Deno.env.get("ALLOWED_ORIGIN") ??
  defaultOrigin;

const ALLOWED_LIST = ORIGINS_ENV.split(",").map(s => s.trim()).filter(Boolean);

function pickAllowOrigin(req: Request): string {
  const origin = req.headers.get("Origin") ?? "";
  if (!origin) return "*";                 // non-browser clients (curl, RN fetch)
  if (ALLOWED_LIST.includes("*")) return origin;
  if (ALLOWED_LIST.includes(origin)) return origin;
  // Be permissive by default (don’t hard-fail); fall back to first configured origin
  return ALLOWED_LIST[0] || defaultOrigin;
}

export function corsHeaders(req?: Request) {
  const allowOrigin = req ? pickAllowOrigin(req) : (ALLOWED_LIST[0] || defaultOrigin);
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      // IMPORTANT: include x-cms-secret + headers you already use
      "authorization, apikey, content-type, x-requested-with, x-client-info, x-cms-secret",
    "Access-Control-Max-Age": "86400",
  } as const;
}

export function preflight(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  return null;
}

export function json(body: unknown, init: ResponseInit = {}) {
  const headers = { "Content-Type": "application/json", ...corsHeaders(), ...(init.headers ?? {}) };
  return new Response(JSON.stringify(body), { ...init, headers });
}
