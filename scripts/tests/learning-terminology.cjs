const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');

const apps = [
  { name: 'student', base: process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176', path: '/materials/daily-dispatch', select: 'select[aria-label="Category"]', card: '.library-lesson' },
  { name: 'tutor', base: process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177', path: '/materials/daily-dispatch', select: '.dispatch-category-select', card: '.dispatch-card' },
  { name: 'dashboard', base: process.env.DASHBOARD_TEST_URL || 'http://127.0.0.1:5175', path: '/daily-dispatch', select: '.dd-filter-select', card: '.dd-article-card' },
];
const articles = [
  { id: 'learning', title: 'Learning fixture', topic: 'Learning together', category: 'Education', createdAt: new Date().toISOString() },
  { id: 'science', title: 'Science fixture', topic: 'Science together', category: 'Science', createdAt: new Date().toISOString() },
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const app of apps) for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 950 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.routeWebSocket('**/*', socket => socket.close());
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === app.base) return route.continue();
        let json = { success: true, data: [] };
        if (url.pathname === '/dispatch') json = articles;
        if (['/student/me', '/tutor/me', '/admin/me'].includes(url.pathname)) {
          json.user = { userId: 'learning-fixture', username: 'Fixture', firstName: 'Fixture', role: app.name === 'dashboard' ? 'superadmin' : app.name };
        }
        if (url.pathname === '/tutor/profile') json.data = { profileStatus: 'approved', firstName: 'Fixture' };
        if (url.pathname === '/proof/tutor-certification/me') json.data = { snapshot: { writtenPassed: true, speakingPassed: true, profileApproved: true, interviewPassed: true, missingRequirements: [] } };
        if (url.pathname === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        return route.fulfill({ json });
      });
      await page.goto(app.base + app.path, { waitUntil: 'networkidle' });
      const select = page.locator(app.select);
      await expect(select.locator('option[value="Education"]')).toHaveText('Learning');
      await expect(page.locator(app.card)).toHaveCount(2);
      await select.selectOption({ label: 'Learning' });
      await expect(select).toHaveValue('Education');
      await expect(page.locator(app.card)).toHaveCount(1);
      await expect(page.locator(app.card)).toContainText('Learning fixture');
      await expect(page.locator(app.card)).not.toContainText('Education');
      await select.selectOption({ label: 'Science' });
      await expect(page.locator(app.card)).toHaveCount(1);
      await expect(page.locator(app.card)).toContainText('Science fixture');
      assert.deepEqual(errors, []);
      console.log(`PASS ${app.name} ${width}px: Learning label, legacy Education value, working category filters`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
