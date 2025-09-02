// ruminate-CMS/cms-config.js
(() => {
  const origin = 'https://q06mrashid-sketch.github.io';
  const functionsBase = 'https://eamewialuovzguldcdcf.functions.supabase.co';

  // content.js expects STRINGS here, not functions
  const endpoints = {
    get:  `${functionsBase}/cms-get`,
    set:  `${functionsBase}/cms-set`,
    del:  `${functionsBase}/cms-del`,
    list: `${functionsBase}/cms-list`,
  };

  const getJSON = (url) => fetch(url, { method: 'GET' }).then(r => r.json());
  const postJSON = (url, body) =>
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(r => r.json());
  const deleteJSON = (url) =>
    fetch(url, { method: 'DELETE' }).then(r => r.json());

  const api = {
    async get(key)        { const j = await getJSON(`${endpoints.get}?key=${encodeURIComponent(key)}`);   return j?.value ?? null; },
    async set(key, value) { const j = await postJSON(endpoints.set, { key, value });                      return !!j?.ok; },
    async del(key)        { const j = await deleteJSON(`${endpoints.del}?key=${encodeURIComponent(key)}`);return !!j?.ok; },
    async list(like='%')  { const j = await getJSON(`${endpoints.list}?like=${encodeURIComponent(like)}`);return Array.isArray(j?.keys) ? j.keys : []; },
  };

  window.CMS_CONFIG = {
    origin,
    functionsBase,
    checkoutUrls: {
      live: 'https://example.com/checkout',
      test: 'https://example.com/checkout-test',
    },
    endpoints,
    api,
    disableFallback: true,
  };

  // Safety alias if older code reads `window.CONFIG` instead of `CMS_CONFIG`
  window.CONFIG = window.CMS_CONFIG;
})();
