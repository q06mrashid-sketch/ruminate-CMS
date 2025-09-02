// ruminate-CMS/cms-config.js
(() => {
  // Keep these fixed for GitHub Pages + your Supabase project
  const origin = 'https://q06mrashid-sketch.github.io';
  const functionsBase = 'https://eamewialuovzguldcdcf.functions.supabase.co';

  // Build URL helpers (pure, no "this")
  const endpoints = {
    getUrl:  (key) => `${functionsBase}/cms-get?key=${encodeURIComponent(key)}`,
    setUrl:  ()    => `${functionsBase}/cms-set`,
    delUrl:  (key) => `${functionsBase}/cms-del?key=${encodeURIComponent(key)}`,
    listUrl: (like = '%') => `${functionsBase}/cms-list?like=${encodeURIComponent(like)}`,
  };

  // Thin fetch helpers (do NOT try to set the Origin header; the browser does that)
  const getJSON = (url) => fetch(url, { method: 'GET' }).then(r => r.json());
  const postJSON = (url, body) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json());
  const deleteJSON = (url) => fetch(url, { method: 'DELETE' }).then(r => r.json());

  // Public API — NEVER use "this" here
  const api = {
    async get(key) {
      const j = await getJSON(endpoints.getUrl(key));
      return j?.value ?? null;
    },
    async set(key, value) {
      const j = await postJSON(endpoints.setUrl(), { key, value });
      return !!j?.ok;
    },
    async del(key) {
      const j = await deleteJSON(endpoints.delUrl(key));
      return !!j?.ok;
    },
    async list(like = '%') {
      const j = await getJSON(endpoints.listUrl(like));
      if (Array.isArray(j?.keys)) return j.keys; // our cms-list shape
      if (Array.isArray(j)) return j;            // tolerate array shape
      return [];
    },
  };

  // Expose a single config object that content.js expects
  window.CMS_CONFIG = {
    origin,
    functionsBase,
    checkoutUrls: {             // required by content.js
      live: 'https://example.com/checkout',
      test: 'https://example.com/checkout-test',
    },
    endpoints: {
      get: endpoints.getUrl,
      set: endpoints.setUrl,
      del: endpoints.delUrl,
      list: endpoints.listUrl,
    },
    api,
    disableFallback: true,      // make UI use the API, not seed data
  };
})();
