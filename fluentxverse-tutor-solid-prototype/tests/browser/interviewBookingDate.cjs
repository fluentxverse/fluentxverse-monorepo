const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  fs.mkdirSync('/tmp/fluentxverse-interview-date', { recursive: true });
  try {
    for (const [timezoneId, width] of [['Asia/Manila', 1440], ['Asia/Tokyo', 1440], ['America/Los_Angeles', 1440], ['UTC', 1440], ['Asia/Manila', 390]]) {
      for (const date of ['2026-10-28', '2026-11-01', '2026-12-31']) {
        const context = await browser.newContext({ viewport: { width, height: 1000 }, timezoneId });
        const fullDate = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
        const slot = { id: 'test-today-slot', date, time: '2:00 PM', status: 'open', createdAt: `${date}T00:00:00Z` };
        let booking = null;
        let bookedId = null;
        await context.route('**/*', async route => {
          const url = new URL(route.request().url());
          if (url.origin === base) return route.continue();
          const json = { success: true, data: [] };
          if (url.pathname === '/tutor/me') json.user = { userId: 'date-test', firstName: 'Test', email: 'test@example.invalid', role: 'tutor' };
          if (url.pathname === '/interview/available') json.data = booking ? [] : [slot];
          if (url.pathname === '/interview/my-booking') json.data = booking;
          if (url.pathname === '/interview/book') {
            bookedId = route.request().postDataJSON().slotId;
            booking = { ...slot, status: 'booked', bookedAt: `${date}T05:00:00Z` };
            json.data = booking;
          }
          if (url.pathname === '/notifications') json.data = { notifications: [], unreadCount: 0 };
          if (url.pathname === '/notifications/unread-count') json.data = { unreadCount: 0 };
          return route.fulfill({ json });
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.clock.install({ time: new Date(`${date}T13:00:00+08:00`) });
        await page.clock.pauseAt(new Date(`${date}T13:00:00+08:00`));
        await page.goto(`${base}/interview`, { waitUntil: 'domcontentloaded' });
        const today = page.locator('.day-header.today');
        await expect(today.locator('.day-date')).toHaveText(String(Number(date.slice(-2))));
        const available = page.getByRole('button', { name: /^Book interview on/ });
        await expect(available).toHaveCount(1);
        const column = await available.evaluate(el => [...el.closest('.time-row').children].indexOf(el.closest('.slot-cell')));
        const todayColumn = await today.evaluate(el => [...el.parentElement.children].indexOf(el));
        assert.equal(column, todayColumn, 'Available slot appears under today before booking');
        await available.click();
        const dialog = page.getByRole('dialog', { name: 'Confirm interview booking' });
        await expect(dialog.locator('.booking-confirm-details')).toContainText('2:00 PM');
        await expect(dialog.locator('.booking-confirm-details')).toContainText(fullDate);
        await dialog.getByRole('button', { name: 'Confirm Booking', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        assert.equal(bookedId, slot.id, 'Booking preserves the selected slot ID');
        const checkBooking = async () => {
          const badge = page.locator('.calendar-grid .slot-badge.booked');
          await expect(badge).toHaveCount(1);
          const placed = await badge.evaluate(el => ({
            column: [...el.closest('.time-row').children].indexOf(el.closest('.slot-cell')),
            time: el.closest('.time-row').querySelector('.time-label').textContent,
          }));
          assert.equal(placed.column, todayColumn, `${timezoneId} ${date}: booking stays under today`);
          assert.equal(placed.time, slot.time);
          await expect(page.locator('.current-booking-card')).toContainText('2:00 PM');
          await expect(page.locator('.current-booking-card')).toContainText(fullDate);
        };
        await checkBooking();
        await page.reload({ waitUntil: 'domcontentloaded' });
        await checkBooking();
        await page.getByRole('button', { name: 'Next week', exact: true }).click();
        await expect(page.locator('.calendar-grid .slot-badge.booked')).toHaveCount(0);
        await page.getByRole('button', { name: 'Today', exact: true }).click();
        await checkBooking();
        if (date === '2026-10-28' && timezoneId === 'Asia/Manila') {
          await page.screenshot({ path: `/tmp/fluentxverse-interview-date/manila-booking-${width}.png` });
        }
        assert.deepEqual(errors, []);
        console.log(`PASS ${timezoneId} ${width}px ${date}: selection, booking, reload and week navigation preserve date and time`);
        await context.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
