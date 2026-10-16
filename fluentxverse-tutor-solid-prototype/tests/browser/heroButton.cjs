const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [1566, 375]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      const button = page.locator('.hero-buttons .cta-button.primary');
      await button.waitFor();
      assert.equal(await button.getAttribute('href'), '/register');
      for (const state of ['default', 'hover', 'focus']) {
        if (state === 'hover') await button.hover();
        if (state === 'focus') {
          await page.mouse.move(0, 0);
          await button.focus();
        }
        const paint = await button.evaluate(el => {
          const style = getComputedStyle(el);
          return { origin: style.backgroundOrigin, repeat: style.backgroundRepeat, radius: style.borderRadius, border: style.borderWidth };
        });
        assert.equal(paint.origin, 'border-box');
        assert.equal(paint.repeat, 'no-repeat');
        assert.equal(paint.radius, '50px');
        assert.equal(paint.border, '2px');
        await button.screenshot({ path: `../output/screenshots/hero-button-${width}-${state}.png` });
      }
      console.log(`PASS ${width}px: seamless button fill in default, hover and focus states`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
