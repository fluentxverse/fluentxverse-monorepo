import Elysia, { t } from 'elysia';
import { getDriver } from '../db/memgraph';

const Debug = new Elysia({ name: 'debug', prefix: '/debug' })
  .post('/log', async ({ body }) => {
    try {
      const { tag = 'frontend', level = 'info', message = '', data = null } = body as any;
      const stamp = new Date().toISOString();
      const payload = data ? JSON.stringify(data) : '';
      const line = `[${stamp}] [${tag}] [${level}] ${message}${payload ? ' :: ' + payload : ''}`;
      // Print to server terminal
      if (level === 'error') console.error(line);
      else if (level === 'warn') console.warn(line);
      else console.log(line);
      return { success: true };
    } catch (e) {
      console.error('Debug log error:', e);
      return { success: false };
    }
  })
  .get('/tutors-raw', async () => {
    const driver = getDriver();
    const session = driver.session();
    try {
      const result = await session.run(`
        MATCH (u:User {role: 'tutor'})
        RETURN u.id as id, u.email as email, u.firstName as firstName, u.lastName as lastName,
               u.writtenExamPassed as writtenExamPassed, u.speakingExamPassed as speakingExamPassed,
               u.writtenExamScore as writtenExamScore, u.speakingExamScore as speakingExamScore,
               u.createdAt as createdAt
      `);
      const tutors = result.records.map(r => ({
        id: r.get('id'),
        email: r.get('email'),
        firstName: r.get('firstName'),
        lastName: r.get('lastName'),
        writtenExamPassed: r.get('writtenExamPassed'),
        speakingExamPassed: r.get('speakingExamPassed'),
        writtenExamScore: r.get('writtenExamScore'),
        speakingExamScore: r.get('speakingExamScore'),
        createdAt: r.get('createdAt')
      }));
      return { success: true, count: tutors.length, tutors };
    } finally {
      await session.close();
    }
  });
  

export default Debug;
