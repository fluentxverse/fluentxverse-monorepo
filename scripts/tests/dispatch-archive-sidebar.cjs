const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5292';
const months = ['November 2026', 'October 2026', 'May 2026', 'April 2026', 'March 2026', 'February 2026', 'January 2026'];

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  fs.mkdirSync('/tmp/dispatch-archive-sidebar', { recursive: true });
  try {
    for (const width of [1440, 900, 390, 320]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 950 }, colorScheme: theme });
      await context.addInitScript(theme => { if (/^https?:$/.test(location.protocol)) localStorage.setItem('theme-storage', JSON.stringify({ state: { isDarkMode: theme === 'dark' }, version: 2 })); }, theme);
      await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(?:localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, route => {
        const path = new URL(route.request().url()).pathname;
        const json = { success: true, user: { userId: 'archive-fixture', role: 'student', email: 'fixture@example.invalid' }, data: [] };
        if (path === '/dispatch/archives') json.archives = months.map(month => ({ month, count: 8 }));
        if (path.startsWith('/dispatch/archives/')) {
          const month = decodeURIComponent(path.slice('/dispatch/archives/'.length));
          json.articles = Array.from({ length: 8 }, (_, index) => ({ id: 'fixture-' + index, title: `${month} article ${index + 1}`, createdAt: '2026-11-05T01:00:00Z', excerpt: 'A short introduction to the news story and its key discussion points.', category: 'Sports', topic: 'International events' }));
        }
        if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        return route.fulfill({ json });
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.setDefaultTimeout(10000);
      await page.goto(base + '/materials/daily-dispatch/archives/November%202026', { waitUntil: 'domcontentloaded' });
      const root = page.locator('.dispatch-archive'), sidebar = page.getByRole('complementary', { name: 'Archive navigation' });
      await expect(root).toHaveAttribute('data-theme', theme, { timeout: 30000 }).catch(async error => { console.error({ url: page.url(), errors, body: await page.locator('body').innerText() }); throw error; });
      await expect(sidebar).toBeVisible();
      await expect(sidebar.getByRole('link')).toHaveCount(7);
      await expect(sidebar.getByRole('link', { name: 'November 2026 (8)', exact: true })).toHaveAttribute('aria-current', 'page');
      const contrast = await sidebar.locator('h3,a,.ddp-archive-count').evaluateAll(elements => {
        const rgb = value => value.match(/[\d.]+/g).map(Number);
        const luminance = rgb => rgb.slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, index) => sum + v * [.2126, .7152, .0722][index], 0);
        return elements.map(el => {
          let node = el, background = 'rgb(255, 255, 255)';
          while (node) { const value = getComputedStyle(node).backgroundColor; if ((rgb(value)[3] ?? 1) !== 0) { background = value; break; } node = node.parentElement; }
          const a = luminance(rgb(getComputedStyle(el).color)), b = luminance(rgb(background));
          return { text: el.textContent, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
        });
      });
      assert(contrast.every(item => item.ratio >= 4.5), JSON.stringify(contrast));
      const header = await root.locator('.ddp-header-bar').boundingBox(), nav = await sidebar.boundingBox(), content = await root.locator('.dda-content').boundingBox();
      assert(nav.y >= header.y + header.height, 'Header does not cover the archive navigation');
      assert(content.y >= header.y + header.height, 'Header does not cover the archive title');
      if (width <= 900) assert(nav.y < content.y, 'Month selection stays available above articles on mobile');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow');
      await sidebar.getByRole('link', { name: 'October 2026 (8)', exact: true }).click();
      await expect(page).toHaveURL(base + '/materials/daily-dispatch/archives/October%202026');
      await expect(page.locator('.dda-month-title')).toContainText('October 2026');
      await expect(sidebar.getByRole('link', { name: 'October 2026 (8)', exact: true })).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('.dda-article-title').first()).toHaveText('October 2026 article 1');
      const november = sidebar.getByRole('link', { name: 'November 2026 (8)', exact: true });
      await november.focus(); await page.keyboard.press('Enter');
      await expect(page.locator('.dda-month-title')).toContainText('November 2026');
      await page.screenshot({ path: `/tmp/dispatch-archive-sidebar/${width}-${theme}.png`, fullPage: true });
      if (width > 900) {
        await page.evaluate(() => window.scrollTo(0, 600));
        const stickyHeader = await root.locator('.ddp-header-bar').boundingBox(), stickySidebar = await sidebar.boundingBox();
        assert(stickySidebar.y >= stickyHeader.y + stickyHeader.height, 'Sticky month navigation stays below the header');
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${width} ${theme}: readable archive links and counts, selected month, mouse/keyboard navigation, no overlap`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
