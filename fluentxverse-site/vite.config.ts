import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import solid from 'vite-plugin-solid';
import { readFileSync } from 'node:fs';

const feedPath = new URL('./src/data/changelogEntries.json', import.meta.url);
const changelogFeed: Plugin = {
  name: 'changelog-feed',
  configureServer(server) {
    server.middlewares.use('/changelog.json', (req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(req.method === 'HEAD' ? undefined : readFileSync(feedPath));
    });
  },
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'changelog.json', source: readFileSync(feedPath, 'utf8') });
  },
};

export default defineConfig({
  plugins: [solid(), changelogFeed],
  server: { port: 3000 },
  build: { target: 'es2022' },
});
