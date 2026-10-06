// Local preview server with no dependencies.
//
//   node tools/serve.mjs            http://localhost:8767/
//   PORT=9000 node tools/serve.mjs
//
// / is model.html wrapped as a full page, rebuilt on every request, so an edit shows on reload.
// Everything else is served from the project folder, e.g. /ha/_view.html to check the exported GLB.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { ROOT, page } from './build.mjs';

const PORT = Number(process.env.PORT) || 8767;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.yaml': 'text/yaml; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
};

http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (url === '/' || url === '/index.html') {
    res.writeHead(200, { 'content-type': TYPES['.html'], 'cache-control': 'no-store' });
    res.end(page());
    return;
  }
  const file = path.join(ROOT, url);
  // stay inside the project folder
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`http://localhost:${PORT}/`));
