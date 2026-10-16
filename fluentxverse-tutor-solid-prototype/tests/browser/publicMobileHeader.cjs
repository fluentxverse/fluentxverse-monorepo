const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';
const screenshots = process.env.HEADER_SCREENSHOTS || '/tmp/fluentxverse-tutor-mobile-header';

function checkCentered(button, icon) {
  assert.ok(Math.abs(button.x + button.width / 2 - icon.x - icon.width / 2) < 1);
  assert.ok(Math.abs(button.y + button.height / 2 - icon.y - icon.height / 2) < 1);
}

(async () => {
  fs.mkdirSync(screenshots, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [320, 375, 393, 430, 768, 991, 992, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 900 }, colorScheme: 'dark' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      // Keep the test in the public, unauthenticated state without touching accounts.
      await page.route('**/tutor/me', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Unauthorized"}' }));
      await page.goto(base, { waitUntil: 'networkidle' });
      await page.locator('.hero-title').waitFor();
      const trigger = page.getByRole('button', { name: 'Open mobile menu', exact: true });
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

      if (width < 992) {
        const geometry = await trigger.evaluate(button => {
          const rect = el => el.getBoundingClientRect().toJSON();
          return {
            button: rect(button), icon: rect(button.querySelector('svg')),
            nav: rect(button.closest('.menu-nav')),
            brand: rect(document.querySelector('#sticky-header .brand-text')),
            display: getComputedStyle(button).display,
          };
        });
        assert.equal(geometry.button.width, 44);
        assert.equal(geometry.button.height, 44);
        assert.equal(geometry.icon.width, 24);
        assert.equal(geometry.display, 'flex');
        checkCentered(geometry.button, geometry.icon);
        assert.ok(geometry.brand.right + 5 <= geometry.button.left, 'Brand and menu do not overlap');
        assert.ok(geometry.button.right <= geometry.nav.right + 1);
        assert.ok(Math.abs(geometry.button.y + 22 - geometry.nav.y - geometry.nav.height / 2) < 1);
        await page.screenshot({ path: `${screenshots}/home-${width}.png` });

        await trigger.focus();
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', { name: 'Navigation', exact: true });
        await dialog.waitFor({ state: 'visible' });
        assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
        assert.equal(await trigger.getAttribute('aria-controls'), 'tutor-public-navigation');
        assert.equal(await page.locator('#tutor-public-navigation').evaluate(el => getComputedStyle(el).opacity), '1');
        assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
        const close = dialog.getByRole('button', { name: 'Close mobile menu' });
        assert.equal(await close.evaluate(el => document.activeElement === el), true);
        checkCentered(await close.boundingBox(), await close.locator('svg').boundingBox());
        const logo = await dialog.locator('.mobile-logo').boundingBox();
        assert.ok(logo.x + logo.width <= (await close.boundingBox()).x, 'Menu brand and close control do not overlap');
        assert.equal(await dialog.evaluate(el => el.scrollWidth > el.clientWidth), false);
        for (const name of ['Home', 'About', 'Contact']) {
          assert.equal(await dialog.getByRole('link', { name, exact: true }).isVisible(), true);
        }
        assert.equal(await dialog.getByRole('link', { name: 'Apply Now', exact: true }).count(), 0);
        assert.equal(await dialog.locator('.mobile-menu-actions button').count(), 1);
        assert.equal(await dialog.getByRole('button', { name: 'Login', exact: true }).isVisible(), true);
        const borders = await dialog.evaluate(el => [...el.querySelectorAll('.mobile-menu, .menu-box, .menu-outer, .mobile-menu-header, .mobile-nav, .navigation li, .mobile-menu-actions, .social-links')].map(node => {
          const style = getComputedStyle(node);
          return [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth];
        }));
        assert.ok(borders.flat().every(value => value === '0px'), 'No leftover panel or navigation divider lines');
        const socialLinks = dialog.locator('.social-links a');
        assert.equal(await socialLinks.count(), 3);
        const brands = [
          ['LinkedIn', 'https://www.linkedin.com/company/fluentxverse', 'ri-linkedin-fill'],
          ['Facebook', 'https://www.facebook.com/fluentxverse', 'ri-facebook-fill'],
          ['X', 'https://x.com/FluentXverse', 'ri-twitter-x-fill'],
        ];
        await page.evaluate(() => document.fonts.load('24px remixicon', '\uf3e6\uecbc\ueeb5'));
        assert.ok(await page.evaluate(() => [...document.fonts].some(font => font.family === 'remixicon' && font.status === 'loaded')));
        for (const [label, href, icon] of brands) {
          const link = dialog.getByRole('link', { name: label, exact: true });
          assert.equal(await link.getAttribute('href'), href);
          assert.equal(await link.getAttribute('target'), '_blank');
          assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
          assert.equal(await link.textContent(), '');
          const mark = link.locator(`i.${icon}`);
          assert.equal(await mark.getAttribute('aria-hidden'), 'true');
          checkCentered(await link.boundingBox(), await mark.boundingBox());
        }
        await dialog.locator('.mobile-logo img').evaluate(img => img.decode());
        await page.screenshot({ path: `${screenshots}/menu-${width}.png` });

        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'detached' });
        assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
        assert.equal(await trigger.evaluate(el => document.activeElement === el), true);
        assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');

        await page.keyboard.press('Space');
        await close.click();
        await dialog.waitFor({ state: 'detached' });
        await trigger.click();
        await page.mouse.click(2, 2);
        await dialog.waitFor({ state: 'detached' });
        await trigger.click();
        await dialog.getByRole('link', { name: 'About', exact: true }).click();
        await page.waitForURL('**/about');
        await dialog.waitFor({ state: 'detached' });
        assert.equal(await trigger.isVisible(), true);
        await trigger.click();
        await dialog.getByRole('link', { name: 'Home', exact: true }).click();
        await page.waitForURL(base + '/');
        await dialog.waitFor({ state: 'detached' });
      } else {
        assert.equal(await trigger.isVisible(), false);
        assert.equal(await page.locator('#sticky-header .navbar-wrap').isVisible(), true);
        await page.screenshot({ path: `${screenshots}/home-${width}.png` });
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: header layout, menu visibility, keyboard and navigation`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
