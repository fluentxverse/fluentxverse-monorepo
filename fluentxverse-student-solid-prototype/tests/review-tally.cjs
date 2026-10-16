const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';
const output = path.resolve(__dirname, '../../output/screenshots');

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  await fs.mkdir(output, { recursive: true });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1440, 375]) {
      const context = await browser.newContext({ viewport: { width, height: width < 600 ? 812 : 1000 } });
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })), theme);
      for (const url of ['http://127.0.0.1:8780', 'http://127.0.0.1:8765', 'https://api.fluentxverse.com'])
        await context.addCookies([{ name: 'studentAuth', value: 'synthetic-cookie', url }]);
      let unavailable = false, downloads = 0;
      const groupId = `0x${'a'.repeat(64)}`;
      const evidence = { verified: true, protocol: 'fluentxverse.review-tally.v1', manifestHash: `0x${'b'.repeat(64)}` };
      await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780)|https:\/\/api\.fluentxverse\.(?:com|xyz))\//, async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.pathname === '/student/me') return route.fulfill({ status: 401, json: { success: false } });
        if (url.pathname === '/tutor/synthetic-tutor') return route.fulfill({ json: { success: true, data: {
          userId: 'synthetic-tutor', firstName: 'Test', lastName: 'Tutor', displayName: 'Test Tutor', tier: 1,
          rating: 4, totalReviews: 1, bio: 'Test profile', languages: ['English'], specializations: ['Business English'], totalSessions: 20,
        } } });
        if (url.pathname.includes('/anonymous-reviews/public/tutor/')) return route.fulfill({ json: { success: true, data: { enabled: true, summaries: [
          { groupId, period: '2026-10', total: 5, average: 3, distribution: [1, 2, 3, 4, 5].map(rating => ({ rating, count: 1 })),
            topics: [{ id: 'feedback', label: 'End-of-lesson feedback', positiveCount: 3, improvementCount: 1 }], tally: { status: 'verified' } },
          { groupId: `0x${'c'.repeat(64)}`, period: '2026-09', total: 5, average: 4, distribution: [], topics: [], tally: { status: 'platform_calculated' } },
        ] } } });
        if (url.pathname.includes('/anonymous-reviews/public/tally/')) {
          assert.equal(req.headers().cookie, undefined); assert.equal(req.headers().authorization, undefined); assert.equal(req.headers().referer, undefined);
          downloads++;
          return route.fulfill(unavailable ? { status: 503, json: { success: false, error: 'Tally receipt is unavailable' } }
            : { json: { success: true, data: evidence } });
        }
        return route.fulfill({ json: { success: true, data: [], notifications: [], user: null } });
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/tutor/synthetic-tutor`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /^Reviews \(/ }).click();
      await page.getByText('Proof-backed tally', { exact: true }).waitFor();
      await page.getByText('Platform-calculated tally', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: /Download tally proof/ }).count(), 1);
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download tally proof for 2026-10' }).click();
      const file = await download; assert.equal(file.suggestedFilename(), 'review-tally-2026-10.json');
      assert.deepEqual(JSON.parse(await fs.readFile(await file.path(), 'utf8')), evidence);
      unavailable = true;
      await page.getByRole('button', { name: 'Download tally proof for 2026-10' }).click();
      await page.getByRole('alert').filter({ hasText: 'Tally receipt is unavailable' }).waitFor();
      assert.equal(downloads, 2);
      await page.locator('.anonymous-tutor-ratings').scrollIntoViewIfNeeded();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(output, `review-tally-${theme}-${width}.png`), fullPage: true });
      assert.deepEqual(errors, []); await context.close();
    }
    console.log('PASS: tally/legacy distinction, public proof download, cookie/referrer omission, failed verification, and desktop/mobile light/dark layouts. API and receipts mocked.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
