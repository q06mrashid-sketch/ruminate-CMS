
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleOptions, json, corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  const origin = req.headers.get('Origin') ?? undefined;

  try {
    if (req.method !== 'DELETE') {
      return json({ error: 'Method not allowed' }, { status: 405 }, origin);
    }

    const url = new URL(req.url);
    const key = url.searchParams.get('key');
    if (!key) return json({ error: 'Missing key' }, { status: 400 }, origin);

    const auth = req.headers.get('Authorization') ?? '';
    const apiKey = req.headers.get('apikey') ?? '';
    if (!auth.startsWith('Bearer ') || !apiKey) {
      return json({ error: 'Unauthorized' }, { status: 401 }, origin);
    }

    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  } catch (err) {
    console.error('cms-del error', err);
    return json({ error: String((err as any)?.message ?? err) }, { status: 500 }, origin);
  }
});
