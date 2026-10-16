const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  await fs.mkdir('../output/screenshots/tutor-materials', { recursive: true });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1566, 375]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })), theme);
      await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, route => new URL(route.request().url()).pathname === '/dispatch' ? route.fulfill({ json: [] }) : route.fulfill({ json: {
        success: true, user: { userId: 'materials-design', email: 'paulanthonyarriola@gmail.com', firstName: 'Alex' },
        data: { slots: [], notifications: [], unreadCount: 0 }, status: { passed: true },
      } }));
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/materials', { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: 'Learning Materials', exact: true }).waitFor();
      assert.equal(await page.locator('.materials-search').count(), 0);
      assert.equal(await page.getByPlaceholder('Search courses...').count(), 0);
      assert.equal(await page.locator('.course-card').count(), 3);
      for (const category of ['Business', 'Conversation', 'News']) {
        await page.locator('.category-tabs').getByRole('button', { name: category, exact: true }).click();
        assert.equal(await page.locator('.course-card').count(), 1, category + ' filter stays functional');
      }
      await page.locator('.category-tabs').getByRole('button', { name: 'All', exact: true }).click();
      assert.equal(await page.locator('.course-card').count(), 3);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `../output/screenshots/tutor-materials/materials-${theme}-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: /Business English Professional communication/ }).click();
      await page.waitForURL(base + '/materials/business-english');
      await page.getByRole('heading', { name: 'Business English', exact: true }).waitFor();
      await page.reload();
      await page.getByRole('heading', { name: 'Business English', exact: true }).waitFor();
      for (const [slug, title] of [['conversational-skills', 'Conversational Skills'], ['daily-dispatch', 'Daily Dispatch']]) {
        await page.goto(base + '/materials');
        await page.locator('.course-card').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).click();
        await page.waitForURL(base + '/materials/' + slug);
        await page.getByRole('heading', { name: title, exact: true }).waitFor();
        await page.reload();
        await page.getByRole('heading', { name: title, exact: true }).waitFor();
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${theme} ${width}: no search bar, category filters, three courses and course navigation`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
