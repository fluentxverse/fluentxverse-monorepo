const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  fs.mkdirSync('/tmp/fluentxverse-interview-period', { recursive: true });
  try {
    for (const [width, timezoneId] of [[1440, 'America/Los_Angeles'], [390, 'Asia/Tokyo']]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId });
      let calendarReads = 0;
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === base) return route.continue();
        const path = url.pathname;
        const json = { success: true, data: [] };
        if (path === '/tutor/me') json.user = { userId: 'period-test', firstName: 'Test', email: 'test@example.invalid', role: 'tutor' };
        if (path === '/interview/available') calendarReads++;
        if (path === '/interview/my-booking') json.data = null;
        if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        if (path === '/notifications/unread-count') json.data = { unreadCount: 0 };
        return route.fulfill({ json });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.install({ time: new Date('2026-10-27T11:59:59+08:00') });
      await page.clock.pauseAt(new Date('2026-10-27T11:59:59+08:00'));
      await page.goto(`${base}/interview`, { waitUntil: 'domcontentloaded' });
      const status = page.getByRole('status', { name: 'Current Manila time period' });
      await expect(status).toHaveText('Morning');
      await expect(page.locator('.time-label').first()).toHaveText('5:00 AM');
      assert.equal(await page.locator('.period-tabs button').count(), 0);
      const reads = calendarReads;
      await page.clock.fastForward(1000);
      await expect(status).toHaveText('Afternoon');
      await expect(page.locator('.time-label').first()).toHaveText('12:00 PM');
      await expect(page.locator('.time-label').last()).toHaveText('5:30 PM');
      await page.clock.setSystemTime(new Date('2026-10-27T17:59:59+08:00'));
      await page.clock.fastForward(1000);
      await expect(status).toHaveText('Evening');
      await expect(page.locator('.time-label').first()).toHaveText('6:00 PM');
      await expect(page.locator('.time-label').last()).toHaveText('11:30 PM');
      await page.screenshot({ path: `/tmp/fluentxverse-interview-period/evening-${width}.png` });
      await page.clock.setSystemTime(new Date('2026-10-28T00:00:00+08:00'));
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await expect(status).toHaveText('Morning');
      assert.equal(calendarReads, reads, 'Period updates do not refetch availability');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      // Unmount the page and ensure its clock listener does not cause navigation errors.
      await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
      await page.clock.fastForward(2000);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px ${timezoneId}: automatic periods, boundaries, wake and no extra availability requests`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
