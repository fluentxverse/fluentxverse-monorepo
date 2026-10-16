const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [1566, 375]) for (const themeMode of ['dark', 'system']) {
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
      await page.goto(`${base}/become-tutor`, { waitUntil: 'domcontentloaded' });
      await page.locator('.tutor-hero-title').waitFor();
      await page.waitForFunction(() => document.body.dataset.theme === 'light');
      assert.equal(await page.locator('.header-theme-switch, .mobile-theme-row').count(), 0);
      const result = await page.evaluate(() => ({
        root: document.documentElement.dataset.theme,
        scheme: document.documentElement.style.colorScheme,
        observed: window.observedThemes,
        stored: JSON.parse(localStorage.getItem('theme-storage')).state.themeMode,
        background: getComputedStyle(document.querySelector('.tutor-requirements-section')).backgroundColor,
      }));
      assert.equal(result.root, 'light');
      assert.equal(result.scheme, 'light');
      assert.ok(!result.observed.includes('dark'), 'No initial dark-mode flash');
      assert.equal(result.stored, themeMode, 'Saved theme preference is preserved');
      assert.equal(result.background, 'rgb(255, 255, 255)');
      if (width === 375) {
        await page.getByRole('button', { name: 'Open mobile menu' }).click();
        assert.equal(await page.locator('.mobile-theme-row').count(), 0);
        await page.getByRole('button', { name: 'Close mobile menu' }).click();
        await page.getByRole('dialog', { name: 'Navigation', exact: true }).waitFor({ state: 'detached' });
      } else {
        await page.getByRole('button', { name: 'Login', exact: true }).click();
        await page.getByRole('dialog', { name: 'Sign in to your account' }).waitFor();
        assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
        await page.getByRole('dialog', { name: 'Sign in to your account' }).getByRole('button', { name: 'Close login modal' }).click();
      }
      await page.screenshot({ path: `../output/screenshots/become-tutor-light-${width}-${themeMode}.png` });
      await page.goto(`${base}/privacy-policy`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('theme-storage')).state.themeMode), themeMode);
      console.log(`PASS ${width}px ${themeMode}: public page stays light, no selector, preference preserved`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
