const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1566, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 950 }, permissions: ['camera', 'microphone'] });
      let accepted = null, choices = [], socket;
      const startsAt = new Date(Date.now() - 300000).toISOString(), endsAt = new Date(Date.now() + 1200000).toISOString();
      await context.addInitScript(theme => { if (/^https?:$/.test(location.protocol)) localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })); }, theme);
      await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, route => {
        const path = new URL(route.request().url()).pathname;
        let json = { success: true, user: { userId: 'design-tutor', email: 'paulanthonyarriola@gmail.com', role: 'tutor', firstName: 'Alex' }, data: [], profile: {} };
        if (path.endsWith('/socket-token')) json.token = 'test-only-token';
        if (path === '/schedule/week') json.data = { slots: [], weekStart: '2026-10-05', weekEnd: '2026-10-11' };
        if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        if (path.startsWith('/tutor/classroom-lesson-notes/')) json.data = { materials: [], studentComment: '', tutorMemo: '', updatedAt: null };
        if (path.endsWith('/trouble-report')) json.data = { startsAt, endsAt, lessonEndsAt: endsAt, closesAt: endsAt, serverNow: new Date().toISOString(), eligible: false, report: null };
        return route.fulfill({ json });
      });
      await context.routeWebSocket('**/socket.io/**', ws => {
        socket = ws;
        ws.onMessage(message => {
          const raw = String(message);
          if (raw.startsWith('40')) ws.send('40' + JSON.stringify({ sid: 'design-socket' }));
          if (raw === '2') ws.send('3');
          const match = raw.match(/^42(\d*)(\[.*\])$/);
          if (!match) return;
          const [event, data] = JSON.parse(match[2]);
          if (event === 'session:join') ws.send('42' + JSON.stringify(['session:state', { sessionId: 'recording-design', mediaProvider: 'realtimekit', startsAt, endsAt, serverNow: new Date().toISOString(), status: 'waiting', participants: {} }]));
          if (event === 'classroom:media-token' && match[1]) ws.send(`43${match[1]}[${JSON.stringify({ error: 'Media is not enabled in this isolated fixture' })}]`);
          if (['classroom:recording-state', 'classroom:recording-consent'].includes(event) && match[1]) {
            if (event === 'classroom:recording-consent') { accepted = data.accepted; choices.push(data); }
            ws.send(`43${match[1]}[${JSON.stringify({ enabled: true, version: 'qa-local-30d-v1', retentionDays: 30, accepted, status: 'waiting' })}]`);
          }
        });
        ws.send('0' + JSON.stringify({ sid: 'recording-engine', upgrades: [], pingInterval: 9000000, pingTimeout: 9000000, maxPayload: 1000000 }));
      });
      const page = await context.newPage(); page.setDefaultTimeout(10000);
      await page.goto(base + '/classroom/recording-design');
      const recording = page.getByRole('dialog', { name: 'Lesson recording', exact: true });
      await recording.waitFor();
      assert(await recording.evaluate(el => el.matches(':modal') && el.scrollWidth <= el.clientWidth));
      assert(await recording.getByRole('button', { name: 'Agree', exact: true }).isDisabled(), 'Agreement requires an explicit checkbox');
      await page.screenshot({ path: `../output/screenshots/tutor-design/recording-${theme}-${width}.png` });
      await recording.getByRole('button', { name: "Don't record", exact: true }).click();
      await recording.waitFor({ state: 'detached' });
      assert.equal(accepted, false);
      assert.equal(await page.getByText('Recording awaits both participants', { exact: true }).count(), 0, 'No permanent consent banner');
      socket.send('42' + JSON.stringify(['session:state', { sessionId: 'recording-design', mediaProvider: 'realtimekit', startsAt, endsAt, serverNow: new Date().toISOString(), status: 'waiting', participants: {} }]));
      await page.waitForTimeout(300);
      assert.equal(await recording.count(), 0, 'Repeated session updates do not reopen the prompt');
      await page.getByRole('button', { name: 'Device settings', exact: true }).click();
      const settings = page.getByRole('dialog', { name: 'Classroom settings', exact: true });
      await settings.getByRole('button', { name: 'Recording permission', exact: true }).click();
      await recording.getByRole('checkbox').check();
      await recording.getByRole('button', { name: 'Agree', exact: true }).click();
      await recording.waitFor({ state: 'detached' });
      assert.equal(accepted, true);
      assert.equal(choices.length, 2);
      assert.equal(choices[1].authority, true);
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden', 'Nested consent dismissal preserves the settings scroll lock');
      await page.keyboard.press('Escape');
      await settings.waitFor({ state: 'detached' });
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
      console.log(`PASS recording dialog ${theme} ${width}: centered consent, opt-in, opt-out, once-only prompt, settings reopening and nested scroll locks`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
