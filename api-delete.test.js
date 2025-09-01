const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

async function setup() {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost' });
  const { window } = dom;
  await new Promise((resolve) => {
    if (window.document.readyState === 'complete') resolve();
    else window.document.addEventListener('DOMContentLoaded', resolve);
  });
  window.localStorage.setItem('cmsAnon', 'test');
  window.showError = () => {};
  return window;
}

test('apiDelete returns early when key is missing', async () => {
  const window = await setup();
  let called = false;
  window.fetch = async () => { called = true; };
  const out = await window.apiDelete('');
  assert.equal(out, undefined);
  assert.equal(called, false);
});

test('apiDelete propagates 400 errors', async () => {
  const window = await setup();
  let called = false;
  window.fetch = async () => {
    called = true;
    return { ok: false, status: 400, json: async () => ({ error: 'bad request' }) };
  };
  await assert.rejects(window.apiDelete('bad.key'), /bad request/);
  assert.ok(called);
});

test('apiDelete removes trailing slash from key', async () => {
  const window = await setup();
  let url;
  window.fetch = async (input) => {
    url = input;
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  await window.apiDelete('foo/');
  const sentKey = new URL(url).searchParams.get('key');
  assert.equal(sentKey, 'foo');
});

test('apiDelete throws descriptive error on network failure', async () => {
  const window = await setup();
  window.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(
    window.apiDelete('foo'),
    /Network or CORS error while deleting key/
  );
});
