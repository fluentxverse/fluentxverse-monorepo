const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';
const tutors = [
  { userId: 'browse-aya', firstName: 'Aya', lastName: 'Nakamura', displayName: 'Aya Nakamura', tier: 1, isAvailable: true, isVerified: true, rating: 4.9, totalReviews: 18, totalSessions: 120, country: 'Philippines', languages: ['English', 'Japanese'], specializations: ['Conversation', 'Business English'], bio: 'Thoughtful conversations and clear explanations, with space to build confidence.', profilePicture: '/assets/img/banner/banner_woman.webp' },
  { userId: 'browse-chris', firstName: 'Christopher', lastName: 'Montgomery', displayName: 'Christopher Alexandra Montgomery', tier: 1, isAvailable: true, bio: 'Practical English for everyday conversations and work.', profilePicture: '/assets/img/nonexistent-avatar.webp' },
  { userId: 'browse-sam', firstName: 'Sam', lastName: 'Lee', displayName: 'Sam Lee', tier: 1, isAvailable: true },
];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const authenticated of [true, false]) for (const theme of ['light', 'dark']) for (const width of [1566, 768, 375, 320]) {
      if (process.env.BROWSE_TEST_CASE && process.env.BROWSE_TEST_CASE !== `${authenticated}-${theme}-${width}`) continue;
      let failPageTwo = 2;
      const searches = [], errors = [];
      const requests = [];
      const context = await browser.newContext({ viewport: { width, height: 950 }, timezoneId: 'Pacific/Auckland' });
      await context.addInitScript(theme => { if (location.protocol === 'http:' || location.protocol === 'https:') localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })); }, theme);
      await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780)|https:\/\/api\.fluentxverse\.(?:com|xyz))\//, async route => {
        const url = new URL(route.request().url()), path = url.pathname;
        if (path === '/lesson-passes/mode') return route.fulfill({ json: { success: true, data: { mode: 'legacy_erc1155' } } });
        requests.push(path);
        const reply = json => route.fulfill({ json });
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
        const user = { userId: 'browse-student-fixture', role: 'student', firstName: 'Student', email: 'browse@example.com', walletAddress: `0x${'a'.repeat(40)}` };
        if (path === '/student/me') return authenticated ? reply({ success: true, user }) : route.fulfill({ status: 401, json: { success: false } });
        if (path === '/tutor/search') {
          searches.push(Object.fromEntries(url.searchParams));
          const q = url.searchParams.get('q'), page = url.searchParams.get('page');
          if (q === 'slow') { await new Promise(resolve => setTimeout(resolve, 1200)); return reply({ success: true, data: { tutors: [{ ...tutors[2], displayName: 'Stale Tutor' }], total: 1, hasMore: false } }); }
          if (q === 'fast') return reply({ success: true, data: { tutors: [{ ...tutors[2], displayName: 'Fast Tutor' }], total: 1, hasMore: false } });
          if (q === 'missing') return reply({ success: true, data: { tutors: [], total: 0, hasMore: false } });
          if (q) return reply({ success: true, data: { tutors: tutors.filter(t => t.displayName.toLowerCase().includes(q.toLowerCase())), total: 1, hasMore: false } });
          if (page === '2' && failPageTwo > 0) { failPageTwo--; return route.fulfill({ status: 503, json: { success: false } }); }
          return reply({ success: true, data: { tutors: page === '2' ? [{ ...tutors[2], userId: 'browse-four', displayName: 'Fourth Tutor' }] : tutors, total: 4, hasMore: page !== '2' } });
        }
        if (path.startsWith('/tickets/balance/')) return reply({ success: true, data: { basic: 5, premium: 2, trial: 1, basicTokenId: 'mock-basic' } });
        if (path.startsWith('/schedule/available/')) return reply({ success: true, data: [{ slotId: 'public-slot', tutorId: 'browse-aya', date: url.searchParams.get('startDate'), time: '22:00', durationMinutes: 25 }] });
        if (path === '/schedule/reserve') return reply({ success: true, data: { reservationId: 'fixture-reservation', expiresAt: new Date(Date.now() + 120000).toISOString(), bookBy: new Date(Date.now() + 120000).toISOString() } });
        if (path === '/tickets/consume') return reply({ success: true, data: { transactionHash: 'fixture-transfer' } });
        if (path === '/schedule/book') return reply({ success: true, data: { bookingId: 'fixture-booking' } });
        return reply({ success: true, data: [], user, profile: {}, lessons: [] });
      });
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date('2026-10-23T00:12:00Z'));
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/browse-tutors`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Browse Tutors', exact: true }).waitFor();
      await page.locator('.browse-tutor-card').first().waitFor();
      assert.equal(await page.locator('.browse-tutor-card').count(), 3);
      await page.waitForFunction(expected => document.documentElement.dataset.theme === expected, authenticated ? theme : 'light');
      assert.equal(await page.locator('.browse-public-hero').count(), 0);
      assert.equal(await page.locator('.browse-day-strip button[aria-pressed="true"]').count(), 1);
      assert.equal(await page.locator('.browse-tutor-card').last().getByText('0 lessons', { exact: true }).count(), 0);
      assert.equal(await page.locator('.browse-tutor-card').first().getByRole('link', { name: 'View Profile', exact: true }).getAttribute('href'), '/tutor/browse-aya');
      await page.locator('.browse-page-heading img').evaluate(img => img.decode());
      await page.screenshot({ path: `../output/screenshots/browse-${authenticated ? 'app' : 'public'}-${theme}-${width}.png`, fullPage: true });
      const fits = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, cards: [...document.querySelectorAll('.browse-tutor-card')].every(card => card.scrollWidth <= card.clientWidth), buttons: [...document.querySelectorAll('.browse-tutor-actions button')].every(button => button.scrollWidth <= button.clientWidth) }));
      assert.equal(fits.overflow, false); assert.ok(fits.cards && fits.buttons);
      if (width === 375) {
        await page.getByRole('button', { name: 'Filters', exact: true }).click();
        await page.getByRole('dialog').waitFor();
        await page.getByLabel('Start time in filters', { exact: true }).selectOption({ value: '09:00' });
        await page.waitForFunction(() => document.querySelector('.browse-filter-dialog select[aria-label="Start time in filters"] option:checked')?.textContent === '10:00');
        await page.getByLabel('Lesson day', { exact: true }).selectOption({ index: 1 });
        await page.keyboard.press('Escape');
        await page.getByRole('dialog').waitFor({ state: 'hidden' });
        await page.waitForFunction(() => document.activeElement?.classList.contains('browse-filter-button'));
        await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
      }
      if (authenticated && theme === 'dark' && width === 1566) {
        await page.getByRole('button', { name: 'Load More Tutors', exact: true }).click();
        await page.getByRole('alert').waitFor();
        assert.equal(await page.locator('.browse-tutor-card').count(), 3, 'Load-more errors retain results');
        await page.getByRole('button', { name: 'Try Again', exact: true }).click();
        await page.getByRole('heading', { name: 'Fourth Tutor', exact: true }).waitFor();
        assert.equal(searches.filter(s => s.page === '2').length, 3, 'One automatic retry and a manual retry do not skip a page');
        const search = page.getByLabel('Search tutors by name');
        await search.fill('slow'); await page.getByRole('button', { name: 'Search', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('.browse-results-header').textContent.includes('Finding'));
        await search.fill('fast'); await page.getByRole('button', { name: 'Search', exact: true }).click();
        await page.getByRole('heading', { name: 'Fast Tutor', exact: true }).waitFor();
        await page.waitForTimeout(1300);
        assert.equal(await page.getByRole('heading', { name: 'Stale Tutor', exact: true }).count(), 0);
        await search.fill('missing'); await page.getByRole('button', { name: 'Search', exact: true }).click();
        await page.getByRole('heading', { name: 'No matching tutors', exact: true }).waitFor();
        await page.locator('.browse-empty').getByRole('button', { name: 'Reset filters', exact: true }).click();
        await page.getByRole('heading', { name: 'Aya Nakamura', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Show schedule for Aya Nakamura', exact: true }).click();
        await page.locator('.booking-modal').waitFor();
        await page.locator('.booking-modal-tutor-name').getByText('Aya Nakamura', { exact: true }).waitFor();
        await page.locator('.booking-modal-close').click();
        await page.getByRole('button', { name: /Tomorrow/ }).click();
        await page.getByRole('heading', { name: 'Aya Nakamura', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Show schedule for Aya Nakamura', exact: true }).click();
        await page.getByRole('button', { name: '23:00 JST', exact: true }).click();
        await page.getByRole('button', { name: 'Confirm Booking', exact: true }).click();
        await page.getByRole('heading', { name: 'Booking Confirmed!', exact: true }).waitFor();
        for (const path of ['/schedule/reserve', '/tickets/consume', '/schedule/book']) assert.equal(requests.filter(request => request === path).length, 1, `${path} runs exactly once`);
      }
      if (!authenticated && (width === 375 || width === 1566)) {
        await page.getByRole('button', { name: /Tomorrow/ }).click();
        await page.getByRole('heading', { name: 'Aya Nakamura', exact: true }).waitFor();
        const authChecks = requests.filter(path => path === '/student/me').length;
        await page.getByRole('button', { name: 'Show schedule for Aya Nakamura', exact: true }).click();
        await page.getByRole('button', { name: '23:00 JST', exact: true }).click();
        assert.equal(await page.locator('.booking-modal-error').count(), 0);
        await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
        await page.screenshot({ path: `../output/screenshots/browse-guest-schedule-${theme}-${width}.png`, fullPage: true });
        await page.getByRole('button', { name: 'Sign In to Book', exact: true }).click();
        await page.locator('.social-login-modal').waitFor();
        assert.equal(await page.getByText('Register or sign in with your preferred account', { exact: true }).count(), 1);
        assert.equal(await page.locator('.booking-modal').count(), 0);
        await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
        await page.screenshot({ path: `../output/screenshots/browse-guest-auth-${theme}-${width}.png`, fullPage: true });
        await page.getByRole('button', { name: 'Close sign in', exact: true }).click();
        await page.locator('.booking-modal-time-slot.selected').waitFor();
        assert.equal(requests.filter(path => path === '/student/me').length, authChecks, 'Viewing a public schedule does not validate a session');
        assert.equal(requests.filter(path => path.startsWith('/tickets/balance/') || path === '/schedule/reserve' || path === '/schedule/book').length, 0, 'Guests do not fetch wallet balances or start bookings');
        await page.locator('.booking-modal-close').click();
      }
      assert.deepEqual(errors, []);
      console.log(`PASS Browse ${authenticated ? 'app' : 'public'} ${theme} ${width}: layout, filters, profile actions${authenticated && theme === 'dark' && width === 1566 ? ', booking/retry/race/empty states' : ''}`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
