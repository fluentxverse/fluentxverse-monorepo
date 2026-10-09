const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const bookingId = 'scheduling-guard-browser';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [1566, 375]) {
      for (const role of ['tutor', 'student']) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        const startsAt = new Date(Date.now() - 26 * 60000).toISOString();
        const endsAt = new Date(Date.parse(startsAt) + 25 * 60000).toISOString();
        const tomorrow = new Date(Date.now() + 86400000 + 8 * 3600000).toISOString().slice(0, 10);
        await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(localhost|127\.0\.0\.1):8765)\//, route => {
          const path = new URL(route.request().url()).pathname;
          const user = { userId: `guard-${role}`, firstName: 'Test', givenName: 'Test', email: 'paulanthonyarriola@gmail.com', role };
          let json = { success: true, user, data: [], lessons: [], articles: [], archives: [] };
          if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
          if (path === '/notifications/unread-count') json.data = { unreadCount: 0 };
          if (path === '/schedule/week') json.data = {
            weekStart: '2026-10-05', weekEnd: '2026-10-11', schedulingBlock: { active: true, expiresAt: new Date(Date.now() + 86400000).toISOString() },
            slots: [{ date: tomorrow, time: '09:00', status: 'booked', bookingId, studentId: 'guard-student', studentName: 'Booked Student' }],
          };
          if (path === `/schedule/tutor-lesson/${bookingId}` || path === `/schedule/lesson/${bookingId}`) json.data = {
            bookingId, studentId: 'guard-student', tutorId: 'guard-tutor', tutorName: 'Test Tutor', slotDate: startsAt.slice(0, 10), slotTime: '1:00 PM',
            startsAt, status: 'completed', durationMinutes: 25, bookedAt: startsAt, sessionId: bookingId,
          };
          if (path === '/tutor/student/guard-student') json.data = {
            id: 'guard-student', givenName: 'Booked', familyName: 'Student', country: 'Japan', joinDate: '2026-04-03', totalLessons: 4, hobbies: [],
          };
          if (path.endsWith('/trouble-report') || path.endsWith('/issue-report')) json.data = {
            startsAt, endsAt, lessonEndsAt: endsAt, serverNow: new Date().toISOString(), eligible: false, reason: 'tutor_joined', report: null,
          };
          if (path === `/tutor/lesson-notes-edit-window/${bookingId}`) json.data = { startsAt, editableUntil: new Date(Date.now() + 48 * 3600000).toISOString(), serverNow: new Date().toISOString(), reason: null };
          if (path.includes('/lesson-recap/')) json.data = { startsAt, materials: [], studentAttendance: 'present', studentComment: '' };
          if (path.includes('/lesson-material-request/')) json.data = { request: null, canEdit: false };
          return route.fulfill({ json });
        });
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const base = `http://localhost:${role === 'tutor' ? 5173 : 5174}`;
        if (role === 'tutor') {
          await page.goto(`${base}/schedule`, { waitUntil: 'domcontentloaded' });
          await page.getByText('New lesson bookings are temporarily blocked.', { exact: true }).waitFor();
          assert.equal(await page.locator('.pending-lesson-notes').count(), 0, 'Schedule must not display the pending-notes list');
          assert.equal(await page.getByText(/Pending lesson notes/).count(), 0);
          await page.getByRole('button', { name: /morning/i }).click();
          assert(await page.getByRole('button', { name: 'Open lesson with Booked Student', exact: true }).isEnabled());
          assert.equal(await page.getByRole('button', { name: /^AVAILABLE / }).count(), 0);
        }
        await page.goto(`${base}/lesson/${bookingId}`, { waitUntil: 'domcontentloaded' });
        if (role === 'tutor') {
          await page.locator('.lesson-notes-card').waitFor();
          assert(await page.locator('.enter-classroom-btn').first().isEnabled());
        } else {
          await page.getByText('Lesson Wrap-up', { exact: true }).waitFor();
          assert(await page.locator('.btn-join-classroom').isEnabled());
        }
        assert.deepEqual(errors, []);
        console.log(`PASS ${role} ${width}: completed lesson permits wrap-up re-entry${role === 'tutor' ? '; block notice and protected booked slots' : ''}`);
        await context.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
