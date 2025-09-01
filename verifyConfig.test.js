const { test } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { JSDOM } = require('jsdom');
const { handleRequest } = require('./server');

function startServer() {
  const server = http.createServer(handleRequest);
  return new Promise(resolve => server.listen(0, () => resolve(server)));
}

test('verifyConfig succeeds with GET request', async (t) => {
  const server = await startServer();
  t.after(() => server.close());
  const port = server.address().port;
  const functionsUrl = `http://localhost:${port}`;

  const { window } = new JSDOM('', { url: 'http://localhost' });
  global.localStorage = window.localStorage;

  function showError(){}
  function getAnon(){ return localStorage.getItem('cmsAnon') || ''; }
  function getFnsUrl(){ return localStorage.getItem('cmsFunctionsUrl') || ''; }

  localStorage.setItem('cmsAnon', 'fake');
  localStorage.setItem('cmsFunctionsUrl', functionsUrl);

  async function verifyConfig(){
    const anon = getAnon();
    if(!anon){ showError('Supabase Anon key missing. Click “Set Supabase anon key” (top bar).'); return false; }
    const url = getFnsUrl();
    if(!url){ showError('Functions URL missing. Click “Set Functions URL” (top bar).'); return false; }
    try{ await fetch(`${url}/cms-get`, { method:'GET', headers:{ 'Authorization': `Bearer ${anon}` }}); }
    catch(e){ showError('Supabase Functions URL unreachable. Check the URL and network.'); return false; }
    return true;
  }

  const ok = await verifyConfig();
  assert.strictEqual(ok, true);
});
