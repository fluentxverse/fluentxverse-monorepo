const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  await fs.mkdir('../output/screenshots/browse-time-filter', { recursive: true });
  try {
    for (const width of [1566, 375, 320]) for (const timezoneId of ['America/Los_Angeles', 'Asia/Tokyo']) {
      const context = await browser.newContext({ viewport: { width, height: 950 }, timezoneId });
      const searches = [], errors = [];
      await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780))\//, route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/student/me') return route.fulfill({ status: 401, json: { success: false } });
        if (url.pathname === '/tutor/search') searches.push(Object.fromEntries(url.searchParams));
        return route.fulfill({ json: { success: true, data: { tutors: [], total: 0, hasMore: false } } });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.setFixedTime(new Date('2026-10-23T03:12:00Z'));
      await page.goto(base + '/browse-tutors');
      await expect(page.locator('.browse-grid')).toHaveAttribute('aria-busy', 'false');
      const mobile = width < 768;
      if (mobile) await page.getByRole('button', { name: 'Filters', exact: true }).click();
      const start = page.getByLabel(mobile ? 'Start time in filters' : 'Start time', { exact: true });
      const end = page.getByLabel(mobile ? 'End time in filters' : 'End time', { exact: true });
      await expect(start).toHaveValue('11:30');
      await expect(end).toHaveValue('12:00');
      assert.equal((await start.locator('option').first().textContent()), '12:30');
      assert.deepEqual([searches[0].dateFilter, searches[0].startTime, searches[0].endTime], ['2026-10-23', '11:30', '12:00']);
      const chooseDay = async index => {
        if (mobile) await page.getByLabel('Lesson day', { exact: true }).selectOption({ index });
        else await page.locator('.browse-day-strip button').nth(index).click();
      };
      await chooseDay(1);
      await expect(start.locator('option').first()).toHaveAttribute('value', '05:00');
      await start.selectOption({ value: '05:00' });
      await chooseDay(0);
      await expect(start).toHaveValue('11:30');
      assert.equal(await start.locator('option[value="05:00"]').count(), 0);
      await page.clock.setFixedTime(new Date('2026-10-23T03:25:00.001Z'));
      await expect(start).toHaveValue('12:00');
      await expect(end).toHaveValue('12:30');
      assert.equal(await start.locator('option[value="11:30"]').count(), 0);
      await expect(page.locator('.browse-grid')).toHaveAttribute('aria-busy', 'false');
      const settled = searches.length;
      await page.waitForTimeout(2200);
      assert.equal(searches.length, settled, 'Clock ticks do not refetch an unchanged window');
      await start.selectOption({ value: '14:30' });
      await expect(end).toHaveValue('15:00');
      if (mobile) await page.getByRole('dialog').getByRole('button', { name: 'Reset', exact: true }).click();
      else await page.getByRole('button', { name: 'Reset filters', exact: true }).first().click();
      await expect(start).toHaveValue('12:00');
      await expect(end).toHaveValue('12:30');
      await page.clock.setFixedTime(new Date('2026-10-23T15:25:00.001Z'));
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await expect(start).toHaveValue('05:00');
      await expect(end).toHaveValue('05:30');
      await expect(page.locator('.browse-day-strip button').first()).toBeDisabled();
      await expect(page.locator('.browse-day-strip button').nth(1)).toHaveAttribute('aria-pressed', 'true');
      await page.clock.setFixedTime(new Date('2026-10-23T16:00:00Z'));
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await expect(page.locator('.browse-day-strip button').first()).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.browse-day-strip button').first()).toBeEnabled();
      await page.screenshot({ path: `../output/screenshots/browse-time-filter/${width}-${timezoneId.replace('/', '-')}.png` });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS browse time ${width}/${timezoneId}: defaults, elapsed options, timer, reset and midnight`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
