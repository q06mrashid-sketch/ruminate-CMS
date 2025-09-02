// ruminate-CMS/cms-config.js
window.CMS_CONFIG = (() => {
  const ORIGIN = 'https://q06mrashid-sketch.github.io';
  const FUNCS  = 'https://eamewialuovzguldcdcf.functions.supabase.co';

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

    // stub these so content.js stops crashing
    checkoutUrls: {
      live: 'https://example.com/checkout',
      test: 'https://example.com/checkout-test',
    },

    endpoints: {
      get:  (key) => `${FUNCS}/cms-get?key=${encodeURIComponent(key)}`,
      set:  ()    => `${FUNCS}/cms-set`,
      del:  (key) => `${FUNCS}/cms-del?key=${encodeURIComponent(key)}`,
      list: (like = '%') => `${FUNCS}/cms-list?like=${encodeURIComponent(like)}`,
    },

    api: {
      async get(key) {
        const j = await httpGet(this.endpoints.get(key));
        return j?.value ?? null;
      },
      async set(key, value) {
        const j = await httpPost(this.endpoints.set(), { key, value });
        return !!j?.ok;
      },
      async del(key) {
        const j = await httpDelete(this.endpoints.del(key));
        return !!j?.ok;
      },
      async list(like = '%') {
        const j = await httpGet(this.endpoints.list(like));
        return Array.isArray(j?.keys) ? j.keys : [];
      },
    },

    // lets your UI skip any fallback seeding code
    disableFallback: true,
  };
})();
