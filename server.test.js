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

test('DELETE /cms-del requires key parameter', async (t) => {
  fs.rmSync(DB_FILE, { force: true });
  const server = await startServer();
  t.after(() => { server.close(); fs.rmSync(DB_FILE, { force: true }); });
  const port = server.address().port;

  const res = await fetch(`http://localhost:${port}/cms-del`, { method: 'DELETE' });
  const body = await res.json();
  assert.strictEqual(res.status, 400);
  assert.deepStrictEqual(body, { error: 'key required' });
});

test('DELETE /cms-del rejects unknown key', async (t) => {
  fs.rmSync(DB_FILE, { force: true });
  const server = await startServer();
  t.after(() => { server.close(); fs.rmSync(DB_FILE, { force: true }); });
  const port = server.address().port;

  const res = await fetch(`http://localhost:${port}/cms-del?key=missing`, { method: 'DELETE' });
  const body = await res.json();
  assert.strictEqual(res.status, 400);
  assert.deepStrictEqual(body, { error: 'key required' });
});
