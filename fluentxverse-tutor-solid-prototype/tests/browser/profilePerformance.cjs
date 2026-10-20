const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';
const baseline = process.env.PROFILE_PERF_BASELINE === '1';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const measurements = [];
  try {
    for (const width of [1440, 375]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const user = { userId: 'profile-perf-fixture', firstName: 'Profile', lastName: 'Tutor', role: 'tutor', email: 'paulanthonyarriola@gmail.com' };
      const errors = [], writes = [], assets = [];
      let reads = 0, personalReads = 0, fail = false, version = 0, screeningSettled = false;
      await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, async route => {
        const req = route.request(), path = new URL(req.url()).pathname;
        let json = { success: true, user, data: [], status: { passed: true } };
        if (!['GET', 'OPTIONS'].includes(req.method())) {
          writes.push(path);
          if (path === '/tutor/profile') { version++; return route.fulfill({ json: { success: true, hasPendingChanges: false } }); }
          return route.fulfill({ status: 400, json: { success: false } });
        }
        if (path === '/tutor/profile') {
          reads++;
          await new Promise(resolve => setTimeout(resolve, 200));
          if (fail) return route.fulfill({ status: 503, json: { success: false } });
          json.data = { ...user, rating: 5, totalReviews: 1, schoolAttended: 'Example University', major: 'Language Education', bio: version ? 'Updated biography from the server.' : 'A profile that should appear without waiting for other services.', education: [], interests: [], profileStatus: 'incomplete' };
        }
        if (path === '/tutor/user/personal-info') { personalReads++; await new Promise(resolve => setTimeout(resolve, 1600)); json.data = { schoolAttended: 'Example University', major: 'Language Education' }; }
        if (path === '/screening/me') { await new Promise(resolve => setTimeout(resolve, 1600)); screeningSettled = true; json.data = { enabled: false, credentials: [] }; }
        if (path.startsWith('/notifications')) json.data = { notifications: [], unreadCount: 0 };
        if (path === '/schedule/week') json.data = { slots: [] };
        return route.fulfill({ json });
      });
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => assets.push(new URL(request.url()).pathname));
      const start = performance.now();
      await page.goto(base + '/profile', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.profile-name')).toHaveText('Profile Tutor');
      const coldMs = Math.round(performance.now() - start);
      measurements.push({ width, coldMs, profileReads: reads, personalReads });
      console.log(`${baseline ? 'BASELINE' : 'PASS'} profile ${width}: visible in ${coldMs}ms, ${reads} profile read, ${personalReads} personal-info reads (200ms profile + 1600ms secondary API fixtures)`);
      if (!baseline) {
        assert.equal(personalReads, 0, 'Profile reuses education in its existing response');
        assert.equal(screeningSettled, false, 'Profile displays before the secondary screening request completes');
        assert.equal(assets.includes('/assets/img/logo/icon_logo.png'), false, 'Navigation avoids the oversized PNG logo');
        const logo = page.locator('img[src="/assets/img/logo/icon_logo.webp"]:visible').first();
        await expect(logo).toBeVisible();
        await expect.poll(() => logo.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
        if (['localhost', '127.0.0.1'].includes(new URL(base).hostname)) assert.ok(coldMs < 1600, 'Local profile display budget');
        else {
          const resources = await page.evaluate(() => ({ navigation: performance.getEntriesByType('navigation').map(e => e.toJSON()), resources: performance.getEntriesByType('resource').map(e => e.toJSON()) }));
          await fs.writeFile(`../output/release/profile-live-resources-${width}.json`, JSON.stringify(resources, null, 2));
        }
        await expect(page.getByText('Example University', { exact: true })).toBeVisible();
        const visit = href => page.evaluate(href => { const a = document.createElement('a'); a.href = href; document.body.append(a); a.click(); a.remove(); }, href);
        await visit('/materials'); await expect(page.getByRole('heading', { name: 'Learning Materials', exact: true })).toBeVisible();
        const warm = performance.now();
        await page.goBack(); await expect(page.locator('.profile-name')).toBeVisible();
        assert.equal(reads, 1, 'Returning promptly reuses account-scoped memory');
        assert.equal(await page.locator('.my-profile-loading').count(), 0);
        measurements.at(-1).warmMs = Math.round(performance.now() - warm);
        await page.locator('.btn-edit-inline').first().click();
        const dialog = page.getByRole('dialog').filter({ has: page.locator('textarea') });
        await dialog.locator('textarea').fill('Updated biography from the server.');
        await dialog.getByRole('button', { name: /Save/ }).click();
        await expect(dialog).toHaveCount(0);
        await visit('/materials'); await expect(page.getByRole('heading', { name: 'Learning Materials', exact: true })).toBeVisible();
        await page.goBack(); await expect(page.locator('.profile-bio-short')).toHaveText('Updated biography from the server.');
        assert.equal(reads, 2, 'Successful edits invalidate the cached profile');
        await visit('/materials'); await expect(page.getByRole('heading', { name: 'Learning Materials', exact: true })).toBeVisible();
        fail = true;
        await page.reload();
        await visit('/profile');
        await expect(page.getByRole('alert').filter({ hasText: 'Could not load your profile' })).toBeVisible();
        assert.equal(await page.locator('.profile-name').count(), 0, 'A failed read does not present an editable empty profile');
        fail = false;
        await page.getByRole('button', { name: 'Try again', exact: true }).click();
        await expect(page.locator('.profile-name')).toBeVisible();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        assert.deepEqual(writes, ['/tutor/profile']); assert.deepEqual(errors, []);
        console.log(`PASS profile ${width}: cached return, education, edit invalidation, failed load and retry`);
      }
      await context.close();
    }
    await fs.mkdir('../output/release', { recursive: true });
    await fs.writeFile(`../output/release/profile-${baseline ? 'before' : base.startsWith('https://') ? 'live-after' : 'after'}.json`, JSON.stringify(measurements, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
