const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  fs.mkdirSync('/tmp/fluentxverse-interview-appointment', { recursive: true });
  try {
    for (const width of [1440, 768, 390, 320]) for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, colorScheme: theme });
      let state = 'scheduled';
      const errors = [], mutations = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === base) return route.continue();
        if (route.request().method() !== 'GET') mutations.push(url.pathname);
        const json = { success: true, data: [] };
        if (url.pathname === '/tutor/me') json.user = { userId: 'appointment-test', firstName: 'Test', email: 'test@example.invalid', role: 'tutor' };
        if (url.pathname === '/interview/my-booking') json.data = { id: 'appointment-slot', date: '2026-10-28', time: '2:00 PM',
          status: state === 'scheduled' ? 'booked' : 'completed', mediaClosed: state !== 'scheduled', result: ['pass', 'fail'].includes(state) ? state : null };
        if (url.pathname === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        if (url.pathname === '/notifications/unread-count') json.data = { unreadCount: 0 };
        return route.fulfill({ json });
      });
      for (state of ['scheduled', 'pending', 'pass', 'fail']) {
        await page.goto(`${base}/interview`, { waitUntil: 'networkidle' });
        const card = page.locator('.interview-appointment');
        await expect(card).toContainText('Wednesday, October 28, 2026');
        await expect(card).toContainText('2:00 PM');
        await expect(card).toContainText('Manila (UTC+08:00)');
        await expect(card.locator('.interview-appointment-status')).toHaveText({ scheduled: 'Scheduled', pending: 'Pending review', pass: 'Passed', fail: 'Not passed' }[state]);
        assert.equal(await card.getByRole('button', { name: 'Join interview', exact: true }).count(), state === 'scheduled' ? 1 : 0);
        await expect(card.getByRole('link')).toHaveAttribute('href', state === 'pass' ? '/application/profile' : '/home');
        const paint = await card.evaluate(el => {
          const luminance = color => {
            const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
            return channels.reduce((total, n, i) => total + n * [.2126, .7152, .0722][i], 0);
          };
          const background = luminance(getComputedStyle(el).backgroundColor);
          return {
            contrast: [...el.querySelectorAll('h2,p,dt,dd,dd span,.interview-appointment-eyebrow')].map(node => {
              const foreground = luminance(getComputedStyle(node).color);
              return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
            }),
            clipped: [...el.querySelectorAll('h2,p,dt,dd,a,button')].some(node => node.scrollWidth > node.clientWidth + 1),
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        assert.ok(paint.contrast.every(value => value >= 4.5), `${theme}: readable text contrast`);
        assert.equal(paint.clipped, false);
        assert.equal(paint.overflow, false);
        if (state === 'scheduled') {
          await card.getByRole('button', { name: 'Cancel interview', exact: true }).click();
          const dialog = page.getByRole('dialog', { name: 'Cancel interview', exact: true });
          await expect(dialog).toContainText('Wednesday, October 28, 2026');
          await dialog.getByRole('button', { name: 'Keep Booking', exact: true }).click();
          await expect(dialog).toHaveCount(0);
        }
        if (state === 'scheduled' || state === 'pass') await card.screenshot({ path: `/tmp/fluentxverse-interview-appointment/${state}-${width}-${theme}.png` });
      }
      assert.deepEqual(mutations, []);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px ${theme}: all four booking states, readable text, responsive layout and actions`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
