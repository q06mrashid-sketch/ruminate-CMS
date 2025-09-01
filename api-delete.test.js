const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

async function setup() {
  let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  html = html.replace('<script src="content.js" defer></script>', '');
  const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost' });
  const { window } = dom;
  await new Promise((resolve) => {
    if (window.document.readyState === 'complete') resolve();
    else window.document.addEventListener('DOMContentLoaded', resolve);
  });
  window.eval(fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8'))
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
    return { ok: false, status: 400, text: async () => 'bad request' };
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

test('apiDelete encodes key parameter', async () => {
  const window = await setup();
  let url;
  window.fetch = async (input) => {
    url = input;
    return { ok: true, status: 204, text: async () => '' };
  };
  await window.apiDelete('sp ce');
  assert.ok(url.includes('key=sp%20ce'));
});

test('apiDelete sends auth headers', async () => {
  const window = await setup();
  let opts;
  window.fetch = async (input, options) => {
    opts = options;
    return { ok: true, status: 204, text: async () => '' };
  };
  await window.apiDelete('foo');
  assert.equal(opts.headers['Content-Type'], 'application/json');
  assert.equal(opts.headers.apikey, 'test');
  assert.equal(opts.headers.Authorization, 'Bearer test');
});

test('apiDelete surfaces failures via showError', async () => {
  const window = await setup();
  let shown;
  window.showError = (msg) => { shown = msg; };
  window.fetch = async () => ({ ok: false, status: 500, text: async () => 'oops' });
  await assert.rejects(window.apiDelete('foo'), /oops/);
  assert.equal(shown, 'oops');
});

