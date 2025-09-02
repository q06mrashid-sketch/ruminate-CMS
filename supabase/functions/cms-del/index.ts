import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { preflight, corsHeaders, json } from '../_shared/cors.ts';

serve(async (req) => {
  // 0) OPTIONS preflight (must be first)
  const pf = preflight(req);
  if (pf) return pf;

  const origin = req.headers.get('Origin') ?? undefined;

  try {
    if (req.method !== 'DELETE') {
      return json({ error: 'Method not allowed' }, { status: 405 }, origin);
    }

    // Auth AFTER preflight
    const auth = req.headers.get('Authorization') ?? '';
    const apiKey = req.headers.get('apikey') ?? '';
    if (!auth.startsWith('Bearer ') || !apiKey) {
      return json({ error: 'Unauthorized' }, { status: 401 }, origin);
    }

    const url = new URL(req.url);
    const key = url.searchParams.get('key');
    if (!key) return json({ error: 'Missing key' }, { status: 400 }, origin);

    // TODO: perform the delete in your storage/db here

    // 204 with CORS
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  } catch (e) {
    console.error('cms-del error', e);
    return json({ error: String((e as any)?.message ?? e) }, { status: 500 }, origin);
  }
});
