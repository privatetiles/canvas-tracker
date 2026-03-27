// Scholr - Proxy Server
// Local:  node proxy.js  →  http://localhost:3000
// Deploy: push to GitHub, connect to Railway

const http       = require('http');
const https      = require('https');
const fs         = require('fs');
const path       = require('path');
const url        = require('url');

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

      if (!canvasUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing url' }));
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
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'User-Agent':    'Scholr/1.0',
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

  // ── Send email via Resend (POST /send-email) ─────────────────────────────
  // Receives { resendKey, to, subject, message } in JSON body
  if (pathname === '/send-email' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let resendKey, to, subject, message;
      try {
        ({ resendKey, to, subject, message } = JSON.parse(body));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
      }

      if (!resendKey || !to || !subject || !message) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required fields' }));
        return;
      }

      const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#fff;border-radius:10px;padding:28px;border:1px solid #ddd;">
        <h2 style="color:#4f8ef7;margin-top:0;">📚 Scholr</h2>
        <div style="background:#f9f9f9;border-left:4px solid #4f8ef7;padding:16px;border-radius:6px;white-space:pre-wrap;font-size:14px;line-height:1.8;color:#333;">${message}</div>
        <p style="font-size:12px;color:#999;margin-top:20px;margin-bottom:0;">Automated alert from Scholr.</p>
      </div>`;

      const payload = JSON.stringify({
        from:    'Scholr <onboarding@resend.dev>',
        to:      [to],
        subject,
        html
      });

      const options = {
        hostname: 'api.resend.com',
        path:     '/emails',
        method:   'POST',
        headers:  {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type':  'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const apiReq = https.request(options, apiRes => {
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', () => {
          if (apiRes.statusCode === 200 || apiRes.statusCode === 201) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: data }));
          }
        });
      });

      apiReq.on('error', err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });

      apiReq.write(payload);
      apiReq.end();
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
  console.log(`\n  Scholr → http://localhost:${PORT}\n`);
});

module.exports = server;
