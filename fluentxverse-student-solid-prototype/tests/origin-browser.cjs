const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    await fs.mkdir('test-results', { recursive: true });
    for (const width of [1440, 768, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      await context.addCookies([{ name: 'studentAuth', value: 'production-session-sentinel', domain: '127.0.0.1', path: '/' }, { name: 'fxvSolidLabAuth', value: 'invalid-lab-session', domain: '127.0.0.1', path: '/' }]);
      const page = await context.newPage();
      const errors = []; let oauthCalls = 0;
      let approved = false;
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (request.url().includes('/oauth/init') || request.url().includes('/oauth/authenticate')) oauthCalls++; });
      // Deterministic blocked-origin fixture; only public config is modified in this
      // ephemeral browser. No dashboard, real app configuration, or token is changed.
      await page.route('**/api/v1/apps/*', async route => {
        const response = await route.fetch();
        const config = await response.json();
        await route.fulfill({ response, json: { ...config, google_oauth: true, twitter_oauth: true, apple_oauth: false, allowed_domains: approved ? ['http://127.0.0.1:5176'] : ['https://student.fluentxverse.com'] } });
      });
      await page.goto(`${process.env.PROTOTYPE_URL || 'http://127.0.0.1:5176/compatibility'}/?mode=live`);
      assert.equal(await page.getByLabel('Student API URL').inputValue(), 'http://127.0.0.1:8776');
      await page.getByRole('button', { name: 'Check configuration', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Privy has not approved http://127.0.0.1:5176' }).waitFor();
      await page.locator('.origin-details').getByText('API: Reachable', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Apple', exact: true }).isDisabled(), true);
      assert.equal(await page.getByRole('link', { name: 'Privy dashboard' }).getAttribute('href'), 'https://dashboard.privy.io');
      await page.getByRole('button', { name: 'Google', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Add this exact origin' }).waitFor();
      assert.equal(oauthCalls, 0, 'Blocked origin attempted OAuth initiation.');
      const result = await page.evaluate(async () => {
        const request = (path, method) => fetch(`http://127.0.0.1:8776${path}`, { method, credentials: 'include', ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: '{}' } : {}) });
        const me = await request('/student/me', 'GET');
        const registration = await request('/student/register', 'POST');
        const logout = await request('/student/logout', 'POST');
        return { me: me.status, registration: registration.status, logout: logout.status };
      });
      assert.deepEqual(result, { me: 401, registration: 404, logout: 200 });
      const cookies = await context.cookies('http://127.0.0.1:8776');
      assert.equal(cookies.find(cookie => cookie.name === 'studentAuth')?.value, 'production-session-sentinel');
      assert.equal(cookies.some(cookie => cookie.name === 'fxvSolidLabAuth'), false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `test-results/origin-${width}.png`, fullPage: true });
      approved = true;
      await page.getByRole('button', { name: 'Check configuration', exact: true }).click();
      await page.locator('.origin-details').getByText('Privy: Approved', { exact: true }).waitFor();
      assert.equal(await page.getByRole('alert').count(), 0, 'Configuration retry did not clear the stale error.');
      // A verified session updates reachability without a separate configuration check.
      await page.reload();
      await page.locator('.origin-details').getByText('API: Not checked', { exact: true }).waitFor();
      await page.route('http://127.0.0.1:8776/student/me', route => route.fulfill({
        json: { user: { userId: 'status-fixture', role: 'student', givenName: 'Test student' } },
      }));
      await page.getByRole('button', { name: 'Check session', exact: true }).click();
      await page.locator('.origin-details').getByText('API: Reachable', { exact: true }).waitFor();
      await page.getByText('Verified by API', { exact: true }).waitFor();
      assert.deepEqual(errors, []);
      console.log(`${width}px: actionable origin error, reachable API, cookie isolation, and blocked registration passed.`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
