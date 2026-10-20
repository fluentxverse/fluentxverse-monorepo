const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';
const lessons = [
  { id: 'lesson-one', level: 1, chapter: 1, lessonNumber: 1, lessonTitle: 'Lesson 1: Introductions', goalTextEn: 'Introduce yourself with confidence.' },
  { id: 'lesson-two', level: 3, chapter: 1, lessonNumber: 2, lessonTitle: 'Lesson 2: Workplace conversations', goalTextEn: 'Discuss your work and interests.' },
  { id: 'lesson-three', level: 3, chapter: 2, lessonNumber: 1, lessonTitle: 'Lesson 1: Travel plans', goalTextEn: 'Plan your next trip.', backgroundImage: '/assets/img/materials/conversational-skills.webp' },
];
const articles = Array.from({ length: 12 }, (_, i) => ({ id: 'article-' + i, title: 'Article ' + String(i).padStart(2, '0'), topic: i ? 'Science and discovery' : 'Workplace technology', category: i ? 'Science' : 'Technology', createdAt: '2026-10-' + String(i + 1).padStart(2, '0') + 'T02:00:00Z' }));
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1566, 768, 375, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
      await context.addInitScript(theme => { if (/^https?:$/.test(location.protocol)) localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })); }, theme);
      let fail = false;
      await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780)|https:\/\/api\.fluentxverse\.(?:com|xyz))\//, route => {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
        const path = new URL(route.request().url()).pathname;
        if (path.startsWith('/lesson-materials/published/') || path === '/dispatch') return fail ? route.fulfill({ status: 500, json: { error: 'Unavailable' } }) : route.fulfill({ json: path === '/dispatch' ? articles : { success: true, lessons } });
        return route.fulfill({ json: path === '/student/me' ? { success: true, user: { userId: 'library-fixture', role: 'student', givenName: 'Mika', walletAddress: '0x' + 'a'.repeat(40) } } : { success: true, data: [], profile: {}, lessons: [] } });
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const layout = async (course, state) => {
        await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
        await page.locator('.library-heading-art').evaluate(img => img.decode());
        const result = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, fits: [...document.querySelectorAll('.library-lesson,.library-heading,.library-field')].every(el => el.scrollWidth <= el.clientWidth), heading: document.querySelector('.library-back').getBoundingClientRect().top >= document.querySelector('.app-header-shell').getBoundingClientRect().bottom }));
        assert.equal(result.overflow, false); assert.ok(result.fits && result.heading, JSON.stringify(result));
        await page.screenshot({ path: '../output/screenshots/library-' + course + '-' + theme + '-' + width + '-' + state + '.png', fullPage: true });
      };
      for (const course of ['business-english', 'conversational-skills']) {
        await page.goto(base + '/materials/' + course, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'Level 1 1 lessons', exact: true }).waitFor();
        await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
        assert.equal(await page.getByRole('link', { name: 'Back to Materials' }).getAttribute('href'), '/materials');
        await layout(course, 'levels');
        await page.getByRole('button', { name: 'Level 1 1 lessons', exact: true }).click();
        await page.getByRole('button', { name: 'Chapter 1 1 lessons', exact: true }).click();
        assert.equal(await page.locator('.library-lesson').count(), 1);
        if (course === 'conversational-skills') {
          const link = page.getByRole('link', { name: 'Open Lesson 1: Introductions', exact: true });
          assert.equal(await link.getAttribute('href'), '/materials/conversational-skills/lesson-one');
          await link.focus(); assert.equal(await link.evaluate(el => el === document.activeElement), true);
        } else assert.equal(await page.locator('a.library-lesson').count(), 0);
        const search = page.getByRole('searchbox', { name: 'Search lessons' });
        await search.fill(' WORKPLACE ');
        assert.equal(await page.locator('.library-lesson').count(), 1);
        assert.match(await page.locator('.library-lesson h3').textContent(), /Workplace/);
        await page.getByRole('button', { name: 'Clear search', exact: true }).click();
        await page.getByLabel('Level', { exact: true }).selectOption('3');
        assert.equal(await page.locator('.library-lesson').count(), 2);
        await page.getByLabel('Chapter', { exact: true }).selectOption('2');
        assert.equal(await page.locator('.library-lesson').count(), 1);
        await page.locator('.library-lesson-cover img').evaluate(img => img.decode());
        assert.equal(await page.locator('.library-lesson-cover img').getAttribute('src'), '/assets/img/materials/conversational-skills.webp');
        await layout(course, 'filtered');
        await search.fill('not-found');
        await page.getByRole('heading', { name: 'No matching lessons' }).waitFor();
        await page.getByRole('button', { name: 'Clear filters', exact: true }).last().click();
        assert.equal(await page.getByLabel('Level', { exact: true }).inputValue(), '');
        assert.equal(await page.getByLabel('Chapter', { exact: true }).isDisabled(), true);
      }
      fail = true;
      await page.goto(base + '/materials/daily-dispatch', { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Unable to load materials' }).waitFor();
      fail = false;
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
      await page.getByRole('link', { name: 'Read Article 11', exact: true }).waitFor();
      assert.equal(await page.locator('.library-heading-art').getAttribute('src'), '/assets/img/home-icons/dispatch-v1.png');
      await page.locator('.library-heading-art').evaluate(img => img.decode());
      assert.equal(await page.locator('.library-heading-art').evaluate(img => img.naturalWidth), 512);
      assert.equal(await page.locator('.library-lesson').count(), 10);
      assert.equal(await page.getByRole('heading', { name: 'Unable to load materials' }).count(), 0);
      await layout('daily-dispatch', 'articles');
      await page.getByRole('button', { name: 'Next page' }).click();
      assert.equal(await page.locator('.library-lesson').count(), 2);
      await page.getByLabel('Category', { exact: true }).selectOption('Technology');
      assert.equal(await page.locator('.library-lesson').count(), 1);
      assert.equal(await page.getByRole('link', { name: 'Read Article 00', exact: true }).getAttribute('href'), '/materials/daily-dispatch/article-0');
      await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
      await page.getByLabel('Sort', { exact: true }).selectOption('Oldest');
      assert.equal(await page.locator('.library-lesson h3').first().textContent(), 'Article 00');
      await page.getByRole('searchbox', { name: 'Search articles' }).fill(' WORKPLACE ');
      assert.equal(await page.locator('.library-lesson').count(), 1);
      await layout('daily-dispatch', 'filtered');
      await page.getByRole('searchbox', { name: 'Search articles' }).fill('no-match');
      await page.getByRole('heading', { name: 'No matching articles' }).waitFor();
      await page.getByRole('button', { name: 'Clear filters', exact: true }).last().click();
      await page.getByLabel('Start date').fill('2026-10-11');
      assert.equal(await page.locator('.library-lesson').count(), 2);
      assert.deepEqual(errors, []);
      console.log('PASS Material libraries ' + theme + ' ' + width + ': levels, chapters, search, links, filters, retry, pagination, layout');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
