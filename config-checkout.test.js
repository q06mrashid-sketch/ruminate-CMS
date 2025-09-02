const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

async function loadDomWithConfig(config) {
  let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  html = html.replace(/<script[^>]*src="shim.js"[^>]*><\/script>/, '')
             .replace(/<script[^>]*src="\.\/cms-config.js"[^>]*><\/script>/, '')
             .replace(/<script>\s*window\.CMS_CONFIG[\s\S]*?<\/script>\n?/, '')
             .replace(/<script[^>]*src="[^"']*content.js[^>]*><\/script>/, '');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'http://localhost',
    beforeParse(window) {
      if (config !== undefined) {
        window.CMS_CONFIG = config;
      }
    },
  });
  await new Promise(resolve => {
    if (dom.window.document.readyState === 'complete') resolve();
    else dom.window.document.addEventListener('DOMContentLoaded', resolve);
  });
  const { window } = dom;
  window.eval(fs.readFileSync(path.join(__dirname, 'shim.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8'));
  return window;
}

test('checkout defaults to web /checkout when config missing', async () => {
  const window = await loadDomWithConfig(undefined);
  assert.strictEqual(window.checkoutUrls.web, '/checkout');
  assert.strictEqual(window.checkoutUrls.app, undefined);
});

test('checkout reads urls from global config when provided', async () => {
  const window = await loadDomWithConfig({ checkoutUrls: { web: 'w', app: 'a' } });
  assert.deepStrictEqual(window.checkoutUrls, { web: 'w', app: 'a' });
});
