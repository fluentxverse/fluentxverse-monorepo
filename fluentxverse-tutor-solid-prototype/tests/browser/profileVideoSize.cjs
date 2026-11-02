const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  fs.mkdirSync('/tmp/fluentxverse-profile-video', { recursive: true });
  try {
    for (const width of [1566, 1024, 768, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === base) return route.continue();
        let json = { success: true, data: [] };
        if (url.pathname === '/tutor/me') json.user = { userId: 'video-size-fixture', firstName: 'Test', role: 'tutor', email: 'test@example.invalid' };
        if (url.pathname === '/tutor/profile') json.data = { firstName: 'Test', bio: 'Tutor introduction', videoIntroUrl: 'https://media.example.invalid/introduction.webm', education: [], interests: [] };
        if (url.pathname === '/proof/tutor-certification/me') json.data = { snapshot: { writtenPassed: true, speakingPassed: true, interviewPassed: true, profileApproved: true, missingRequirements: [] }, credential: { status: 'retired' } };
        if (url.pathname === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        if (url.pathname === '/notifications/unread-count') json.data = { unreadCount: 0 };
        if (url.hostname === 'media.example.invalid') return route.fulfill({ status: 204 });
        return route.fulfill({ json });
      });
      await page.goto(`${base}/profile`, { waitUntil: 'networkidle' });
      const player = page.locator('.hero-video-container .fxv-video-player');
      await expect(player).toBeVisible();
      const bounds = await player.boundingBox();
      assert.ok(bounds.width <= 561 && bounds.width > 150, 'Preview is compact and visible');
      assert.ok(Math.abs(bounds.width / bounds.height - 16 / 9) < .02, 'Video keeps its aspect ratio');
      const wrapper = await page.locator('.hero-video-container').boundingBox();
      assert.ok(Math.abs(wrapper.width - bounds.width) < 2, 'Replace overlay tracks the preview width');
      await expect(page.locator('.hero-video-container input[type=file]')).toHaveCount(1);
      const fullscreen = await player.evaluate(async el => { await el.requestFullscreen(); return document.fullscreenElement === el; });
      assert.equal(fullscreen, true);
      await page.evaluate(() => document.exitFullscreen());
      await expect(player).toHaveCSS('aspect-ratio', '16 / 9');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `/tmp/fluentxverse-profile-video/profile-${width}.png`, fullPage: true });
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: compact 16:9 preview, responsive width, replacement and fullscreen`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
