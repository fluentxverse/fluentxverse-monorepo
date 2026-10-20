const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  await fs.mkdir('../output/screenshots', { recursive: true });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1440, 375, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })), theme);
      let count = 12, failed = false, reads = 0;
      const errors = [];
      const user = { userId: 'history-fixture', givenName: 'History', familyName: 'Student', role: 'student', email: 'history@example.test' };
      await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780))\//, async route => {
        const req = route.request(), path = new URL(req.url()).pathname;
        if (!['GET', 'OPTIONS'].includes(req.method())) return route.fulfill({ status: 400, json: { success: false } });
        let json = { success: true, data: [], lessons: [] };
        if (path === '/student/me') json.user = user;
        if (path === '/student/profile') json.data = { ...user, id: user.userId, fullName: 'History Student', totalLessons: count };
        if (path === '/schedule/student-bookings') {
          reads++;
          if (failed) return route.fulfill({ status: 503, json: { success: false } });
          // Deliberately oldest-first so the test verifies newest-first display.
          json.data = Array.from({ length: count }, (_, i) => ({ bookingId: `lesson-${i + 1}`, tutorName: `Tutor ${i + 1}`, slotDate: `2025-01-${String(i + 1).padStart(2, '0')}`, slotTime: '13:00', durationMinutes: 25, status: 'completed' }));
        }
        return route.fulfill({ json });
      });
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/profile', { waitUntil: 'domcontentloaded' });
      const historyTab = page.getByRole('button', { name: 'History & Notes', exact: true });
      const rows = page.locator('.profile-history-item');
      const nav = page.getByRole('navigation', { name: 'Lesson history pagination' });
      const previous = page.getByRole('button', { name: 'Previous history page' });
      const next = page.getByRole('button', { name: 'Next history page' });
      const rowIds = () => rows.evaluateAll(links => links.map(link => link.getAttribute('href')));
      const refresh = async () => {
        await page.getByRole('button', { name: 'Overview', exact: true }).click();
        await historyTab.click();
      };
      await historyTab.click();
      await expect(rows).toHaveCount(5);
      assert.deepEqual(await rowIds(), [12, 11, 10, 9, 8].map(id => `/lesson/lesson-${id}`));
      await expect(previous).toBeDisabled(); await expect(nav).toContainText('1-5 of 12 lessons');
      const firstReads = reads;
      await next.click(); await expect(nav).toContainText('Page 2 of 3');
      assert.deepEqual(await rowIds(), [7, 6, 5, 4, 3].map(id => `/lesson/lesson-${id}`));
      await next.click(); await expect(rows).toHaveCount(2); await expect(next).toBeDisabled();
      assert.deepEqual(await rowIds(), [2, 1].map(id => `/lesson/lesson-${id}`));
      await expect(nav).toContainText('11-12 of 12 lessons');
      await previous.focus(); await page.keyboard.press('Enter'); await expect(nav).toContainText('Page 2 of 3');
      assert.equal(reads, firstReads, 'Pagination does not refetch all bookings');
      await refresh(); await expect(nav).toContainText('Page 1 of 3');
      await expect(rows).toHaveCount(5);
      await nav.scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: `../output/screenshots/profile-history-${theme}-${width}.png`, fullPage: true });
      count = 5; await refresh(); await expect(rows).toHaveCount(5); await expect(nav).toHaveCount(0);
      count = 0; await refresh(); await expect(page.getByText('No lesson history yet', { exact: true })).toBeVisible(); await expect(nav).toHaveCount(0);
      failed = true; await refresh(); await expect(page.getByRole('alert').filter({ hasText: 'Could not load your lesson history.' })).toBeVisible();
      failed = false; count = 6; await page.getByRole('button', { name: 'Try again', exact: true }).click(); await expect(rows).toHaveCount(5); await expect(nav).toContainText('Page 1 of 2');
      assert.deepEqual(errors, []);
      console.log(`PASS profile history ${theme} ${width}: five per page, sorted links, boundaries, keyboard, reset, single/empty/error states and viewport fit`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
