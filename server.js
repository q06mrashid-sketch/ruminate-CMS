const http = require('http');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'store.json');

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

function writeStore(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    const requestedMethod = req.headers['access-control-request-method'];
    if (requestedMethod) {
      res.setHeader('Access-Control-Allow-Methods', requestedMethod);
    }
    return res.end();
  }

  if (req.method === 'GET' && url.pathname === '/cms-get') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(readStore()));
  }

  if (req.method === 'POST' && url.pathname === '/cms-set') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { key, value } = JSON.parse(body || '{}');
        if (!key) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'key required' })); }
        const store = readStore();
        store[key] = value;
        writeStore(store);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'invalid json' }));
      }
    });
    return;
  }

  if (req.method === 'DELETE' && url.pathname === '/cms-del') {
    const key = url.searchParams.get('key');
    const store = readStore();
    delete store[key];
    writeStore(store);
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: true }));
  }

  res.statusCode = 404;
  res.end('Not found');
}

if (require.main === module) {
  const port = process.env.PORT || 3000;
  http.createServer(handleRequest).listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
} else {
  module.exports = { handleRequest };
}
