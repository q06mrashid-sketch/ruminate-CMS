const { test } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

const { handleRequest } = require('./server');
const DB_FILE = path.join(__dirname, 'store.json');

function startServer() {
  const server = http.createServer(handleRequest);
  return new Promise(resolve => server.listen(0, () => resolve(server)));
}

test('POST /cms-set stores key/value pair to store.json', async (t) => {
  fs.rmSync(DB_FILE, { force: true });
  const server = await startServer();
  t.after(() => { server.close(); fs.rmSync(DB_FILE, { force: true }); });
  const port = server.address().port;

  const res = await fetch(`http://localhost:${port}/cms-set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'greeting', value: 'hello' })
  });
  const body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(body, { ok: true });

  const stored = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  assert.deepStrictEqual(stored, { greeting: 'hello' });
});

test('GET /cms-get returns stored data', async (t) => {
  fs.rmSync(DB_FILE, { force: true });
  const server = await startServer();
  t.after(() => { server.close(); fs.rmSync(DB_FILE, { force: true }); });
  const port = server.address().port;

  await fetch(`http://localhost:${port}/cms-set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'language', value: 'JavaScript' })
  });

  const res = await fetch(`http://localhost:${port}/cms-get`);
  const body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.match(res.headers.get('content-type'), /^application\/json/);
  assert.deepStrictEqual(body, { language: 'JavaScript' });
});

test('DELETE /cms-del requires key parameter', async (t) => {
  fs.rmSync(DB_FILE, { force: true });
  const server = await startServer();
  t.after(() => { server.close(); fs.rmSync(DB_FILE, { force: true }); });
  const port = server.address().port;

  const res = await fetch(`http://localhost:${port}/cms-del`, { method: 'DELETE' });
  const body = await res.json();
  assert.strictEqual(res.status, 400);
  assert.match(res.headers.get('content-type'), /^application\/json/);
  assert.deepStrictEqual(body, { error: 'key required' });
});

test('POST /cms-set requires key parameter', async (t) => {
  fs.rmSync(DB_FILE, { force: true });
  const server = await startServer();
  t.after(() => { server.close(); fs.rmSync(DB_FILE, { force: true }); });
  const port = server.address().port;

  const res = await fetch(`http://localhost:${port}/cms-set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: 'hi' })
  });
  const body = await res.json();
  assert.strictEqual(res.status, 400);
  assert.match(res.headers.get('content-type'), /^application\/json/);
  assert.deepStrictEqual(body, { error: 'key required' });
});

test('DELETE /cms-del succeeds for unknown key', async (t) => {
  fs.rmSync(DB_FILE, { force: true });
  const server = await startServer();
  t.after(() => { server.close(); fs.rmSync(DB_FILE, { force: true }); });
  const port = server.address().port;

  const res = await fetch(`http://localhost:${port}/cms-del?key=missing`, { method: 'DELETE' });
  const body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(body, { ok: true });
});

test('OPTIONS allows apikey and x-client-info headers', async (t) => {
  fs.rmSync(DB_FILE, { force: true });
  const server = await startServer();
  t.after(() => { server.close(); fs.rmSync(DB_FILE, { force: true }); });
  const port = server.address().port;

  const res = await fetch(`http://localhost:${port}/cms-set`, {
    method: 'OPTIONS',
    headers: {
      'Access-Control-Request-Headers': 'apikey, x-client-info'
    }
  });

  assert.strictEqual(res.status, 200);
  const allow = res.headers.get('access-control-allow-headers');
  assert.ok(allow.includes('apikey'));
  assert.ok(allow.includes('x-client-info'));
});

test('OPTIONS /cms-del returns required CORS headers', async (t) => {
  fs.rmSync(DB_FILE, { force: true });
  const server = await startServer();
  t.after(() => { server.close(); fs.rmSync(DB_FILE, { force: true }); });
  const port = server.address().port;

  const res = await fetch(`http://localhost:${port}/cms-del`, {
    method: 'OPTIONS',
    headers: {
      'Access-Control-Request-Headers': 'authorization, apikey, x-cms-secret, content-type, x-client-info',
      'Access-Control-Request-Method': 'DELETE'
    }
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('access-control-allow-origin'), '*');
  assert.strictEqual(
    res.headers.get('access-control-allow-methods'),
    'GET, POST, DELETE, OPTIONS'
  );
  assert.strictEqual(
    res.headers.get('access-control-allow-headers'),
    'authorization, apikey, x-cms-secret, content-type, x-client-info'
  );
});

test('DELETE /cms-del returns required CORS headers', async (t) => {
  fs.rmSync(DB_FILE, { force: true });
  const server = await startServer();
  t.after(() => { server.close(); fs.rmSync(DB_FILE, { force: true }); });
  const port = server.address().port;

  const res = await fetch(`http://localhost:${port}/cms-del?key=missing`, {
    method: 'DELETE'
  });
  const body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(body, { ok: true });
  assert.strictEqual(res.headers.get('access-control-allow-origin'), '*');
  assert.strictEqual(
    res.headers.get('access-control-allow-methods'),
    'GET, POST, DELETE, OPTIONS'
  );
  assert.strictEqual(
    res.headers.get('access-control-allow-headers'),
    'authorization, apikey, x-cms-secret, content-type, x-client-info'
  );
});
