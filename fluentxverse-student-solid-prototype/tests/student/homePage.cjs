const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    const cases = ['light', 'dark'].flatMap(theme => [1566, 1024, 768, 375, 320].map(width => ({ theme, width, state: 'populated' }))).concat([
      { theme: 'light', width: 375, state: 'empty' }, { theme: 'dark', width: 1566, state: 'empty' },
      { theme: 'light', width: 375, state: 'error' }, { theme: 'dark', width: 1566, state: 'error' },
    ]);
    for (const { theme, width, state } of cases) {
      const context = await browser.newContext({ viewport: { width, height: 950 }, timezoneId: 'Pacific/Auckland', reducedMotion: 'reduce' });
      await context.addInitScript(theme => { if (location.protocol === 'http:' || location.protocol === 'https:') localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })); }, theme);
      const failures = new Set(), errors = [], requests = [];
      await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780)|https:\/\/api\.fluentxverse\.(?:com|xyz))\//, async route => {
        const path = new URL(route.request().url()).pathname;
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
        requests.push(path);
        const reply = json => route.fulfill({ json });
        const user = { userId: 'home-fixture', role: 'student', givenName: width === 320 ? 'Alexandramontgomery' : 'Mika', familyName: 'Tanaka', email: 'home@example.invalid', walletAddress: `0x${'a'.repeat(40)}` };
        if (path === '/student/me') return reply({ success: true, user });
        const resource = path === '/schedule/student-stats' || path === '/schedule/student-activity' || path === '/student/favorites' || path.startsWith('/tickets/balance/');
        if (state === 'error' && resource && !failures.has(path)) { failures.add(path); return route.fulfill({ status: 503, json: { success: false } }); }
        if (path === '/schedule/student-stats') return reply({ success: true, data: state === 'empty' ? { lessonsCompleted: 0, upcomingLessons: 0, totalHours: 0 } : { lessonsCompleted: 18, upcomingLessons: 2, totalHours: 7.5, nextLesson: { tutorName: 'Christopher Alexandra Montgomery', tutorAvatar: '/assets/img/nonexistent-home-avatar.webp', slotDate: '2026-10-10', slotTime: '11:30 PM', bookingId: 'home-next' } } });
        if (path.startsWith('/tickets/balance/')) return reply({ success: true, data: { basic: state === 'empty' ? 0 : 5, premium: state === 'empty' ? 0 : 2, trial: state === 'empty' ? 0 : 1 } });
        if (path === '/student/favorites') return reply({ success: true, data: { favorites: state === 'empty' ? [] : [{ id: 'fav-1', tutorId: 'home-tutor', tutorName: 'Aya Nakamura', tutorAvatar: '/assets/img/banner/banner_woman.webp' }, { id: 'fav-2', tutorId: 'home-tutor-2', tutorName: 'Christopher Alexandra Montgomery', tutorAvatar: null }], total: 2, page: 1, totalPages: 1 } });
        if (path === '/schedule/student-activity') return reply({ success: true, data: state === 'empty' ? [] : Array.from({ length: 6 }, (_, index) => ({ type: index === 2 ? 'ticket_purchased' : index % 2 ? 'lesson_booked' : 'lesson_completed', action: index === 2 ? 'Purchased 5 basic tickets' : `Lesson ${index + 1} ${index % 2 ? 'booked' : 'completed'}`, tutorName: index === 2 ? undefined : 'Aya Nakamura', date: 'Oct 9, 2026', bookingId: index === 2 ? undefined : `home-activity-${index}`, ticketTier: 'basic', timestamp: '2026-10-09T12:00:00Z' })) });
        return reply({ success: true, data: [], profile: {}, lessons: [] });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.install({ time: new Date('2026-10-10T14:00:00Z') });
      await page.goto(`${base}/home`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: /Welcome back/ }).waitFor();
      await page.waitForFunction(() => !document.querySelector('.student-home-loading'));
      await page.waitForFunction(expected => document.documentElement.dataset.theme === expected, theme);
      await page.locator('.student-home-art').evaluateAll(images => Promise.all(images.map(img => img.decode())));
      if (state === 'error') {
        assert.equal(await page.getByRole('alert').count(), 4);
        assert.equal(await page.getByText('No favorites yet', { exact: true }).count(), 0);
        assert.deepEqual(await page.locator('.student-home-metric strong').allTextContents(), ['—', '—', '—']);
        await page.screenshot({ path: `../output/screenshots/home-${theme}-${width}-error.png`, fullPage: true });
        for (const section of ['.student-home-next', '.student-home-tickets', '.student-home-favorites', '.student-home-activity']) await page.locator(section).getByRole('button', { name: 'Try again', exact: true }).click();
        await page.waitForFunction(() => !document.querySelector('.student-home-loading') && !document.querySelector('.student-home-error'));
      }
      if (state !== 'empty') {
        assert.deepEqual(await page.locator('.student-home-metric strong').allTextContents(), ['18', '2', '7.5']);
        assert.equal(await page.getByRole('link', { name: 'Open Lesson', exact: true }).getAttribute('href'), '/lesson/home-next');
        assert.match(await page.locator('.student-home-lesson-details').textContent(), /Oct 11/);
        assert.match(await page.locator('.student-home-lesson-details').textContent(), /12:30 AM JST/);
        assert.equal(await page.locator('.student-home-favorite').count(), 2);
        assert.equal(await page.locator('.student-home-activity-list li').count(), 5);
        await page.getByRole('button', { name: 'Next activity page', exact: true }).click();
        await page.getByText('Lesson 6 booked', { exact: true }).waitFor();
        assert.equal(await page.locator('.student-home-activity-list li').count(), 1);
        await page.getByRole('button', { name: 'Previous activity page', exact: true }).click();
        await page.getByText('Lesson 1 completed', { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Previous activity page', exact: true }).isDisabled(), true);
      } else {
        await page.getByText('No upcoming lessons yet.', { exact: true }).waitFor();
        assert.deepEqual(await page.locator('.student-home-metric strong').allTextContents(), ['0', '0', '0']);
      }
      assert.equal(await page.getByRole('link', { name: 'My Schedule', exact: true }).getAttribute('href'), '/schedule');
      assert.equal(await page.locator('.student-home a[href="/my-lessons"]').count(), 0);
      assert.equal(await page.locator('.student-home-main i.fas').count(), 0);
      const ticketImages = page.locator('.student-home-ticket-row img[src*="ticket-v2.png"]');
      assert.equal(await ticketImages.count(), 2);
      const ticketSizes = await ticketImages.evaluateAll(async images => {
        await Promise.all(images.map(image => image.decode()));
        return images.map(image => ({ width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight }));
      });
      assert.deepEqual(ticketSizes, Array(2).fill({ width: 64, height: 40, naturalWidth: 640, naturalHeight: 360 }));
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, fits: [...document.querySelectorAll('.student-home-card, .student-home-button, .student-home-favorite')].every(el => el.scrollWidth <= el.clientWidth), headingVisible: document.querySelector('.student-home-heading').getBoundingClientRect().top >= document.querySelector('.app-header-shell').getBoundingClientRect().bottom }));
      assert.equal(layout.overflow, false); assert.ok(layout.fits && layout.headingVisible, JSON.stringify(layout));
      await page.screenshot({ path: `../output/screenshots/home-${theme}-${width}-${state}.png`, fullPage: true });
      if (theme === 'light' && width === 1566 && state === 'populated') {
        const countdown = await page.locator('.student-home-countdown').textContent();
        await page.clock.fastForward(60000);
        await page.waitForFunction(previous => document.querySelector('.student-home-countdown').textContent !== previous, countdown);
        assert.equal(requests.filter(path => path === '/schedule/student-stats').length, 1, 'Countdown updates do not refetch dashboard data');
      }
      assert.deepEqual(errors, []);
      console.log(`PASS Home ${theme} ${width} ${state}: artwork, data, links, pagination, layout${state === 'error' ? ', independent retries' : ''}`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
