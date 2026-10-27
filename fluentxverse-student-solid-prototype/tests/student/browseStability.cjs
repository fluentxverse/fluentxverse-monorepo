const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';
const reproduce = process.env.BROWSE_EXPECT_SHIFT === '1';

(async () => {
  const browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'], executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-features=OverlayScrollbar'] });
  const output = '../output/screenshots/browse-stability';
  await fs.mkdir(output, { recursive: true });
  try {
    for (const authenticated of (reproduce ? [false] : [false, true])) for (const width of (reproduce ? [1566] : [1566, 375])) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const user = { userId: 'stability-student', role: 'student', firstName: 'Student', email: 'stability@example.com' };
      let mode = 'empty';
      await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780)|https:\/\/api\.fluentxverse\.(?:com|xyz))\//, async route => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/student/me') return route.fulfill({ status: authenticated ? 200 : 401, json: authenticated ? { success: true, user } : { success: false } });
        if (path === '/tutor/search') {
          const current = mode;
          await new Promise(resolve => setTimeout(resolve, 450));
          const tutors = current === 'populated' ? Array.from({ length: 9 }, (_, i) => ({ userId: `layout-${i}`, firstName: 'Sample', lastName: `Tutor ${i}`, displayName: `Sample Tutor ${i}`, isAvailable: true, tier: 1 })) : [];
          return route.fulfill({ json: { success: true, data: { tutors, total: tutors.length, hasMore: false, page: 1, limit: 12 } } });
        }
        return route.fulfill({ json: { success: true, user, data: [], lessons: [] } });
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/browse-tutors', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.browse-empty')).toBeVisible();
      await page.addStyleTag({ content: 'html { scrollbar-width: auto; } html::-webkit-scrollbar { width: 16px; }' });
      await page.evaluate(() => document.fonts.ready);
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
        for (const nextMode of ['empty', 'populated', 'empty']) {
          mode = nextMode;
          await page.evaluate(() => {
            window.__browseSamples = [];
            window.__sampleBrowse = true;
            const sample = () => {
              const box = document.querySelector('.browse-container').getBoundingClientRect();
              const heading = document.querySelector('.browse-page-heading').getBoundingClientRect();
              window.__browseSamples.push({ x: box.x, width: box.width, heading: heading.x, scrolls: document.documentElement.scrollHeight > innerHeight, client: document.documentElement.clientWidth });
              if (window.__sampleBrowse) requestAnimationFrame(sample);
            };
            sample();
          });
          const days = page.locator('.browse-day-strip button');
          const selected = await days.evaluateAll(buttons => buttons.findIndex(button => button.getAttribute('aria-pressed') === 'true'));
          await days.nth((selected + 1) % 7).click();
          await expect(page.locator('.browse-grid')).toHaveAttribute('aria-busy', 'true');
          await expect(page.locator('.browse-grid')).toHaveAttribute('aria-busy', 'false');
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const samples = await page.evaluate(() => { window.__sampleBrowse = false; return window.__browseSamples; });
          const spread = key => Math.max(...samples.map(sample => sample[key])) - Math.min(...samples.map(sample => sample[key]));
          if (reproduce) {
            console.log({ states: [...new Set(samples.map(sample => JSON.stringify(sample)))], scrollbar: await page.evaluate(() => ({ inner: innerWidth, root: document.documentElement.clientWidth, body: document.body.clientWidth })) });
            assert(spread('x') > 1 || spread('width') > 1, 'Original page reproduces scrollbar-driven horizontal shift');
            console.log(`REPRODUCED: horizontal movement ${spread('x')}px, width change ${spread('width')}px`);
            await context.close();
            return;
          }
          assert(spread('x') < 1 && spread('width') < 1 && spread('heading') < 1, `Stable ${authenticated ? 'app' : 'public'} ${width}/${theme}/${nextMode}: ${JSON.stringify(samples)}`);
          assert(samples.some(sample => sample.scrolls), 'Test exercises overflowing results/skeletons');
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        }
        await page.screenshot({ path: `${output}/${authenticated ? 'app' : 'public'}-${width}-${theme}.png`, fullPage: true });
      }
      if (width === 375) {
        const before = await page.locator('.browse-container').boundingBox();
        await page.getByRole('button', { name: 'Filters', exact: true }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toBeHidden();
        const after = await page.locator('.browse-container').boundingBox();
        assert(Math.abs(before.x - after.x) < 1 && Math.abs(before.width - after.width) < 1, 'Closing filters preserves layout');
      }
      assert.deepEqual(errors, []);
      console.log(`PASS stable day filtering ${authenticated ? 'app' : 'public'} ${width}: loading, empty and populated results; both themes`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
