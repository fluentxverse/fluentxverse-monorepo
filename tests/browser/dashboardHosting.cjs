const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const path = require('node:path');
const { isIP } = require('node:net');

// Use real public assets/API responses without logging in or changing administrator accounts.
(async () => {
  const args = ['--no-sandbox'];
  if (process.env.DASHBOARD_DNS_IP) {
    assert(isIP(process.env.DASHBOARD_DNS_IP));
    args.push(`--host-resolver-rules=MAP dashboard.fluentxverse.com ${process.env.DASHBOARD_DNS_IP}`);
    console.log('NOTE: dashboard DNS override enabled; local DNS propagation is not verified');
  }
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args });
  const output = path.resolve(__dirname, '../../output/screenshots');
  await mkdir(output, { recursive: true });
  try {
    for (const width of [1566, 375]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors = [], apiCalls = [], badAssets = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => {
        const url = new URL(request.url());
        if (url.hostname.startsWith('api.fluentxverse.')) apiCalls.push(url);
      });
      page.on('response', response => {
        const url = new URL(response.url());
        if (url.hostname !== 'dashboard.fluentxverse.com' || !url.pathname.startsWith('/assets/')) return;
        if ((!response.ok() && response.status() !== 304) || (response.headers()['content-type'] || '').includes('text/html')) {
          badAssets.push({ path: url.pathname, status: response.status() });
        }
      });
      const root = await page.goto('https://dashboard.fluentxverse.com/', { waitUntil: 'networkidle' });
      assert.equal(root.status(), 200);
      assert.equal(root.headers()['x-content-type-options'], 'nosniff');
      await page.getByRole('heading', { name: 'Admin Dashboard', exact: true }).waitFor();
      assert(await page.getByLabel('Username', { exact: true }).isVisible());
      const password = page.getByLabel('Password', { exact: true });
      assert.equal(await password.getAttribute('type'), 'password');
      assert(await page.locator('.login-form button[type="submit"]').isEnabled());
      const probes = await page.evaluate(async () => {
        const results = {};
        for (const route of ['/admin/me', '/admin/recordings/']) {
          const response = await fetch(`https://api.fluentxverse.com${route}`, { credentials: 'include' });
          results[route] = response.status;
        }
        const response = await fetch('https://api.fluentxverse.com/admin/login', {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}',
        });
        results['/admin/login'] = response.status;
        return results;
      });
      assert.equal(probes['/admin/me'], 401);
      assert([401, 403].includes(probes['/admin/recordings/']), 'Private recordings must reject an anonymous session');
      assert([400, 422].includes(probes['/admin/login']), 'The login API must reject a missing-credentials payload');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: path.join(output, `dashboard-login-com-${width}.png`) });
      const nested = await page.goto('https://dashboard.fluentxverse.com/recordings', { waitUntil: 'networkidle' });
      assert.equal(nested.status(), 200);
      await page.getByRole('heading', { name: 'Admin Dashboard', exact: true }).waitFor();
      const refreshed = await page.reload({ waitUntil: 'networkidle' });
      assert.equal(refreshed.status(), 200);
      await page.getByRole('heading', { name: 'Admin Dashboard', exact: true }).waitFor();
      assert(apiCalls.some(url => url.pathname === '/admin/me'));
      assert(apiCalls.every(url => url.hostname === 'api.fluentxverse.com'));
      assert.deepEqual(errors, []);
      assert.deepEqual(badAssets, []);
      console.log(`PASS dashboard .com ${width}px: login UI, same-site API/CORS, protected recordings and deep-link refresh`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
