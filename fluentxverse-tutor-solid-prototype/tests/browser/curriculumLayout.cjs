const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';
const pages = [
  ['business-english', '.course-hero', '.lessons-search', '.lessons-grouped', '.lessons-empty'],
  ['conversational-skills', '.course-hero', '.lessons-search', '.lessons-grouped', '.lessons-empty'],
  ['daily-dispatch', '.dispatch-header-main', '.dispatch-search', '.dispatch-card', '.dispatch-empty'],
  ['young-learners', '.yl-page-header', '.yl-search-box', '.yl-levels-list', '.yl-empty'],
];
const lesson = { id: 'curriculum-layout', level: 1, chapter: 1, lessonNumber: 1, lessonName: 'Introductions', lessonTitle: 'Lesson 1: Introductions', levelBadge: 'Level 1', chapterLabel: 'Chapter 1: Introductions', goalTextEn: 'Introduce yourself clearly.' };

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  await fs.mkdir('../output/screenshots/tutor-curriculum', { recursive: true });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1566, 375, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })), theme);
      await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, route => {
        const path = new URL(route.request().url()).pathname;
        let json = { success: true, user: { userId: 'curriculum-design', email: 'paulanthonyarriola@gmail.com', firstName: 'Alex', role: 'tutor' }, data: { slots: [], notifications: [], unreadCount: 0 }, status: { passed: true }, lessons: [] };
        if (path.startsWith('/lesson-materials/published/')) json.lessons = [{ ...lesson, course: path.split('/').pop() }];
        if (path === '/young-learners/published') json.lessons = [{ ...lesson, unit: 1, theme: 'Introductions', unitLabel: 'Hello', mascot: 'sunny', ageGroup: '6-8' }];
        if (path === '/dispatch') json = [{ id: 'curriculum-article', title: 'Introductions in everyday life', topic: 'Communication', category: 'Education', createdAt: '2026-10-10T01:00:00Z' }];
        return route.fulfill({ json });
      });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      page.setDefaultNavigationTimeout(30000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const [slug, headerSelector, searchSelector, populatedSelector, emptySelector] of pages) {
        await page.goto(base + '/materials/' + slug, { waitUntil: 'domcontentloaded' });
        await page.locator(populatedSelector).first().waitFor();
        const art = page.locator(headerSelector + ' img.tutor-art');
        await art.evaluate(el => el.decode());
        const first = await art.boundingBox();
        const size = width > 600 ? 80 : 64;
        assert.equal(first.width, size, slug + ' artwork width');
        assert.equal(first.height, size, slug + ' artwork height');
        await page.waitForTimeout(250);
        const second = await art.boundingBox();
        assert(Math.abs(first.y - second.y) < 0.5, slug + ' artwork must not move');
        const header = await page.locator(headerSelector).boundingBox();
        assert(first.y >= header.y && first.y + first.height <= header.y + header.height + 1, slug + ' artwork stays within the header');
        assert(first.x >= header.x && first.x + first.width <= header.x + header.width + 1);
        const motion = await art.evaluate(el => ({
          image: getComputedStyle(el).animationName,
          parent: getComputedStyle(el.parentElement).animationName,
          decoration: getComputedStyle(el.closest('.course-hero') || el.parentElement, '::before').display,
        }));
        assert.equal(motion.image, 'none');
        assert.equal(motion.parent, 'none');
        if (headerSelector === '.course-hero') assert.equal(motion.decoration, 'none');
        const dashboard = await page.locator('.dashboard-header').boundingBox();
        assert(header.y >= dashboard.y + dashboard.height, slug + ' header is below navigation');
        const search = page.locator(searchSelector);
        const icon = await search.locator(':scope > svg').boundingBox();
        const input = search.locator('input');
        const inputRect = await input.boundingBox();
        const container = await search.boundingBox();
        assert.equal(container.height, 44, 'Stable search height');
        assert(Math.abs(icon.y + icon.height / 2 - inputRect.y - inputRect.height / 2) < 1, slug + ' icon vertically centered');
        const paddingLeft = await input.evaluate(el => parseFloat(getComputedStyle(el).paddingLeft));
        assert(icon.x + icon.width < inputRect.x + paddingLeft, slug + ' icon does not overlap typed text');
        assert(icon.y >= container.y && icon.y + icon.height <= container.y + container.height);
        if (headerSelector === '.course-hero') for (const select of await page.locator('.filter-select').all()) {
          const rect = await select.boundingBox();
          assert.equal(rect.height, container.height, 'Filter and search controls share a height');
          if (width > 1024) assert(Math.abs(rect.y - container.y) <= 1, 'Desktop controls share a baseline');
        }
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), slug + ' no page overflow');
        await page.screenshot({ path: `../output/screenshots/tutor-curriculum/${slug}-${theme}-${width}.png`, fullPage: true });
        if (headerSelector === '.course-hero') {
          const labels = await page.locator('.filter-label').all();
          const searchLabel = await page.getByText('Search', { exact: true }).boundingBox();
          for (const label of labels) {
            const rect = await label.boundingBox();
            const target = page.locator('#' + await label.getAttribute('for'));
            const control = await target.boundingBox();
            assert(rect.y + rect.height <= control.y, 'Filter label stays above its control');
            if (width > 1024) assert(Math.abs(rect.y - searchLabel.y) <= 1, 'Desktop labels share a baseline');
          }
          await page.getByText('Search', { exact: true }).click();
          assert(await input.evaluate(el => el === document.activeElement), 'Search label focuses its field');

          // The owning page CSS must work without the shared workspace overrides.
          await page.locator('.App').evaluate(el => el.classList.remove('tutor-workspace'));
          await page.waitForTimeout(350);
          assert.equal((await art.boundingBox()).width, size, 'Artwork size is defined by the page itself');
          assert.equal(await art.evaluate(el => getComputedStyle(el.parentElement).animationName), 'none');
          const { ownIcon, ownInput } = await search.evaluate(el => ({
            ownIcon: el.querySelector('svg').getBoundingClientRect().toJSON(),
            ownInput: el.querySelector('input').getBoundingClientRect().toJSON(),
          }));
          assert(Math.abs(ownIcon.y + ownIcon.height / 2 - ownInput.y - ownInput.height / 2) < 1, `${slug} ${theme} ${width}: page CSS centers its search icon ${JSON.stringify({ ownIcon, ownInput })}`);
          await page.locator('.App').evaluate(el => el.classList.add('tutor-workspace'));
          await page.waitForTimeout(350);
          await input.evaluate(el => el.blur());
          await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
        }
        await input.fill('no-match-curriculum-layout');
        await input.press('Tab');
        await page.locator(emptySelector).waitFor();
        assert.equal(await page.locator(populatedSelector).count(), 0, slug + ' search filters the results');
        if (slug === 'young-learners') await page.getByRole('button', { name: 'Clear search', exact: true }).click();
        else {
          await input.fill('');
          await input.press('Tab');
        }
        await page.locator(populatedSelector).first().waitFor();
        assert.deepEqual(errors, []);
      }
      console.log(`PASS curriculum ${theme} ${width}: four libraries, static uncropped artwork, aligned search and working filtering`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
