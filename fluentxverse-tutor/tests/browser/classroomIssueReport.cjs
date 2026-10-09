// Mocked APIs never write to the real database.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  await fs.mkdir('../output/screenshots', { recursive: true });
  try {
    for (const role of ['student', 'tutor']) for (const theme of ['light', 'dark']) for (const width of [1566, 375]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, permissions: ['camera', 'microphone'] });
      let report = null, eligible = false, submissions = 0, race = false;
      let departureDeadline = null, tutorReturned = false;
      let classroomSocket;
      let reportDelay = 0;
      const errors = [];
      const startsAt = new Date(Date.now() - 5 * 60000).toISOString();
      const endsAt = new Date(Date.now() + 20 * 60000).toISOString();
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })), theme);
      await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(localhost|127\.0\.0\.1):8765)\//, async route => {
        const req = route.request(), path = new URL(req.url()).pathname;
        const user = { userId: `${role}-smoke`, email: 'paulanthonyarriola@gmail.com', role, givenName: 'Smoke', firstName: 'Smoke', tier: 1 };
        let json = { success: true, data: [], profile: {}, user };
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
        if (path.endsWith('/socket-token')) json = { success: true, token: 'test-only-token' };
        if (path === '/schedule/week') json.data = { slots: [], weekStart: '2026-10-05', weekEnd: '2026-10-11' };
        if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        if (path === '/notifications/unread-count') json.data = { unreadCount: 0 };
        if (path.startsWith('/tutor/classroom-lesson-notes/')) json.data = { materials: [], studentComment: '', tutorMemo: '', updatedAt: null };
        if (path.endsWith('/issue-report') || path.endsWith('/trouble-report')) {
          if (req.method() === 'POST') {
            submissions++;
            if (report || race) {
              report = { id: 'report-from-other-tab', status: 'submitted', createdAt: startsAt };
              return route.fulfill({ status: 409, json: { success: false, error: 'An issue has already been reported for this lesson' } });
            }
            report = { id: 'report-one', ...req.postDataJSON(), status: 'submitted', createdAt: startsAt };
            return route.fulfill({ json: { success: true, data: report } });
          }
          const waitingForReturn = departureDeadline && Date.now() < departureDeadline;
          if (reportDelay) await new Promise(resolve => setTimeout(resolve, reportDelay));
          json.data = { startsAt, endsAt, lessonEndsAt: endsAt, closesAt: new Date(Date.now() + 48 * 3600000).toISOString(), serverNow: new Date().toISOString(),
            eligible: eligible && !report && !waitingForReturn && !tutorReturned,
            reason: tutorReturned ? 'tutor_joined' : waitingForReturn ? 'tutor_disconnected_wait' : eligible ? null : 'waiting_for_tutor',
            availableAt: departureDeadline ? new Date(departureDeadline).toISOString() : null,
            duringLessonTutorIssue: departureDeadline ? 'left_early' : 'no_show', report };
        }
        return route.fulfill({ json });
      });
      await context.routeWebSocket('**/socket.io/**', ws => {
        classroomSocket = ws;
        ws.onMessage(message => {
          const raw = String(message);
          if (raw.startsWith('40')) ws.send('40' + JSON.stringify({ sid: `socket-${role}` }));
          if (raw === '2') ws.send('3');
          if (raw.startsWith('42') && raw.includes('session:join')) ws.send('42' + JSON.stringify(['session:state', { sessionId: 'classroom-report-smoke', startsAt, endsAt, serverNow: new Date().toISOString(), status: 'waiting', participants: {} }]));
          const match = raw.match(/^42(\d+)(\[.*\])$/);
          if (match && JSON.parse(match[2])[0] === 'webrtc:ice-config') ws.send(`43${match[1]}[${JSON.stringify({ iceServers: [] })}]`);
        });
        ws.send('0' + JSON.stringify({ sid: `engine-${role}`, upgrades: [], pingInterval: 9000000, pingTimeout: 9000000, maxPayload: 1000000 }));
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://localhost:${role === 'tutor' ? 5173 : 5174}/classroom/classroom-report-smoke`, { waitUntil: 'domcontentloaded' });
      const button = page.getByRole('button', { name: 'Report issue', exact: true });
      await button.waitFor();
      assert(await button.isDisabled(), 'Reporting is disabled outside eligibility');
      if (role === 'student') {
        const status = page.locator('.student-issue-report-control [role="status"]');
        await status.getByText('Not available yet', { exact: true }).waitFor();
        reportDelay = 1000;
        const checking = page.waitForRequest(request => request.url().endsWith('/issue-report') && request.method() === 'GET');
        const checked = page.waitForResponse(response => response.url().endsWith('/issue-report'));
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await checking;
        await page.waitForTimeout(150);
        assert.equal(await status.textContent(), 'Not available yet', 'Background refresh preserves the status text');
        await checked;
        reportDelay = 0;
      }
      eligible = true;
      if (role === 'student') departureDeadline = Date.now() + 2000;
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await button.waitFor({ state: 'visible' });
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Report issue' && !button.disabled));
      if (role === 'student') {
        await button.click();
        await page.getByRole('button', { name: '10 minutes or less', exact: true }).click();
        await page.getByRole('radio', { name: 'Tutor-related issue', exact: true }).check();
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await page.getByRole('radio', { name: 'Tutor left early or ended the lesson early', exact: true }).check();
        assert.equal(await page.getByRole('radio', { name: 'Tutor did not join the classroom', exact: true }).count(), 0);
        await page.screenshot({ path: `../output/screenshots/student-tutor-disconnected-${theme}-${width}.png` });
        tutorReturned = true;
        classroomSocket.send('42' + JSON.stringify(['classroom:activity-log', { id: 'tutor-returned', sessionId: 'classroom-report-smoke', userId: 'tutor-smoke', userType: 'tutor', eventType: 'entered', createdAt: new Date().toISOString(), message: 'Tutor returned.' }]));
        await page.getByRole('alert').filter({ hasText: 'The tutor is in the classroom' }).waitFor();
        assert(await page.getByRole('button', { name: 'Submit report', exact: true }).isDisabled());
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        assert.equal(submissions, 0, 'Returning tutor prevents a report from the open form');
        tutorReturned = false; departureDeadline = Date.now() + 1500;
        classroomSocket.send('42' + JSON.stringify(['classroom:activity-log', { id: 'tutor-left-again', sessionId: 'classroom-report-smoke', userId: 'tutor-smoke', userType: 'tutor', eventType: 'left', createdAt: new Date().toISOString(), message: 'Tutor left.' }]));
        await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Report issue' && !button.disabled));
        departureDeadline = null;
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'No horizontal overflow');
      await page.screenshot({ path: `../output/screenshots/classroom-report-${role}-${theme}-${width}.png` });
      const selectIssue = async () => {
        await button.click();
        await page.getByRole('button', { name: '10 minutes or less', exact: true }).click();
        if (role === 'student') await page.getByRole('radio', { name: 'Audio or microphone problem', exact: true }).check();
        else await page.getByRole('button', { name: 'Audio or microphone problem', exact: true }).click();
      };
      await selectIssue();
      const dialog = page.getByRole('dialog');
      assert.equal(await dialog.count(), 1);
      const bounds = await dialog.boundingBox();
      assert(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width + 1 && bounds.y + bounds.height <= 901);
      await page.screenshot({ path: `../output/screenshots/classroom-report-dialog-${role}-${theme}-${width}.png` });
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(submissions, 0, 'Cancelling does not submit');
      await selectIssue();
      if (role === 'tutor') {
        await page.getByRole('button', { name: 'Student-related issue', exact: true }).click();
        assert.equal(await page.getByRole('button', { name: 'Submit Report', exact: true }).count(), 0);
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        const submit = page.getByRole('button', { name: 'Submit Report', exact: true });
        assert(await submit.isDisabled(), 'A student-related subtype is required');
        await page.getByRole('button', { name: 'Student is late', exact: true }).click();
        await page.getByRole('button', { name: 'Back', exact: true }).click();
        await page.getByRole('button', { name: 'Audio or microphone problem', exact: true }).click();
        assert(await submit.isEnabled(), 'Other reasons retain the two-step flow');
        await page.getByRole('button', { name: 'Student-related issue', exact: true }).click();
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        assert(await submit.isDisabled(), 'Changing reasons clears the previous subtype');
        await page.getByRole('button', { name: width === 375 ? 'Student is late' : 'Student asked to cancel', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('.trouble-report-options button.selected')?.getAttribute('aria-pressed') === 'true');
        assert(await submit.isEnabled());
        await page.waitForFunction(expected => {
          const selected = document.querySelector('.trouble-report-options button.selected');
          return selected && getComputedStyle(selected).backgroundColor === expected;
        }, theme === 'dark' ? 'rgb(36, 64, 100)' : 'rgb(239, 246, 255)');
        assert.equal(await page.locator('.trouble-report-options button.selected').evaluate(el => getComputedStyle(el).backgroundColor), theme === 'dark' ? 'rgb(36, 64, 100)' : 'rgb(239, 246, 255)');
        await page.screenshot({ path: `../output/screenshots/classroom-report-student-issue-${theme}-${width}.png` });
        assert.equal(submissions, 0, 'Next and selecting choices never submit');
      }
      await page.getByRole('button', { name: 'Submit report', exact: false }).click();
      await dialog.waitFor({ state: 'detached' });
      assert.equal(submissions, 1);
      if (role === 'student') {
        reportDelay = 1000;
        const checking = page.waitForRequest(request => request.url().endsWith('/issue-report') && request.method() === 'GET');
        const checked = page.waitForResponse(response => response.url().endsWith('/issue-report'));
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await checking;
        await page.waitForTimeout(150);
        assert.equal(await page.locator('.student-issue-report-control [role="status"]').textContent(), 'Report submitted', 'Submitted status does not flash during refresh');
        await checked;
        reportDelay = 0;
      }
      if (role === 'tutor') {
        assert.equal(report.reason, 'student');
        assert.equal(report.studentIssue, width === 375 ? 'late' : 'asked_to_cancel');
      }
      assert(await page.getByRole('button', { name: 'Issue reported', exact: true }).isDisabled());
      assert(await page.evaluate(() => [...document.querySelectorAll('video')].some(video => video.srcObject?.getAudioTracks().some(track => track.readyState === 'live'))), 'Reporting does not stop the microphone');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Issue reported', exact: true }).waitFor();
      assert(await page.getByRole('button', { name: 'Issue reported', exact: true }).isDisabled(), 'Reload cannot send a second report');
      report = null;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Report issue' && !button.disabled));
      await selectIssue();
      race = true;
      await page.getByRole('button', { name: 'Submit report', exact: false }).click();
      await page.getByRole('alert').filter({ hasText: 'An issue has already been reported' }).waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => /Submit report/i.test(button.textContent) && button.disabled));
      assert(await page.getByRole('button', { name: 'Submit report', exact: false }).isDisabled(), 'A concurrent report disables submission');
      assert.equal(submissions, 2);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS: ${role} ${theme} ${width}: eligibility, modal, cancel, submit, reload, concurrent duplicate, live microphone`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
