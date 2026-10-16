const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5188';
const shots = resolve(__dirname, '../../output/screenshots');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  mkdirSync(shots, { recursive: true });
  try {
    for (const width of JSON.parse(process.env.TRIAL_TEST_WIDTHS || '[1440,768,375,320]')) {
      const context = await browser.newContext({ viewport: { width, height: 950 }, timezoneId: 'Asia/Tokyo' });
      await context.addInitScript(dark => { if (/^https?:$/.test(location.protocol)) localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: dark ? 'dark' : 'light', isDarkMode: dark }, version: 2 })); }, width === 375);
      let signedIn = true, failMode = false, failBooking = false, loseResponse = true, booked = false;
      const calls = [], errors = [];
      await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780)|https:\/\/api\.fluentxverse\.(?:com|xyz))\//, async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname;
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
        calls.push({ path, body: request.postData() });
        const reply = data => route.fulfill({ json: { success: true, data } });
        const tutor = { userId: 'trial-aya', firstName: 'Aya', lastName: 'Nakamura', displayName: 'Aya Nakamura', tier: 1, isAvailable: true, bio: 'Clear English conversations.', profilePicture: '/assets/img/banner/banner_woman.webp' };
        if (path === '/student/me') return signedIn ? route.fulfill({ json: { success: true, user: { userId: 'trial-browser-student', role: 'student', firstName: 'Mika', email: 'trial@example.test' } } }) : route.fulfill({ status: 401, json: { success: false } });
        if (path === '/tutor/search') return reply({ tutors: [tutor], total: 1, hasMore: false });
        if (path === '/lesson-passes/mode') return failMode ? route.fulfill({ status: 503, json: { success: false, error: 'Trial configuration unavailable' } }) : reply({ mode: 'trial', trialLessonLimit: 1 });
        if (path.startsWith('/schedule/available/')) return reply([{ slotId: 'trial-browser-slot', tutorId: tutor.userId, date: url.searchParams.get('startDate'), time: '22:00', durationMinutes: 25 }]);
        if (path === '/schedule/reserve') return reply({ reservationId: 'trial-browser-reservation', expiresAt: new Date(Date.now() + 120000).toISOString(), bookBy: new Date(Date.now() + 120000).toISOString() });
        if (path === '/schedule/book') {
          assert.deepEqual(request.postDataJSON(), { slotId: 'trial-browser-slot', reservationId: 'trial-browser-reservation' });
          if (failBooking) return route.fulfill({ status: 400, json: { success: false, error: 'Your free trial allowance has already been used or reserved' } });
          booked = true;
          if (loseResponse) { loseResponse = false; return route.fulfill({ status: 503, json: { success: false, error: 'Response interrupted' } }); }
          return reply({ bookingId: 'trial-booking', paymentMethod: 'trial' });
        }
        if (path.startsWith('/schedule/reservation/')) return reply({ state: booked ? 'booked' : 'held', bookingId: booked ? 'trial-booking' : undefined });
        if (path === '/schedule/student-stats') return reply({ lessonsCompleted: 0, upcomingLessons: 0, totalHours: 0 });
        if (path === '/schedule/student-activity') return reply([{ type: 'ticket_purchased', action: 'Purchased legacy tickets', date: 'Yesterday' }]);
        if (path === '/student/favorites') return reply({ favorites: [], total: 0, page: 1, limit: 4, totalPages: 0 });
        if (path.startsWith('/tickets/')) throw new Error('Trial launch requested tickets');
        return reply([]);
      });
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/home`, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: /Welcome back/ }).waitFor();
      if (width === 320) {
        const bounds = await page.evaluate(() => {
          const bell = document.querySelector('.student-notification-bell').getBoundingClientRect(), menu = document.querySelector('.mobile-nav-toggler').getBoundingClientRect();
          return { bellRight: bell.right, menuLeft: menu.left, bellBottom: bell.bottom, headerBottom: document.querySelector('.menu-wrap').getBoundingClientRect().bottom,
            wrapPadding: getComputedStyle(document.querySelector('.menu-wrap')).padding,
            navPadding: getComputedStyle(document.querySelector('.menu-nav')).padding,
            navDisplay: getComputedStyle(document.querySelector('.menu-nav')).display,
            bellMargin: getComputedStyle(document.querySelector('.student-notification-bell')).margin,
            brandWidth: document.querySelector('.brand-lockup').getBoundingClientRect().width };
        });
        assert(bounds.bellRight <= bounds.menuLeft, `Header controls do not overlap: ${JSON.stringify(bounds)}`);
        assert(bounds.bellBottom <= bounds.headerBottom, 'Notification button stays inside the header');
      }
      assert.equal(await page.locator('a[href="/tickets"]').count(), 0);
      assert.equal(await page.locator('.student-home-tickets').count(), 0);
      assert.equal(await page.getByText('Purchased legacy tickets').count(), 0);
      await page.screenshot({ path: resolve(shots, `trial-launch-home-${width}.png`), fullPage: true });
      await page.goto(`${base}/tickets`, { waitUntil: 'networkidle' });
      await page.waitForURL('**/browse-tutors', { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Aya Nakamura', exact: true }).waitFor();
      assert.equal(await page.locator('a[href="/tickets"]').count(), 0);
      await page.getByRole('button', { name: /Tomorrow/ }).click();
      await page.getByRole('button', { name: 'Show schedule for Aya Nakamura', exact: true }).click();
      await page.getByRole('button', { name: '23:00 JST', exact: true }).click();
      assert(await page.getByRole('button', { name: 'Book Free Trial', exact: true }).evaluate(n => n.scrollWidth <= n.clientWidth));
      await page.screenshot({ path: resolve(shots, `trial-launch-selection-${width}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Book Free Trial', exact: true }).click();
      await page.getByRole('heading', { name: 'Booking Confirmed!', exact: true }).waitFor();
      assert.equal(calls.filter(c => c.path === '/schedule/reserve').length, 1);
      assert.equal(calls.filter(c => c.path === '/schedule/book').length, 2, 'Interrupted confirmation retries the same reservation');
      assert(!calls.some(c => c.path.startsWith('/tickets/')));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: resolve(shots, `trial-launch-booking-${width}.png`), fullPage: true });
      await page.reload({ waitUntil: 'networkidle' });
      failBooking = true; booked = false;
      await page.getByRole('button', { name: /Tomorrow/ }).click();
      await page.getByRole('button', { name: 'Show schedule for Aya Nakamura', exact: true }).click();
      await page.getByRole('button', { name: '23:00 JST', exact: true }).click();
      await page.getByRole('button', { name: 'Book Free Trial', exact: true }).click();
      await page.locator('.booking-modal-error').filter({ hasText: 'allowance' }).waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem('fxv:pending-trial-booking:trial-browser-student')), null);
      assert(calls.some(c => c.path === '/schedule/release-reservation'));
      assert.deepEqual(errors, []);
      await page.reload({ waitUntil: 'networkidle' }); failMode = true;
      await page.getByRole('button', { name: 'Show schedule for Aya Nakamura', exact: true }).click();
      await page.locator('.booking-modal-error').filter({ hasText: 'configuration' }).waitFor();
      signedIn = false; failMode = false;
      await page.goto(`${base}/`, { waitUntil: 'networkidle' });
      assert.equal(await page.locator('.pricing-section').count(), 0);
      assert.equal(await page.locator('a[href="/tickets"]').count(), 0);
      assert.equal(await page.getByText('Free Trial Lesson', { exact: true }).count(), 1);
      await page.goto(`${base}/browse-tutors`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /Tomorrow/ }).click();
      await page.getByRole('button', { name: 'Show schedule for Aya Nakamura', exact: true }).click();
      await page.getByRole('button', { name: '23:00 JST', exact: true }).click();
      await page.getByRole('button', { name: 'Sign In to Book', exact: true }).click();
      await page.locator('.social-login-modal').waitFor();
      assert(!calls.some(c => c.path.startsWith('/tickets/')));
      await context.close();
      console.log(`PASS trial launch ${width}: ticket UI hidden, redirects, wallet-free booking, retry, allowance errors and fail-closed configuration`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
