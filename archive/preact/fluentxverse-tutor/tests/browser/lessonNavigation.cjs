// Run against port 5173; all API responses are isolated fixtures.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.TUTOR_TEST_URL || 'http://localhost:5173';
const bookingId = 'lesson-navigation-test';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [1566, 375]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(localhost|127\.0\.0\.1):8765)\//, route => {
        const path = new URL(route.request().url()).pathname;
        const user = { userId: 'navigation-tutor', firstName: 'Test', email: 'paulanthonyarriola@gmail.com', role: 'tutor' };
        let response = { success: true, user, data: [], lessons: [], articles: [], archives: [] };
        if (path === '/tutor/me') response = { success: true, user };
        if (path === '/schedule/week') response = { success: true, data: { slots: [], weekStart: '2026-10-05', weekEnd: '2026-10-11' } };
        if (path === '/notifications') response = { success: true, data: { notifications: [], unreadCount: 0 } };
        if (path === '/notifications/unread-count') response = { success: true, data: { unreadCount: 0 } };
        if (path === `/schedule/tutor-lesson/${bookingId}`) response = { success: true, data: {
          bookingId, studentId: 'navigation-student', slotDate: '2026-10-07', slotTime: '1:00 PM', status: 'completed', durationMinutes: 25,
        } };
        if (path === '/tutor/student/navigation-student') response = { success: true, data: {
          id: 'navigation-student', givenName: 'Navigation', familyName: 'Student', country: 'Japan', joinDate: '2026-04-03', totalLessons: 4, hobbies: [],
        } };
        if (path === `/tutor/lesson-notes/${bookingId}`) response = { success: true, data: [] };
        if (path === `/tutor/lesson-notes-edit-window/${bookingId}`) response = { success: true, data: {
          startsAt: '2026-10-07T05:00:00Z', editableUntil: '2026-10-09T05:25:00Z', serverNow: new Date().toISOString(), reason: null,
        } };
        if (path.endsWith('/trouble-report')) response = { success: true, data: {
          startsAt: '2026-10-07T05:00:00Z', endsAt: '2026-10-07T05:25:00Z', serverNow: new Date().toISOString(), report: null,
        } };
        return route.fulfill({ json: response });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
      page.setDefaultTimeout(10000);
      await page.goto(`${base}/lesson/${bookingId}`);
      await page.locator('.lesson-notes-card').waitFor().catch(async error => {
        console.error(await page.locator('body').innerText(), errors);
        throw error;
      });
      const initialHistory = await page.evaluate(() => history.length);
      if (width > 991) await page.locator('.sidebar-icon a[href="/materials"]').click();
      else {
        await page.getByRole('button', { name: 'Open menu' }).click();
        await page.locator('.mobile-menu-nav a[href="/materials"]').click();
      }
      await page.waitForURL(`${base}/materials`);
      assert.equal(await page.evaluate(() => history.length), initialHistory + 1, 'One click creates exactly one history entry');
      await page.goBack();
      await page.waitForURL(`${base}/lesson/${bookingId}`);
      await page.locator('.lesson-notes-card').waitFor();
      await page.goForward();
      await page.waitForURL(`${base}/materials`);
      await page.goBack();
      await page.waitForURL(`${base}/lesson/${bookingId}`);
      await page.locator('.lesson-notes-card').waitFor();
      // Shared header links must not double-push history either.
      await page.locator(width > 991 ? '.inbox-btn' : '.mobile-header-user').click();
      const destination = width > 991 ? '/inbox' : '/profile';
      await page.waitForURL(`${base}${destination}`);
      await page.goBack();
      await page.waitForURL(`${base}/lesson/${bookingId}`);
      await page.locator('.lesson-notes-card').waitFor();
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}: single-entry navigation, Back/Forward lesson restoration, shared header navigation`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
