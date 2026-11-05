const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.SITE_URL || 'http://127.0.0.1:5343';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base, { waitUntil: 'networkidle' });
      const section = page.locator('.web3-ecosystem');
      await expect(section.getByRole('heading', { name: 'Built on Arbitrum. Connected by Web3.' })).toBeVisible();
      await expect(section.locator('.web3-foundation')).toHaveCount(3);
      await expect(section.locator('.web3-provider')).toHaveCount(4);
      for (const img of await section.locator('img').all()) {
        await img.scrollIntoViewIfNeeded(); await img.evaluate(e => e.decode());
        assert(await img.evaluate(e => e.naturalWidth > 0 && e.naturalHeight > 0));
      }
      for (const a of await section.locator('a').all()) {
        assert.match(await a.getAttribute('href'), /^https:\/\//);
        assert.match(await a.getAttribute('rel'), /noopener/);
        assert(await a.evaluate(e => e.scrollWidth <= e.clientWidth + 1), `${await a.getAttribute('aria-label')} overflows at ${width}px`);
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      const columns = await section.locator('.web3-foundations').evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length);
      assert.equal(columns, width <= 900 ? 1 : 3);
      if ([1440, 390, 320].includes(width)) await section.screenshot({ path: `/tmp/fluentxverse-web3-ecosystem-${width}.png` });
      console.log(`PASS ${width}px: seven provider assets, links, responsive columns and no overflow`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
