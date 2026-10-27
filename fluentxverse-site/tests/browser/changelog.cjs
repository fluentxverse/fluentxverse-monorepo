const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.SITE_URL || 'http://127.0.0.1:5215';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const output = '../output/screenshots/changelog';
  await fs.mkdir(output, { recursive: true });
  try {
    for (const width of [1440, 1024, 800, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 950 }, permissions: ['clipboard-read', 'clipboard-write'] });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const feed = await page.request.get(`${base}/changelog.json`);
      assert(feed.headers()['content-type'].includes('application/json'));
      const entries = (await feed.json()).entries;
      const studentEntries = entries.filter(entry => entry.apps.includes('student'));
      const engineEntries = entries.filter(entry => entry.apps.includes('engine'));
      assert.ok(engineEntries.length > 0, 'Engine feed entries missing');
      await page.goto(`${base}/changelog`);
      await expect(page).toHaveTitle('Changelog | FluentXVerse');
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://fluentxverse.com/changelog');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Changelog');
      await expect(page.locator('.changelog-entry')).toHaveCount(entries.length);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${output}/${width}.png`, fullPage: true });
      const overflow = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth > innerWidth + 1,
        text: [...document.querySelectorAll('main h1,main h2,main p,main li,nav a')].filter(el => el.getBoundingClientRect().width && el.scrollWidth > el.clientWidth + 1).map(el => el.textContent),
      }));
      assert.equal(overflow.page, false); assert.deepEqual(overflow.text, []);
      await page.getByRole('group', { name: 'Filter by app' }).getByRole('button', { name: 'Engine', exact: true }).click();
      await expect(page).toHaveURL(/app=engine/);
      await expect(page.locator('.changelog-entry')).toHaveCount(engineEntries.length);
      await expect(page.getByRole('button', { name: 'Engine', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await page.reload();
      await expect(page.locator('.changelog-entry')).toHaveCount(engineEntries.length);
      await page.getByLabel('Change type', { exact: true }).selectOption('fixed');
      await expect(page.locator('.changelog-entry')).toHaveCount(engineEntries.filter(entry => entry.type === 'fixed').length);
      await page.getByRole('searchbox', { name: 'Search updates' }).fill('mainnet account');
      await expect(page.locator('.changelog-entry')).toHaveCount(1);
      await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
      await page.getByRole('group', { name: 'Filter by app' }).getByRole('button', { name: 'Student app', exact: true }).click();
      await expect(page).toHaveURL(/app=student/);
      await expect(page.locator('.changelog-entry')).toHaveCount(studentEntries.length);
      await expect(page.getByRole('button', { name: 'Student app', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await page.reload();
      await expect(page.locator('.changelog-entry')).toHaveCount(studentEntries.length);
      await page.getByLabel('Change type', { exact: true }).selectOption('changed');
      await expect(page.locator('.changelog-entry')).toHaveCount(studentEntries.filter(entry => entry.type === 'changed').length);
      await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
      await expect(page.locator('.changelog-entry')).toHaveCount(entries.length);
      await page.getByRole('searchbox', { name: 'Search updates' }).fill('FXV-20261024-001');
      await expect(page.locator('.changelog-entry')).toHaveCount(1);
      await page.getByRole('button', { name: 'Copy link to FXV-20261024-001', exact: true }).click();
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'https://fluentxverse.com/changelog#FXV-20261024-001');
      await page.getByRole('button', { name: 'Clear search', exact: true }).click();
      await expect(page.locator('.changelog-entry')).toHaveCount(entries.length);
      await page.getByRole('searchbox', { name: 'Search updates' }).fill('not-a-real-update');
      await expect(page.getByRole('heading', { name: 'No matching updates' })).toBeVisible();
      await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
      await page.getByRole('link', { name: 'FXV-20261024-001', exact: true }).click();
      await expect(page).toHaveURL(/#FXV-20261024-001$/);
      await expect(page.locator('#FXV-20261024-001')).toBeFocused();
      await page.reload();
      await expect(page.locator('#FXV-20261024-001')).toBeFocused();
      assert(await page.locator('#FXV-20261024-001').evaluate(el => el.getBoundingClientRect().top) >= 70);
      await page.goto(`${base}/`);
      if (width <= 760) await page.getByRole('button', { name: 'Open menu', exact: true }).click();
      if (width > 960 || width <= 760) await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Changelog', exact: true }).click();
      else await page.locator('.site-footer').getByRole('link', { name: 'Changelog', exact: true }).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Changelog');
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS changelog ${width}: layout, filters, search, URL persistence, copy, deep links, feed, navigation`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
