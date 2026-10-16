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
      await page.goto(`${base}/contact`, { waitUntil: 'domcontentloaded' });
      await page.locator('.contact-us-page-header h1').waitFor();
      await page.waitForFunction(() => document.body.dataset.theme === 'light');
      assert.equal(await page.locator('.header-theme-switch, .mobile-theme-row').count(), 0);
      assert.equal(await page.locator('.contact-card-icon i, .contact-faq-icon i').count(), 0);
      assert.equal(await page.locator('.contact-us-page-wrapper img').count(), 8);
      assert.equal(await page.getByRole('link', { name: 'Send Email' }).getAttribute('href'), 'mailto:support@fluentxverse.com');
      assert.equal(await page.getByRole('link', { name: 'Apply Now' }).getAttribute('href'), '/register');
      assert.equal(await page.getByRole('button', { name: 'Viber unavailable' }).isDisabled(), true);
      assert.equal(await page.locator('a[href^="viber:"]').count(), 0);
      for (const img of await page.locator('.contact-us-page-wrapper img').all()) {
        await img.scrollIntoViewIfNeeded();
        await img.evaluate(img => img.decode());
      }
      const result = await page.evaluate(() => ({
        theme: document.documentElement.dataset.theme,
        observed: window.observedThemes,
        stored: JSON.parse(localStorage.getItem('theme-storage')).state.themeMode,
        overflow: document.documentElement.scrollWidth > innerWidth,
        background: getComputedStyle(document.querySelector('.contact-us-page-wrapper')).backgroundColor,
        pixels: [...document.querySelectorAll('.contact-illustration')].map(img => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let occupied = 0;
          for (let i = 3; i < data.length; i += 4) if (data[i] > 0) occupied++;
          return { occupied, cornerAlpha: data[3], size: img.naturalWidth };
        }),
        overlaps: [...document.querySelectorAll('.contact-faq-card')].some(card =>
          card.querySelector('img').getBoundingClientRect().bottom > card.querySelector('h3').getBoundingClientRect().top),
      }));
      assert.equal(result.theme, 'light');
      assert.equal(result.background, 'rgb(255, 255, 255)');
      assert.ok(!result.observed.includes('dark'), 'No dark-mode flash');
      assert.equal(result.stored, themeMode);
      assert.equal(result.overflow, false);
      assert.equal(result.overlaps, false);
      for (const pixels of result.pixels) {
        assert.equal(pixels.size, 384);
        assert.equal(pixels.cornerAlpha, 0);
        assert.ok(pixels.occupied > 10000);
      }
      if (width === 375) {
        await page.getByRole('button', { name: 'Open mobile menu' }).click();
        assert.equal(await page.locator('.mobile-theme-row').count(), 0);
        await page.getByRole('button', { name: 'Close mobile menu' }).click();
        await page.getByRole('dialog', { name: 'Navigation', exact: true }).waitFor({ state: 'detached' });
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `../output/screenshots/contact-${width}-${themeMode}.png`, fullPage: true });
      assert.deepEqual(errors, []);
      await page.goto(`${base}/privacy-policy`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
      console.log(`PASS Contact ${width}px ${themeMode}: light, custom images, no selector/overflow/overlap, working links`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
