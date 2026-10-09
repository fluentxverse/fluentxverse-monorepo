const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.STUDENT_TEST_URL || 'http://localhost:5174';
const id = 'classroom-survey-flow-test';
const topics = [
  ['connection', 'Audio and connection quality', true], ['feedback', 'End-of-lesson feedback', true],
  ['corrections', 'Corrections and explanations', true], ['pace', "Tutor's speaking pace", true],
  ['difficulty', 'Lesson difficulty for my English level', true], ['environment', 'Quiet learning environment', false],
  ['start_time', 'Starting the lesson on time', false], ['end_time', 'Finishing the lesson on time', false],
  ['engagement', 'Tutor focus and engagement', false], ['request', 'Following my lesson request', false], ['other', 'Other', true],
].map(([id, label, positive]) => ({ id, label, positive }));
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  await fs.mkdir('../output/screenshots', { recursive: true });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1566, 375]) {
      let survey = null, eligible = false, readyAt = null, failLoad = false, failSave = false, writes = 0, checks = 0, ws;
      const startsAt = new Date(Date.now() - 5 * 60000).toISOString(), endsAt = new Date(Date.now() + 20 * 60000).toISOString();
      const errors = [];
      const height = width < 650 ? 667 : 900;
      const context = await browser.newContext({ viewport: { width, height }, permissions: ['camera', 'microphone'] });
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })), theme);
      await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):8765|https:\/\/api\.fluentxverse\.(?:com|xyz))\//, async route => {
        const req = route.request(), path = new URL(req.url()).pathname;
        const user = { userId: 'survey-student', id: 'survey-student', role: 'student', givenName: 'Test', email: 'survey@example.test' };
        if (path.endsWith('/socket-token')) return route.fulfill({ json: { success: true, token: 'fixture-token' } });
        if (path === '/student/me') return route.fulfill({ json: { success: true, user } });
        if (path.endsWith('/survey')) {
          if (req.method() === 'POST') {
            writes++; await new Promise(resolve => setTimeout(resolve, 300));
            if (failSave) { failSave = false; return route.fulfill({ status: 503, json: { success: false, error: 'Could not save your feedback. Please try again.' } }); }
            survey = { ...req.postDataJSON(), submittedAt: new Date().toISOString() };
            return route.fulfill({ json: { success: true, data: survey } });
          }
          checks++;
          if (failLoad) { failLoad = false; return route.fulfill({ status: 503, json: { success: false } }); }
          return route.fulfill({ json: { success: true, data: { eligible: eligible && !survey, reason: survey ? 'submitted' : eligible ? null : 'not_ended', readyAt,
            endsAt, closesAt: new Date(Date.parse(endsAt) + 48 * 3600000).toISOString(), survey, topics } } });
        }
        if (path.endsWith('/issue-report')) return route.fulfill({ json: { success: true, data: { eligible: false, reason: 'tutor_joined', report: null, startsAt, lessonEndsAt: endsAt, closesAt: new Date(Date.now() + 48 * 3600000).toISOString(), serverNow: new Date().toISOString() } } });
        return route.fulfill({ json: { success: true, data: [], user, profile: {}, notifications: [] } });
      });
      await context.routeWebSocket('**/socket.io/**', socket => {
        ws = socket;
        socket.onMessage(message => {
          const raw = String(message);
          if (raw.startsWith('40')) socket.send('40' + JSON.stringify({ sid: 'survey-socket' }));
          if (raw === '2') socket.send('3');
          if (raw.startsWith('42') && raw.includes('session:join')) socket.send('42' + JSON.stringify(['session:state', { sessionId: id, startsAt, endsAt, serverNow: new Date().toISOString(), status: 'active', participants: { tutorId: 'survey-tutor', studentId: 'survey-student' } }]));
          const match = raw.match(/^42(\d+)(\[.*\])$/);
          if (match && JSON.parse(match[2])[0] === 'webrtc:ice-config') socket.send(`43${match[1]}[${JSON.stringify({ iceServers: [] })}]`);
        });
        socket.send('0' + JSON.stringify({ sid: 'survey-engine', upgrades: [], pingInterval: 9000000, pingTimeout: 9000000, maxPayload: 1000000 }));
      });
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/classroom/${id}`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Report issue', exact: true }).waitFor();
      await page.waitForFunction(() => document.querySelector('.session-time-display .timer')?.textContent !== '00:00:00');
      await page.waitForTimeout(250);
      const dialog = page.getByRole('dialog', { name: 'Lesson feedback', exact: true });
      assert.equal(await dialog.count(), 0, 'No survey while the lesson is active');
      const emit = (event, payload) => ws.send('42' + JSON.stringify([event, payload]));
      emit('session:user-left', { userId: 'survey-tutor', userType: 'tutor' });
      await page.waitForTimeout(1700);
      assert.equal(await dialog.count(), 0, 'An unconfirmed mid-lesson disconnect does not open a survey');
      emit('session:user-joined', { userId: 'survey-tutor', userType: 'tutor' });
      eligible = true; readyAt = new Date().toISOString();
      emit('session:survey-ready', { sessionId: id, reason: 'left' });
      eligible = false; readyAt = null;
      emit('session:user-joined', { userId: 'survey-tutor', userType: 'tutor' });
      await page.waitForTimeout(1700);
      assert.equal(await dialog.count(), 0, 'A quick return cancels the departure prompt');
      eligible = true; readyAt = new Date().toISOString();
      emit('session:survey-ready', { sessionId: 'another-lesson', reason: 'ended' });
      await page.waitForTimeout(100); assert.equal(await dialog.count(), 0, 'Signals are lesson-scoped');
      failLoad = true; emit('session:survey-ready', { sessionId: id, reason: 'ended' });
      await dialog.getByRole('alert').waitFor();
      await dialog.getByRole('button', { name: 'Try again', exact: true }).click();
      await dialog.getByLabel('Step 1 of 3', { exact: true }).waitFor();
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
      emit('session:survey-ready', { sessionId: id, reason: 'ended' });
      await page.waitForTimeout(150); assert.equal(await dialog.count(), 0, 'Dismissed prompts are not reopened automatically');
      await page.getByRole('button', { name: 'Lesson feedback', exact: true }).click();
      await dialog.waitFor();
      const bounds = await dialog.boundingBox();
      assert(Math.abs(bounds.x + bounds.width / 2 - width / 2) < 2, 'Modal is centered horizontally');
      assert(Math.abs(bounds.y + bounds.height / 2 - height / 2) < 2, 'Modal is centered vertically');
      await dialog.getByRole('button', { name: 'Next', exact: true }).click();
      await dialog.getByRole('alert').filter({ hasText: 'Choose an overall lesson rating' }).waitFor();
      assert.equal(writes, 0);
      await dialog.getByRole('radio', { name: '5 stars - Very satisfied', exact: true }).check();
      await dialog.screenshot({ path: `../output/screenshots/classroom-survey-rating-${theme}-${width}.png` });
      await dialog.getByRole('button', { name: 'Next', exact: true }).click();
      await dialog.getByLabel('Step 2 of 3', { exact: true }).waitFor();
      const good = dialog.getByRole('group', { name: 'What went well?', exact: true });
      const improve = dialog.getByRole('group', { name: 'What could be better?', exact: true });
      await good.getByRole('checkbox', { name: "Tutor's speaking pace", exact: true }).check();
      await improve.getByRole('checkbox', { name: 'Audio and connection quality', exact: true }).check();
      assert(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), 'No horizontal modal overflow');
      await dialog.screenshot({ path: `../output/screenshots/classroom-survey-topics-${theme}-${width}.png` });
      await dialog.getByRole('button', { name: 'Back', exact: true }).click();
      assert(await dialog.getByRole('radio', { name: '5 stars - Very satisfied', exact: true }).isChecked());
      await dialog.getByRole('button', { name: 'Next', exact: true }).click();
      assert(await good.getByRole('checkbox', { name: "Tutor's speaking pace", exact: true }).isChecked());
      await dialog.getByRole('button', { name: 'Next', exact: true }).click();
      await dialog.getByLabel('Step 3 of 3', { exact: true }).waitFor();
      await dialog.locator('textarea').fill('Good speaking pace. Please improve the audio.');
      await dialog.screenshot({ path: `../output/screenshots/classroom-survey-comment-${theme}-${width}.png` });
      failSave = true; await dialog.getByRole('button', { name: 'Submit feedback', exact: true }).click();
      await dialog.getByRole('alert').filter({ hasText: 'Could not save your feedback' }).waitFor();
      assert.equal(await dialog.locator('textarea').inputValue(), 'Good speaking pace. Please improve the audio.');
      await dialog.getByRole('button', { name: 'Submit feedback', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.classroom-survey-close')?.disabled);
      await dialog.getByRole('heading', { name: 'Thank you for your feedback', exact: true }).waitFor();
      assert.deepEqual(survey.positive, ['pace']); assert.deepEqual(survey.improvement, ['connection']); assert.equal(writes, 2);
      assert.equal(await dialog.getByRole('link', { name: 'View lesson recap', exact: true }).getAttribute('href'), `/lesson/${id}`);
      await dialog.getByRole('button', { name: 'Done', exact: true }).click();
      emit('session:survey-ready', { sessionId: id, reason: 'ended' });
      await page.waitForTimeout(150); assert.equal(await dialog.count(), 0);
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: 'Report issue', exact: true }).waitFor();
      await page.waitForTimeout(250); assert.equal(await dialog.count(), 0, 'Submitted surveys do not prompt after reload');
      assert.equal(await page.getByRole('button', { name: 'Lesson feedback', exact: true }).count(), 0);
      assert.deepEqual(errors, []);
      await context.close(); console.log(`PASS classroom survey ${theme} ${width}: tutor events, reconnect guard, modal flow, validation, retry, dismissal and single submission`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
