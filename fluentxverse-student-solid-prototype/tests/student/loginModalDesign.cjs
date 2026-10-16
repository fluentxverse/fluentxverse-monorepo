const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const { mkdir } = require('node:fs/promises');
const assert = require('node:assert/strict');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';
const output = process.env.LOGIN_SCREENSHOTS || '/tmp/fluentxverse-login-modal';

(async () => {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const [width, height, theme, failure] of [[1440, 950, 'light', false], [375, 760, 'light', false], [320, 568, 'light', true], [1440, 950, 'dark', true], [375, 760, 'dark', false]]) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
      await context.addInitScript(failure => {
        if (!/^https?:$/.test(location.protocol)) return;
        localStorage.setItem('fxv_last_auth_provider', 'google');
        if (failure) sessionStorage.setItem('fxv_privy_auth_error', 'Sign-in could not be completed. Please check your connection and try again.');
      }, failure);
      const writes = [], errors = [];
      await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780)|https:\/\/api\.fluentxverse\.(?:com|xyz))\//, route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
        if (request.method() !== 'GET') { writes.push(path); throw Error('Design check must not create or sign in an account'); }
        if (path === '/student/me') return route.fulfill({ status: 401, json: { success: false } });
        if (path === '/lesson-passes/mode') return route.fulfill({ json: { success: true, data: { mode: 'trial', trialLessonLimit: 1 } } });
        if (path === '/tutor/search') return route.fulfill({ json: { success: true, data: { tutors: [], total: 0, hasMore: false } } });
        return route.fulfill({ json: { success: true, data: [], profile: {}, lessons: [] } });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/register');
      const opener = page.getByRole('button', { name: 'Sign in', exact: true });
      await opener.click();
      const dialog = page.getByRole('dialog', { name: 'Sign in or register' });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('.google-btn')).toBeEnabled({ timeout: 30000 });
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      await dialog.locator('.modal-logo img').evaluate(image => image.decode());
      await expect(dialog.locator('.student-dialog-art')).toHaveCount(0);
      await expect(dialog.locator('.social-btn')).toHaveCount(3);
      await expect(dialog.locator('.modal-brand-text')).toHaveText('FluentXVerse');
      await expect(dialog.locator('.last-used-badge')).toHaveText('Last used');
      if (failure) await expect(dialog.getByRole('alert')).toBeVisible();
      const geometry = await dialog.evaluate(element => {
        const modal = element.getBoundingClientRect();
        const logo = element.querySelector('.modal-logo').getBoundingClientRect();
        const brand = element.querySelector('.modal-brand-text').getBoundingClientRect();
        const buttons = [...element.querySelectorAll('.social-btn')].map(button => ({ width: button.clientWidth, scrollWidth: button.scrollWidth, height: button.getBoundingClientRect().height }));
        return { modal: modal.toJSON(), logo: logo.toJSON(), brand: brand.toJSON(), buttons, contentFits: element.scrollWidth <= element.clientWidth };
      });
      assert.ok(geometry.logo.width >= 72 && geometry.logo.height >= 82);
      assert.ok(Math.abs(geometry.logo.x + geometry.logo.width / 2 - (geometry.modal.x + geometry.modal.width / 2)) < 1, 'Logo must be centered');
      assert.ok(Math.abs(geometry.brand.x + geometry.brand.width / 2 - (geometry.modal.x + geometry.modal.width / 2)) < 1, 'Wordmark must be centered');
      assert.ok(geometry.contentFits && geometry.buttons.every(button => button.scrollWidth <= button.width));
      assert.ok(Math.max(...geometry.buttons.map(button => button.height)) - Math.min(...geometry.buttons.map(button => button.height)) < 1, 'Last-used badge must not change button height');
      assert.ok(geometry.modal.left >= 0 && geometry.modal.right <= width && geometry.modal.top >= 0 && geometry.modal.bottom <= height);
      await page.screenshot({ path: `${output}/login-${width}-${theme}${failure ? '-error' : ''}.png` });
      await expect(dialog.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms-of-service');
      await expect(dialog.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy-policy');
      await dialog.locator('.social-legal').scrollIntoViewIfNeeded();
      const legalFits = await dialog.locator('.social-legal').evaluate(element => {
        const legal = element.getBoundingClientRect(), box = element.closest('dialog').getBoundingClientRect();
        return legal.top >= box.top && legal.bottom <= box.bottom;
      });
      assert.ok(legalFits, 'Legal links must be reachable in a short viewport');
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
      assert.equal(await page.evaluate(() => document.body.style.overflow), '');
      await opener.click();
      await page.getByRole('button', { name: 'Close sign in' }).click();
      await expect(dialog).toHaveCount(0);
      assert.deepEqual(writes, []);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS login modal: ${width}x${height}, ${theme}, error=${failure}`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
