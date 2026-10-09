// Run against the tutor app with isolated API fixtures.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.TUTOR_TEST_URL || 'http://localhost:5173';
const bookingId = 'report-layout-test';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1566, 375]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })), theme);
      let status = 'submitted';
      await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(localhost|127\.0\.0\.1):8765)\//, route => {
        const path = new URL(route.request().url()).pathname;
        const user = { userId: 'report-tutor', firstName: 'Test', email: 'paulanthonyarriola@gmail.com', role: 'tutor' };
        let response = { success: true, user, data: [], lessons: [], articles: [], archives: [] };
        if (path === '/notifications') response.data = { notifications: [], unreadCount: 0 };
        if (path === '/notifications/unread-count') response.data = { unreadCount: 0 };
        if (path === '/schedule/week') response.data = { slots: [], weekStart: '2026-10-05', weekEnd: '2026-10-11' };
        if (path === `/schedule/tutor-lesson/${bookingId}`) response.data = { bookingId, studentId: 'report-student', slotDate: '2026-10-08', slotTime: '6:00 PM', status: 'completed', durationMinutes: 25 };
        if (path === '/tutor/student/report-student') response.data = { id: 'report-student', givenName: 'Test', familyName: 'Student', country: 'Japan', joinDate: '2026-04-03', totalLessons: 14, hobbies: [] };
        if (path === `/tutor/lesson-notes-edit-window/${bookingId}`) response.data = { startsAt: '2026-10-08T10:00:00Z', editableUntil: '2026-10-10T10:25:00Z', serverNow: new Date().toISOString(), reason: null };
        if (path.endsWith('/trouble-report')) response.data = {
          startsAt: '2026-10-08T10:00:00Z', endsAt: '2026-10-08T10:25:00Z', serverNow: new Date().toISOString(),
          report: { id: 'own-report', createdAt: '2026-10-08T10:05:00Z', studentIssueLabel: 'Student is late', status,
            ...(status === 'resolved' ? { resolution: 'Support reviewed the classroom attendance records.', attendanceCorrection: 'present', ticketTransactionId: 'refund-' + '0123456789'.repeat(15) } : {}) },
          studentReport: { id: 'received-report', createdAt: '2026-10-08T10:10:00Z', status, reason: 'Tutor-related issue', tutorIssueLabel: 'Tutor disconnected during the lesson', duration: 'up_to_ten', details: 'The tutor disconnected during the lesson.\nI waited for the tutor to return.', resolution: status === 'resolved' ? 'The report has been reviewed by support.' : '' },
        };
        return route.fulfill({ json: response });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (status of ['submitted', 'under_review', 'resolved']) {
        await page.goto(`${base}/lesson/${bookingId}`, { waitUntil: 'domcontentloaded' });
        const panels = page.locator('.lesson-report-outcome');
        await panels.first().waitFor();
        assert.equal(await panels.count(), 2);
        assert.equal(await panels.first().locator('.lesson-report-issue').innerText(), 'Student is late');
        assert.equal(await panels.first().locator('.lesson-report-status').innerText(), status === 'resolved' ? 'Resolved' : status === 'under_review' ? 'Under review' : 'Submitted');
        for (const panel of await panels.all()) {
          assert.equal(await panel.evaluate(el => el.scrollWidth <= el.clientWidth), true, 'Report content must fit its panel');
          assert.equal(await panel.evaluate(el => getComputedStyle(el).borderTopWidth), '1px');
          const box = await panel.boundingBox();
          assert.ok(box.x >= 0 && box.x + box.width <= width, 'Panel must fit the viewport');
        }
        await page.locator('.lesson-issue-report-btn.report-received').click();
        await page.waitForTimeout(700);
        assert.ok(await page.locator('#student-lesson-report').evaluate(el => el.getBoundingClientRect().top >= 0 && el.getBoundingClientRect().top < innerHeight), 'Received report button scrolls to the report');
        if (status === 'submitted') {
          await panels.first().scrollIntoViewIfNeeded();
          await page.screenshot({ path: `../output/screenshots/lesson-report-${theme}-${width}.png` });
        }
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${theme} ${width}: report states, wrapping, panel styling, received-report navigation`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
