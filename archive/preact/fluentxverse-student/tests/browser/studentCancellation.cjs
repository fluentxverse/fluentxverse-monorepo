const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.STUDENT_TEST_URL || 'http://localhost:5174';
const initialNow = Date.parse('2026-10-07T06:00:00Z');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1566, 375]) {
      let startsAt = initialNow - 3600_000, status = 'confirmed';
      const writes = [], errors = [];
      const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'America/Los_Angeles' });
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })), theme);
      await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):8765|https:\/\/api\.fluentxverse\.(?:com|xyz))\//, async route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        const reply = json => route.fulfill({ json });
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
        const user = { userId: 'cancellation-test', role: 'student', firstName: 'Test', email: 'paulanthonyarriola@gmail.com' };
        const lesson = { bookingId: 'cancel-test', tutorId: 'test-tutor', tutorName: 'Test Tutor', startsAt: new Date(startsAt).toISOString(),
          slotDate: '2026-10-07', slotTime: new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }).format(new Date(startsAt)), durationMinutes: 25, status, bookedAt: '2026-10-01T00:00:00Z' };
        if (path === '/student/me') return reply({ success: true, user });
        if (path === '/schedule/cancel') { writes.push(request.postDataJSON()); return reply({ success: true, refunded: false, message: 'Booking cancelled.' }); }
        if (path.startsWith('/schedule/lesson/')) return reply({ success: true, data: lesson });
        if (path === '/schedule/student-bookings') return reply({ success: true, data: [lesson] });
        if (path.startsWith('/schedule/lesson-material-request/')) return reply({ success: true, data: { canRequestMaterial: false, materialRequest: null } });
        if (path.endsWith('/issue-report')) return reply({ success: true, data: { eligible: false, report: null, reason: 'expired', serverNow: new Date(initialNow).toISOString() } });
        if (path.startsWith('/schedule/lesson-recap/')) return reply({ success: true, data: { materials: [], studentAttendance: null, studentComment: '' } });
        return reply({ success: true, data: [], user, profile: {} });
      });
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      const checkCardSizes = async () => {
        const sizes = await page.locator('.lesson-grid > div > .lesson-card').evaluateAll(cards => cards.map(card => ({ width: card.getBoundingClientRect().width, height: card.getBoundingClientRect().height })));
        assert.equal(sizes.length, 2);
        if (width > 1024) {
          assert(Math.abs(sizes[0].width - sizes[1].width) < 1, 'Desktop cards have equal widths');
          assert(Math.abs(sizes[0].height - sizes[1].height) < 1, 'Desktop cards have equal heights');
        }
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Cards do not overflow on mobile');
      };
      await page.clock.install({ time: initialNow });
      await page.goto(`${base}/lesson/cancel-test`);
      await page.getByRole('heading', { name: 'Lesson Ended', exact: true }).waitFor();
      await page.locator('.student-attendance strong').waitFor();
      assert.equal(await page.locator('.student-attendance strong').textContent(), 'Present', 'Unmarked attendance defaults to Present');
      assert.equal(await page.locator('.lesson-cancel-btn-card').count(), 0);
      assert.equal(await page.getByText('Not Yet Available', { exact: true }).count(), 0);
      await checkCardSizes();
      await page.screenshot({ path: `/tmp/student-ended-lesson-${theme}-${width}.png`, fullPage: true });
      startsAt = initialNow - 60_000;
      await page.reload(); await page.getByRole('button', { name: /Enter Classroom/ }).waitFor();
      await checkCardSizes();
      assert.equal(await page.locator('.lesson-cancel-btn-card').count(), 0);
      await page.clock.setSystemTime(initialNow);
      startsAt = initialNow + 360_000;
      await page.reload(); await page.locator('.lesson-cancel-btn-card').click();
      await page.locator('.cancel-modal').waitFor();
      await page.clock.fastForward(62_000);
      await page.waitForFunction(() => !document.querySelector('.cancel-modal'));
      assert.equal(await page.locator('.cancel-modal').count(), 0, 'An open confirmation expires five minutes before the lesson');
      assert.equal(await page.locator('.lesson-cancel-btn-card').count(), 0);
      assert.equal(writes.length, 0);
      await page.clock.fastForward(30 * 60_000);
      await page.getByRole('heading', { name: 'Lesson Ended', exact: true }).waitFor();
      await page.clock.setSystemTime(initialNow);
      startsAt = initialNow - 60_000;
      await page.goto(`${base}/schedule`); await page.locator('.schedule-card').waitFor();
      assert.equal(await page.locator('.schedule-card .action-btn.cancel').count(), 0, 'Ongoing schedule items have no cancel action');
      startsAt = initialNow + 360_000;
      await page.reload(); await page.locator('.schedule-card .action-btn.cancel').click();
      await page.clock.fastForward(62_000);
      await page.waitForFunction(() => !document.querySelector('.cancel-modal'));
      assert.equal(await page.locator('.cancel-modal').count(), 0);
      assert.equal(await page.locator('.schedule-card .action-btn.cancel').count(), 0);
      assert.equal(writes.length, 0);
      await page.clock.setSystemTime(initialNow);
      startsAt = initialNow + 3600_000;
      await page.goto(`${base}/lesson/cancel-test`); await page.locator('.lesson-cancel-btn-card').click();
      await checkCardSizes();
      await page.locator('.cancel-modal-btn.danger').click();
      await page.locator('.lesson-notification').waitFor(); assert.equal(writes.length, 1);
      assert.deepEqual(errors, []);
      console.log(`PASS ${theme} ${width}: stale confirmed lessons, ongoing lessons, start/end boundaries, expiring confirmations, schedule actions and future cancellation`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
