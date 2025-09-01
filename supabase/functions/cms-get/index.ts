import { ALLOWED_ORIGINS, corsHeaders, handleOptions, json } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  const origin = req.headers.get('origin') || '';
  if (ALLOWED_ORIGINS.length && !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: 'origin not allowed' }, { status: 403 });
  }

  if (req.method !== 'GET') {
    return json({ error: 'Not found' }, { status: 404 });
  }

  const auth = req.headers.get('authorization');
  if (!auth || !auth.toLowerCase().startsWith('bearer')) {
    return json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const keyParam = url.searchParams.get('key');
  if (keyParam) decodeURIComponent(keyParam);

  // In a real implementation you would retrieve data here.
  return json({ ok: true });
});
