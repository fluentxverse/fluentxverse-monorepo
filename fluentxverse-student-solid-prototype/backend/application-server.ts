import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { parse } from 'dotenv';
import { createLabHandler } from './handler';
import { permittedApplicationRoute } from './application-policy';

if (process.env.NODE_ENV === 'production') throw new Error('The local student test API must not run in production.');
const original = parse(await readFile(new URL('../../fluentxverse-server/.env', import.meta.url)));
const own = await readFile(new URL('../.env.local', import.meta.url)).then(parse).catch(() => ({} as Record<string, string>));
const writes = own.LAB_ENABLE_APP_MUTATIONS === '1';
if (writes && (!own.LAB_MEMGRAPH_URI || !own.LAB_DATABASE_URL)) throw new Error('App mutations and classroom signaling require LAB_MEMGRAPH_URI and LAB_DATABASE_URL pointing to isolated test databases.');
const appId = own.LAB_PRIVY_APP_ID || own.VITE_PRIVY_APP_ID || original.PRIVY_APP_ID;
if (appId !== original.PRIVY_APP_ID && !own.LAB_PRIVY_APP_SECRET) throw new Error('The selected test Privy app requires LAB_PRIVY_APP_SECRET.');
process.env.NODE_ENV = 'development';
process.env.API_PUBLIC_URL = 'http://127.0.0.1:8780';
process.env.DASHBOARD_PUBLIC_URL = 'http://127.0.0.1:5175';
delete process.env.COOKIE_DOMAIN;
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.JWT_REFRESH_SECRET = randomBytes(48).toString('hex');
process.env.PRIVY_APP_ID = appId;
process.env.PRIVY_APP_SECRET = own.LAB_PRIVY_APP_SECRET || original.PRIVY_APP_SECRET;
process.env.SEAWEED_FILER_URL = own.LAB_SEAWEED_FILER_URL || `http://127.0.0.1:${original.SEAWEED_FILER_PORT || '8888'}`;
process.env.DATABASE_URL = own.LAB_DATABASE_URL || `postgresql://${encodeURIComponent(original.POSTGRES_USER || 'fluentxverse_user')}:${encodeURIComponent(original.POSTGRES_PASSWORD || '')}@127.0.0.1:${original.POSTGRES_PORT || '5432'}/${original.POSTGRES_DB || 'fluentxverse'}`;
// No engine credentials, migrations, attendance jobs, or production signing keys.
const { initDriver, closeDriver } = await import('../../fluentxverse-server/src/db/memgraph');
await initDriver(own.LAB_MEMGRAPH_URI || `bolt://127.0.0.1:${original.MEMGRAPH_BOLT_PORT || '7691'}`, own.LAB_MEMGRAPH_USER || original.MEMGRAPH_USER, own.LAB_MEMGRAPH_PASSWORD || original.MEMGRAPH_PASSWORD, 1);
const { default: Elysia } = await import('elysia');
const app = new Elysia()
  .use((await import('../../fluentxverse-server/src/routes/student.route')).default)
  .use((await import('../../fluentxverse-server/src/routes/tutor.route')).default)
  .use((await import('../../fluentxverse-server/src/routes/schedule.route')).default)
  .use((await import('../../fluentxverse-server/src/routes/lessonWorkflow.route')).default)
  .use((await import('../../fluentxverse-server/src/routes/lesson.route')).default)
  .use((await import('../../fluentxverse-server/src/routes/lessonMaterial.route')).lessonMaterialRoutes)
  .use((await import('../../fluentxverse-server/src/routes/dispatch.route')).dispatchRoutes)
  .use((await import('../../fluentxverse-server/src/routes/youngLearners.route')).youngLearnersRoute)
  .use((await import('../../fluentxverse-server/src/routes/notification.route')).default)
  .use((await import('../../fluentxverse-server/src/routes/inbox.route')).default)
  .use((await import('../../fluentxverse-server/src/routes/ticket.route')).default)
  .use((await import('../../fluentxverse-server/src/routes/lessonPasses.route')).default)
  .use((await import('../../fluentxverse-server/src/routes/proof.route')).default)
  .compile();
const server = Bun.serve({ hostname: '127.0.0.1', port: 8780, maxRequestBodySize: 10 * 1024 * 1024,
  fetch: createLabHandler(request => Promise.resolve(app.handle(request)), {
    cookieName: 'fxvSolidStudentAuth', permittedRoute: (method, path) => permittedApplicationRoute(method, path, writes),
    publicRead: path => path.startsWith('/lesson/files/'),
    publicReadOrigins: ['http://127.0.0.1:5175', 'http://localhost:5175'],
    health: { service: 'solid-student-lab', accountRegistration: writes, appMutations: writes, classroomSignaling: writes },
  }),
});
let socketServer: ReturnType<typeof createServer> | undefined;
if (writes) {
  socketServer = createServer();
  const { initSocketServer } = await import('../../fluentxverse-server/src/socket/socket.server');
  const io = initSocketServer(socketServer);
  io.engine.opts.allowRequest = (request, callback) => callback(null, request.headers.origin === 'http://127.0.0.1:5176');
  socketServer.listen(8781, '127.0.0.1');
}
console.log(`Solid student test API: ${server.url}; ${writes ? 'test database mutations and signaling enabled' : 'read-only student data; auth enabled; classroom signaling disabled'}.`);
const stop = async () => { socketServer?.close(); await server.stop(true); await closeDriver(); process.exit(0); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
