<!-- ruminate-CMS/cms-config.js -->
<script>
window.CMS_CONFIG = (() => {
  const ORIGIN = 'https://q06mrashid-sketch.github.io';                 // your site origin
  const FUNCS = 'https://eamewialuovzguldcdcf.functions.supabase.co';   // your Supabase Functions base

  async function httpGet(url) {
    const res = await fetch(url, { method: 'GET', credentials: 'omit' });
    if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
    return res.json();
  }
  async function httpPost(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${url} → ${res.status}`);
    return res.json();
  }
  async function httpDelete(url) {
    const res = await fetch(url, { method: 'DELETE', credentials: 'omit' });
    if (!res.ok) throw new Error(`DELETE ${url} → ${res.status}`);
    return res.json();
  }

  return {
    origin: ORIGIN,
    functionsBase: FUNCS,
    // required by your app, avoids "Cannot read properties of undefined (reading 'checkoutUrls')"
    checkoutUrls: {
      live: 'https://example.com/checkout',      // replace with your real live checkout
      test: 'https://example.com/checkout-test', // replace with your test checkout
    },
    endpoints: {
      get:   (key) => `${FUNCS}/cms-get?key=${encodeURIComponent(key)}`,
      set:   () =>   `${FUNCS}/cms-set`,
      del:   (key) => `${FUNCS}/cms-del?key=${encodeURIComponent(key)}`,
      list:  (like) => `${FUNCS}/cms-list?like=${encodeURIComponent(like ?? '%')}`,
    },
    api: {
      async get(key) {
        const j = await httpGet(CMS_CONFIG.endpoints.get(key));
        // Expect shape: { key, value } or { value: ... } from your function
        return j?.value ?? null;
      },
      async set(key, value) {
        const j = await httpPost(CMS_CONFIG.endpoints.set(), { key, value });
        return !!j?.ok;
      },
      async del(key) {
        const j = await httpDelete(CMS_CONFIG.endpoints.del(key));
        return !!j?.ok;
      },
      async list(like = '%') {
        const j = await httpGet(CMS_CONFIG.endpoints.list(like));
        return Array.isArray(j?.keys) ? j.keys : [];
      },
    },
    // kill any client-side fallback/seed logic if your app checks this
    disableFallback: true,
  };
})();
</script>
