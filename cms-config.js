window.CMS_CONFIG = (() => {
  // allow runtime overrides from localStorage
  const LS = {
    fns: () => localStorage.getItem('cmsFunctionsUrl'),
    anon: () => localStorage.getItem('cmsAnon'),
    secret: () => localStorage.getItem('cmsWriteSecret'), // optional
  };

  const origin = globalThis.location?.origin || '';
  const functionsBase = LS.fns() || 'https://eamewialuovzguldcdcf.functions.supabase.co';

  // ---- default headers (Authorization + apikey, optional secret) ----
  function defaultHeaders(extra = {}) {
    const anon = LS.anon() || '';
    const base = {
      ...(anon ? { Authorization: `Bearer ${anon}`, apikey: anon } : {}),
      ...extra,
    };
    return base;
  }

  // tiny HTTP helpers (always merge default headers)
  async function getJSON(url, opts = {}) {
    const headers = { ...(opts.headers || {}), ...defaultHeaders() };
    const res = await fetch(url, { ...opts, headers });
    if (!res.ok) throw new Error(`${opts.method || 'GET'} ${url} → ${res.status}`);
    return res.json();
  }
  const http = {
    get:  (url, headers)              => getJSON(url, { headers }),
    post: (url, body, headers)        => getJSON(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(headers||{}) }, body: JSON.stringify(body) }),
    del:  (url, headers)              => getJSON(url, { method: 'DELETE', headers }),
  };

  // URL builders
  const endpoints = {
    listUrl: (like = '%') => `${functionsBase}/cms-list?like=${encodeURIComponent(like)}`,
    getUrl:  (key)        => `${functionsBase}/cms-get?key=${encodeURIComponent(key)}`,
    setUrl:  ()           => `${functionsBase}/cms-set`,
    delUrl:  (key)        => `${functionsBase}/cms-del?key=${encodeURIComponent(key)}`,
  };

  // Real API calls
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
      const secret = LS.secret() || (window.CONFIG && window.CONFIG.writeSecret) || undefined;
      const j = await http.post(
        endpoints.setUrl(),
        { key, value },
        secret ? { 'x-cms-secret': secret } : undefined
      );
      return !!j?.ok;
    },
    async del(key) {
      const j = await http.del(endpoints.delUrl(key));
      return !!j?.ok;
    },
  };

  // stub so content.js won’t crash on checkoutUrls
  const checkoutUrls = { live: '#', test: '#' };

  return {
    origin,
    functionsBase,
    checkoutUrls,
    endpoints,
    api,
    // let the app fall back if functions are down
    disableFallback: false,
  };
})();
