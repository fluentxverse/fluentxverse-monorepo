const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const base = process.env.TUTOR_TEST_URL || 'https://tutor.fluentxverse.com';
const fixture = process.env.TUTOR_HOSTING_FIXTURES === 'true';
const api = 'https://api.fluentxverse.com';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const screenshots = path.resolve('test-results/production-hosting');
  await fs.mkdir(screenshots, { recursive: true });
  try {
    for (const width of [1440, 375]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      if (fixture) await context.route(api + '/**', route => route.fulfill({
        status: route.request().url().endsWith('/health') ? 200 : 401,
        json: { success: false },
      }));
      await context.addInitScript(() => localStorage.setItem('fxv_theme', 'dark'));
      const page = await context.newPage();
      const errors = [], failedAssets = [], requests = [], sessions = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => requests.push({ url: request.url(), method: request.method() }));
      page.on('response', response => {
        if (response.url().startsWith(api + '/tutor/me')) sessions.push(response.status());
        if (new URL(response.url()).origin !== new URL(base).origin) return;
        if (['script', 'stylesheet', 'image', 'font'].includes(response.request().resourceType())) {
          if (!response.ok() && response.status() !== 304) failedAssets.push(response.url());
          if (response.headers()['content-type']?.includes('text/html')) failedAssets.push('Invalid asset MIME: ' + response.url());
        }
      });
      const sessionResponse = page.waitForResponse(response => response.url().startsWith(api + '/tutor/me')).catch(() => null);
      const response = await page.goto(base, { waitUntil: 'domcontentloaded' });
      assert.equal(response.status(), 200);
      assert.equal(await page.locator('meta[name="fxv-app-framework"]').getAttribute('content'), 'solidjs');
      await page.getByRole('heading', { name: /Teach English/ }).waitFor();
      if (width < 768) await page.getByRole('button', { name: 'Open mobile menu', exact: true }).click();
      await page.getByRole('button', { name: 'Login', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Sign in to your account', exact: true });
      await dialog.getByLabel('Email', { exact: true }).pressSequentially('hosting-check@example.test');
      assert.equal(await dialog.getByLabel('Email', { exact: true }).inputValue(), 'hosting-check@example.test');
      await dialog.getByLabel('Password', { exact: true }).fill('not-submitted');
      assert(await dialog.evaluate(element => element.matches(':modal')));
      await page.screenshot({ path: path.join(screenshots, `login-${width}.png`) });
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const health = await page.evaluate(async url => (await fetch(url, { credentials: 'include' })).status, api + '/health');
      assert.equal(health, 200, 'API health and tutor-origin CORS');
      const restoredSession = await sessionResponse;
      assert(restoredSession, 'Session restoration response was observed');
      assert.equal(restoredSession.status(), 401, 'Anonymous session is rejected by the production API');
      for (const route of ['/about', '/contact', '/become-tutor']) {
        await page.goto(base + route, { waitUntil: 'domcontentloaded' });
        await page.locator('h1').waitFor();
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.locator('h1').waitFor();
        assert.equal(await page.locator('meta[name="fxv-app-framework"]').getAttribute('content'), 'solidjs');
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
        assert.equal(await page.locator('.header-theme-switch, .mobile-theme-row').count(), 0);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.screenshot({ path: path.join(screenshots, `${route.slice(1)}-${width}.png`) });
      }
      await page.goto(base + '/schedule', { waitUntil: 'domcontentloaded' });
      await page.waitForURL(base + '/');
      await page.getByRole('heading', { name: /Teach English/ }).waitFor();
      assert.equal(requests.filter(request => /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(request.url) && !request.url.startsWith(base)).length, 0);
      assert(requests.some(request => request.url.startsWith(api + '/tutor/me')));
      assert.equal(requests.filter(request => request.method !== 'GET' && request.method !== 'OPTIONS' && request.url.startsWith(api)).length, 0, 'Probe never writes production data');
      assert.deepEqual(failedAssets, []);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS tutor ${width}: SolidJS, API/CORS, anonymous guards, stable login fields, assets, public light mode and deep-link refresh${fixture ? ' (fixture API)' : ''}`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
