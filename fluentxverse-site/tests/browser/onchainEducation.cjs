const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.SITE_URL || 'http://127.0.0.1:5233';
const output = process.env.SITE_SCREENSHOTS || '../output/screenshots/onchain-education';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  await fs.mkdir(output, { recursive: true });
  try {
    for (const width of (process.env.SITE_WIDTHS || '1440,1024,768,390,320').split(',').map(Number)) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      const page = await context.newPage(), errors = [], failedAssets = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.status() >= 400 && new URL(r.url()).origin === new URL(base).origin) failedAssets.push(r.url()); });
      await page.goto(base + '/onchain-education');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Onchain education.');
      await expect(page.getByRole('heading', { name: 'Why bring online education onchain?', exact: true })).toBeVisible();
      await expect(page.locator('.onchain-pillar')).toHaveCount(5);
      await expect(page.locator('.onchain-pillar-benefits li')).toHaveCount(10);
      await expect(page.getByText('Design references:', { exact: false })).toHaveCount(0);
      await expect(page.getByText("W3C's credential model", { exact: false })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Verifiable Credentials Data Model v2.0', exact: true })).toHaveCount(0);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Five reasons/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://fluentxverse.com/onchain-education');
      await page.locator('.article-hero-photo').evaluate(img => img.decode());
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(() => ({ page: document.documentElement.scrollWidth > innerWidth + 1,
        elements: [...document.querySelectorAll('.onchain-pillar h3,.onchain-pillar p,.onchain-pillar strong,.onchain-pillar-intro')]
          .filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.slice(0, 80)),
        overlap: [...document.querySelectorAll('.onchain-pillar')].some(e => { const a=e.querySelector('h3').getBoundingClientRect(),b=e.querySelector('ul').getBoundingClientRect();return a.right>b.left&&b.right>a.left&&a.bottom>b.top&&b.bottom>a.top; }) }));
      assert.equal(overflow.page, false); assert.deepEqual(overflow.elements, []); assert.equal(overflow.overlap, false);
      await page.locator('#reasons-title').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${output}/${width}-pillars.png` });
      await page.goto(base + '/onchain-education#educator-payments');
      await expect(page.locator('#educator-payments')).toBeInViewport();
      await expect(page.locator('#educator-payments')).toContainText('transfers and automated course royalties are not enabled');
      await expect(page.locator('#community-governance')).toContainText('future directions');
      await expect(page.locator('#onchain-faq-title')).toHaveCount(0);
      await expect(page.locator('.research-faq')).toHaveCount(0);
      await expect(page.locator('main > section').last()).toHaveClass(/contact-band/);
      assert.equal(await page.locator('#success-title').evaluate(heading => heading.closest('section').nextElementSibling?.classList.contains('contact-band')), true);
      assert.deepEqual(errors, []); assert.deepEqual(failedAssets, []);
      await context.close(); console.log(`PASS onchain education ${width}: five themes, ten benefits, privacy/rollout boundaries, metadata, assets, deep link, removed FAQ and layout`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
