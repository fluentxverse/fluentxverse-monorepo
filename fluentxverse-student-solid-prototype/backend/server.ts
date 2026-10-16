import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { parse } from 'dotenv';
import { LAB_ORIGIN } from './policy';
import { createLabHandler } from './handler';

if (process.env.NODE_ENV === 'production') throw new Error('The Solid auth harness must not run in production.');
const serverEnv = parse(await readFile(new URL('../../fluentxverse-server/.env', import.meta.url)));
const own = await readFile(new URL('../.env.local', import.meta.url)).then(parse).catch(() => ({} as Record<string, string>));
const appId = own.LAB_PRIVY_APP_ID || own.VITE_PRIVY_APP_ID || serverEnv.PRIVY_APP_ID;
if (appId !== serverEnv.PRIVY_APP_ID && !own.LAB_PRIVY_APP_SECRET) {
  throw new Error('Set LAB_PRIVY_APP_SECRET for the selected test Privy app in .env.local.');
}

// Load only the settings required by existing auth handlers. No production JWT,
// wallet-engine credentials, background workers, or server index are reused.
process.env.NODE_ENV = 'development';
process.env.API_PUBLIC_URL = 'http://127.0.0.1:8776';
delete process.env.COOKIE_DOMAIN;
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.JWT_REFRESH_SECRET = randomBytes(48).toString('hex');
process.env.PRIVY_APP_ID = appId;
process.env.PRIVY_APP_SECRET = own.LAB_PRIVY_APP_SECRET || serverEnv.PRIVY_APP_SECRET;
const { default: Student } = await import('../../fluentxverse-server/src/routes/student.route');
const { initDriver, closeDriver } = await import('../../fluentxverse-server/src/db/memgraph');
await initDriver(
  own.LAB_MEMGRAPH_URI || `bolt://127.0.0.1:${serverEnv.MEMGRAPH_BOLT_PORT || '7691'}`,
  own.LAB_MEMGRAPH_USER || serverEnv.MEMGRAPH_USER,
  own.LAB_MEMGRAPH_PASSWORD || serverEnv.MEMGRAPH_PASSWORD,
  1,
);
Student.compile();

const server = Bun.serve({
  hostname: '127.0.0.1', port: 8776, maxRequestBodySize: 16384,
  fetch: createLabHandler(request => Promise.resolve(Student.handle(request))),
});
console.log(`Solid auth harness: ${server.url}`);
console.log(`Allowed frontend: ${LAB_ORIGIN}; existing account auth only; separate cookie and JWT keys.`);
const stop = async () => { await server.stop(true); await closeDriver(); process.exit(0); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
