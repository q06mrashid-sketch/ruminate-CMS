// ruminate-CMS/cms-config.js
(() => {
  const origin = 'https://q06mrashid-sketch.github.io';
  const functionsBase = 'https://eamewialuovzguldcdcf.functions.supabase.co';

  const checkoutUrls = {
    live: 'https://example.com/checkout',
    test: 'https://example.com/checkout-test',
  };

  // handy builders (optional; some tooling might use these)
  const endpoints = {
    getUrl:  (key)        => `${functionsBase}/cms-get?key=${encodeURIComponent(key)}`,
    setUrl:  ()           => `${functionsBase}/cms-set`,
    delUrl:  (key)        => `${functionsBase}/cms-del?key=${encodeURIComponent(key)}`,
    listUrl: (like = '%') => `${functionsBase}/cms-list?like=${encodeURIComponent(like)}`,
  };

  // IMPORTANT: content.js expects STRING endpoints (caller appends ?key= / ?like=)
  const api = {
    get:  `${functionsBase}/cms-get`,
    set:  `${functionsBase}/cms-set`,
    del:  `${functionsBase}/cms-del`,
    list: `${functionsBase}/cms-list`,
  };

  const cfg = {
    origin,
    functionsBase,
    checkoutUrls,
    endpoints,
    api,
    disableFallback: true,
  };

  // expose under both names
  window.CMS_CONFIG = cfg;
  window.CONFIG = cfg;
})();
