const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.STUDENT_TEST_URL || 'http://localhost:5174';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64');

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1566, 375]) for (const valid of [true, false]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })), theme);
      const requests = [], errors = [];
      const startsAt = new Date(Date.now() + 3600000);
      const tutor = { userId: 'media-tutor', firstName: 'Paul', lastName: 'Arriola', displayName: 'Paul Arriola', email: 'tutor@example.com', tier: 1, profilePicture: 'https://api.fluentxverse.xyz/lesson/files/user/media-tutor/profile/photo.png', education: [], interests: [], specializations: [], languages: [], reviews: [] };
      const lesson = { bookingId: 'media-lesson', tutorId: tutor.userId, tutorName: tutor.displayName, tutorAvatar: tutor.profilePicture,
        slotDate: new Date(startsAt.getTime() + 8 * 3600000).toISOString().slice(0, 10), slotTime: new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }).format(startsAt), startsAt: startsAt.toISOString(), status: 'confirmed', durationMinutes: 25, bookedAt: new Date().toISOString() };
      await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(localhost|127\.0\.0\.1):8765)\//, route => {
        const path = new URL(route.request().url()).pathname.replace(/\/$/, '');
        const user = { userId: 'media-student', role: 'student', firstName: 'Test', givenName: 'Test', email: 'student@example.com' };
        let json = { success: true, user, data: [], profile: {}, isFavorite: false };
        if (path.startsWith('/lesson/files/user/')) return valid ? route.fulfill({ contentType: 'image/png', body: png }) : route.fulfill({ status: 404, json: { error: 'File not found' } });
        if (path === '/schedule/student-bookings') json.data = [lesson];
        if (path === '/schedule/lesson/media-lesson') json.data = lesson;
        if (path === '/schedule/student-stats') json.data = { lessonsCompleted: 0, upcomingLessons: 1, totalHours: 0, nextLesson: lesson };
        if (path === '/student/favorites') json.data = { favorites: [{ id: 'favorite', tutorId: tutor.userId, tutorName: tutor.displayName, tutorAvatar: tutor.profilePicture }], total: 1, totalPages: 1 };
        if (path === '/tutor/media-tutor') json.data = tutor;
        if (path === '/tutor/search') json.data = { tutors: [tutor], total: 1, page: 1, limit: 12, hasMore: false };
        if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        if (path === '/notifications/unread-count') json.data = { unreadCount: 0 };
        if (path.endsWith('/issue-report')) json.data = { eligible: false, reason: 'not_started', report: null, serverNow: new Date().toISOString() };
        if (path.includes('/lesson-material-request/')) json.data = { canRequestMaterial: true, materialRequest: null };
        if (path.includes('/lesson-recap/')) json.data = { materials: [], studentAttendance: 'present', studentComment: '' };
        return route.fulfill({ json });
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.setDefaultNavigationTimeout(60000);
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => requests.push(request.url()));
      const check = async selector => {
        await page.locator(selector).waitFor();
        await page.waitForFunction(({ selector, valid }) => {
          const el = document.querySelector(selector);
          return valid ? el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0 : el?.tagName === 'DIV' && el.getAttribute('role') === 'img';
        }, { selector, valid });
      };
      await page.goto(`${base}/schedule`, { waitUntil: 'domcontentloaded' });
      await check('.schedule-card-avatar > :first-child');
      await page.locator('.schedule-card .action-btn.cancel').click();
      await check('.cancel-tutor-avatar > :first-child');
      await page.locator('.cancel-modal .modal-close-btn').click();
      await page.screenshot({ path: `../output/screenshots/student-media-${theme}-${width}-${valid ? 'valid' : 'missing'}.png` });
      await page.goto(`${base}/lesson/media-lesson`, { waitUntil: 'domcontentloaded' });
      await check('.tutor-profile .tutor-avatar');
      await page.goto(`${base}/home`, { waitUntil: 'domcontentloaded' });
      await check('.next-lesson-avatar');
      await check('.favorite-tutor-avatar');
      const notificationCount = () => requests.filter(url => new URL(url).pathname.replace(/\/$/, '') === '/notifications').length;
      const beforeFocus = notificationCount();
      await page.evaluate(() => { for (let i = 0; i < 10; i++) window.dispatchEvent(new Event('focus')); });
      await page.waitForTimeout(300);
      assert.equal(notificationCount(), beforeFocus, 'Focus bursts do not duplicate notification refreshes');
      await page.goto(`${base}/tutor/media-tutor`, { waitUntil: 'domcontentloaded' });
      await check('.profile-avatar-large');
      await page.goto(`${base}/browse-tutors`, { waitUntil: 'domcontentloaded' });
      await check('.tutor-card-new__avatar');
      await page.locator('button.tutor-card-new__cta').click();
      await check('.booking-modal-avatar');
      await page.locator('.booking-modal-close').click();
      const before = requests.filter(url => url.includes('/profile/photo.png')).length;
      await page.waitForTimeout(1200);
      assert.equal(requests.filter(url => url.includes('/profile/photo.png')).length, before, 'Failed images do not retry repeatedly');
      assert.ok(!requests.some(url => url.includes('fluentxverse-seaweed-filer') || url.includes('via.placeholder.com') || new URL(url).hostname === 'api.fluentxverse.xyz'));
      assert.deepEqual(errors, []);
      console.log(`PASS ${theme} ${width} ${valid ? 'valid' : 'missing'}: schedule, cancellation, lesson, home, favorites, tutor profile and browsing media`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
