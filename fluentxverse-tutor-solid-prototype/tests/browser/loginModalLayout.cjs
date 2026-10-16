const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';
const screenshots = process.env.LOGIN_SCREENSHOTS || '/tmp/fluentxverse-tutor-login-layout';

async function checkFit(dialog, width, height) {
  await expect.poll(() => dialog.evaluate((el, height) => {
    const box = el.getBoundingClientRect();
    return box.top >= 15 && box.bottom <= height - 15;
  }, height)).toBe(true);
  const layout = await dialog.evaluate(el => {
    const rect = node => node.getBoundingClientRect().toJSON();
    return {
      box: rect(el), fits: el.scrollWidth <= el.clientWidth,
      form: rect(el.querySelector('.modal-form')),
      controls: [...el.querySelectorAll('.modal-input, .modal-btn')].map(rect),
      logo: rect(el.querySelector('.modal-logo')),
      close: rect(el.querySelector('.modal-close')),
    };
  });
  assert.ok(layout.fits, 'Dialog must not scroll horizontally');
  assert.ok(layout.box.left >= 16 && layout.box.right <= width - 16);
  assert.ok(layout.box.top >= 15 && layout.box.bottom <= height - 15);
  assert.ok(layout.logo.right <= layout.close.left, 'Brand does not overlap the close button');
  for (const control of layout.controls) {
    assert.ok(control.left >= layout.form.left && control.right <= layout.form.right + 1);
    assert.ok(control.right < layout.box.right, 'Controls stay inside the padded dialog');
    assert.ok(control.height >= 44);
  }
}

(async () => {
  await mkdir(screenshots, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const [width, height] of [[320, 568], [375, 760], [393, 851], [430, 932], [768, 900], [1440, 900]]) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
      const errors = [], writes = [];
      const failure = 'Unable to sign in. Please check your email and password, then try again. Reference: ' + 'a'.repeat(100);
      const headers = {
        'Access-Control-Allow-Origin': new URL(base).origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control, Pragma',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      };
      // Exercise errors without sending any credentials or writes to a real API.
      await context.route(/\/tutor\/me(?:\?.*)?$/, route => route.fulfill({ status: 401, headers, json: { success: false } }));
      await context.route(/\/tutor\/login(?:\?.*)?$/, route => {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        writes.push(route.request().method());
        return route.fulfill({ status: 401, headers, json: { success: false, error: failure } });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base);
      if (width < 768) await page.getByRole('button', { name: 'Open mobile menu', exact: true }).click();
      await page.getByRole('button', { name: 'Login', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Sign in to your account', exact: true });
      await expect(dialog).toBeVisible();
      await dialog.locator('.modal-logo img').evaluate(img => img.decode());
      await checkFit(dialog, width, height);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `${screenshots}/login-${width}.png` });
      await dialog.getByLabel('Email', { exact: true }).fill('layout-check@example.test');
      await dialog.getByLabel('Password', { exact: true }).fill('mocked-only-not-a-real-password');
      await dialog.getByRole('button', { name: 'Login', exact: true }).click();
      await expect(dialog.getByRole('alert')).toHaveText(failure);
      await checkFit(dialog, width, height);
      await page.screenshot({ path: `${screenshots}/login-error-${width}.png` });
      if (width === 375) {
        await page.setViewportSize({ width, height: 360 });
        await checkFit(dialog, width, 360);
        const apply = dialog.getByRole('button', { name: 'Apply for an account', exact: true });
        await apply.scrollIntoViewIfNeeded();
        const box = await dialog.boundingBox(), link = await apply.boundingBox();
        assert.ok(link.y >= box.y && link.y + link.height <= box.y + box.height, 'Footer remains reachable when keyboard reduces available height');
        await dialog.evaluate(el => { el.scrollTop = 0; });
        await page.screenshot({ path: `${screenshots}/login-short-viewport.png` });
      }
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      assert.equal(await page.evaluate(() => document.body.style.overflow), '');
      assert.deepEqual(writes, ['POST']);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS ${width}x${height}: no horizontal overflow, controls fit, error and keyboard-height layout`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
