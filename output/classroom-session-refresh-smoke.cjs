const { chromium } = require('/home/paulanthonyarriola/.local/lib/python3.14/site-packages/playwright/driver/package');
const assert = require('node:assert/strict');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check) {
  for (let i = 0; i < 100; i++) {
    if (await check()) return;
    await sleep(100);
  }
  throw new Error('Timed out waiting for browser assertion');
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  try {
    for (const role of ['student', 'tutor']) {
      const context = await browser.newContext({ viewport: { width: role === 'student' ? 375 : 1280, height: 900 }, permissions: ['camera', 'microphone'] });
      let renewals = 0;
      let failNext = false;
      let holdNext = false;
      let releaseRenewal;
      let logoutRequests = 0;
      let signedOut = false;
      const user = { userId: `${role}-smoke`, email: 'paulanthonyarriola@gmail.com', role, givenName: 'Smoke', firstName: 'Smoke', tier: 1 };
      await context.route('https://api.fluentxverse.xyz/**', async route => {
        const path = new URL(route.request().url()).pathname;
        const renewal = path === (role === 'student' ? '/student/me' : '/tutor/refresh');
        if (renewal) {
          renewals++;
          if (failNext) {
            failNext = false;
            return route.fulfill({ status: 503, json: { message: 'Temporary unavailable' } });
          }
          if (holdNext) {
            holdNext = false;
            await new Promise(resolve => { releaseRenewal = resolve; });
          }
        }
        if (path.endsWith('/logout')) { logoutRequests++; signedOut = true; }
        if (signedOut && path.endsWith('/me')) return route.fulfill({ status: 401, json: { message: 'Signed out' } });
        let json = { success: true, data: [], profile: {}, user };
        if (path.endsWith('/me')) json = { user };
        if (path.endsWith('/socket-token')) json = { success: true, token: 'test-only-token' };
        if (path === '/schedule/week') json = { success: true, data: { slots: [], weekStart: '2026-10-05', weekEnd: '2026-10-11' } };
        if (path === '/notifications') json = { success: true, data: { notifications: [], unreadCount: 0 } };
        if (path === '/notifications/unread-count') json = { success: true, data: { unreadCount: 0 } };
        return route.fulfill({ json });
      });
      await context.routeWebSocket('wss://ws.fluentxverse.xyz/**', ws => {
        ws.onMessage(message => {
          if (String(message).startsWith('40')) return ws.send('40{"sid":"smoke-socket"}');
          const match = String(message).match(/^42(\d*)(\[.*\])$/);
          if (!match) return;
          const [event] = JSON.parse(match[2]);
          if (event === 'session:join') ws.send('42' + JSON.stringify(['session:state', {
            sessionId: 'lifecycle-smoke', status: 'active',
            participants: { studentId: role === 'student' ? 'student-smoke' : 'peer-student', tutorId: role === 'tutor' ? 'tutor-smoke' : 'peer-tutor' },
          }]));
          if (event === 'webrtc:ice-config' && match[1]) ws.send(`43${match[1]}[{"iceServers":[]}]`);
          if (event === 'webrtc:offer' && match[1]) ws.send(`43${match[1]}[{"delivered":true}]`);
        });
        ws.send('0{"sid":"engine-smoke","upgrades":[],"pingInterval":9000000,"pingTimeout":9000000,"maxPayload":1000000}');
      });
      const page = await context.newPage();
      await page.clock.install();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`https://${role}.fluentxverse.xyz/classroom/lifecycle-smoke?refresh-test=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.locator('[data-call-state]').waitFor();
      await sleep(1000);
      assert.ok(renewals >= (role === 'student' ? 2 : 1), `${role}: missing entry renewal`);
      await page.clock.pauseAt(new Date(Date.now() + 1000));
      for (let step = 0; step < 4; step++) {
        const before = renewals;
        await page.clock.fastForward(10 * 60000 + 1000);
        await until(() => renewals > before);
        await sleep(250);
        assert.equal(await page.locator('.session-modal-overlay').count(), 0);
      }
      console.log(`PASS: ${role} renews silently across 40 classroom minutes, no refresh modal`);
      failNext = true;
      let before = renewals;
      await page.clock.fastForward(10 * 60000 + 1000);
      await until(() => renewals > before);
      await sleep(250);
      before = renewals;
      await page.clock.fastForward(31000);
      await until(() => renewals > before);
      await sleep(250);
      assert.equal(await page.locator('.session-modal-overlay').count(), 0);
      console.log(`PASS: ${role} retries temporary renewal failure without interrupting classroom`);
      await page.screenshot({ path: `output/${role}-automatic-session-refresh.png` });
      await page.evaluate(() => {
        history.pushState(null, '', '/schedule');
        dispatchEvent(new PopStateEvent('popstate'));
      });
      await page.locator('[data-call-state]').waitFor({ state: 'detached' });
      await page.clock.runFor(1000);
      await sleep(500);
      before = renewals;
      await page.clock.fastForward(27 * 60000 + 1000);
      await sleep(500);
      assert.equal(renewals, before, `${role}: renewal leaked after navigation`);
      assert.equal(await page.locator('.session-modal-overlay').count(), 1);
      console.log(`PASS: ${role} stops automatic renewal on leaving classroom; manual warning remains elsewhere`);
      if (role === 'tutor') {
        await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
        await page.evaluate(() => {
          history.pushState(null, '', '/classroom/lifecycle-smoke');
          dispatchEvent(new PopStateEvent('popstate'));
        });
        await page.clock.runFor(1000);
        await sleep(250);
        await page.clock.runFor(1000);
        await page.locator('[data-call-state]').waitFor();
        await sleep(500);
        // Hold the next cookie renewal while the user explicitly signs out.
        holdNext = true;
        await page.clock.fastForward(10 * 60000 + 1000);
        await until(() => !!releaseRenewal);
        await page.evaluate(() => {
          history.pushState(null, '', '/schedule');
          dispatchEvent(new PopStateEvent('popstate'));
        });
        await page.clock.runFor(1000);
        await sleep(250);
        await page.locator('[title="Settings"]').first().click();
        await page.getByRole('button', { name: /Sign Out|Log ?out/i }).click();
        await sleep(300);
        assert.equal(logoutRequests, 0, 'Logout must wait for pending cookie renewal');
        releaseRenewal();
        await until(() => logoutRequests === 1);
        console.log('PASS: tutor logout waits for renewal before deleting session');
      }
      assert.deepEqual(errors, [], `${role}: unexpected browser exceptions`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
