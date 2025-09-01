export const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(o => o.trim()).filter(Boolean);

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-cms-secret, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS'
};

export function handleOptions(req: Request): Response | void {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
}

export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = { ...corsHeaders, 'Content-Type': 'application/json', ...(init.headers || {}) };
  return new Response(JSON.stringify(body), { ...init, headers });
}
