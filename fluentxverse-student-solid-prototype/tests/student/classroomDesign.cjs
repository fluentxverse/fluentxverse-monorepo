const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';
const id = 'classroom-design-fixture';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  await fs.mkdir('../output/screenshots', { recursive: true });
  try {
    for (const theme of process.env.TEST_THEME ? [process.env.TEST_THEME] : ['light', 'dark']) {
      for (const width of process.env.TEST_WIDTHS ? process.env.TEST_WIDTHS.split(',').map(Number) : [1566, 768, 375, 320]) {
        const context = await browser.newContext({ viewport: { width, height: width <= 375 ? 667 : 950 }, reducedMotion: 'reduce', permissions: ['camera', 'microphone'] });
        await context.addInitScript(theme => {
          if (/^https?:$/.test(location.protocol)) localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 }));
        }, theme);
        let consent = null, enabled = true, failSave = true, holdSave = false, releaseSave;
        let stateReads = 0, saves = [], ws, connections = 0;
        const initiallyUnavailable = theme === 'light' && width === 1566;
        let failState = initiallyUnavailable;
        const startsAt = new Date(Date.now() - 5 * 60000).toISOString(), endsAt = new Date(Date.now() + 20 * 60000).toISOString();
        const recordingState = () => ({ enabled, version: 'notice-v1', retentionDays: 30, accepted: consent, status: consent === false ? 'declined' : 'waiting' });
        await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780)|https:\/\/api\.fluentxverse\.(?:com|xyz))\//, async route => {
          const req = route.request(), path = new URL(req.url()).pathname;
          if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
          if (req.method() !== 'GET' && path !== '/schedule/preload') throw new Error('Unexpected API write: ' + path);
          const user = { userId: 'design-student', id: 'design-student', role: 'student', givenName: 'Test', firstName: 'Test', email: 'test@example.invalid' };
          const reply = json => route.fulfill({ json });
          if (path.endsWith('/socket-token')) return reply({ success: true, token: 'fixture-token' });
          if (path === '/student/me') return reply({ success: true, user });
          if (path === '/student/profile') return reply({ success: true, data: { ...user, currentProficiency: 'Level 3' } });
          if (path === '/student/last-viewed-lesson') return reply({ success: true, data: null });
          if (path.endsWith('/survey')) return reply({ success: true, data: { eligible: false, reason: 'not_ended', readyAt: null, survey: null, topics: [] } });
          if (path.endsWith('/issue-report')) return reply({ success: true, data: { eligible: true, reason: null, report: null, startsAt, lessonEndsAt: endsAt, serverNow: new Date().toISOString() } });
          if (path === '/dispatch/classroom-library') return reply({ success: true, articles: [{ id: 'fixture-news', title: 'A new discovery', category: 'Science', postDate: new Date().toISOString().slice(0, 10), status: 'published' }] });
          return reply({ success: true, data: [], lessons: [], user, profile: {}, notifications: [] });
        });
        await context.routeWebSocket('**/socket.io/**', socket => {
          ws = socket; connections++;
          socket.onMessage(async message => {
            const raw = String(message);
            const emit = (event, data) => socket.send('42' + JSON.stringify([event, data]));
            if (raw.startsWith('40')) socket.send('40' + JSON.stringify({ sid: 'design-socket' }));
            if (raw === '2') socket.send('3');
            if (raw.startsWith('42') && raw.includes('session:join')) emit('session:state', { sessionId: id, mediaProvider: 'realtimekit', startsAt, endsAt, serverNow: new Date().toISOString(), status: 'active', participants: { tutorId: null, studentId: 'design-student' } });
            if (raw.startsWith('42') && raw.includes('classroom:request-activity-history')) emit('classroom:activity-history', []);
            const match = raw.match(/^42(\d+)(\[.*\])$/);
            if (!match) return;
            const [event, data] = JSON.parse(match[2]);
            const ack = result => socket.send(`43${match[1]}[${JSON.stringify(result)}]`);
            if (event === 'classroom:recording-state') {
              stateReads++;
              if (failState) { failState = false; ack({ error: 'Fixture state unavailable.' }); }
              else ack(recordingState());
            }
            if (event === 'classroom:media-token') ack({ error: 'Fixture has no real video call.' });
            if (event === 'classroom:recording-consent') {
              saves.push(data);
              if (holdSave) await new Promise(resolve => { releaseSave = resolve; });
              if (failSave) { failSave = false; ack({ error: 'Fixture save unavailable.' }); }
              else { consent = data.accepted; ack(recordingState()); }
            }
          });
          socket.send('0' + JSON.stringify({ sid: 'design-engine', upgrades: [], pingInterval: 9000000, pingTimeout: 9000000, maxPayload: 1000000 }));
        });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const load = async () => {
          const previousReads = stateReads;
          await page.goto(base + '/classroom/' + id, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await page.getByRole('button', { name: 'Report issue', exact: true }).waitFor();
          const deadline = Date.now() + 30000;
          while (stateReads === previousReads && Date.now() < deadline) await page.waitForTimeout(50);
          assert(stateReads > previousReads, 'The server consent state must be read before checking the prompt');
        };
        const modal = page.getByRole('dialog', { name: 'Lesson recording', exact: true });
        const shot = async state => page.screenshot({ path: `../output/screenshots/classroom-design-${theme}-${width}-${state}.png` });
        await load();
        if (initiallyUnavailable) {
          assert.equal(await modal.count(), 0, 'Unavailable status must not show a loading banner or unverified consent prompt');
          assert.equal(await page.locator('.classroom-recording-notice').count(), 0);
        }
        await modal.waitFor();
        assert.equal(await page.locator('.classroom-recording-notice').count(), 0);
        assert.equal(await modal.getByRole('button', { name: 'Agree', exact: true }).isDisabled(), true);
        await modal.locator('header img').evaluate(image => image.decode());
        let bounds = await modal.boundingBox();
        assert(Math.abs(bounds.x + bounds.width / 2 - width / 2) < 2);
        assert(bounds.y >= 0 && bounds.y + bounds.height <= page.viewportSize().height + 1);
        assert(await modal.evaluate(el => el.scrollWidth <= el.clientWidth));
        await shot('consent');
        await modal.getByRole('checkbox').check();
        await modal.getByRole('button', { name: 'Agree', exact: true }).click();
        await modal.getByRole('alert').waitFor();
        assert.equal(consent, null, 'Failed writes must not dismiss consent');
        assert.equal(await modal.getByRole('checkbox').isChecked(), true);
        holdSave = true;
        await modal.getByRole('button', { name: 'Agree', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('.recording-close')?.disabled);
        await page.keyboard.press('Escape');
        assert.equal(await modal.isVisible(), true, 'Cannot dismiss a pending consent write');
        while (!releaseSave) await page.waitForTimeout(25);
        holdSave = false; releaseSave();
        await modal.waitFor({ state: 'hidden' });
        assert.equal(consent, true); assert.equal(saves.length, 2);
        assert.deepEqual(saves[1], { accepted: true, authority: true, version: 'notice-v1' });
        if (initiallyUnavailable) {
          const previousConnections = connections;
          await ws.close();
          const deadline = Date.now() + 15000;
          while (connections === previousConnections && Date.now() < deadline) await page.waitForTimeout(50);
          assert(connections > previousConnections, 'Fixture should reconnect');
          await page.waitForTimeout(250);
          assert.equal(await modal.count(), 0, 'Reconnect must not reopen a saved consent choice');
        }
        await shot('classroom');
        assert.equal(await page.locator('.classroom-container i').count(), 0, 'No old icon-font controls');
        await page.locator('.classroom-art').evaluateAll(images => Promise.all(images.map(image => image.decode())));
        assert(await page.locator('.classroom-art').evaluateAll(images => images.every(image => getComputedStyle(image.parentElement).filter === 'none')), 'Custom artwork keeps its colors in both themes');
        assert.equal(await page.getByText('Recording awaits both participants', { exact: true }).count(), 0);
        await page.getByRole('button', { name: 'Device settings', exact: true }).click();
        await page.getByRole('button', { name: 'Recording permission', exact: true }).click();
        await modal.getByText('Current choice: Recording allowed', { exact: true }).waitFor();
        const savedBeforeDismiss = saves.length;
        await page.keyboard.press('Escape'); await modal.waitFor({ state: 'hidden' });
        assert.equal(saves.length, savedBeforeDismiss, 'Dismissing settings must not silently change consent');
        await page.getByRole('button', { name: 'Recording permission', exact: true }).click();
        await modal.waitFor();
        await modal.getByRole('button', { name: "Don't record", exact: true }).click();
        await modal.waitFor({ state: 'hidden' }); assert.equal(consent, false);
        assert.deepEqual(saves.at(-1), { accepted: false, authority: false, version: 'notice-v1' });
        await page.waitForFunction(() => document.activeElement?.classList.contains('classroom-recording-settings'));
        await page.getByRole('button', { name: 'Close settings', exact: true }).click();
        await page.getByRole('button', { name: 'Classroom history', exact: true }).click();
        await page.getByRole('dialog', { name: 'History', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Close history', exact: true }).click();
        await page.locator('.video-section').hover();
        await page.getByRole('button', { name: 'Mute microphone', exact: true }).click();
        await page.getByRole('button', { name: 'Unmute microphone', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Turn off camera', exact: true }).click();
        await page.getByRole('button', { name: 'Turn on camera', exact: true }).waitFor();
        const layout = await page.locator('.classroom-container').evaluate(el => {
          const rect = selector => el.querySelector(selector)?.getBoundingClientRect();
          const controls = rect('.video-controls'), status = rect('.connection-status'), text = rect('.camera-off-text'), pip = rect('.video-pip');
          const logo = rect('.classroom-logo'), time = rect('.classroom-session-info');
          const intersects = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
          return { header: logo.right <= time.left, status: !intersects(controls, status), text: !intersects(controls, text), pip: !intersects(controls, pip) };
        });
        assert(Object.values(layout).every(Boolean), JSON.stringify(layout));
        await shot('controls');
        await page.getByRole('button', { name: 'Send message', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Select a course library', exact: true }).click();
        await page.getByRole('option', { name: /Daily Dispatch/ }).click();
        await page.locator('.dispatch-picker').waitFor();
        await page.locator('.dp-heading img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
        assert.equal(await page.locator('.classroom-container i').count(), 0);
        await shot('dispatch');
        await load();
        await page.waitForTimeout(350);
        assert.equal(await modal.count(), 0, 'Saved decline does not reopen after reload');
        consent = true; await load(); await page.waitForTimeout(350);
        assert.equal(await modal.count(), 0, 'Saved agreement does not reopen after reload');
        enabled = false; consent = null; await load(); await page.waitForTimeout(350);
        assert.equal(await modal.count(), 0, 'Disabled recording never prompts');
        await page.getByRole('button', { name: 'Device settings', exact: true }).click();
        assert.equal(await page.getByRole('button', { name: 'Recording permission', exact: true }).count(), 0);
        assert.deepEqual(errors, []); assert(stateReads >= 4);
        await context.close();
        console.log(`PASS Classroom ${theme} ${width}: consent, retry, pending guard, persisted choices, withdrawal, icons, device/history/call controls, material library`);
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
