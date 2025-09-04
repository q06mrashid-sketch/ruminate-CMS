
window.CMS_CONFIG = (() => {
  const origin        = globalThis.location?.origin || '';
  const functionsBase = 'https://eamewialuovzguldcdcf.functions.supabase.co';

  // tiny HTTP helpers
  async function getJSON(url, opts={}) {
    const res = await fetch(url, { ...opts, headers: { ...(opts.headers||{}) } });
    if (!res.ok) throw new Error(`${opts.method||'GET'} ${url} → ${res.status}`);
    return res.json();
  }
  const http = {
    get:  (url)        => getJSON(url),
    post: (url, body)  => getJSON(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }),
    del:  (url)        => getJSON(url, { method:'DELETE' }),
  };

  // URL builders (internal)
  const endpoints = {
    listUrl: (like = '%') => `${functionsBase}/cms-list?like=${encodeURIComponent(like)}`,
    getUrl:  (key)        => `${functionsBase}/cms-get?key=${encodeURIComponent(key)}`,
    setUrl:  ()           => `${functionsBase}/cms-set`,
    delUrl:  (key)        => `${functionsBase}/cms-del?key=${encodeURIComponent(key)}`,
  };

  // REAL API calls (this is what content.js expects)
  const api = {
    async list(like = '%') {
      const j = await http.get(endpoints.listUrl(like));
      return Array.isArray(j?.keys) ? j.keys : [];
    },
    async get(key) {
      const j = await http.get(endpoints.getUrl(key));
      return j?.value ?? null;
    },
    async set(key, value) {
      const j = await http.post(endpoints.setUrl(), { key, value });
      return !!j?.ok;
    },
    async del(key) {
      const j = await http.del(endpoints.delUrl(key));
      return !!j?.ok;
    },
  };

  // stub so content.js doesn’t blow up
  const checkoutUrls = { live: '#', test: '#' };

  return {
    origin,
    functionsBase,
    checkoutUrls,
    endpoints,
    api,
    disableFallback: true,
  };
})();
