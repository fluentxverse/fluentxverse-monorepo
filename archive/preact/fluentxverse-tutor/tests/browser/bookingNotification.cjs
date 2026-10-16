const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.TUTOR_TEST_URL || 'http://localhost:5173';
const bookingId = 'booking-notification-test';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const source of ['dropdown', 'page']) {
      const context = await browser.newContext({ viewport: { width: 1566, height: 900 } });
      let markedRead = false;
      await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(localhost|127\.0\.0\.1):8765)\//, route => {
        const path = new URL(route.request().url()).pathname;
        const user = { userId: 'navigation-tutor', firstName: 'Test', email: 'paulanthonyarriola@gmail.com', role: 'tutor' };
        let response = { success: true, user, data: [], lessons: [], articles: [], archives: [] };
        if (path === '/schedule/week') response.data = { slots: [], weekStart: '2026-10-05', weekEnd: '2026-10-11' };
        if (path === '/notifications') response.data = { notifications: [{
          id: 'booking-notification', type: 'booking_new', title: 'New Session Booked',
          message: 'A student has booked a session.', timestamp: new Date().toISOString(),
          isRead: false, data: { bookingId, link: '/schedule' },
        }], unreadCount: 1 };
        if (path === '/notifications/unread-count') response.data = { unreadCount: 1 };
        if (path === '/notifications/booking-notification/read') markedRead = true;
        if (path === `/schedule/tutor-lesson/${bookingId}`) response.data = {
          bookingId, studentId: 'navigation-student', slotDate: '2026-10-07', slotTime: '1:00 PM', status: 'completed', durationMinutes: 25,
        };
        if (path === '/tutor/student/navigation-student') response.data = {
          id: 'navigation-student', givenName: 'Navigation', familyName: 'Student', country: 'Japan', joinDate: '2026-04-03', totalLessons: 4, hobbies: [],
        };
        if (path === `/tutor/lesson-notes-edit-window/${bookingId}`) response.data = {
          startsAt: '2026-10-07T05:00:00Z', editableUntil: '2026-10-09T05:25:00Z', serverNow: new Date().toISOString(), reason: null,
        };
        if (path.endsWith('/trouble-report')) response.data = {
          startsAt: '2026-10-07T05:00:00Z', endsAt: '2026-10-07T05:25:00Z', serverNow: new Date().toISOString(), report: null,
        };
        return route.fulfill({ json: response });
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/${source === 'dropdown' ? 'schedule' : 'notifications'}`, { waitUntil: 'domcontentloaded' });
      if (source === 'dropdown') await page.locator('.notification-btn').click();
      await page.locator(source === 'dropdown' ? '.notification-item' : '.notification-card').filter({ hasText: 'New Session Booked' }).click();
      await page.waitForURL(`${base}/lesson/${bookingId}`, { waitUntil: 'domcontentloaded' });
      await page.locator('.lesson-notes-card').waitFor();
      assert.equal(markedRead, true);
      assert.deepEqual(errors, []);
      console.log(`PASS ${source}: legacy booking notification marks read and opens matching lesson`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
