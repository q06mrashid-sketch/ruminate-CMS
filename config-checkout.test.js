const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

async function loadDomWithConfig(config) {
  let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  html = html.replace(/<script[^>]*src="shim.js"[^>]*><\/script>/, '')
             .replace(/<script[^>]*src="[^"']*content.js[^>]*><\/script>/, '');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'http://localhost',
    beforeParse(window) {
      if (config !== undefined) {
        window.CONFIG = config;
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

test('checkout defaults to empty strings when CONFIG missing', async () => {
  const window = await loadDomWithConfig(undefined);
  assert.deepStrictEqual({ ...window.checkout }, { pos: '', portal: '', app: '' });
});

test('checkout reads urls from CONFIG when provided', async () => {
  const window = await loadDomWithConfig({ checkoutUrls: { pos: 'p', portal: 'o', app: 'a' } });
  assert.deepStrictEqual({ ...window.checkout }, { pos: 'p', portal: 'o', app: 'a' });
});
