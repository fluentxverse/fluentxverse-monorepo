const { chromium, expect: playwrightExpect } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const expect = playwrightExpect.configure({ timeout: 20000 });
const assert = require('node:assert/strict');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';
const tutor = { userId: 'history-tutor', firstName: 'Alex', lastName: 'Teacher', displayName: 'Alex Teacher',
  tier: 1, isAvailable: true, rating: 5, totalReviews: 1, languages: ['English'], bio: 'Conversation practice.' };

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const authenticated of [false, true]) for (const width of [1566, 375]) {
      let profileDelay = 0;
      const errors = [], searches = [];
      let documents = 0;
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780))\//, async route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        const headers = { 'access-control-allow-origin': new URL(base).origin, 'access-control-allow-credentials': 'true',
          'access-control-allow-headers': 'Content-Type, Authorization', 'access-control-allow-methods': 'GET, OPTIONS' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        const reply = json => route.fulfill({ json, headers });
        if (request.method() !== 'GET') return reply({ success: true, data: {} });
        if (path === '/student/me') return authenticated ? reply({ success: true, user: { userId: 'history-student', role: 'student', firstName: 'Student', email: 'history@example.com', walletAddress: `0x${'a'.repeat(40)}` } }) : route.fulfill({ status: 401, headers, json: { success: false } });
        if (path === '/tutor/search') {
          searches.push(new URL(request.url()).searchParams.get('q'));
          return reply({ success: true, data: { tutors: [tutor], total: 1, hasMore: false } });
        }
        if (path === '/tutor/history-tutor') {
          await new Promise(resolve => setTimeout(resolve, profileDelay));
          return reply({ success: true, data: tutor });
        }
        if (path === '/lesson-passes/mode') return reply({ success: true, data: { mode: 'legacy_erc1155' } });
        if (path.startsWith('/tickets/balance/')) return reply({ success: true, data: { basic: 1, premium: 0, trial: 0 } });
        if (path === '/student/favorites') return reply({ success: true, data: { favorites: [], total: 0, page: 1, totalPages: 0 } });
        if (path === '/schedule/student-stats') return reply({ success: true, data: { lessonsCompleted: 0, upcomingLessons: 0, totalHours: 0 } });
        if (path === '/notifications' || path === '/notifications/') return reply({ success: true, data: { notifications: [], unreadCount: 0 } });
        return reply({ success: true, data: [], lessons: [], notifications: [], unreadCount: 0 });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
      const checkBrowse = async () => {
        try {
          await expect(page.getByRole('heading', { name: 'Browse Tutors', exact: true })).toBeVisible();
          await expect(page.locator('.browse-tutor-card')).toHaveCount(1);
          await expect(page.locator('.error-boundary-fallback')).toHaveCount(0);
        } catch (error) {
          console.error({ authenticated, width, url: page.url(), body: (await page.locator('body').innerText()).slice(0, 1000), errors });
          throw error;
        }
      };
      await page.goto(base + '/browse-tutors', { waitUntil: 'domcontentloaded' });
      await checkBrowse();
      for (let cycle = 0; cycle < 3; cycle++) {
        await page.getByRole('link', { name: 'View Profile', exact: true }).click();
        await expect(page.locator('.tutor-profile-page h1')).toHaveText('Alex Teacher');
        await page.goBack({ waitUntil: 'domcontentloaded' });
        await checkBrowse();
        await page.goForward({ waitUntil: 'domcontentloaded' });
        await expect(page.locator('.tutor-profile-page h1')).toHaveText('Alex Teacher');
        await page.goBack({ waitUntil: 'domcontentloaded' });
        await checkBrowse();
      }
      profileDelay = 800;
      await page.getByRole('link', { name: 'View Profile', exact: true }).click();
      await page.waitForURL('**/tutor/history-tutor');
      await expect(page.locator('.tutor-profile-loading')).toBeVisible();
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await checkBrowse();
      await page.waitForTimeout(1000);
      await checkBrowse();
      const home = page.locator('.menu-nav a[aria-label="FluentXVerse home"]').first();
      await home.click();
      await page.waitForURL(authenticated ? '**/home' : new URL('/', base).href);
      if (authenticated) {
        await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
        await expect(page.locator('.student-home-loading')).toHaveCount(0);
      } else await expect(page.locator('.main-content.no-sidebar')).toBeVisible();
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await checkBrowse();
      // A different route fails to load; Back must still restore the healthy list.
      await context.route(/\/(?:student\/pages\/ContactPage\.tsx|assets\/ContactPage-[^/]+\.js)(?:\?.*)?$/, route => route.fulfill({
        contentType: 'text/javascript', body: 'export default function ContactPage() { throw new Error("History fixture: failed destination"); }',
      }));
      await page.evaluate(() => {
        const link = document.createElement('a');
        link.href = '/contact';
        document.body.append(link);
        link.click();
        link.remove();
      });
      await expect(page.locator('.error-boundary-fallback')).toBeVisible();
      await expect(page.locator('.App .error-boundary-fallback')).toBeVisible();
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await checkBrowse();
      await page.getByLabel('Search tutors by name').fill('Alex');
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await expect.poll(() => searches.at(-1)).toBe('Alex');
      await checkBrowse();
      await page.goForward({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('.error-boundary-fallback')).toBeVisible();
      await expect(page.locator('.App .error-boundary-fallback')).toBeVisible();
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await checkBrowse();
      assert.equal(documents, 1, 'Back recovers without reloading the document or resetting the session');
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `/tmp/student-browser-history-${authenticated ? 'signed-in' : 'guest'}-${width}.png` });
      console.log(`PASS browser history ${authenticated ? 'signed-in' : 'guest'} ${width}: repeated Back/Forward, pending requests, recovery after a failed route`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
