const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const base = process.env.STUDENT_TEST_URL || 'https://student.fluentxverse.com';

async function openLogin(page) {
  await page.waitForFunction(() => [...document.querySelectorAll('.login-btn, .mobile-nav-toggler')].some(element => element.getClientRects().length > 0));
  if (!await page.locator('.login-btn').isVisible()) await page.getByRole('button', { name: 'Open mobile menu', exact: true }).click();
  await page.locator('.login-btn:visible, .mobile-login-btn:visible').first().click();
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const screenshots = path.resolve('test-results/production-hosting');
  await fs.mkdir(screenshots, { recursive: true });
  try {
    for (const [width, height] of [[1440, 900], [375, 812]]) {
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage();
      const errors = [], failedAssets = [], localRequests = [], sessionStatuses = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => {
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(request.url())) localRequests.push(request.url());
      });
      page.on('response', response => {
        if (new URL(response.url()).origin !== new URL(base).origin) return;
        const request = response.request();
        if (!['script', 'stylesheet', 'image', 'font'].includes(request.resourceType())) return;
        if (!response.ok() && response.status() !== 304) failedAssets.push(`${response.status()} ${response.url()}`);
        if (response.status() === 200) {
          const type = response.headers()['content-type'] || '';
          if (request.resourceType() === 'script' && !/javascript/.test(type)) failedAssets.push(`Invalid script MIME ${response.url()}`);
          if (request.resourceType() === 'stylesheet' && !type.startsWith('text/css')) failedAssets.push(`Invalid stylesheet MIME ${response.url()}`);
          if (request.resourceType() === 'image' && !type.startsWith('image/')) failedAssets.push(`Invalid image MIME ${response.url()}`);
        }
      });
      page.on('response', response => {
        if (response.url().startsWith('https://api.fluentxverse.com/student/me')) sessionStatuses.push(response.status());
      });
      const response = await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
      assert.equal(response.status(), 200);
      assert.equal(await page.locator('meta[name="fxv-app-framework"]').getAttribute('content'), 'solidjs');
      await page.locator('.hero-stage__canvas').waitFor();
      await openLogin(page);
      await page.getByRole('button', { name: 'Continue with Google' }).waitFor();
      await page.waitForFunction(() => { const button = document.querySelector('.google-btn'); return button && !button.disabled; });
      assert.equal(await page.getByText('Social sign-in is not configured for this environment.', { exact: true }).count(), 0);
      await page.screenshot({ path: path.join(screenshots, `login-${width}.png`) });
      await page.getByRole('button', { name: 'Close sign in', exact: true }).click();
      await page.screenshot({ path: path.join(screenshots, `home-${width}.png`) });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const health = await page.evaluate(async () => {
        const result = await fetch('https://api.fluentxverse.com/health', { credentials: 'include' });
        return result.status;
      });
      assert.equal(health, 200, 'Production API must be reachable with student-origin CORS');
      assert.ok(sessionStatuses.includes(401), `Expected anonymous cookie check, got ${sessionStatuses}`);
      await page.goto(`${base}/browse-tutors`, { waitUntil: 'domcontentloaded' });
      await page.locator('.browse-page').waitFor();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('.browse-page').waitFor();
      assert.equal(await page.locator('meta[name="fxv-app-framework"]').getAttribute('content'), 'solidjs');
      await page.screenshot({ path: path.join(screenshots, `browse-${width}.png`) });
      if (width === 1440) {
        await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
        await openLogin(page);
        await page.waitForFunction(() => { const button = document.querySelector('.google-btn'); return button && !button.disabled; });
        const redirect = page.waitForURL(url => url.hostname === 'accounts.google.com', { timeout: 45000, waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'Continue with Google' }).click();
        await redirect;
        assert.ok(new URL(page.url()).searchParams.get('redirect_uri'), 'Google OAuth authorization was reached');
      }
      assert.deepEqual(localRequests, [], 'Production must never request the local API harness');
      assert.deepEqual(failedAssets, [], 'App assets must load successfully');
      assert.deepEqual(errors, [], 'No uncaught browser errors');
      console.log(`PASS ${base} ${width}: SolidJS, production API/CORS, Privy initialization, assets, deep-link refresh${width === 1440 ? ', Google OAuth initiation' : ''}`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
