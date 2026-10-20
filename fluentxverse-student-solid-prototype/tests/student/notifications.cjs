const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';
const apiPattern = /^(http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780)|https:\/\/api\.fluentxverse\.(?:com|xyz))\//;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [1566, 375]) {
      const context = await browser.newContext({ viewport: { width, height: 800 } });
      let failures = 1, requests = 0, empty = false, delay = 0;
      const errors = [];
      await context.route(apiPattern, async route => {
        const path = new URL(route.request().url()).pathname;
        const reply = json => route.fulfill({ json });
        if (path === '/student/me') return reply({ success: true, user: { userId: 'notification-student', role: 'student', givenName: 'Mika', email: 'mika@example.test' } });
        if (path === '/notifications/') {
          requests++;
          if (delay) await new Promise(resolve => setTimeout(resolve, delay));
          if (failures-- > 0) return route.fulfill({ status: 503, json: { success: false } });
          return reply({ success: true, data: { notifications: empty ? [] : [{ id: 'notice-fixture', title: 'Lesson feedback ready', message: 'Your tutor has submitted your lesson notes.', timestamp: '2026-10-16T06:56:59Z', isRead: false, data: { link: '/lesson/booking-fixture' } }] } });
        }
        return reply({ success: true, data: [], lessons: [], profile: {} });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/contact');
      const bell = page.getByRole('button', { name: /^Notifications/ });
      await bell.click();
      const dialog = page.getByRole('dialog', { name: 'Notifications', exact: true });
      await expect(dialog.getByText('Lesson feedback ready')).toBeVisible();
      assert.ok(requests >= 2, 'transient failure retried');
      await expect(dialog.getByRole('alert')).toHaveCount(0);
      await page.keyboard.press('Escape');

      failures = 2;
      await bell.click();
      await expect(dialog.getByRole('alert')).toContainText('Could not refresh notifications. Showing the last update.');
      await expect(dialog.getByText('Lesson feedback ready')).toBeVisible();
      await dialog.getByRole('button', { name: 'Retry' }).click();
      await expect(dialog.getByRole('alert')).toHaveCount(0);
      await expect(dialog.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false');
      await page.keyboard.press('Escape');

      failures = 2;
      await bell.click();
      await expect(dialog.getByRole('alert')).toBeVisible();
      await page.keyboard.press('Escape');
      delay = 200;
      empty = true;
      await bell.click();
      await expect(dialog.getByText('No notifications yet.')).toBeVisible();
      await expect(dialog.getByRole('alert')).toHaveCount(0);
      await expect(dialog.getByText('Lesson feedback ready')).toHaveCount(0);
      const fits = await dialog.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
      });
      assert.ok(fits, 'notification dialog fits viewport');

      await page.keyboard.press('Escape');
      failures = 2;
      delay = 0;
      await page.reload();
      await bell.click();
      await expect(dialog.getByRole('alert')).toContainText('Could not load notifications.');
      await expect(dialog.getByText('No notifications yet.')).toHaveCount(0);
      empty = false;
      await dialog.getByRole('button', { name: 'Retry' }).click();
      await expect(dialog.getByText('Lesson feedback ready')).toBeVisible();
      await expect(dialog.getByRole('alert')).toHaveCount(0);
      assert.deepEqual(errors, []);
      console.log(`PASS notifications ${width}: transient recovery, retry, stale feed, reopen, empty and initial failure`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
