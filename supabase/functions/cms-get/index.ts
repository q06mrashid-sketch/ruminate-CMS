import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleOptions, json } from '../_shared/cors.ts';

serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  const origin = req.headers.get('Origin') ?? undefined;

  try {
    if (req.method !== 'GET') {
      return json({ error: 'Method not allowed' }, { status: 405 }, origin);
    }

    const auth = req.headers.get('Authorization') ?? '';
    const apiKey = req.headers.get('apikey') ?? '';
    if (!auth.startsWith('Bearer ') || !apiKey) {
      return json({ error: 'Unauthorized' }, { status: 401 }, origin);
    }

    return json({ ok: true }, {}, origin);
  } catch (err) {
    console.error('cms-get error', err);
    return json({ error: String((err as any)?.message ?? err) }, { status: 500 }, origin);
  }
});
