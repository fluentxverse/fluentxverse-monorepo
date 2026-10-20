import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  plugins: [solid()],
  resolve: { dedupe: ['solid-js', '@solidjs/router', 'lucide-solid'], alias: { '@': path.join(root, 'tutor'), '@client': path.join(root, 'tutor/client'), '@components': path.join(root, 'tutor/Components'), '@context': path.join(root, 'tutor/context') } },
  server: { host: '127.0.0.1', port: 5177, strictPort: true },
  build: { target: 'es2022', manifest: true },
});
