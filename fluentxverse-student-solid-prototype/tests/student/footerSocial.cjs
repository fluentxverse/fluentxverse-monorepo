const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  await fs.mkdir('../output/screenshots/footer-social', { recursive: true });
  try {
    for (const width of [1566, 768, 375, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780))\//,
        route => route.fulfill({ status: 401, json: { success: false } }));
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      const links = page.locator('.footer-social-links');
      await links.scrollIntoViewIfNeeded();
      await expect(links.locator('a')).toHaveCount(3);
      assert.deepEqual(await links.locator('a').evaluateAll(elements => elements.map(element => element.getAttribute('aria-label'))), ['FluentXVerse on LinkedIn', 'FluentXVerse on Facebook', 'FluentXVerse on X']);
      await expect(links.locator('a[href*="youtube"]')).toHaveCount(0);
      for (const [name, href] of [['LinkedIn', 'https://www.linkedin.com/company/fluentxverse'], ['Facebook', 'https://www.facebook.com/fluentxverse'], ['X', 'https://x.com/fluentxverse']]) {
        const link = links.getByRole('link', { name: `FluentXVerse on ${name}`, exact: true });
        await expect(link).toHaveAttribute('href', href);
        await expect(link.locator('svg')).toHaveCount(1);
        assert.equal((await link.innerText()).trim(), '', 'No typed placeholders');
        const bounds = await link.boundingBox(), icon = await link.locator('svg').boundingBox();
        assert.equal(bounds.width, 44); assert.equal(bounds.height, 44);
        assert.equal(icon.width, 20); assert.equal(icon.height, 20);
        assert.ok(icon.x > bounds.x && icon.x + icon.width < bounds.x + bounds.width);
        await link.focus();
        await expect(link).toBeFocused();
        assert.equal(await link.evaluate(element => getComputedStyle(element).outlineStyle), 'solid');
        await link.hover();
        assert.deepEqual(await link.boundingBox(), bounds, 'Hover does not shift social links');
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.locator('.landing-footer').screenshot({ path: `../output/screenshots/footer-social/${width}.png` });
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`PASS footer social ${width}: brand vectors, accessible links, focus, stable sizing`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
