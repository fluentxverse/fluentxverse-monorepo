const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';
const widths = (process.env.KB_TEST_WIDTHS || '1566,1024,768,375,320').split(',').map(Number);

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  await fs.mkdir('../output/screenshots/tutor-knowledge-base', { recursive: true });
  try {
    for (const theme of ['light', 'dark']) for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      await context.addInitScript(theme => {
        localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 }));
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.__copiedArticle = value; } } });
      }, theme);
      let userId = 'knowledge-tutor';
      await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, async route => {
        const path = new URL(route.request().url()).pathname;
        const user = { userId, firstName: 'Alex', lastName: 'Teacher', role: 'tutor', email: 'alex@example.com' };
        const json = { success: true, user, data: [], status: { passed: true } };
        if (path.endsWith('/unread-count')) json.data = { unreadCount: 0 };
        if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        return route.fulfill({ json });
      });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/knowledge-base', { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Knowledge Base', exact: true })).toBeVisible();
      await expect(page.locator('.tutor-kb-article-row')).toHaveCount(13);
      assert(await page.locator('img.tutor-art').evaluate(el => el.complete && el.naturalWidth > 0), 'Header artwork decodes');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${theme} ${width}: index fits`);
      await page.screenshot({ path: `../output/screenshots/tutor-knowledge-base/index-${theme}-${width}.png`, fullPage: true });
      if (width >= 992) {
        const nav = page.locator('.sidebar a[href="/knowledge-base"]');
        await expect(nav).toHaveAttribute('aria-current', 'page');
        assert(await nav.locator('svg').count(), 'Distinct navigation icon');
      } else {
        await page.getByRole('button', { name: 'Open menu', exact: true }).click();
        await page.getByRole('dialog', { name: 'Navigation' }).getByRole('link', { name: 'Knowledge Base', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Navigation' })).toHaveCount(0);
      }
      const search = page.getByRole('searchbox', { name: 'Search knowledge base' });
      await search.fill('no-such-topic-9876');
      await expect(page.getByRole('heading', { name: 'No matching articles' })).toBeVisible();
      await page.getByRole('button', { name: 'Clear search' }).click();
      if (width < 768) await page.getByRole('combobox', { name: 'Knowledge base topic' }).selectOption('classroom');
      else await page.locator('.tutor-kb-sidebar nav a[href*="category=classroom"]').click();
      await expect(page.locator('.tutor-kb-article-row')).toHaveCount(3);
      await search.fill('microphone');
      await expect(page.locator('.tutor-kb-article-row')).toHaveCount(1);
      await page.locator('.tutor-kb-article-row').click();
      await expect(page.locator('.tutor-kb-reader h2')).toHaveText('Camera, microphone, and connection checks');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${theme} ${width}: reader fits`);
      await page.getByRole('button', { name: 'Save article', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Unsave article' })).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('button', { name: 'Copy article link' }).click();
      assert.equal(await page.evaluate(() => window.__copiedArticle), base + '/knowledge-base/camera-microphone-and-connection');
      await page.getByRole('navigation', { name: 'In this article' }).getByRole('link').first().click();
      await expect(page).toHaveURL(/#permissions$/);
      await page.screenshot({ path: `../output/screenshots/tutor-knowledge-base/article-${theme}-${width}.png`, fullPage: true });
      await page.reload({ waitUntil: 'networkidle' });
      await expect(page.getByRole('button', { name: 'Unsave article' })).toBeVisible();
      await page.getByRole('link', { name: 'Back to articles' }).click();
      await expect(search).toHaveValue('microphone');
      await expect(page.locator('.tutor-kb-article-row')).toHaveCount(1);
      await page.goBack();
      await expect(page.locator('.tutor-kb-reader h2')).toHaveText('Camera, microphone, and connection checks');
      await page.goto(base + '/knowledge-base?view=saved');
      await expect(page.locator('.tutor-kb-article-row')).toHaveCount(1);
      await page.locator('.tutor-kb-article-row').click();
      await page.getByRole('button', { name: 'Unsave article' }).click();
      await page.getByRole('link', { name: 'Back to articles' }).click();
      await expect(page.getByRole('heading', { name: 'No saved articles yet' })).toBeVisible();
      await page.goto(base + '/knowledge-base/join-your-classroom');
      await page.getByRole('button', { name: 'Save article', exact: true }).click();
      userId = 'another-knowledge-tutor';
      await page.reload({ waitUntil: 'networkidle' });
      await expect(page.getByRole('button', { name: 'Save article', exact: true })).toBeVisible();
      await page.goto(base + '/knowledge-base/missing-article');
      await expect(page.getByRole('heading', { name: 'Article not found' })).toBeVisible();
      if (theme === 'light' && width === 1566) {
        await page.goto(base + '/knowledge-base/join-your-classroom');
        await page.evaluate(() => {
          const original = Storage.prototype.setItem;
          Storage.prototype.setItem = function(key, value) { if (key.startsWith('fxv_tutor_kb_saved:')) throw new Error('Storage blocked'); return original.call(this, key, value); };
          navigator.clipboard.writeText = async () => { throw new Error('Clipboard denied'); };
        });
        await page.getByRole('button', { name: 'Save article', exact: true }).click();
        await expect(page.getByText('Saved for this visit only. Device storage is unavailable.')).toBeVisible();
        await page.getByRole('button', { name: 'Copy article link' }).click();
        await expect(page.getByText('Could not copy the link. The article URL is in the address bar.')).toBeVisible();
        await page.getByRole('button', { name: 'Dismiss notice' }).click();
        await expect(page.locator('.tutor-kb-notice')).toHaveCount(0);
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${theme} ${width}: navigation, search, category, deep links, contents, saved persistence/isolation, copy link, history, missing article`);
      await context.close();
    }
    const context = await browser.newContext();
    await context.route('**/tutor/me', route => route.fulfill({ status: 401, json: { success: false } }));
    const page = await context.newPage(); await page.goto(base + '/knowledge-base/join-your-classroom');
    await expect(page).toHaveURL(base + '/');
    await expect(page.locator('.tutor-kb-reader')).toHaveCount(0);
    await context.close();
    console.log('PASS knowledge base requires authentication');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
