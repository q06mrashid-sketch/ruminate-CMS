import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { preflight, json } from '../_shared/cors.ts';

serve(async (req) => {
  // 0) OPTIONS preflight (must be first)
  const pf = preflight(req);
  if (pf) return pf;

  try {
    if (req.method !== 'GET') {
      return json({ error: 'Method not allowed' }, { status: 405 });
    }

    // Auth AFTER preflight
    const auth = req.headers.get('Authorization') ?? '';
    const apiKey = req.headers.get('apikey') ?? '';
    if (!auth.startsWith('Bearer ') || !apiKey) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
    return json({ ok: true });
  } catch (e) {
    console.error('cms-get error', e);
    return json({ error: String((e as any)?.message ?? e) }, { status: 500 });
  }
});
