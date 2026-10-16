const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [1566, 768, 375]) for (const themeMode of ['dark', 'system']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: 'dark' });
      await context.addInitScript(themeMode => {
        localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode }, version: 2 }));
        window.observedThemes = [];
        new MutationObserver(records => {
          for (const record of records) if (record.target === document.documentElement) {
            window.observedThemes.push(document.documentElement.dataset.theme);
          }
        }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-theme'] });
      }, themeMode);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/about`, { waitUntil: 'domcontentloaded' });
      await page.locator('.about-hero-title').waitFor();
      await page.waitForFunction(() => document.body.dataset.theme === 'light');
      assert.equal(await page.locator('.header-theme-switch, .mobile-theme-row').count(), 0);
      assert.equal(await page.locator('.value-icon i, .highlight-icon i').count(), 0);
      assert.equal(await page.locator('.value-icon img, .highlight-icon img').count(), 7);
      for (const img of await page.locator('.about-us-wrapper img').all()) {
        await img.scrollIntoViewIfNeeded();
        await img.evaluate(img => img.decode());
      }
      const result = await page.evaluate(() => ({
        theme: document.documentElement.dataset.theme,
        observed: window.observedThemes,
        stored: JSON.parse(localStorage.getItem('theme-storage')).state.themeMode,
        overflow: document.documentElement.scrollWidth > innerWidth,
        background: getComputedStyle(document.querySelector('.about-us-wrapper')).backgroundColor,
        pixels: [...document.querySelectorAll('.about-illustration')].map(img => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let occupied = 0;
          for (let i = 3; i < data.length; i += 4) if (data[i] > 0) occupied++;
          return { occupied, cornerAlpha: data[3], size: img.naturalWidth };
        }),
      }));
      assert.equal(result.theme, 'light');
      assert.equal(result.background, 'rgb(255, 255, 255)');
      assert.ok(!result.observed.includes('dark'), 'No dark-mode flash');
      assert.equal(result.stored, themeMode);
      assert.equal(result.overflow, false);
      for (const pixels of result.pixels) {
        assert.equal(pixels.size, 384);
        assert.equal(pixels.cornerAlpha, 0);
        assert.ok(pixels.occupied > 10000, 'Custom image renders nonblank');
      }
      if (width === 375) {
        await page.getByRole('button', { name: 'Open mobile menu' }).click();
        assert.equal(await page.locator('.mobile-theme-row').count(), 0);
        await page.getByRole('button', { name: 'Close mobile menu' }).click();
        await page.getByRole('dialog', { name: 'Navigation', exact: true }).waitFor({ state: 'detached' });
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `../output/screenshots/about-${width}-${themeMode}.png`, fullPage: true });
      assert.deepEqual(errors, []);
      await page.goto(`${base}/privacy-policy`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
      console.log(`PASS About ${width}px ${themeMode}: light, no theme selector, custom images, no overflow, preference preserved`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
