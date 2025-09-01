const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

test('remove handler deletes keys and clears row with missing data', async () => {
  let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  html = html.replace('<script src="content.js" defer></script>', '');
  const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost' });
  const { window } = dom;
  await new Promise((resolve) => {
    if (window.document.readyState === 'complete') resolve();
    else window.document.addEventListener('DOMContentLoaded', resolve);
  });
  window.eval(fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8'))

  const existingKeys = new Set(['menu.coffee.latte', 'price.coffee.latte']);
  const calls = [];
  window.fetch = async (url) => {
    const key = new URL(url).searchParams.get('key');
    calls.push(key);
    if (existingKeys.has(key)) {
      return { ok: true, json: async () => ({ ok: true }) };
    }
    // Simulate backend returning 404 for unknown keys
    return { ok: false, status: 404, json: async () => ({ error: 'not found' }) };
  };

  let loadAllCalled = false;
  window.loadAll = async () => { loadAllCalled = true; };
  let errorMsg;
  window.showError = (msg) => { if (msg) errorMsg = msg; };
  window.alert = () => {};
  window.localStorage.setItem('cmsAnon', 'test');

  window.addMenuRow({ suffix: 'latte', name: 'Latte', category: 'coffee' });
  const tbody = window.document.getElementById('menuRows');
  const row = tbody.querySelector('tr');
  const removeBtn = row.querySelector('td:last-child button');
  await removeBtn.onclick();

  assert.strictEqual(tbody.children.length, 0);
  assert.ok(loadAllCalled);
  assert.strictEqual(errorMsg, undefined);

  const expected = [];
  for (const cat of ['coffee', 'not-coffee', 'pif', 'specials']) {
    for (const suf of ['latte', 'latte.drink']) {
      expected.push(`menu.${cat}.${suf}`);
      expected.push(`price.${cat}.${suf}`);
      expected.push(`desc.${cat}.${suf}`);
      expected.push(`image.${cat}.${suf}`);
      expected.push(`image.${cat}.${suf}.name`);
      expected.push(`alt.${cat}.${suf}`);
      expected.push(`extra.${cat}.${suf}`);
      expected.push(`syrups-on.${cat}.${suf}`);
      expected.push(`syrup-on.${cat}.${suf}`);
      expected.push(`coffee-on.${cat}.${suf}`);
    }
  }
  assert.strictEqual(calls.length, expected.length);
  const callSet = new Set(calls);
  expected.forEach(k => assert.ok(callSet.has(k), `Missing delete for ${k}`));
});

