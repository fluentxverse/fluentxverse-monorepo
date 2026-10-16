// Isolated fixtures keep visual and dialog checks away from production data.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';
const user = { userId: 'design-tutor', firstName: 'Alex', lastName: 'Teacher', email: 'paulanthonyarriola@gmail.com', role: 'tutor' };
const pages = ['/home', '/schedule', '/profile', '/materials', '/materials/daily-dispatch', '/materials/conversational-skills', '/materials/business-english', '/materials/young-learners', '/inbox', '/notifications', '/interview', '/exam/written', '/exam/speaking'];
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  await fs.mkdir('../output/screenshots/tutor-design', { recursive: true });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1566, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })), theme);
      await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, async route => {
        const path = new URL(route.request().url()).pathname;
        let json = { success: true, user, data: [], lessons: [], articles: [], archives: [], slots: [], booking: null, status: { passed: true, percentage: 90, attemptsThisMonth: 0, maxAttemptsPerMonth: 2 } };
        if (path === '/tutor/profile') json.data = { ...user, bio: 'I teach practical English for everyday conversations.', interests: ['Travel', 'Music'], education: ['Language education'], profileStatus: 'approved', totalReviews: 0 };
        if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        if (path.endsWith('/unread-count')) json.data = { unreadCount: 0 };
        if (path === '/inbox/messages') json.data = { messages: [], stats: { total: 0, unread: 0, pinned: 0 } };
        if (path === '/schedule/week') json.data = { slots: [], weekStart: '2026-10-05', weekEnd: '2026-10-11' };
        if (path.includes('/personal-info')) json.data = { ...user, birthDate: '1995-04-10' };
        if (path === '/dispatch') json = [];
        return route.fulfill({ json });
      });
      const page = await context.newPage();
      page.setDefaultTimeout(8000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      for (const path of pages) {
        await page.goto(base + path, { waitUntil: 'networkidle' });
        await page.waitForTimeout(100);
        assert(!await page.getByText('Something went wrong', { exact: true }).count(), path + ' rendered an error boundary');
        const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, offenders: [...document.querySelectorAll('body *')].filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.right > innerWidth + 2 && !el.closest('.schedule-scrollable,.calendar-container,.chapter-lessons,.notifications-dropdown');
        }).slice(0, 10).map(el => ({ tag: el.tagName, class: el.getAttribute('class'), right: el.getBoundingClientRect().right })) }));
        assert(overflow.scroll <= width + 2, JSON.stringify({ path, theme, ...overflow }));
        for (const art of await page.locator('img.tutor-art').all()) assert(await art.evaluate(el => el.complete && el.naturalWidth > 0), `${path}: artwork must decode`);
        await page.screenshot({ path: `../output/screenshots/tutor-design/${path.slice(1).replaceAll('/', '-')}-${theme}-${width}.png`, fullPage: true });
        assert.deepEqual(errors, [], path);
      }
      await page.goto(base + '/profile', { waitUntil: 'networkidle' });
      if (width < 992) {
        await page.getByRole('button', { name: 'Open menu', exact: true }).click();
        await page.getByRole('dialog', { name: 'Navigation', exact: true }).getByRole('button', { name: 'Settings', exact: true }).click();
      } else await page.getByTitle('Settings', { exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Account settings', exact: true });
      await dialog.waitFor();
      assert(await dialog.evaluate(el => el.matches(':modal')), 'Account dialog must use native modality');
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
      await dialog.getByRole('button', { name: 'Update Email', exact: true }).click();
      await dialog.getByRole('heading', { name: 'Update Email', exact: true }).waitFor();
      assert(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), 'Email view fits');
      await dialog.getByRole('button', { name: 'Go back' }).click();
      await dialog.getByRole('button', { name: 'Update Password', exact: true }).click();
      await dialog.getByRole('heading', { name: 'Update Password', exact: true }).waitFor();
      assert(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), 'Password view fits');
      await page.screenshot({ path: `../output/screenshots/tutor-design/password-${theme}-${width}.png` });
      await dialog.getByRole('button', { name: 'Go back' }).click();
      await dialog.getByRole('button', { name: 'Update My Personal Information', exact: true }).click();
      await dialog.getByRole('heading', { name: 'Update Personal Information', exact: true }).waitFor();
      assert(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), 'Personal information view fits');
      await page.screenshot({ path: `../output/screenshots/tutor-design/personal-info-${theme}-${width}.png` });
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
      console.log(`PASS ${theme} ${width}: ${pages.length} pages, decoded artwork, no viewport overflow, account subviews and native dismissal`);
      await context.close();
    }
    const context = await browser.newContext();
    await context.route('**/tutor/me', route => route.fulfill({ status: 401, json: { success: false } }));
    const page = await context.newPage(); await page.goto(base + '/about');
    await page.getByRole('button', { name: /login/i }).first().click();
    await page.getByRole('dialog', { name: 'Sign in to your account' }).waitFor();
    await page.getByLabel('Email', { exact: true }).fill('applicant@example.com');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog:modal').count(), 0);
    console.log('PASS public login: labeled fields, native dialog, Escape dismissal');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
