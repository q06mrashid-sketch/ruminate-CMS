import { ALLOWED_ORIGINS, corsHeaders, handleOptions, json } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  const origin = req.headers.get('origin') || '';
  if (ALLOWED_ORIGINS.length && !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: 'origin not allowed' }, { status: 403 });
  }

  if (req.method !== 'PUT') {
    return json({ error: 'Not found' }, { status: 404 });
  }

  const auth = req.headers.get('authorization');
  if (!auth || !auth.toLowerCase().startsWith('bearer')) {
    return json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const keyParam = url.searchParams.get('key');
  if (!keyParam) {
    return json({ error: 'key required' }, { status: 400 });
  }
  const key = decodeURIComponent(keyParam);

  let value: unknown;
  try {
    const body = await req.json();
    value = body?.value;
  } catch {
    return json({ error: 'invalid json' }, { status: 400 });
  }

  // In a real implementation you would store the key/value pair here.
  return json({ ok: true });
});
