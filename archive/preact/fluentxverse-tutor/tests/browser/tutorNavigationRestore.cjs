// API fixtures keep navigation and visual checks away from production account data.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.TUTOR_TEST_URL || 'http://localhost:5181';
const user = { userId: 'navigation-design', firstName: 'Alex', lastName: 'Teacher', email: 'paulanthonyarriola@gmail.com', role: 'tutor' };

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  await fs.mkdir('../output/screenshots/tutor-navigation', { recursive: true });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1566, 1280, 1024, 375, 320]) {
      const height = width < 992 ? 667 : 900;
      const context = await browser.newContext({ viewport: { width, height } });
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })), theme);
      await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):8765)\//, route => {
        const path = new URL(route.request().url()).pathname;
        let json = { success: true, user, data: [], status: { passed: true } };
        if (path === '/schedule/week') json.data = { slots: [], weekStart: '2026-10-05', weekEnd: '2026-10-11' };
        if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        if (path.endsWith('/unread-count')) json.data = { unreadCount: 0 };
        return route.fulfill({ json });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/schedule', { waitUntil: 'networkidle' });
      await page.locator('.clock-time').filter({ hasText: /[AP]M/ }).waitFor();
      assert.equal(await page.locator('.tutor-header-nav,.tutor-header-brand').count(), 0);
      assert(await page.locator('.header-left').isVisible(), 'The original clock remains visible');
      assert.equal(await page.locator('.dashboard-header .fa-clock').count(), 1);
      const layout = await page.evaluate(() => {
        const rect = selector => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
        };
        const ticker = document.querySelector('.schedule-ticker');
        return {
          header: rect('.dashboard-header'), actions: rect('.dashboard-header-actions'),
          title: rect('.schedule-title-row'), ticker: rect('.schedule-ticker'), item: rect('.schedule-ticker-item'),
          padding: getComputedStyle(ticker).paddingTop,
          scrollWidth: document.documentElement.scrollWidth,
          borderRadius: getComputedStyle(document.querySelector('.dashboard-header')).borderRadius,
        };
      });
      assert.equal(layout.borderRadius, '0px', 'Original full-width header');
      assert(layout.actions.right <= width, 'Header actions stay within the viewport');
      assert(layout.title.top >= layout.header.bottom, 'Header does not cover the page heading');
      assert(layout.item.top >= layout.ticker.top + 1 && layout.item.bottom <= layout.ticker.bottom - 1, 'Ticker line and both borders fit without vertical clipping');
      assert.equal(layout.padding, '0px');
      assert(layout.scrollWidth <= width, 'No horizontal page overflow');
      const track = page.locator('.schedule-ticker-track');
      await page.mouse.move(0, 0);
      const firstTransform = await track.evaluate(el => getComputedStyle(el).transform);
      await page.waitForTimeout(150);
      assert.notEqual(await track.evaluate(el => getComputedStyle(el).transform), firstTransform, 'Announcement still scrolls');
      await page.locator('.schedule-ticker').hover();
      assert.equal(await track.evaluate(el => getComputedStyle(el).animationPlayState), 'paused');
      await page.screenshot({ path: `../output/screenshots/tutor-navigation/schedule-${theme}-${width}.png` });
      if (width < 992) {
        await page.getByRole('button', { name: 'Open menu', exact: true }).click();
        const drawer = page.getByRole('dialog', { name: 'Navigation', exact: true });
        await drawer.waitFor();
        await page.waitForTimeout(350);
        const box = await drawer.boundingBox();
        assert.equal(box.x, 0);
        assert.equal(box.y, 0);
        assert.equal(box.height, height);
        assert(box.width <= 320, 'Original slide-out menu width');
        assert.equal(await drawer.locator('.mobile-menu-nav i').count(), 7);
        assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
        await page.screenshot({ path: `../output/screenshots/tutor-navigation/menu-${theme}-${width}.png` });
        await page.keyboard.press('Escape');
        await drawer.waitFor({ state: 'detached' });
        assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
        await page.getByRole('button', { name: 'Open menu', exact: true }).click();
        await page.getByRole('dialog', { name: 'Navigation', exact: true }).getByRole('button', { name: 'Settings', exact: true }).click();
      } else {
        assert(await page.locator('.sidebar').isVisible());
        assert.equal(await page.locator('.sidebar-icon li.active i').count(), 1);
        assert.notEqual(await page.locator('.sidebar-icon li.active a').evaluate(el => getComputedStyle(el).boxShadow), 'none');
        await page.getByTitle('Settings', { exact: true }).click();
      }
      await page.getByRole('dialog', { name: 'Account settings', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      assert.deepEqual(errors, []);
      console.log(`PASS ${theme} ${width}: original header/sidebar, unclipped animated ticker, settings and mobile drawer`);
      await context.close();
    }
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):8765)\//, route => route.fulfill({ json: {
      success: true, user, data: { slots: [], notifications: [], unreadCount: 0 }, status: { passed: true },
    } }));
    const page = await context.newPage();
    await page.goto(base + '/schedule');
    await page.locator('.schedule-ticker-track').waitFor();
    assert.equal(await page.locator('.schedule-ticker-track').evaluate(el => getComputedStyle(el).animationName), 'none');
    assert.equal(await page.locator('.schedule-ticker').evaluate(el => getComputedStyle(el).overflowX), 'auto');
    console.log('PASS reduced motion: readable, manually scrollable announcement');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
