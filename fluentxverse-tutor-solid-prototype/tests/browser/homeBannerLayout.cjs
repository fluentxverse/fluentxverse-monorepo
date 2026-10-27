const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';
const screenshots = process.env.BANNER_SCREENSHOTS || '/tmp/fluentxverse-home-banner';

(async () => {
  fs.mkdirSync(screenshots, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [320, 375, 390, 430, 575, 767, 768, 991, 992, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/tutor/me', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Unauthorized"}' }));
      await page.goto(base, { waitUntil: 'networkidle' });
      await page.locator('.hero-image').evaluate(img => img.decode());
      await page.locator('.hero-features .home-illustration').evaluateAll(images => Promise.all(images.map(img => img.decode())));
      await page.evaluate(() => document.fonts.ready);
      const geometry = await page.locator('.hero-section').evaluate(hero => {
        const rect = el => el.getBoundingClientRect().toJSON();
        const image = hero.querySelector('.hero-image');
        return {
          hero: rect(hero), image: rect(image),
          imageRatio: image.naturalWidth / image.naturalHeight,
          content: rect(hero.querySelector('.hero-content')),
          header: rect(document.querySelector('#sticky-header')),
          features: rect(hero.querySelector('.hero-features')),
          rows: [...hero.querySelectorAll('.feature-badge')].map(row => ({
            row: rect(row), icon: rect(row.querySelector('.feature-illustration')),
            text: rect(row.querySelector('span')),
          })),
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      assert.equal(geometry.overflow, false, `${width}px: no horizontal overflow`);
      assert.equal(geometry.rows.length, 3);
      assert.equal(await page.locator('.hero-buttons .primary').getAttribute('href'), '/register');
      assert.equal(await page.locator('.hero-buttons .secondary').getAttribute('href'), '/about');
      if (width <= 991) {
        assert.ok(Math.abs(geometry.image.x + geometry.image.width / 2 - width / 2) < 1, `${width}px: banner image centered`);
        assert.ok(geometry.image.left >= 19 && geometry.image.right <= width - 19, 'Equal image gutters');
        assert.ok(Math.abs(geometry.image.width / geometry.image.height - geometry.imageRatio) < 0.01, 'Image proportions preserved');
        assert.ok(geometry.image.top >= geometry.header.bottom, 'Image clears navigation');
        assert.ok(geometry.content.top >= geometry.image.bottom + 20, 'Copy clears image');
      }
      if (width <= 767) {
        const [first, ...rest] = geometry.rows;
        assert.ok(Math.abs(geometry.features.x + geometry.features.width / 2 - width / 2) < 1, 'Benefits group centered');
        for (const row of geometry.rows) {
          assert.equal(row.icon.width, 40);
          assert.equal(row.icon.height, 40);
          assert.ok(row.text.left >= row.icon.right + 10, 'Icon and text do not overlap');
          assert.ok(row.text.right <= row.row.right + 1, 'Text fits row');
        }
        for (const row of rest) {
          assert.ok(Math.abs(row.icon.left - first.icon.left) < 1, 'Icons share a column');
          assert.ok(Math.abs(row.text.left - first.text.left) < 1, 'Text shares a column');
        }
        for (let i = 1; i < geometry.rows.length; i++) {
          const gap = geometry.rows[i].row.top - geometry.rows[i - 1].row.bottom;
          assert.ok(gap >= 0 && gap <= 8, 'Compact, non-overlapping benefit rows');
        }
        await page.locator('.hero-features').screenshot({ path: `${screenshots}/benefits-${width}.png` });
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${screenshots}/home-${width}.png` });
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: banner geometry, benefits, links and no overflow`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
