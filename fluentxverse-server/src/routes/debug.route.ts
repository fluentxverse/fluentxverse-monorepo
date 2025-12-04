import Elysia, { t } from 'elysia';

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
});
  

export default Debug;
