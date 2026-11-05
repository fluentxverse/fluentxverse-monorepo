const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.DASHBOARD_TEST_URL || 'http://127.0.0.1:5365';
const article = {
  id: 'archive-route-fixture', title: 'Youth sports today', category: 'Sports', topic: 'Youth games', createdAt: '2026-11-05T01:00:00Z',
  warmUpQuestions: [], vocabulary: [], articleContent: { paragraphs: [{ text: 'Young athletes share their ambitions.', comprehensionQuestion: { question: 'What do athletes share?', answer: 'TUTOR-ONLY ANSWER' } }], source: 'https://olympics.com/news/youth-games' },
  summaryQuestion: '', discussionA: { topic: '', questions: [] }, discussionB: { topic: '', questions: [] },
};
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  fs.mkdirSync('/tmp/dashboard-dispatch-archives', { recursive: true });
  try {
    for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme });
      await context.addInitScript(theme => { if (/^https?:$/.test(location.protocol)) localStorage.setItem('fxv_admin_theme', theme); }, theme);
      let fail = false, empty = false;
      await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(?:localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, route => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/dispatch/' + article.id) return route.fulfill({ json: article });
        if (path === '/dispatch/archives') return route.fulfill({ json: { success: true, archives: [{ month: 'November 2026', count: 4 }, { month: 'October 2026', count: 6 }] } });
        if (path.startsWith('/dispatch/archives/')) return route.fulfill({ status: fail ? 503 : 200, json: { articles: empty ? [] : [{ ...article, title: decodeURIComponent(path.split('/').at(-1)) + ' news', excerpt: 'A clear introduction to international sports.' }] } });
        return route.fulfill({ json: { success: true, user: { id: 'archive-admin', userId: 'archive-admin', role: 'admin', email: 'fixture@example.invalid' }, data: [] } });
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const view of ['student', 'tutor']) {
        const prefix = `/daily-dispatch/${view === 'student' ? 'student/' : ''}archives/`;
        const path = prefix + 'November%202026';
        await page.goto(base + path, { waitUntil: 'domcontentloaded' });
        const root = page.locator('.dda-page');
        await expect(root).toHaveAttribute('data-view', view);
        await expect(root).toHaveAttribute('data-theme', theme);
        await expect(root.locator('.dda-month-title')).toHaveText('Month: November 2026');
        await expect(root.locator('.dda-article-title')).toHaveText('November 2026 news');
        await expect(root.locator('.ddp-header-bar')).toHaveCSS('background-color', 'rgb(18, 18, 18)');
        await expect(root.locator('.dda-content')).toHaveCSS('background-color', theme === 'dark' ? 'rgb(26, 26, 26)' : 'rgb(255, 255, 255)');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(root.locator('.dda-month-title')).toContainText('November 2026');
        const months = page.getByRole('complementary', { name: 'Archive navigation' });
        await expect(months.getByRole('link', { name: 'October 2026' })).toHaveAttribute('href', prefix + 'October%202026');
        await months.getByRole('link', { name: 'October 2026' }).click({ force: width < 900 });
        await expect(page).toHaveURL(base + prefix + 'October%202026');
        await expect(root.locator('.dda-article-title')).toHaveText('October 2026 news');
        await expect(months.getByRole('link', { name: 'October 2026' })).toHaveAttribute('aria-current', 'page');
        await page.goBack();
        await expect(root.locator('.dda-month-title')).toContainText('November 2026');
        const opened = page.waitForEvent('popup');
        await root.locator('.dda-article-card').click();
        const popup = await opened;
        await expect(popup).toHaveURL(base + `/daily-dispatch/${view === 'student' ? 'student' : 'preview'}/` + article.id);
        await expect(popup.locator('[data-dispatch-renderer]')).toHaveAttribute('data-view', view);
        if (view === 'student') await expect(popup.locator('.ddp-container')).not.toContainText('TUTOR-ONLY ANSWER');
        await expect(popup.locator('.ddp-archives-list a').filter({ hasText: 'November 2026' })).toHaveAttribute('href', prefix + 'November%202026');
        await popup.close();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Archive fits viewport');
        await page.screenshot({ path: `/tmp/dashboard-dispatch-archives/${view}-${width}-${theme}.png`, fullPage: true });
      }
      if (width === 1440 && theme === 'light') {
        const path = '/daily-dispatch/student/archives/November%202026';
        fail = true;
        await page.goto(base + path, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('.dda-error')).toContainText('Failed to load articles');
        fail = false; empty = true;
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.locator('.dda-no-articles')).toContainText('No articles found for November 2026');
      }
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS ${width} ${theme}: exact student archive URL, direct reload, month links, browser back, correct student/tutor article mode`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
