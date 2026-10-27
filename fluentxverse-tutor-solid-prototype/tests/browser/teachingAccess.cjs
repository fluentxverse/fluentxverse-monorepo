const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5239';
const restricted = ['/schedule', '/materials', '/performance-metrics', '/lesson/private-booking',
  '/classroom/private-session', '/lesson/view?materialId=private',
  '/materials/daily-dispatch', '/materials/daily-dispatch/archives/2026-10', '/materials/daily-dispatch/private',
  '/materials/conversational-skills', '/materials/conversational-skills/private',
  '/materials/business-english', '/materials/business-english/private',
  '/materials/young-learners', '/materials/young-learners/lesson/private',
  '/conversation-mat/beginner/one/private', '/profile', '/knowledge-base', '/knowledge-base/interview-preparation'];

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const output = '../output/screenshots/teaching-access'; await fs.mkdir(output, { recursive: true });
  try {
    const widths = process.env.ACCESS_WIDTHS ? process.env.ACCESS_WIDTHS.split(',').map(Number) : [1440, 390, 320];
    const themes = process.env.ACCESS_THEMES ? process.env.ACCESS_THEMES.split(',') : ['light', 'dark'];
    for (const width of widths) for (const theme of themes) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme }, version: 2 })), theme);
      let approved = false, unavailable = false, delay = 0, email = 'test@example.invalid';
      const requests = [], errors = [];
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/\/$/, '');
        if (url.origin === base) return route.continue();
        requests.push(path);
        const headers = { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,cache-control,pragma' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        const user = { userId: 'access-fixture', firstName: 'Test', email, role: 'tutor' };
        const json = { success: true, data: [] };
        if (path === '/tutor/me') json.user = user;
        if (path === '/tutor/email-verification') json.data = { verified: true };
        if (path === '/proof/tutor-certification/me') {
          if (delay) await new Promise(resolve => setTimeout(resolve, delay));
          if (unavailable) return route.fulfill({ status: 503, headers, json: { success: false } });
          json.data = { snapshot: { writtenPassed: true, speakingPassed: true,
            profileApproved: approved, interviewPassed: approved,
            missingRequirements: approved ? [] : ['profile_approval', 'interview_pass'] }, credential: { status: 'retired' } };
        }
        if (path === '/exam/status' || path === '/exam/speaking/status') json.status = { passed: true, attemptsThisMonth: 0, maxAttemptsPerMonth: 2 };
        if (path === '/tutor/profile') json.data = { ...user, firstName: 'Test', lastName: 'Applicant', interests: [], education: [], profileStatus: 'incomplete' };
        if (path === '/interview/my-booking') json.data = null;
        if (path === '/tutor/performance') json.data = { lessons: { total: 0 }, rating: { average: null }, survey: { total: 0, average: null }, attendance: { rate: null }, notes: { submissionRate: null }, reliability: { score: null }, cancellation: { rate: null } };
        if (path.includes('/unread-count')) json.data = { unreadCount: 0 };
        if (path.includes('/notifications')) json.data = { notifications: [], unreadCount: 0 };
        return route.fulfill({ headers, json });
      });
      await context.routeWebSocket('**/*', ws => ws.close());
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      for (const path of restricted) {
        await page.goto(base + path);
        await expect(page).toHaveURL(/\/home\?certification=required$/);
        await expect(page.getByRole('alert').filter({ hasText: 'Certification Required' })).toBeVisible();
        await expect(page.locator('.certification-alert')).toContainText('profile approval, and interview');
        await expect(page.getByRole('navigation', { name: 'Teaching workspace' })).toHaveCount(0);
        assert(!requests.includes('/tutor/performance') && !requests.includes('/schedule/week'), 'Blocked pages must not fetch teaching data');
      }
      await page.waitForTimeout(5200);
      await expect(page.locator('.certification-alert')).toBeVisible();
      await page.screenshot({ path: `${output}/${width}-${theme}.png`, fullPage: true });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.getByRole('button', { name: 'Dismiss certification warning' }).click();
      await expect(page.locator('.certification-alert')).toHaveCount(0);
      for (const [mobile, desktop] of [['Materials', 'materials'], ['My Profile', 'profile'], ['Metrics', 'performance metrics'], ['Knowledge Base', 'Knowledge Base']]) {
        if (width <= 390) {
          await page.getByRole('button', { name: 'Open menu', exact: true }).click();
          await page.getByRole('dialog', { name: 'Navigation' }).getByRole('link', { name: mobile, exact: true }).click();
        } else await page.locator('.sidebar').getByRole('link', { name: desktop, exact: true }).click();
        await expect(page).toHaveURL(/\/home\?certification=required$/);
        await expect(page.locator('.certification-alert')).toBeVisible();
      }
      await page.getByRole('link', { name: 'Application Profile', exact: true }).click();
      await expect(page).toHaveURL(/\/application\/profile$/);
      await expect(page.getByRole('button', { name: 'About', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Stats', exact: true })).toHaveCount(0);
      assert(!requests.includes('/tutor/performance'));
      await page.goto(base + '/interview');
      await expect(page.getByRole('heading', { name: 'Book Your Interview' })).toBeVisible();
      email = 'paulanthonyarriola@gmail.com';
      await page.goto(base + '/materials');
      await expect(page).toHaveURL(/\/home\?certification=required$/);
      // Approval failures must not be treated as approval or rejection.
      unavailable = true;
      await page.goto(base + '/materials');
      await expect(page.getByText('Could not verify certification', { exact: true })).toBeVisible();
      assert.equal(new URL(page.url()).pathname, '/materials');
      unavailable = false; approved = true; delay = 300;
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Learning Materials', exact: true })).toBeVisible();
      delay = 0;
      await page.goto(base + '/profile');
      await page.getByRole('button', { name: 'Stats', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Your Performance', exact: true })).toBeVisible();
      assert(requests.includes('/tutor/performance'));
      await page.goto(base + '/knowledge-base');
      await expect(page.getByRole('heading', { name: 'Knowledge Base', exact: true })).toBeVisible();
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS ${width}/${theme}: ${restricted.length} blocked routes, menus, persistent warning, profile tab, onboarding, no email bypass, retry, approved access`);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
