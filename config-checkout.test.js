const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

async function loadDomWithConfig(config) {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
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
  return dom.window;
}

test('checkout defaults to empty strings when CONFIG missing', async () => {
  const window = await loadDomWithConfig(undefined);
  assert.deepStrictEqual({ ...window.checkout }, { pos: '', portal: '', app: '' });
});

test('checkout reads urls from CONFIG when provided', async () => {
  const window = await loadDomWithConfig({ checkoutUrls: { pos: 'p', portal: 'o', app: 'a' } });
  assert.deepStrictEqual({ ...window.checkout }, { pos: 'p', portal: 'o', app: 'a' });
});
