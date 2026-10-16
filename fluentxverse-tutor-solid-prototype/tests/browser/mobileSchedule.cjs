const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';
const output = process.env.SCHEDULE_SCREENSHOTS || '/tmp/fluentxverse-tutor-mobile-schedule';
const user = { userId: 'mobile-schedule', firstName: 'Alex', lastName: 'Teacher', email: 'layout@example.test', role: 'tutor' };

(async () => {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const [width, theme] of [[320, 'light'], [375, 'light'], [393, 'dark'], [430, 'light'], [767, 'light'], [1440, 'light']]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme }, version: 2 })), theme);
      const errors = [], writes = [], submissions = [];
      const headers = {
        'Access-Control-Allow-Origin': new URL(base).origin, 'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control, Pragma',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      };
      await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, route => {
        const request = route.request(), url = new URL(request.url());
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (request.method() === 'POST' && url.pathname === '/schedule/open') {
          submissions.push(request.postDataJSON());
          return route.fulfill({ headers, json: { success: false, error: 'Mocked submission: no slots were changed.' } });
        }
        if (!['GET', 'OPTIONS'].includes(request.method())) { writes.push(url.pathname); return route.abort(); }
        let json = { success: true, user, data: [], status: { passed: true } };
        if (url.pathname === '/proof/tutor-certification/me') json.data = {
          snapshot: { tutorId: user.userId, missingRequirements: [] }, credential: { status: 'verified' },
        };
        if (url.pathname === '/schedule/week') json.data = {
          slots: url.searchParams.get('weekOffset') === '0' ? [
            { date: '2026-10-16', time: '09:00', status: 'booked', bookingId: 'friday-lesson', studentId: 'student-123456', studentName: 'Friday Student' },
            { date: '2026-10-16', time: '10:00', status: 'open', slotId: 'friday-open' },
            { date: '2026-10-17', time: '15:00', status: 'closed', penaltyCode: '303', penaltyReason: 'Short notice cancellation' },
          ] : [],
          weekStart: '2026-10-12', weekEnd: '2026-10-18',
        };
        if (url.pathname === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        if (url.pathname.endsWith('/unread-count')) json.data = { unreadCount: 0 };
        return route.fulfill({ headers, json });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.install({ time: new Date('2026-10-14T08:00:00Z') });
      await page.goto(base + '/schedule');
      const grid = page.locator('.schedule-grid');
      await expect(grid.locator('tbody button').first()).toBeVisible();
      const periods = page.getByRole('group', { name: 'Time of day' });
      const boxes = await periods.locator('button').evaluateAll(buttons => buttons.map(button => {
        const rect = button.getBoundingClientRect();
        return { y: rect.y, fits: button.scrollWidth <= button.clientWidth };
      }));
      assert.equal(new Set(boxes.map(box => Math.round(box.y))).size, 1, 'All three periods stay on one row');
      assert.ok(boxes.every(box => box.fits), 'Period labels fit');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

      if (width <= 767) {
        const dates = page.getByRole('group', { name: 'Day of week' });
        await expect(dates.locator('button')).toHaveCount(7);
        await expect(dates.getByRole('button', { name: 'Wednesday, October 14, 2026' })).toHaveAttribute('aria-pressed', 'true');
        await expect(grid.locator('thead tr').first().locator('th')).toHaveCount(2);
        const viewport = await page.locator('.schedule-scrollable').evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth }));
        assert.equal(viewport.scroll, viewport.width, 'Day schedule never needs horizontal scrolling');
        for (const button of await grid.locator('tbody button').all()) {
          const box = await button.boundingBox();
          assert.ok(box.x >= 0 && box.x + box.width <= width);
          assert.ok(box.height >= 44, 'Touchable slot controls');
        }
        for (const period of ['Morning', 'Evening', 'Afternoon']) {
          await periods.getByRole('button', { name: new RegExp(`^${period}$`, 'i') }).click();
          await expect(periods.getByRole('button', { name: new RegExp(`^${period}$`, 'i') })).toHaveAttribute('aria-pressed', 'true');
          assert.equal(await grid.locator('tbody tr').count(), period === 'Morning' ? 14 : 12);
        }
        await dates.getByRole('button', { name: 'Friday, October 16, 2026' }).click();
        await periods.getByRole('button', { name: /^morning$/i }).click();
        await expect(grid.getByRole('button', { name: 'Open lesson with Friday Student', exact: true })).toBeEnabled();
        await expect(grid.getByRole('button', { name: /^Update attendance for Friday Student/ })).toHaveCount(1);
        const popupPromise = page.waitForEvent('popup');
        await grid.getByRole('button', { name: 'Open lesson with Friday Student', exact: true }).click();
        const popup = await popupPromise;
        await popup.waitForURL('**/lesson/friday-lesson', { waitUntil: 'domcontentloaded' });
        assert.equal(new URL(popup.url()).pathname, '/lesson/friday-lesson');
        await popup.close();
        await grid.getByRole('button', { name: 'AVAILABLE 9:30 AM', exact: true }).click();
        await expect(grid.getByRole('button', { name: 'SELECTED 9:30 AM', exact: true })).toBeVisible();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Selection actions fit');
        await page.getByRole('button', { name: 'Confirm Selection (1)', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Confirm schedule changes' });
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: 'Open 1 Slot', exact: true }).click();
        await expect.poll(() => submissions.length).toBe(1);
        assert.deepEqual(submissions[0], { slots: [{ date: '2026-10-16', time: '09:30' }] });
        await expect(dialog.getByRole('button', { name: 'Open 1 Slot', exact: true })).toBeEnabled();
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'Clear Selection', exact: true }).click();
        await grid.locator('thead tr').nth(1).getByRole('button').click();
        await expect(grid.getByRole('button', { name: /^SELECTED / })).toHaveCount(12);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Bulk selection actions fit');
        await page.getByRole('button', { name: 'Clear Selection', exact: true }).click();
        await dates.getByRole('button', { name: 'Saturday, October 17, 2026' }).click();
        await periods.getByRole('button', { name: /^afternoon$/i }).click();
        await expect(grid.getByRole('button', { name: 'TA-303 3:00 PM', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Next Week', exact: true }).click();
        await expect(dates.getByRole('button', { name: 'Monday, October 19, 2026' })).toHaveAttribute('aria-pressed', 'true');
        await expect(grid.locator('thead tr').first()).toContainText('Monday');
        await page.getByRole('button', { name: 'Previous Week', exact: true }).click();
        await expect(dates.getByRole('button', { name: 'Wednesday, October 14, 2026' })).toHaveAttribute('aria-pressed', 'true');
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: `${output}/schedule-${theme}-${width}.png` });
        if (width === 375) {
          await page.setViewportSize({ width: 1440, height: 900 });
          await expect(dates).toHaveCount(0);
          await expect(grid.locator('thead tr').first().locator('th')).toHaveCount(8);
          await page.setViewportSize({ width, height: 900 });
          await expect(dates).toBeVisible();
          await expect(grid.locator('thead tr').first().locator('th')).toHaveCount(2);
        }
      } else {
        await expect(page.locator('.schedule-day-selector')).toHaveCount(0);
        await expect(grid.locator('thead tr').first().locator('th')).toHaveCount(8);
        await page.screenshot({ path: `${output}/schedule-${theme}-${width}.png` });
      }
      const legend = page.getByRole('list', { name: 'Slot status legend' });
      await expect(legend.getByRole('listitem')).toHaveCount(6);
      await expect(legend.getByRole('listitem')).toHaveText(['Available', 'Booked', 'Selected', 'Your Open Slots', 'Closed', 'Past / Unavailable']);
      const legendLayout = await legend.evaluate(el => ({
        tracks: getComputedStyle(el).gridTemplateColumns.split(' ').length,
        fits: el.scrollWidth <= el.clientWidth,
        items: [...el.children].map(item => {
          const chip = item.querySelector('.schedule-legend-swatch');
          const box = chip.getBoundingClientRect();
          return { x: item.getBoundingClientRect().x, y: item.getBoundingClientRect().y, width: box.width, height: box.height,
            animation: getComputedStyle(chip).animationName, shadow: getComputedStyle(chip).boxShadow };
        }),
      }));
      const columns = width <= 575 ? 2 : width <= 1100 ? 3 : 6;
      assert.equal(legendLayout.tracks, columns);
      assert.equal(new Set(legendLayout.items.map(item => Math.round(item.x))).size, columns, 'Legend items use aligned columns');
      assert.equal(new Set(legendLayout.items.map(item => Math.round(item.y))).size, 6 / columns, 'Legend has even rows');
      assert.ok(legendLayout.fits);
      for (const chip of legendLayout.items) {
        assert.equal(chip.width, 18);
        assert.equal(chip.height, 18);
        assert.equal(chip.animation, 'none');
        assert.equal(chip.shadow, 'none');
      }
      await legend.screenshot({ path: `${output}/legend-${theme}-${width}.png` });
      assert.deepEqual(errors, []);
      assert.deepEqual(writes, []);
      await context.close();
      console.log(`PASS ${theme} ${width}: one-row periods, schedule fit, dates, booking and selection`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
