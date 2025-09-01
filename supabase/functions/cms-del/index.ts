const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-cms-secret, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'DELETE') {
    return new Response('Not found', { status: 404, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  if (!key) {
    return new Response(JSON.stringify({ error: 'key required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  // In a real implementation you would remove the key from your store here.
  // This demo simply acknowledges the request.
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
