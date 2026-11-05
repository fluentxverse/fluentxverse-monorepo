const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5291';
const article = { id: 'tools-fixture', title: 'Youth sports today', category: 'Sports', topic: 'Games', createdAt: '2026-11-05T01:00:00Z', warmUpQuestions: ['Which sports do you enjoy?'], vocabulary: [], articleContent: { paragraphs: [{ id: 'one', text: 'Young athletes meet at international events.', comprehensionQuestion: null }], source: 'UI fixture' }, summaryQuestion: '', discussionA: { topic: 'Sports', questions: ['What do you watch?'] }, discussionB: { topic: '', questions: [] } };
const older = { id: 'older-fixture', title: 'Olympic & youth memories', topic: 'History', category: 'Sports', createdAt: '2020-01-01T00:00:00Z', status: 'published' };
const library = [...Array.from({ length: 60 }, (_, index) => ({ ...older, id: 'recent-' + index, title: 'Recent article ' + index, createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString() })), older];
const textContrast = locator => locator.evaluate(el => {
  const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
  const lum = value => rgb(value).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
  const a = lum(getComputedStyle(el).color), b = lum(getComputedStyle(el).backgroundColor);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
});

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  fs.mkdirSync('/tmp/tutor-dispatch-tools', { recursive: true });
  try {
    for (const width of [1440, 390, 320]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme });
      await context.addInitScript(theme => { if (/^https?:$/.test(location.protocol)) localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme }, version: 2 })); }, theme);
      let failLibrary = false, libraryReads = 0;
      await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(?:localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, route => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/dispatch/tools-fixture') return route.fulfill({ json: article });
        if (path === '/dispatch/classroom-library') { libraryReads++; return route.fulfill({ status: failLibrary ? 503 : 200, json: { success: !failLibrary, articles: library } }); }
        if (path === '/dispatch') throw Error('Search must use the complete published library, not the latest 50 articles');
        const json = { success: true, user: { userId: 'tools-tutor', id: 'tools-tutor', role: 'tutor', firstName: 'Test', email: 'fixture@example.invalid' }, data: [], archives: [{ month: 'November 2026', count: 2 }, { month: 'October 2026', count: 1 }] };
        if (path === '/proof/tutor-certification/me') json.data = { snapshot: { writtenPassed: true, speakingPassed: true, profileApproved: true, interviewPassed: true, missingRequirements: [] } };
        if (path.startsWith('/dispatch/archives/')) json.articles = [{ ...article, title: decodeURIComponent(path.split('/').at(-1)) + ' news', excerpt: 'A clear introduction to the news and discussion topics.' }];
        if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        return route.fulfill({ json });
      });
      const page = await context.newPage(), errors = [];
      page.setDefaultTimeout(15000);
      page.on('pageerror', error => errors.push(error.message));
      if (width === 1440) {
        for (const mode of ['', '?mode=student']) {
          await page.goto(base + '/materials/daily-dispatch/tools-fixture' + mode, { waitUntil: 'domcontentloaded' });
          const search = page.getByRole('search');
          const button = search.getByRole('button', { name: 'Search', exact: true });
          await button.hover();
          await expect(button).toHaveCSS('background-color', 'rgb(230, 184, 0)');
          assert(await textContrast(button) >= 4.5, 'Search hover remains readable');
          await search.getByRole('searchbox', { name: 'Search article titles' }).fill('  Olympic & youth  ');
          if (mode) await page.keyboard.press('Enter'); else await button.click();
          await expect(page).toHaveURL(url => url.pathname === '/materials/daily-dispatch' && url.searchParams.get('search') === 'Olympic & youth');
          await expect(page.getByLabel('Search articles', { exact: true })).toHaveValue('Olympic & youth');
          await expect(page.locator('.dispatch-card-title')).toHaveText([older.title]);
          await page.reload({ waitUntil: 'domcontentloaded' });
          await expect(page.locator('.dispatch-card-title')).toHaveText([older.title]);
          await page.getByLabel('Search articles', { exact: true }).fill('no matching story');
          await expect(page.getByRole('heading', { name: 'No articles found', exact: true })).toBeVisible();
          await page.getByLabel('Search articles', { exact: true }).fill('  Olympic & youth  ');
          await expect(page.locator('.dispatch-card-title')).toHaveText([older.title]);
        }
        failLibrary = true;
        await page.goto(base + '/materials/daily-dispatch?search=Olympic', { waitUntil: 'domcontentloaded' });
        await expect(page.locator('.dispatch-error')).toBeVisible();
        failLibrary = false;
        await page.getByRole('button', { name: 'Try Again', exact: true }).click();
        await expect(page.locator('.dispatch-error')).toHaveCount(0);
        await expect(page.locator('.dispatch-card-title')).toHaveText([older.title]);
        assert(libraryReads > 0);
      }
      await page.goto(base + '/materials/daily-dispatch/archives/November%202026', { waitUntil: 'domcontentloaded' });
      const root = page.locator('.dda-page');
      await expect(root).toHaveAttribute('data-theme', theme, { timeout: 30000 });
      await expect(root.locator('.ddp-header-bar')).toHaveCSS('background-color', 'rgb(18, 18, 18)');
      await expect(root).toHaveCSS('background-color', theme === 'dark' ? 'rgb(26, 26, 26)' : 'rgb(255, 255, 255)');
      await expect(root.locator('.dda-content')).toHaveCSS('background-color', theme === 'dark' ? 'rgb(26, 26, 26)' : 'rgb(255, 255, 255)');
      const card = root.locator('.dda-article-card').first();
      await expect(card).toHaveCSS('background-color', theme === 'dark' ? 'rgb(26, 26, 26)' : 'rgb(255, 255, 255)');
      const contrast = await card.locator('h2,p').evaluateAll(elements => {
        const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
        const lum = value => rgb(value).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((s,v,i) => s + v * [.2126,.7152,.0722][i],0);
        return elements.map(el => { const a = lum(getComputedStyle(el).color), b = lum(getComputedStyle(el.closest('.dda-article-card')).backgroundColor); return (Math.max(a,b)+.05)/(Math.min(a,b)+.05); });
      });
      assert(contrast.every(value => value >= 4.5), 'Archive content is readable: ' + contrast);
      assert(await textContrast(card.locator('.dda-article-category-tag')) >= 4.5, 'Category label remains readable on yellow');
      const nav = page.getByRole('complementary', { name: 'Archive navigation' });
      await expect(nav).toBeVisible();
      const header = await root.locator('.ddp-header-bar').boundingBox(), main = await root.locator('.dda-content').boundingBox();
      assert(main.y >= header.y + header.height, 'Archive starts below the black header');
      await nav.getByRole('link', { name: 'October 2026', exact: true }).click();
      await expect(page.locator('.dda-month-title')).toContainText('October 2026');
      await expect(page.locator('.dda-article-title')).toHaveText('October 2026 news');
      await expect(page.getByRole('link', { name: 'October 2026', exact: true })).toHaveAttribute('aria-current', 'page');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow');
      await page.screenshot({ path: `/tmp/tutor-dispatch-tools/${width}-${theme}.png`, fullPage: true });
      assert.deepEqual(errors, []);
      console.log(`PASS ${width} ${theme}: black archive header, readable themed content, month navigation${width === 1440 ? ', hover, click/Enter search, older results, reload, empty state, retry' : ''}`);
      await context.close();
    }
    const system = await browser.newContext({ viewport: { width: 1440, height: 950 }, colorScheme: 'light' });
    await system.addInitScript(() => { if (/^https?:$/.test(location.protocol)) localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: 'system' }, version: 2 })); });
    await system.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(?:localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, route => {
      const path = new URL(route.request().url()).pathname;
      const json = { success: true, user: { userId: 'system-tutor', role: 'tutor', firstName: 'Test', email: 'fixture@example.invalid' }, data: [], archives: [] };
      if (path.startsWith('/dispatch/archives/')) json.articles = [article];
      if (path === '/proof/tutor-certification/me') json.data = { snapshot: { writtenPassed: true, speakingPassed: true, profileApproved: true, interviewPassed: true, missingRequirements: [] } };
      if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
      return route.fulfill({ json });
    });
    const page = await system.newPage();
    await page.goto(base + '/materials/daily-dispatch/archives/November%202026', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.dda-page')).toHaveAttribute('data-theme', 'light', { timeout: 30000 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('.dda-page')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('.ddp-header-bar')).toHaveCSS('background-color', 'rgb(18, 18, 18)');
    await system.close();
    console.log('PASS system theme changes update the archive without changing the black header');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
