const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
  });
  const output = '../output/screenshots/tutor-quality';
  await fs.mkdir(output, { recursive: true });
  try {
    for (const width of [1566, 768, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      const requests = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route(/https:\/\/api\.fluentxverse\.(com|xyz)\//, route => {
        requests.push(route.request().url());
        if (route.request().url().includes('/tutor/search')) {
          return route.fulfill({ json: { success: true, tutors: [], total: 0, page: 1, limit: 12, hasMore: false } });
        }
        return route.fulfill({ status: 401, json: { success: false } });
      });
      await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
      const section = page.getByRole('region', { name: 'Your goals deserve a great tutor.' });
      await section.scrollIntoViewIfNeeded();
      await expect(section).toBeVisible();
      await expect(section.locator('.tutor-quality__standards > li')).toHaveCount(5);
      await expect(section.getByText(/stringent selection/)).toBeVisible();
      await expect(section.getByText(/expectations for punctuality/)).toBeVisible();
      await expect(section.locator('.tutor-quality__goals li')).toHaveCount(3);
      await expect(section.locator('img')).toHaveJSProperty('complete', true);
      assert(await section.locator('img').evaluate(image => image.naturalWidth > 0), 'Artwork loads');
      assert.equal(requests.some(url => url.includes('/tutor/')), false, 'Section needs no tutor API requests');
      for (const theme of ['light', 'dark']) {
        await page.evaluate(dark => document.body.classList.toggle('dark-mode', dark), theme === 'dark');
        assert.equal(await section.evaluate(element => getComputedStyle(element).getPropertyValue('--tq-accent').trim()), theme === 'dark' ? '#83b4ff' : '#0b55d9', 'Brand blue accents');
        const layout = await section.evaluate(element => {
          const bounds = element.getBoundingClientRect();
          const outside = [...element.querySelectorAll('h2, h3, p, a, img, li')].filter(child => {
            const box = child.getBoundingClientRect();
            return box.left < bounds.left - 1 || box.right > bounds.right + 1;
          });
          return { overflow: document.documentElement.scrollWidth > innerWidth, outside: outside.map(child => child.tagName) };
        });
        assert.equal(layout.overflow, false, `No page overflow at ${width}/${theme}`);
        assert.deepEqual(layout.outside, [], `Content stays within section at ${width}/${theme}`);
        await section.screenshot({ path: `${output}/${width}-${theme}.png` });
      }
      const link = section.getByRole('link', { name: 'Find your tutor' });
      await expect(link).toHaveAttribute('href', '/browse-tutors');
      await link.focus();
      await expect(link).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/browse-tutors$/);
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`PASS tutor quality ${width}: both themes, artwork, bounded content, keyboard navigation`);
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
