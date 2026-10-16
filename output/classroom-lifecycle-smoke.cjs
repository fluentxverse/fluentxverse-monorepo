const { chromium } = require('/home/paulanthonyarriola/.local/lib/python3.14/site-packages/playwright/driver/package');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  try {
    for (const role of process.env.TEST_ROLE ? [process.env.TEST_ROLE] : ['student', 'tutor']) {
      for (const denied of [false, true]) {
        const context = await browser.newContext({ viewport: { width: denied ? 375 : 1280, height: 900 }, permissions: ['camera', 'microphone'] });
        const frames = [];
        let closed = false;
        let send;
        await context.route('https://api.fluentxverse.xyz/**', route => {
          const path = new URL(route.request().url()).pathname;
          const user = { userId: `${role}-smoke`, email: 'paulanthonyarriola@gmail.com', role, givenName: 'Smoke', firstName: 'Smoke', tier: 1 };
          let json = { success: true, data: [], profile: {}, user };
          if (path.endsWith('/me')) json = { user };
          if (path.endsWith('/socket-token')) json = { success: true, token: 'test-only-token' };
          if (path === '/schedule/week') json = { success: true, data: { slots: [], weekStart: '2026-10-05', weekEnd: '2026-10-11' } };
          if (path === '/notifications') json = { success: true, data: { notifications: [], unreadCount: 0 } };
          if (path === '/notifications/unread-count') json = { success: true, data: { unreadCount: 0 } };
          return route.fulfill({ json });
        });
        await context.routeWebSocket('wss://ws.fluentxverse.xyz/**', ws => {
          send = packet => ws.send(packet);
          ws.onClose(() => { closed = true; });
          ws.onMessage(message => {
            frames.push(String(message));
            if (String(message).startsWith('40')) {
              ws.send('40{"sid":"smoke-socket"}');
              return;
            }
            const match = String(message).match(/^42(\d*)(\[.*\])$/);
            if (!match) return;
            const [event] = JSON.parse(match[2]);
            if (event === 'session:join') {
              ws.send('42' + JSON.stringify(['session:state', {
                sessionId: 'lifecycle-smoke', status: 'active',
                participants: { studentId: role === 'student' ? 'student-smoke' : 'peer-student', tutorId: role === 'tutor' ? 'tutor-smoke' : 'peer-tutor' },
              }]));
            }
            if (event === 'webrtc:ice-config' && match[1]) ws.send(`43${match[1]}[{"iceServers":[]}]`);
            if (event === 'webrtc:offer' && match[1]) ws.send(`43${match[1]}[{"delivered":true}]`);
          });
          ws.send('0{"sid":"engine-smoke","upgrades":[],"pingInterval":25000,"pingTimeout":20000,"maxPayload":1000000}');
        });
        await context.addInitScript(({ denied }) => {
          window.__testTracks = [];
          const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
          navigator.mediaDevices.getUserMedia = async constraints => {
            if (denied) throw new DOMException('Permission denied', 'NotAllowedError');
            const stream = await original(constraints);
            window.__testTracks.push(...stream.getTracks());
            return stream;
          };
        }, { denied });
        const page = await context.newPage();
        page.on('pageerror', error => console.error(`${role} page error: ${error.message}`));
        page.on('console', message => {
          if (message.type() === 'error' && message.text().includes('ErrorBoundary')) console.error(`${role}: ${message.text()}`);
        });
        await page.goto(`https://${role}.fluentxverse.xyz/classroom/lifecycle-smoke`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        const banner = page.locator('[data-call-state]');
        try { await banner.waitFor(); } catch (error) {
          await page.screenshot({ path: `output/${role}-call-test-failure.png` });
          console.error(`${role} URL: ${page.url()} body: ${(await page.locator('body').innerText()).slice(0, 1000)}`);
          throw error;
        }
        if (denied) {
          await page.getByText('Failed to access camera or microphone', { exact: true }).waitFor();
          assert.equal(await banner.getAttribute('role'), 'alert');
          await page.screenshot({ path: `output/${role}-call-permission-mobile.png` });
          console.log(`PASS: ${role} media permission failure is visible on mobile`);
        } else {
          await page.getByText('Connecting audio and video...', { exact: true }).waitFor();
          assert.equal(await banner.getAttribute('data-call-state'), 'connecting');
          await page.waitForFunction(() => window.__testTracks.length >= 2);
          send('42' + JSON.stringify(['session:error', { message: 'Test room access failure' }]));
          await banner.getByText('Test room access failure', { exact: true }).waitFor();
          assert.equal(await banner.getAttribute('role'), 'alert');
          await page.screenshot({ path: `output/${role}-call-error-desktop.png` });
          console.log(`PASS: ${role} room presence does not claim media connection; socket errors are visible`);
        }
        await page.evaluate(() => {
          history.pushState(null, '', '/schedule');
          dispatchEvent(new PopStateEvent('popstate'));
        });
        await banner.waitFor({ state: 'detached' });
        await page.waitForTimeout(300);
        assert.ok(frames.some(frame => frame.includes('session:leave')));
        assert.ok(closed || frames.some(frame => frame === '41'));
        assert.ok(await page.evaluate(() => window.__testTracks.every(track => track.readyState === 'ended')));
        console.log(`PASS: ${role} navigation leaves the room, disconnects signaling, and stops media`);
        await context.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
