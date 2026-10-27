const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5238';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const output = '../output/screenshots/interview-calendar';
  await fs.mkdir(output, { recursive: true });
  try {
    for (const width of [1440, 1024, 768, 390, 320]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme }, version: 2 })), theme);
      let posts = 0;
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/\/$/, '');
        if (url.origin === base) return route.continue();
        const headers = { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,cache-control,pragma' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (request.method() === 'POST') posts++;
        const json = { success: true, data: [] };
        if (path === '/tutor/me') json.user = { userId: 'interview-layout-test', firstName: 'Test', email: 'test@example.invalid', role: 'tutor' };
        if (path === '/tutor/email-verification') json.data = { verified: true, email: 'test@example.invalid' };
        if (path === '/interview/available') {
          const offset = Number(url.searchParams.get('weekOffset')) || 0;
          const date = new Date(Date.UTC(2030, 0, 15 + offset * 7)).toISOString().slice(0, 10);
          json.data = [{ id: 'layout-slot', date, time: '8:30 PM', status: 'open' }];
        }
        if (path === '/interview/my-booking') json.data = null;
        if (path.includes('/unread-count')) json.data = { unreadCount: 0 };
        if (path.includes('/notifications')) json.data = { notifications: [], unreadCount: 0 };
        return route.fulfill({ headers, json });
      });
      await context.routeWebSocket('**/*', ws => ws.close());
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.clock.install({ time: new Date('2030-01-14T04:00:00Z') });
      await page.goto(base + '/interview');
      await expect(page.getByRole('heading', { name: 'Book Your Interview' })).toBeVisible();
      await page.getByRole('button', { name: 'Evening', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Evening', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.calendar-grid .time-label')).toHaveCount(12);
      const region = page.getByRole('region', { name: 'Interview availability' });
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        region: document.querySelector('.calendar-container').getBoundingClientRect().height,
        row: document.querySelector('.slot-cell').getBoundingClientRect().height,
        card: document.querySelector('.schedule-card').getBoundingClientRect().height,
        container: document.querySelector('.interview-booking-page .container').getBoundingClientRect().width,
      }));
      assert.equal(layout.overflow, false);
      assert(layout.region <= (width <= 768 ? 421 : 441));
      if (width > 768) { assert(layout.row <= 35); assert(layout.card < 550); assert(layout.container <= 1041); }
      const slot = page.getByRole('button', { name: 'Book interview on Tuesday, January 15, 2030 at 8:30 PM' });
      await slot.scrollIntoViewIfNeeded();
      await slot.focus(); await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog', { name: 'Confirm interview booking' })).toBeVisible();
      await expect(page.locator('.booking-confirm-details')).toContainText('8:30 PM');
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(posts, 0, 'Opening/cancelling must not book a slot');
      await page.getByRole('button', { name: 'Next week', exact: true }).click();
      await expect(page.locator('.week-range')).toContainText('Jan 21');
      await page.getByRole('button', { name: 'Previous week', exact: true }).click();
      await expect(page.locator('.week-range')).toContainText('Jan 14');
      await page.getByRole('button', { name: 'Morning', exact: true }).click();
      await expect(page.locator('.calendar-grid .time-label')).toHaveCount(14);
      await page.getByRole('button', { name: 'Evening', exact: true }).click();
      await region.evaluate(el => { el.scrollTop = 0; el.scrollLeft = 0; });
      await page.screenshot({ path: `${output}/${width}-${theme}.png`, fullPage: true });
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS ${width}/${theme}: compact grid, scrolling, keyboard slot selection, modal cancel, periods, week navigation`);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
