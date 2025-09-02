import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { preflight, json } from '../_shared/cors.ts';

serve(async (req) => {
  // 0) OPTIONS preflight (must be first)
  const pf = preflight(req);
  if (pf) return pf;

  try {
    if (req.method !== 'PUT') {
      return json({ error: 'Method not allowed' }, { status: 405 });
    }

    const url = new URL(req.url);
    const key = url.searchParams.get('key');
    if (!key) return json({ error: 'Missing key' }, { status: 400 });

    // Auth AFTER preflight
    const auth = req.headers.get('Authorization') ?? '';
    const apiKey = req.headers.get('apikey') ?? '';
    if (!auth.startsWith('Bearer ') || !apiKey) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      await req.json();
    } catch {
      return json({ error: 'invalid json' }, { status: 400 });
    }
    return json({ ok: true });
  } catch (e) {
    console.error('cms-put error', e);
    return json({ error: String((e as any)?.message ?? e) }, { status: 500 });
  }
});
