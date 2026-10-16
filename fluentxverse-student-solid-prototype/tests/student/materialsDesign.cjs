const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1566, 1024, 768, 375, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
      await context.addInitScript(theme => { if (location.protocol === 'http:' || location.protocol === 'https:') localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })); }, theme);
      await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780)|https:\/\/api\.fluentxverse\.(?:com|xyz))\//, route => {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
        const path = new URL(route.request().url()).pathname;
        return route.fulfill({ json: path === '/student/me' ? { success: true, user: { userId: 'materials-fixture', role: 'student', givenName: 'Mika', walletAddress: '0x' + 'a'.repeat(40) } } : { success: true, data: [], profile: {}, lessons: [] } });
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/materials', { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Learning materials', exact: true }).waitFor();
      await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
      const search = page.getByRole('searchbox', { name: 'Search learning materials' });
      assert.equal(await page.locator('.materials-course').count(), 3);
      assert.deepEqual(await page.locator('.materials-course-art img').evaluateAll(async images => { await Promise.all(images.map(img => img.decode())); return images.map(img => img.getAttribute('src')); }), [
        '/assets/img/materials/business-english.webp', '/assets/img/materials/conversational-skills.webp', '/assets/img/materials/daily-dispatch.webp',
      ]);
      for (const [title, path] of [['Business English', 'business-english'], ['Conversational Skills', 'conversational-skills'], ['Daily Dispatch', 'daily-dispatch']]) assert.equal(await page.getByRole('link', { name: 'Open ' + title, exact: true }).getAttribute('href'), '/materials/' + path);
      assert.equal(await page.getByRole('link', { name: 'Book a Lesson', exact: true }).getAttribute('href'), '/browse-tutors');
      const layout = async state => {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        const result = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          fits: [...document.querySelectorAll('.materials-course,.materials-collections button,.materials-empty')].every(el => el.scrollWidth <= el.clientWidth),
          heading: document.querySelector('.materials-heading').getBoundingClientRect().top >= document.querySelector('.app-header-shell').getBoundingClientRect().bottom,
        }));
        assert.equal(result.overflow, false); assert.ok(result.fits && result.heading, JSON.stringify(result));
        await page.screenshot({ path: '../output/screenshots/materials-' + theme + '-' + width + '-' + state + '.png', fullPage: true });
      };
      await layout('all');
      const first = page.getByRole('link', { name: 'Open Business English', exact: true });
      await first.focus();
      assert.equal(await first.evaluate(el => el === document.activeElement), true);
      await page.getByRole('button', { name: 'Curriculum', exact: true }).click();
      assert.equal(await page.locator('.materials-course').count(), 2);
      assert.equal(await page.getByRole('link', { name: 'Open Daily Dispatch', exact: true }).count(), 0);
      await search.fill('  WORKPLACE  ');
      assert.equal(await page.locator('.materials-course').count(), 1);
      assert.equal(await page.locator('.materials-course h2').textContent(), 'Business English');
      await page.getByRole('button', { name: 'Clear search', exact: true }).click();
      assert.equal(await page.locator('.materials-course').count(), 2);
      assert.equal(await page.getByRole('button', { name: 'Curriculum', exact: true }).getAttribute('aria-pressed'), 'true');
      await layout('curriculum');
      await page.getByRole('button', { name: 'Daily Dispatch', exact: true }).click();
      assert.equal(await page.locator('.materials-course').count(), 1);
      await search.fill('news');
      assert.equal(await page.locator('.materials-course').count(), 1);
      await search.fill('unmatched'.repeat(30));
      await page.getByRole('heading', { name: 'No matching materials', exact: true }).waitFor();
      await layout('empty');
      await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
      assert.equal(await search.inputValue(), '');
      assert.equal(await page.locator('.materials-course').count(), 3);
      assert.equal(await page.getByRole('button', { name: 'All materials', exact: true }).getAttribute('aria-pressed'), 'true');
      assert.deepEqual(errors, []);
      console.log('PASS Materials ' + theme + ' ' + width + ': original images, links, filters, search, empty state, layout');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
