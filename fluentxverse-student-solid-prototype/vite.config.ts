import { defineConfig, loadEnv } from 'vite';
import solid from 'vite-plugin-solid';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const root = fileURLToPath(new URL('.', import.meta.url));
  const own = loadEnv(mode, root, 'VITE_');
  const server = loadEnv(mode, fileURLToPath(new URL('../fluentxverse-server', import.meta.url)), 'PRIVY_APP_ID');
  return {
    plugins: [solid()],
    resolve: { alias: { '@': path.join(root, 'student'), '@client': path.join(root, 'student/client'), '@components': path.join(root, 'student/Components'), '@context': path.join(root, 'student/context') } },
    // Only the public app ID is shared; archived frontend settings are not loaded.
    define: { 'import.meta.env.VITE_PRIVY_APP_ID': JSON.stringify(own.VITE_PRIVY_APP_ID ?? (server.PRIVY_APP_ID || '')) },
    server: { host: '127.0.0.1', port: 5176, strictPort: true },
    build: { target: 'es2022' },
  };
});
