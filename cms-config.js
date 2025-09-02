// ruminate-CMS/cms-config.js
(() => {
  const origin = 'https://q06mrashid-sketch.github.io';
  const functionsBase = 'https://eamewialuovzguldcdcf.functions.supabase.co';

  // what content.js reads for checkout deep-links; fill in later if you have real ones
  const checkoutUrls = {
    live: 'https://example.com/checkout',
    test: 'https://example.com/checkout-test',
  };

  // URL BUILDERS (not network calls)
  const endpoints = {
    getUrl:  (key)       => `${functionsBase}/cms-get?key=${encodeURIComponent(key)}`,
    setUrl:  ()          => `${functionsBase}/cms-set`,
    delUrl:  (key)       => `${functionsBase}/cms-del?key=${encodeURIComponent(key)}`,
    listUrl: (like = '%')=> `${functionsBase}/cms-list?like=${encodeURIComponent(like)}`,
  };

  // Back-compat: content.js calls api.* expecting string URLs
  const api = {
    get:  endpoints.getUrl,
    set:  endpoints.setUrl,
    del:  endpoints.delUrl,
    list: endpoints.listUrl,
  };

  window.CMS_CONFIG = {
    origin,
    functionsBase,
    checkoutUrls,
    endpoints,
    api,
    disableFallback: true, // stop using any baked-in seed/fallback
  };

  // safety alias in case older code reads window.CONFIG
  window.CONFIG = window.CMS_CONFIG;
})();
