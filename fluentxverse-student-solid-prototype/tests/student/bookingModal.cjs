const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';
const output = process.env.BOOKING_MODAL_SCREENSHOTS || '/tmp/student-booking-modal';
const widths = (process.env.BOOKING_MODAL_WIDTHS || '1566,768,375,320').split(',').map(Number);
const themes = (process.env.BOOKING_MODAL_THEMES || 'light,dark').split(',');
const tutor = { userId: 'booking-design', firstName: 'Paul Anthony', lastName: 'Arriola', displayName: 'Paul Anthony Arriola',
  tier: 1, isAvailable: true, isVerified: true, rating: 5, totalReviews: 1, profilePicture: '/assets/img/banner/banner_woman.webp' };
const slots = Array.from({ length: 11 }, (_, index) => {
  const minutes = 12 * 60 + 30 + index * 30;
  return { slotId: `design-slot-${index}`, tutorId: tutor.userId, date: '2026-10-17',
    time: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`, durationMinutes: 25 };
});

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  await fs.mkdir(output, { recursive: true });
  try {
    for (const theme of themes) for (const width of widths) {
      let scenario = 'normal', releaseBooking, releaseLoading;
      const writes = [], errors = [];
      const context = await browser.newContext({ viewport: { width, height: 850 }, timezoneId: 'Pacific/Auckland', reducedMotion: 'reduce' });
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })), theme);
      await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780)|https:\/\/api\.fluentxverse\.(?:com|xyz))\//, async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname;
        const headers = { 'access-control-allow-origin': request.headers().origin || base, 'access-control-allow-credentials': 'true',
          'access-control-allow-headers': 'Content-Type, Authorization, Cache-Control, Pragma', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
        const reply = json => route.fulfill({ json, headers });
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        const user = { userId: 'booking-student', role: 'student', givenName: 'Mika' };
        if (path === '/student/me') return reply({ success: true, user });
        if (path === '/lesson-passes/mode') return reply({ success: true, data: { mode: 'trial' } });
        if (path === '/schedule/preload') return reply({ success: true, data: {} });
        if (path === '/tutor/search') return reply({ success: true, data: { tutors: [tutor], total: 1, hasMore: false } });
        if (path.startsWith('/schedule/available/')) {
          if (scenario === 'loading') await new Promise(resolve => { releaseLoading = resolve; });
          if (scenario === 'error') return route.fulfill({ status: 503, json: { error: 'Availability is temporarily unavailable.' }, headers });
          const data = scenario === 'empty' ? [] : [...slots].reverse();
          if (scenario === 'rollover') data.push({ ...slots[0], slotId: 'midnight-slot', time: '23:30' });
          return reply({ success: true, data });
        }
        if (request.method() !== 'GET') {
          assert(['/schedule/reserve', '/schedule/book'].includes(path), `Unexpected test mutation ${path}`);
          writes.push({ path, data: request.postDataJSON() });
          if (path === '/schedule/reserve') return reply({ success: true, data: { reservationId: 'design-hold', expiresAt: '2026-10-17T01:05:00Z' } });
          await new Promise(resolve => { releaseBooking = resolve; });
          return reply({ success: true, data: { bookingId: 'design-booking' } });
        }
        return reply({ success: true, user, data: [], profile: {}, lessons: [] });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.install({ time: new Date('2026-10-17T01:00:00Z') });
      await page.goto(`${base}/browse-tutors`, { waitUntil: 'domcontentloaded' });
      const opener = page.getByRole('button', { name: 'Show schedule for Paul Anthony Arriola', exact: true });
      const open = async () => { await opener.click(); await page.locator('.booking-dialog[open]').waitFor(); };
      const modal = page.locator('.booking-dialog');
      const close = modal.getByRole('button', { name: 'Close booking', exact: true });
      const confirm = modal.locator('.booking-modal-confirm');
      const fits = async () => {
        let result;
        await expect.poll(async () => {
          result = await modal.evaluate(el => {
          const r = el.getBoundingClientRect(), footer = el.querySelector('.booking-modal-footer')?.getBoundingClientRect();
          return { fits: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
            box: { left: r.left, right: r.right, top: r.top, bottom: r.bottom }, viewport: [innerWidth, innerHeight],
            footerVisible: !footer || (footer.top >= r.top && footer.bottom <= r.bottom + 1),
            contentFits: [...el.querySelectorAll('button,.booking-modal-tutor-info,.booking-modal-selected-info')].every(child => child.scrollWidth <= child.clientWidth + 1) };
          });
          return result.fits && result.footerVisible && result.contentFits;
        }, { timeout: 10000 }).toBe(true).catch(error => { console.error(result); throw error; });
      };
      await open();
      await expect(modal.locator('.booking-modal-time-slot')).toHaveCount(11);
      await expect(confirm).toBeDisabled();
      await expect(modal.locator('.booking-modal-date-header')).toHaveText('Saturday, Oct 17');
      await expect(modal.locator('.booking-modal-time-slot').first()).toHaveAccessibleName('13:30 JST');
      await fits();
      await modal.screenshot({ path: `${output}/${theme}-${width}-unselected.png` });
      await modal.getByRole('button', { name: '14:00 JST', exact: true }).click();
      await expect(confirm).toBeEnabled();
      await expect(modal.locator('.booking-modal-selected-info')).toContainText('14:00 JST');
      const selected = modal.locator('.booking-modal-time-slot.selected');
      await page.mouse.move(1, 1);
      await expect(selected).toHaveCSS('background-color', 'rgb(2, 69, 174)');
      await expect(selected.locator('span')).toHaveCSS('color', 'rgb(255, 255, 255)');
      await fits();
      await modal.screenshot({ path: `${output}/${theme}-${width}-selected.png` });
      if (width <= 375) {
        await page.setViewportSize({ width, height: 500 });
        const last = modal.getByRole('button', { name: '18:30 JST', exact: true });
        await last.scrollIntoViewIfNeeded();
        await last.click();
        await expect(last).toBeInViewport();
        await fits();
        await modal.screenshot({ path: `${output}/${theme}-${width}-scrollable.png` });
        if (width === 375 && theme === 'light') {
          await page.setViewportSize({ width: 568, height: 320 });
          await last.scrollIntoViewIfNeeded();
          await expect(last).toBeInViewport();
          await fits();
          await modal.screenshot({ path: `${output}/light-landscape.png` });
        }
        await page.setViewportSize({ width, height: 850 });
      }
      await page.keyboard.press('Escape');
      await expect(modal).toHaveCount(0);
      await expect(opener).toBeFocused();

      scenario = 'rollover';
      await open();
      await expect(modal.locator('.booking-modal-date')).toHaveCount(2);
      await modal.getByRole('button', { name: 'Sunday, Oct 18', exact: true }).click();
      await expect(modal.locator('.booking-modal-time-slot')).toHaveCount(1);
      await expect(confirm).toBeDisabled();
      await modal.getByRole('button', { name: '00:30 JST', exact: true }).click();
      await expect(modal.locator('.booking-modal-selected-info')).toContainText('Sunday, Oct 18');
      await fits();
      if (width <= 375) {
        await page.setViewportSize({ width, height: 500 });
        await fits();
        await modal.screenshot({ path: `${output}/${theme}-${width}-short-viewport.png` });
        await page.setViewportSize({ width, height: 850 });
      }
      if (width === 1566 && theme === 'light') {
        await confirm.click();
        await expect(confirm).toBeDisabled();
        await expect(close).toBeDisabled();
        await expect(modal.locator('.booking-modal-time-slot')).toBeDisabled();
        await expect.poll(() => Boolean(releaseBooking)).toBe(true);
        assert.deepEqual(writes.map(write => write.path), ['/schedule/reserve', '/schedule/book']);
        assert.equal(writes[0].data.slotId, 'midnight-slot');
        assert.deepEqual(writes[1].data, { slotId: 'midnight-slot', reservationId: 'design-hold' });
        releaseBooking();
        await expect(modal.getByRole('heading', { name: 'Booking Confirmed!', exact: true })).toBeVisible();
      } else await close.click();
      if (width === 375 && theme === 'light') {
        scenario = 'loading';
        await open();
        await expect(modal.locator('.booking-modal-loading')).toBeVisible();
        await expect.poll(() => Boolean(releaseLoading)).toBe(true);
        await fits();
        scenario = 'normal';
        releaseLoading();
        await expect(modal.locator('.booking-modal-time-slot')).toHaveCount(11);
        await close.click();

        scenario = 'error';
        await open();
        await expect(modal.getByRole('alert')).toBeVisible();
        await fits();
        await modal.screenshot({ path: `${output}/light-375-error.png` });
        scenario = 'normal';
        await modal.getByRole('button', { name: 'Retry', exact: true }).click();
        await expect(modal.locator('.booking-modal-time-slot')).toHaveCount(11);
        await close.click();

        scenario = 'empty';
        await open();
        await expect(modal.locator('.booking-modal-empty')).toBeVisible();
        await expect(modal.locator('.booking-modal-footer')).toHaveCount(0);
        await fits();
        await modal.screenshot({ path: `${output}/light-375-empty.png` });
        await close.click();
      }
      assert.deepEqual(errors, []);
      console.log(`PASS booking ${theme} ${width}: selection, layout, keyboard, JST rollover${width === 1566 && theme === 'light' ? ', booking exactly once' : ''}`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
