const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [1440, 375]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      let signedIn = false, role = 'tutor', certified = true;
      await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, route => {
        const path = new URL(route.request().url()).pathname;
        const user = { userId: 'solid-auth-fixture', role, email: 'solid-auth@example.test', firstName: 'Alex', lastName: 'Tutor' };
        if (path === '/tutor/me' && !signedIn) return route.fulfill({ status: 401, json: { success: false } });
        if (path === '/tutor/login') signedIn = true;
        let data = [], json = { success: true, user, data, lessons: [], articles: [], status: { passed: true }, booking: null };
        if (path === '/tutor/me' && role === 'tutor') {
          const { role: omitted, ...restoredUser } = user;
          json.user = restoredUser;
        }
        if (path === '/proof/tutor-certification/me') json.data = { snapshot: { writtenPassed: true, speakingPassed: true, profileApproved: true, interviewPassed: certified, missingRequirements: certified ? [] : ['interview_pass'] }, proofs: [] };
        if (path.replace(/\/$/, '') === '/tutor/email-verification') json.data = { verified: true };
        if (path === '/schedule/week') json.data = { slots: [], weekStart: '2026-10-05', weekEnd: '2026-10-11' };
        if (path.startsWith('/notifications')) json.data = { notifications: [], unreadCount: 0 };
        if (path === '/tutor/profile') json.data = { ...user, interests: [], education: [], profileStatus: 'approved' };
        return route.fulfill({ json });
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/schedule');
      await page.waitForURL(base + '/');
      if (width < 768) await page.getByRole('button', { name: 'Open mobile menu', exact: true }).click();
      await page.getByRole('button', { name: 'Login', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Login', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Sign in to your account' });
      await dialog.getByLabel('Email', { exact: true }).pressSequentially('solid-auth@example.test');
      assert.equal(await dialog.getByLabel('Email', { exact: true }).inputValue(), 'solid-auth@example.test');
      await dialog.getByLabel('Password', { exact: true }).fill('fixture-only-password');
      await dialog.getByRole('button', { name: 'Login', exact: true }).click();
      await page.waitForURL(base + '/home');
      await page.goto(base + '/schedule');
      await page.getByRole('heading', { name: /Lesson Schedule/ }).waitFor();
      certified = false;
      await page.reload();
      await page.waitForURL(base + '/home?certification=required');
      role = 'student';
      await page.goto(base + '/profile');
      await page.waitForURL(base + '/');
      assert.equal(await page.locator('.tutor-workspace').count(), 0, 'Student sessions cannot access the tutor workspace');
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS auth ${width}: guest redirect, stable typing, tutor login, certification guard, non-tutor session rejection`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
