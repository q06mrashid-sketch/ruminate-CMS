function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin ?? '',
    'Access-Control-Allow-Headers':
      'authorization, apikey, x-cms-secret, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) });
  }

  if (req.method !== 'DELETE') {
    return new Response('Not found', { status: 404, headers: corsHeaders(origin) });
  }

  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  if (!key) {
    return new Response(JSON.stringify({ error: 'key required' }), {
      status: 400,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }
  // In a real implementation you would remove the key from your store here.
  // This demo simply acknowledges the request.
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
});
