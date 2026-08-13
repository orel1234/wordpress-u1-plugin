// A static file server with no dependencies.
//
// Railway builds what it finds; a package.json with a start script is the
// least it needs, and no dependency list means no install step that can fail
// on a deploy whose only job is to hand back four HTML files.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

http.createServer((req, res) => {
  // The query string is part of the URL and not part of the path — `?u1qa=1`
  // is how the monitoring hook is switched on, and it must not 404.
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  // Nothing above the public directory, whatever the path claims.
  const file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }

  fs.readFile(file, (err, body) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404</h1><p><a href="/">Back to the shop</a></p>');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  });
}).listen(PORT, () => console.log(`step-a11y on :${PORT}`));
