const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1566, 1024, 768, 375, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 950 }, timezoneId: 'Pacific/Auckland', reducedMotion: 'reduce' });
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })), theme);
      let empty = false, failed = false;
      const bookings = [
        { bookingId: 'future', slotDate: '2026-10-10', slotTime: '11:30 PM', status: 'confirmed' },
        { bookingId: 'deadline', slotDate: '2026-10-10', slotTime: '10:03 PM', status: 'confirmed' },
        { bookingId: 'past-a', slotDate: '2026-10-09', slotTime: '2:00 PM', status: 'completed' },
        { bookingId: 'past-b', slotDate: '2026-10-09', slotTime: '3:00 PM', status: 'completed' },
        { bookingId: 'past-single', slotDate: '2026-10-08', slotTime: '2:00 PM', status: 'completed' },
      ].map(item => ({ ...item, tutorId: 'tutor-fixture', tutorName: 'Christopher Alexandra Montgomery', durationMinutes: 25 }));
      await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780)|https:\/\/api\.fluentxverse\.(?:com|xyz))\//, route => {
        const path = new URL(route.request().url()).pathname;
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
        if (path === '/student/me') return route.fulfill({ json: { success: true, user: { userId: 'schedule-fixture', role: 'student', givenName: 'Mika', walletAddress: '0x' + 'a'.repeat(40) } } });
        if (path === '/schedule/student-bookings' && failed) return route.fulfill({ status: 503, json: { success: false } });
        return route.fulfill({ json: { success: true, data: path === '/schedule/student-bookings' && !empty ? bookings : [], profile: {}, lessons: [] } });
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.install({ time: new Date('2026-10-10T14:00:00Z') });
      const checkLayout = async state => {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        const result = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          fits: [...document.querySelectorAll('.schedule-card,.action-btn,.past-calendar')].every(el => el.scrollWidth <= el.clientWidth),
          heading: document.querySelector('.schedule-header').getBoundingClientRect().top >= document.querySelector('.app-header-shell').getBoundingClientRect().bottom,
        }));
        assert.equal(result.overflow, false); assert.ok(result.fits && result.heading, JSON.stringify(result));
        await page.screenshot({ path: '../output/screenshots/schedule-' + theme + '-' + width + '-' + state + '.png', fullPage: true });
      };
      await page.goto(base + '/schedule', { waitUntil: 'domcontentloaded' });
      await page.locator('.schedule-card').first().waitFor();
      await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
      await page.locator('.schedule-art').evaluateAll(images => Promise.all(images.map(img => img.decode())));
      assert.equal(await page.locator('.schedule-card').count(), 2);
      const future = page.locator('.schedule-card').filter({ has: page.locator('a[href="/lesson/future"]') });
      const deadline = page.locator('.schedule-card').filter({ has: page.locator('a[href="/lesson/deadline"]') });
      assert.match(await future.locator('.date-day').textContent(), /11/);
      assert.equal(await future.getByRole('button', { name: 'Cancel', exact: true }).count(), 0);
      assert.equal(await deadline.getByRole('button', { name: 'Cancel', exact: true }).count(), 0);
      assert.equal(await future.getByRole('link', { name: 'Open Lesson', exact: true }).getAttribute('href'), '/lesson/future');
      assert.equal(await future.getByRole('link', { name: 'View Tutor', exact: true }).getAttribute('href'), '/tutor/tutor-fixture');
      await checkLayout('upcoming');
      await page.getByRole('button', { name: /Past Lessons/ }).click();
      await page.getByRole('button', { name: 'Friday, October 9, 2026: 2 lessons' }).click();
      assert.equal(await page.locator('.past-calendar-lesson').count(), 2);
      assert.equal(await page.locator('a[href="/lesson/past-single"]').count(), 1);
      await checkLayout('past');
      empty = true;
      await page.goto(base + '/schedule');
      await page.getByRole('heading', { name: 'No Upcoming Lessons' }).waitFor();
      await checkLayout('empty');
      failed = true;
      await page.reload();
      await page.getByRole('heading', { name: 'Error Loading Schedule' }).waitFor();
      await checkLayout('error');
      assert.deepEqual(errors, []);
      console.log('PASS Schedule ' + theme + ' ' + width + ': JST dates, no cancellation action, lesson/tutor links, multi-lesson calendar, empty/error, layout');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
