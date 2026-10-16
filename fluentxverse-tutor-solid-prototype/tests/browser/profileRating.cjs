const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';
const output = process.env.PROFILE_RATING_SCREENSHOTS || '/tmp/tutor-profile-rating';
const user = { userId: 'rating-check', firstName: 'Alex', lastName: 'Teacher', email: 'rating@example.test', role: 'tutor' };

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  await fs.mkdir(output, { recursive: true });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1440, 768, 375, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })), theme);
      let rating = 5, totalReviews = 1;
      const writes = [], errors = [];
      await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, route => {
        const request = route.request();
        if (!['GET', 'OPTIONS'].includes(request.method())) { writes.push(request.url()); return route.abort(); }
        const path = new URL(request.url()).pathname;
        const json = { success: true, user, data: [], status: { passed: true } };
        if (path === '/tutor/profile') json.data = { ...user, rating, totalReviews, profileStatus: 'approved', interests: [], education: [] };
        if (path.includes('/personal-info')) json.data = user;
        if (path === '/schedule/week') json.data = { slots: [] };
        if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        if (path.endsWith('/unread-count')) json.data = { unreadCount: 0 };
        return route.fulfill({ json });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      for (const sample of [{ rating: 5, count: 1 }, { rating: 0, count: 0 }, { rating: 3.2, count: 12 }]) {
        rating = sample.rating; totalReviews = sample.count;
        await page.goto(base + '/profile', { waitUntil: 'domcontentloaded' });
        const row = page.locator('.my-profile-page .profile-rating-row');
        await expect(row.locator('.rating-score')).toHaveText(rating.toFixed(1));
        await expect(row.locator('.rating-count')).toHaveText(`(${totalReviews} ${totalReviews === 1 ? 'review' : 'reviews'})`);
        await expect(row.getByRole('img')).toHaveAttribute('aria-label', `Rated ${rating.toFixed(1)} out of 5`);
        await expect(row.locator('svg.filled')).toHaveCount(Math.round(rating));
        await expect(row.locator('svg.empty')).toHaveCount(5 - Math.round(rating));
        const styles = await row.locator('.star-rating svg').evaluateAll(stars => stars.map(star => ({
          filled: star.classList.contains('filled'), color: getComputedStyle(star).color, fill: getComputedStyle(star).fill,
          width: star.getBoundingClientRect().width,
        })));
        for (const star of styles) {
          assert.equal(star.width, 18);
          if (star.filled) { assert.equal(star.color, 'rgb(245, 158, 11)'); assert.equal(star.fill, star.color); }
          else assert.equal(star.fill, 'none');
        }
        if (width <= 768) {
          const alignment = await row.evaluate(row => {
            const r = row.getBoundingClientRect();
            const children = [...row.children].map(child => child.getBoundingClientRect());
            return { parent: r.left + r.width / 2, content: (Math.min(...children.map(r => r.left)) + Math.max(...children.map(r => r.right))) / 2 };
          });
          assert(Math.abs(alignment.parent - alignment.content) < 2, 'Mobile rating contents are centered');
        } else assert.equal(await row.evaluate(row => getComputedStyle(row).justifyContent), 'normal');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        if (rating === 5) await page.screenshot({ path: `${output}/${theme}-${width}.png`, animations: 'disabled' });
      }
      assert.deepEqual(writes, []);
      assert.deepEqual(errors, []);
      console.log(`PASS ${theme} ${width}: centered mobile rating, filled/empty SVG stars, score and review counts`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
