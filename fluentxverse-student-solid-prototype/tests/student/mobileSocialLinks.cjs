const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';
const output = process.env.SOCIAL_SCREENSHOTS || '/tmp/fluentxverse-student-mobile-social';
const links = [
  ['LinkedIn', 'https://www.linkedin.com/company/fluentxverse', 'ri-linkedin-fill'],
  ['Facebook', 'https://www.facebook.com/fluentxverse', 'ri-facebook-fill'],
  ['X', 'https://x.com/FluentXverse', 'ri-twitter-x-fill'],
];

(async () => {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [320, 375, 430, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce' });
      const errors = [], writes = [];
      await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780)|https:\/\/api\.fluentxverse\.(?:com|xyz))\//, route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
        if (request.method() !== 'GET') {
          writes.push(path);
          return route.abort();
        }
        if (path === '/student/me') return route.fulfill({ status: 401, json: { success: false } });
        if (path === '/lesson-passes/mode') return route.fulfill({ json: { success: true, data: { mode: 'trial', trialLessonLimit: 1 } } });
        return route.fulfill({ json: { success: true, data: [], profile: {}, lessons: [] } });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/register');
      const menu = page.locator('.mobile-menu');
      const socials = menu.locator('.social-links');
      await expect(socials.locator('a')).toHaveCount(3);
      for (const [label, href, icon] of links) {
        const link = socials.getByRole('link', { name: label, exact: true, includeHidden: true });
        await expect(link).toHaveAttribute('href', href);
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        await expect(link.locator(`i.${icon}`)).toHaveAttribute('aria-hidden', 'true');
        assert.equal(await link.textContent(), '', 'No text-placeholder icons');
      }
      if (width < 992) {
        await page.getByRole('button', { name: 'Open mobile menu' }).click();
        await expect(menu).toBeVisible();
        await socials.scrollIntoViewIfNeeded();
        await page.evaluate(() => document.fonts.load('24px remixicon', '\uf3e6\uecbc\ueeb5'));
        assert.ok(await page.evaluate(() => [...document.fonts].some(font => font.family === 'remixicon' && font.status === 'loaded')), 'Real brand-icon font loaded');
        for (const [label] of links) {
          const link = socials.getByRole('link', { name: label, exact: true });
          const box = await link.boundingBox(), icon = await link.locator('i').boundingBox();
          assert.equal(box.width, 44);
          assert.equal(box.height, 44);
          assert.ok(box.x >= 0 && box.x + box.width <= width);
          assert.ok(Math.abs(box.x + 22 - icon.x - 12) < 1);
          assert.ok(Math.abs(box.y + 22 - icon.y - 12) < 1);
          assert.notEqual(await link.locator('i').evaluate(el => getComputedStyle(el, '::before').content), 'none');
        }
        await page.screenshot({ path: `${output}/menu-${width}.png` });
        await page.getByRole('button', { name: 'Close mobile menu' }).click();
        assert.equal(await page.evaluate(() => document.body.classList.contains('mobile-menu-visible')), false);
      } else {
        await expect(menu).toBeHidden();
        await page.screenshot({ path: `${output}/register-${width}.png` });
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(writes, []);
      await context.close();
      console.log(`PASS ${width}px: three correct social links, branded icons, layout`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
