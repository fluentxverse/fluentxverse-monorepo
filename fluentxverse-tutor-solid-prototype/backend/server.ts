import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { parse } from 'dotenv';
import { createHandler } from './handler';
if (process.env.NODE_ENV === 'production') throw new Error('The tutor compatibility API is local-only.');
const original = parse(await readFile(new URL('../../fluentxverse-server/.env', import.meta.url)));
process.env.NODE_ENV = 'development';
process.env.API_PUBLIC_URL = 'http://127.0.0.1:8782';
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.JWT_REFRESH_SECRET = randomBytes(48).toString('hex');
delete process.env.COOKIE_DOMAIN;
process.env.SEAWEED_FILER_URL = `http://127.0.0.1:${original.SEAWEED_FILER_PORT || '8888'}`;
process.env.DATABASE_URL = `postgresql://${encodeURIComponent(original.POSTGRES_USER || 'fluentxverse_user')}:${encodeURIComponent(original.POSTGRES_PASSWORD || '')}@127.0.0.1:${original.POSTGRES_PORT || '5432'}/${original.POSTGRES_DB || 'fluentxverse'}`;
const { initDriver, closeDriver } = await import('../../fluentxverse-server/src/db/memgraph');
await initDriver(`bolt://127.0.0.1:${original.MEMGRAPH_BOLT_PORT || '7691'}`, original.MEMGRAPH_USER, original.MEMGRAPH_PASSWORD, 1);
const { default: Elysia } = await import('elysia');
const app = new Elysia()
  .use((await import('../../fluentxverse-server/src/routes/auth.route')).default)
  .use((await import('../../fluentxverse-server/src/routes/tutor.route')).default)
  .use((await import('../../fluentxverse-server/src/routes/schedule.route')).default)
  .use((await import('../../fluentxverse-server/src/routes/lessonWorkflow.route')).default)
  .use((await import('../../fluentxverse-server/src/routes/lesson.route')).default)
  .use((await import('../../fluentxverse-server/src/routes/lessonMaterial.route')).lessonMaterialRoutes)
  .use((await import('../../fluentxverse-server/src/routes/dispatch.route')).dispatchRoutes)
  .use((await import('../../fluentxverse-server/src/routes/youngLearners.route')).youngLearnersRoute)
  .use((await import('../../fluentxverse-server/src/routes/notification.route')).default)
  .use((await import('../../fluentxverse-server/src/routes/inbox.route')).default)
  .use((await import('../../fluentxverse-server/src/routes/proof.route')).default)
  .use((await import('../../fluentxverse-server/src/routes/exam.route')).default)
  .use((await import('../../fluentxverse-server/src/routes/interview.route')).default)
  .compile();
const server = Bun.serve({ hostname: '127.0.0.1', port: 8782, fetch: createHandler(request => Promise.resolve(app.handle(request))) });
console.log(`Solid tutor compatibility API: ${server.url}; auth and reads only, writes and live calls disabled.`);
const stop = async () => { await server.stop(true); await closeDriver(); process.exit(0); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
