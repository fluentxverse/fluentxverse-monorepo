const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  fs.mkdirSync('/tmp/fluentxverse-interview-progress', { recursive: true });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1440, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      await page.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })), theme);
      let result = null;
      let profileStatus = 'incomplete';
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === base) return route.continue();
        const json = { success: true, data: [] };
        if (url.pathname === '/tutor/me') json.user = { userId: 'progress-test', firstName: 'Test', email: 'test@example.invalid', role: 'tutor' };
        if (url.pathname.replace(/\/$/, '') === '/tutor/email-verification') json.data = { verified: true };
        if (url.pathname.includes('/exam/') && url.pathname.endsWith('/status')) json.status = { passed: true, hasCompletedExam: true, attemptsThisMonth: 1, maxAttemptsPerMonth: 2 };
        if (url.pathname === '/interview/my-booking') json.data = { id: 'progress-slot', date: '2026-10-28', time: '2:00 PM', status: 'completed', mediaClosed: true, result };
        if (url.pathname === '/proof/tutor-certification/me') json.data = {
          snapshot: { writtenPassed: true, speakingPassed: true, interviewPassed: result === 'pass', interviewResult: result,
            profileApproved: profileStatus === 'approved', profileStatus,
            missingRequirements: [...(result !== 'pass' ? ['interview_pass'] : []), ...(profileStatus !== 'approved' ? ['profile_approval'] : [])] },
          credential: { status: 'retired' },
        };
        if (url.pathname === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        if (url.pathname === '/notifications/unread-count') json.data = { unreadCount: 0 };
        if (url.pathname === '/schedule/week') json.data = { slots: [] };
        if (url.pathname === '/tutor/lesson-issues') json.data = { direction: url.searchParams.get('direction'), summary: { sent: 0, received: 0 }, statusCounts: { submitted: 0, under_review: 0, resolved: 0 }, items: [] };
        return route.fulfill({ json });
      });
      await page.clock.install();
      await page.goto(`${base}/home`, { waitUntil: 'networkidle' });
      const status = page.getByRole('status', { name: 'Interview result' });
      await expect(status).toBeVisible().catch(async error => {
        console.error(await page.locator('body').innerText(), errors);
        throw error;
      });
      await expect(status).toContainText('PENDING REVIEW');
      const guide = page.getByRole('button', { name: 'INTERVIEW GUIDE', exact: true });
      await expect(guide).toBeVisible();
      result = 'pass';
      await page.clock.fastForward(15000);
      await expect(status).toContainText('PASSED');
      await expect(guide).toHaveCount(0);
      await expect(status.getByRole('link', { name: 'COMPLETE YOUR PROFILE' })).toHaveAttribute('href', '/application/profile');
      await expect(page.locator('.home-page-container .progress-step-number.is-active').last()).toHaveText('3');
      assert.equal(await page.locator('.tutor-home-shortcuts').count(), 0, 'Pass alone does not grant teaching access');
      await page.screenshot({ path: `/tmp/fluentxverse-interview-progress/passed-${width}.png`, fullPage: true });
      profileStatus = 'pending_review';
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await expect(status).toContainText('awaiting review');
      await expect(status.getByRole('link')).toHaveText('VIEW APPLICATION PROFILE');
      await expect(guide).toHaveCount(0);
      profileStatus = 'approved';
      await page.clock.fastForward(15000);
      const desk = page.getByRole('region', { name: 'Teaching Desk' });
      await expect(desk).toBeVisible();
      await expect(desk.getByText('No booked lessons in the next seven days')).toBeVisible();
      await expect(page.locator('.main-status-card')).toHaveCount(0);
      await expect(page.locator('.progress-steps')).toHaveCount(0);
      await expect(page.getByText('ENGLISH PROFICIENCY TEST', { exact: true })).toHaveCount(0);
      await expect(page.getByText(/Ensure your contact number is correct/)).toHaveCount(0);
      await expect(page.locator('.tutor-home-shortcuts')).toBeVisible();
      assert.equal(await desk.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', 'Teaching Desk blends with the surrounding page');
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `/tmp/fluentxverse-interview-progress/approved-${theme}-${width}.png`, fullPage: true });
      await page.reload({ waitUntil: 'networkidle' });
      await expect(desk).toBeVisible();
      await expect(page.locator('.main-status-card')).toHaveCount(0);
      result = 'fail';
      await page.clock.fastForward(15000);
      await expect(status).toContainText('NOT PASSED');
      await expect(desk).toHaveCount(0);
      await expect(guide).toBeVisible();
      await expect(status.getByRole('link')).toHaveCount(0);
      await expect(page.locator('.home-page-container .progress-step-number.is-active').last()).toHaveText('2');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      console.log(`PASS ${theme} ${width}px: pending, pass, profile step, approved workspace, matching background and corrected fail refresh`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
