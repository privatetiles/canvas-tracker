// Canvas Tracker - Proxy Server
// Local:  node proxy.js  →  http://localhost:3000
// Deploy: push to GitHub, connect to Railway

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT = process.env.PORT || 3000;
const DIR  = __dirname;

const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // CORS headers — allow any origin so the app works from any device/domain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── Canvas API proxy (POST /canvas) ───────────────────────────────────────
  // Receives { url, token } in JSON body — token never exposed in URL or logs
  if (pathname === '/canvas' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let canvasUrl, token;
      try {
        ({ url: canvasUrl, token } = JSON.parse(body));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
      }

      if (!canvasUrl || !token) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing url or token' }));
        return;
      }

      let target;
      try { target = new URL(canvasUrl); }
      catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid Canvas URL' }));
        return;
      }

      const options = {
        hostname: target.hostname,
        path:     target.pathname + target.search,
        method:   'GET',
        headers:  {
          'Authorization': `Bearer ${token}`,
          'User-Agent':    'CanvasTracker/1.0',
          'Accept':        'application/json',
        }
      };

      const proxyReq = https.request(options, proxyRes => {
        let data = '';
        proxyRes.on('data', chunk => data += chunk);
        proxyRes.on('end', () => {
          res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(data);
        });
      });

      proxyReq.on('error', err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });

      proxyReq.end();
    });
    return;
  }

  // ── Serve static files ────────────────────────────────────────────────────
  let filePath = path.join(DIR, pathname === '/' ? 'canvas-tracker.html' : pathname);
  const ext    = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  Canvas Tracker → http://localhost:${PORT}\n`);
});
