import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = resolve(process.env.ENGINE_PREVIEW_ROOT || 'output/release/proof-destinations-20261025/frontend/dist');
const port = Number(process.env.PORT || 5217);
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp' };
createServer(async (request, response) => {
  const path = resolve(root, '.' + new URL(request.url, 'http://localhost').pathname);
  if (path !== root && !path.startsWith(root + '/')) { response.writeHead(403).end(); return; }
  try {
    const file = extname(path) ? path : resolve(root, 'index.html');
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
}).listen(port, '127.0.0.1', () => console.log(`Engine preview http://localhost:${port}`));
